import type { CameraTransform, LayerTransform } from "../types/story";

export interface StageKeyframePosition {
  id: string;
  progress: number;
}

export type StageTransformEditTarget =
  | { kind: "base" }
  | { kind: "keyframe"; keyframeId: string };

export interface StagePoint {
  x: number;
  y: number;
}

export function shotProgressFromTrackPointer(clientX: number, trackLeft: number, trackWidth: number): number | undefined {
  if (!Number.isFinite(clientX) || !Number.isFinite(trackLeft) || !Number.isFinite(trackWidth) || trackWidth <= 0) return undefined;
  const progress = clamp((clientX - trackLeft) / trackWidth, 0, 1);
  return Math.round(progress * 1000) / 1000;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function pointerDeltaInFrame(delta: StagePoint, frameScale: number): StagePoint {
  if (!Number.isFinite(frameScale) || frameScale <= 0) return { x: 0, y: 0 };
  return { x: delta.x / frameScale, y: delta.y / frameScale };
}

export function resolveLayerTransformEditTarget(
  keyframes: readonly StageKeyframePosition[],
  selectedKeyframeId: string | undefined,
  playhead: number,
): StageTransformEditTarget | undefined {
  if (keyframes.length === 0) return { kind: "base" };
  const selectedKeyframe = keyframes.find((keyframe) => keyframe.id === selectedKeyframeId);
  if (!selectedKeyframe || Math.abs(selectedKeyframe.progress - playhead) > 1e-9) return undefined;
  return { kind: "keyframe", keyframeId: selectedKeyframe.id };
}

export function moveLayerFromPointerDelta(
  start: Pick<LayerTransform, "x" | "y">,
  delta: StagePoint,
  camera: CameraTransform,
  viewport: StagePoint,
): Pick<LayerTransform, "x" | "y"> {
  if (viewport.x <= 0 || viewport.y <= 0 || camera.scale <= 0) return start;

  const radians = camera.rotation * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const scale = camera.scale / 100;
  const localX = (cosine * delta.x + sine * delta.y) / scale;
  const localY = (-sine * delta.x + cosine * delta.y) / scale;

  return {
    x: clamp(start.x + localX / viewport.x * 100, 0, 100),
    y: clamp(start.y + localY / viewport.y * 100, 0, 100),
  };
}

export function scaleFromPointerDistance(
  startScale: number,
  startDistance: number,
  currentDistance: number,
  minimum: number,
  maximum: number,
): number {
  if (startDistance <= 0 || !Number.isFinite(currentDistance)) return startScale;
  return clamp(startScale * currentDistance / startDistance, minimum, maximum);
}

export function pointerAngle(point: StagePoint, pivot: StagePoint): number {
  return Math.atan2(point.y - pivot.y, point.x - pivot.x);
}

export function rotationFromPointerAngles(startRotation: number, startAngle: number, currentAngle: number): number {
  const delta = Math.atan2(Math.sin(currentAngle - startAngle), Math.cos(currentAngle - startAngle)) * 180 / Math.PI;
  return ((startRotation + delta + 180) % 360 + 360) % 360 - 180;
}