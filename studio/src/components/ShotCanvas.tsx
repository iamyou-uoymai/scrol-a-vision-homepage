import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import heroScene from "../../../assets/hero-scene.jpg";
import travelerArtwork from "../../../assets/traveler.svg";
import type { CompositionCue, LayerTransform, Shot, VisualLayer } from "../types/story";
import { DEFAULT_CAMERA_TRANSFORM, evaluateAnimationTrack } from "../data/animation";
import { fitFrameInViewport, UNIVERSAL_FRAME_SIZE } from "../data/viewportFrame";
import type { FittedFrame } from "../data/viewportFrame";
import { moveLayerFromPointerDelta, pointerAngle, pointerDeltaInFrame, rotationFromPointerAngles, scaleFromPointerDistance } from "../data/stageInteraction";
import type { StageTransformEditTarget } from "../data/stageInteraction";
import type { StudioSelectionProjection } from "../data/studioSelection";
import type { ActiveCompositionPreview } from "../data/compositionPreview";

interface ShotCanvasProps {
  shot: Shot;
  playhead?: number;
  resolvedPreview?: ActiveCompositionPreview;
  selection: StudioSelectionProjection["stage"];
  selectedCue?: CompositionCue;
  narrativeSelectionLabel?: string;
  transformEditTarget?: StageTransformEditTarget;
  transformEditMessage?: string;
  editable?: boolean;
  onLayerSelect: (id: string) => void;
  onLayerTransformChange: (id: string, update: Partial<LayerTransform>, target: StageTransformEditTarget) => void;
}

function layerFrameStyle(layer: VisualLayer, transform: LayerTransform): CSSProperties {
  const { x, y, scale, rotation } = transform;
  return {
    left: `${x}%`,
    top: `${y}%`,
    width: layer.kind === "background" ? "100%" : layer.kind === "character" ? "24%" : "38%",
    height: layer.kind === "background" ? "100%" : layer.kind === "character" ? "72%" : "auto",
    transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale / 100})`,
  };
}

function layerStyle(layer: VisualLayer, transform: LayerTransform): CSSProperties {
  return { ...layerFrameStyle(layer, transform), opacity: transform.opacity / 100 };
}

type TransformMode = "move" | "scale" | "rotate";

interface PointerGesture {
  pointerId: number;
  layerId: string;
  mode: TransformMode;
  target: StageTransformEditTarget;
  startTransform: LayerTransform;
  startClient: { x: number; y: number };
  pivot: { x: number; y: number };
  stageSize: { x: number; y: number };
  frameScale: number;
  camera: import("../types/story").CameraTransform;
  startDistance: number;
  startAngle: number;
  moved: boolean;
}

interface TransformControlPositions {
  rotation: { x: number; y: number };
  scale: { x: number; y: number };
}

function distanceBetween(first: { x: number; y: number }, second: { x: number; y: number }): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function ShotCanvas({ shot, playhead = 0, resolvedPreview, selection, selectedCue, narrativeSelectionLabel, transformEditTarget, transformEditMessage, editable = true, onLayerSelect, onLayerTransformChange }: ShotCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const selectionFrameRef = useRef<HTMLDivElement>(null);
  const repositionControlsRef = useRef<() => void>(() => undefined);
  const gestureRef = useRef<PointerGesture | undefined>(undefined);
  const [fittedFrame, setFittedFrame] = useState<FittedFrame>({ left: 0, top: 0, width: 0, height: 0, scale: 0 });
  const [activeManipulation, setActiveManipulation] = useState<TransformMode>();
  const [controlPositions, setControlPositions] = useState<TransformControlPositions>();
  const selectedLayerId = selection.selectedLayerId;
  const preview = resolvedPreview?.shot.id === shot.id ? resolvedPreview : undefined;
  const camera = preview?.cameraTransform ?? evaluateAnimationTrack(shot.animation.camera, playhead) ?? DEFAULT_CAMERA_TRANSFORM;
  const worldStyle: CSSProperties = {
    transform: `translate3d(${camera.x}%, ${camera.y}%, 0) rotate(${camera.rotation}deg) scale(${camera.scale / 100})`,
  };
  const selectedLayer = shot.layers.find((layer) => layer.id === selectedLayerId);
  const selectedLayerTransform = selectedLayer
    ? preview?.layerTransforms[selectedLayer.id] ?? evaluateAnimationTrack(shot.animation.layers[selectedLayer.id], playhead) ?? selectedLayer.transform
    : undefined;
  const scaleBounds = transformEditTarget?.kind === "keyframe" ? { minimum: 20, maximum: 300 } : { minimum: 40, maximum: 160 };

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateFrame = () => {
      const next = fitFrameInViewport(viewport.clientWidth, viewport.clientHeight);
      setFittedFrame((current) => current.left === next.left
        && current.top === next.top
        && current.width === next.width
        && current.height === next.height
        ? current
        : next);
    };
    const observer = new ResizeObserver(updateFrame);
    observer.observe(viewport);
    updateFrame();
    return () => observer.disconnect();
  }, []);

  repositionControlsRef.current = () => {
    const viewport = viewportRef.current;
    const frame = selectionFrameRef.current;
    if (!viewport || !frame || !selectedLayer) {
      setControlPositions(undefined);
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const inset = 10;
    const localPoint = (x: number, y: number) => ({
      x: Math.max(inset, Math.min(viewport.clientWidth - inset, x - viewportRect.left - viewport.clientLeft)),
      y: Math.max(inset, Math.min(viewport.clientHeight - inset, y - viewportRect.top - viewport.clientTop)),
    });
    const positions = {
      rotation: localPoint(frameRect.left + frameRect.width / 2, frameRect.top - 16),
      scale: localPoint(frameRect.right - 8, frameRect.bottom - 8),
    };
    setControlPositions((current) => current
      && Math.abs(current.rotation.x - positions.rotation.x) < 0.1
      && Math.abs(current.rotation.y - positions.rotation.y) < 0.1
      && Math.abs(current.scale.x - positions.scale.x) < 0.1
      && Math.abs(current.scale.y - positions.scale.y) < 0.1
      ? current
      : positions);
  };

  useLayoutEffect(() => {
    repositionControlsRef.current();
  }, [selectedLayerId, selectedLayerTransform?.x, selectedLayerTransform?.y, selectedLayerTransform?.scale, selectedLayerTransform?.rotation, camera.x, camera.y, camera.scale, camera.rotation]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !selectedLayer) return;
    const observer = new ResizeObserver(() => repositionControlsRef.current());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [selectedLayerId, shot.id]);

  function finishGesture(pointerId: number, restore: boolean) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== pointerId) return;
    gestureRef.current = undefined;
    setActiveManipulation(undefined);
    if (restore && gesture?.moved) {
      onLayerTransformChange(gesture.layerId, gesture.startTransform, gesture.target);
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!editable || event.button !== 0 || gestureRef.current) return;
    const target = event.target instanceof Element ? event.target : null;
    const handle = target?.closest<HTMLButtonElement>("[data-stage-transform-handle]");
    const layerElement = target?.closest<HTMLElement>("[data-stage-layer-id]");
    const layerId = layerElement?.dataset.stageLayerId;
    const mode = (handle?.dataset.stageTransformHandle as TransformMode | undefined) ?? "move";
    if (!layerId || layerId !== selectedLayerId || !transformEditTarget || !selectedLayerTransform || !worldRef.current) return;

    const boundsElement = selectionFrameRef.current;
    const frameElement = frameRef.current;
    if (!boundsElement || !frameElement || frameElement.offsetWidth <= 0) return;
    const bounds = boundsElement.getBoundingClientRect();
    const frameBounds = frameElement.getBoundingClientRect();
    const pivot = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
    const startClient = { x: event.clientX, y: event.clientY };
    const startTransform = { ...selectedLayerTransform };
    gestureRef.current = {
      pointerId: event.pointerId,
      layerId,
      mode,
      target: transformEditTarget,
      startTransform,
      startClient,
      pivot,
      stageSize: { x: worldRef.current.offsetWidth, y: worldRef.current.offsetHeight },
      frameScale: frameBounds.width / frameElement.offsetWidth,
      camera,
      startDistance: distanceBetween(startClient, pivot),
      startAngle: pointerAngle(startClient, pivot),
      moved: false,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
    setActiveManipulation(mode);
    event.preventDefault();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const point = { x: event.clientX, y: event.clientY };
    if (!gesture.moved && distanceBetween(point, gesture.startClient) < 3) return;
    gesture.moved = true;

    if (gesture.mode === "move") {
      const position = moveLayerFromPointerDelta(
        gesture.startTransform,
        pointerDeltaInFrame(
          { x: point.x - gesture.startClient.x, y: point.y - gesture.startClient.y },
          gesture.frameScale,
        ),
        gesture.camera,
        gesture.stageSize,
      );
      onLayerTransformChange(gesture.layerId, position, gesture.target);
    } else if (gesture.mode === "scale") {
      const scale = scaleFromPointerDistance(
        gesture.startTransform.scale,
        gesture.startDistance,
        distanceBetween(point, gesture.pivot),
        scaleBounds.minimum,
        scaleBounds.maximum,
      );
      onLayerTransformChange(gesture.layerId, { scale }, gesture.target);
    } else {
      const rotation = rotationFromPointerAngles(
        gesture.startTransform.rotation,
        gesture.startAngle,
        pointerAngle(point, gesture.pivot),
      );
      onLayerTransformChange(gesture.layerId, { rotation }, gesture.target);
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    finishGesture(event.pointerId, false);
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    finishGesture(event.pointerId, true);
  }

  function handleKeyboardTransform(event: ReactKeyboardEvent<HTMLButtonElement>, mode: "scale" | "rotate") {
    if (!editable || !selectedLayer || !selectedLayerTransform || !transformEditTarget || !["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : -1;
    const step = direction * (event.shiftKey ? 5 : 1);
    const update = mode === "scale"
      ? { scale: Math.max(scaleBounds.minimum, Math.min(scaleBounds.maximum, selectedLayerTransform.scale + step)) }
      : { rotation: Math.max(-180, Math.min(180, selectedLayerTransform.rotation + step)) };
    onLayerTransformChange(selectedLayer.id, update, transformEditTarget);
  }

  return (
    <div className="canvas-surround" data-selected-object={`${selection.object.domain}-${selection.object.kind}`} data-selected-object-id={selection.object.id} data-preview-shot-id={preview?.shot.id} data-traversal-position={preview?.traversalProgress} data-shot-local-position={preview?.shotProgress}>
      <div className="canvas-toolbar"><span>COMPOSITION</span><span>1080 x 1920 <i /> FIT</span></div>
      {selection.narrativeSelection && (
        <p className="canvas-selection-note" data-testid="stage-narrative-selection">
          {`${selection.object.kind} selected: ${narrativeSelectionLabel ?? selection.object.id}. No composition link. Showing ${shot.title}.`}
        </p>
      )}
      {selection.object.domain === "composition" && selection.object.kind === "cue" && selectedCue && (
        <p className="canvas-selection-note" data-testid="stage-cue-selection">Cue selected: {selectedCue.label}</p>
      )}
      {selectedLayer && transformEditMessage && (
        <p className="canvas-selection-note" data-testid="stage-transform-status">{transformEditMessage}</p>
      )}
      <div
        className="composition-viewport"
        ref={viewportRef}
        data-manipulating={activeManipulation}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handlePointerCancel}
      >
        <div
          className="composition-frame"
          data-logical-frame="1080x1920"
          ref={frameRef}
          style={{
            left: fittedFrame.left,
            top: fittedFrame.top,
            width: UNIVERSAL_FRAME_SIZE.width,
            height: UNIVERSAL_FRAME_SIZE.height,
            transform: `scale(${fittedFrame.scale})`,
          }}
        >
        <div className="canvas-world" style={worldStyle} ref={worldRef}>
          <div className="scene-light" aria-hidden="true" />
          {shot.layers.map((layer) => {
            const transform = preview?.layerTransforms[layer.id] ?? evaluateAnimationTrack(shot.animation.layers[layer.id], playhead) ?? layer.transform;
            return (
              <button
                type="button"
                className={`canvas-layer layer-${layer.kind}${selectedLayerId === layer.id ? " is-selected" : ""}${selectedLayerId === layer.id && editable && transformEditTarget ? " can-manipulate" : ""}`}
                style={layerStyle(layer, transform)}
                key={layer.id}
                data-stage-layer-id={layer.id}
                aria-label={`Select layer: ${layer.name}`}
                aria-pressed={selectedLayerId === layer.id}
                onClick={() => {
                  if (layer.id !== selectedLayerId) onLayerSelect(layer.id);
                }}
              >
                {layer.kind === "background" ? (
                  <span className="background-art" style={{ backgroundImage: `url("${heroScene}")` }} />
                ) : layer.kind === "character" ? (
                  <img className="character-artwork" src={travelerArtwork} alt="Traveler silhouette" />
                ) : (
                  <span className="dialogue-artwork">
                    {layer.speaker && <strong>{layer.speaker}</strong>}
                    {layer.text}
                  </span>
                )}
                {selectedLayerId === layer.id && <span className="layer-label">{layer.name}</span>}
              </button>
            );
          })}
        </div>
        {selectedLayer && selectedLayerTransform && (
          <div className="canvas-controls-world" style={worldStyle} aria-label={`${selectedLayer.name} transform controls`}>
            <div
              className={`canvas-selection-frame${activeManipulation ? ` is-manipulating manipulation-${activeManipulation}` : ""}`}
              style={layerFrameStyle(selectedLayer, selectedLayerTransform)}
              ref={selectionFrameRef}
              data-stage-selection-frame
              data-stage-layer-id={selectedLayer.id}
            >
              {selectedLayer.kind === "dialogue" && (
                <span className="dialogue-artwork canvas-selection-measure" aria-hidden="true">
                  {selectedLayer.speaker && <strong>{selectedLayer.speaker}</strong>}
                  {selectedLayer.text}
                </span>
              )}
            </div>
          </div>
        )}
        <span className="canvas-safe-area" aria-hidden="true" />
        <div className="canvas-caption"><span>SHOT 01</span><span>THE CROSSING</span></div>
        </div>
        {selectedLayer && controlPositions && (
          <div className="canvas-controls-screen" aria-label={`${selectedLayer.name} transform controls`}>
            <button
              type="button"
              className="canvas-transform-handle canvas-rotation-handle"
              style={{ left: controlPositions.rotation.x, top: controlPositions.rotation.y }}
              data-stage-transform-handle="rotate"
              data-stage-layer-id={selectedLayer.id}
              aria-label={`Rotate ${selectedLayer.name} around its center`}
              title="Rotate around layer center"
              disabled={!editable || !transformEditTarget}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => handleKeyboardTransform(event, "rotate")}
            />
            <button
              type="button"
              className="canvas-transform-handle canvas-scale-handle"
              style={{ left: controlPositions.scale.x, top: controlPositions.scale.y }}
              data-stage-transform-handle="scale"
              data-stage-layer-id={selectedLayer.id}
              aria-label={`Scale ${selectedLayer.name} uniformly from its center`}
              title="Scale uniformly from layer center"
              disabled={!editable || !transformEditTarget}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => handleKeyboardTransform(event, "scale")}
            />
          </div>
        )}
      </div>
      <div className="canvas-footnote"><span>Selected shot composition</span><span>Autosaved locally</span></div>
    </div>
  );
}