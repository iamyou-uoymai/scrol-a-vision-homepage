import type { CSSProperties } from "react";
import heroScene from "../../../assets/hero-scene.jpg";
import travelerArtwork from "../../../assets/traveler.svg";
import type { Shot, VisualLayer } from "../types/story";
import { DEFAULT_CAMERA_TRANSFORM, evaluateAnimationTrack } from "../data/animation";

interface ShotCanvasProps {
  shot: Shot;
  playhead?: number;
  selectedLayerId?: string;
  onLayerSelect: (id: string) => void;
}

function layerStyle(layer: VisualLayer, transform: VisualLayer["transform"]): CSSProperties {
  const { x, y, scale, rotation, opacity } = transform;
  return {
    left: `${x}%`,
    top: `${y}%`,
    width: layer.kind === "background" ? "100%" : layer.kind === "character" ? "24%" : "38%",
    height: layer.kind === "background" ? "100%" : layer.kind === "character" ? "72%" : "auto",
    opacity: opacity / 100,
    transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale / 100})`,
  };
}

export function ShotCanvas({ shot, playhead = 0, selectedLayerId, onLayerSelect }: ShotCanvasProps) {
  const camera = evaluateAnimationTrack(shot.animation.camera, playhead) ?? DEFAULT_CAMERA_TRANSFORM;
  const worldStyle: CSSProperties = {
    transform: `translate3d(${camera.x}%, ${camera.y}%, 0) rotate(${camera.rotation}deg) scale(${camera.scale / 100})`,
  };

  return (
    <div className="canvas-surround">
      <div className="canvas-toolbar"><span>COMPOSITION</span><span>16:10 <i /> 100%</span></div>
      <div className="composition-viewport">
        <div className="canvas-world" style={worldStyle}>
          <div className="scene-light" aria-hidden="true" />
          {shot.layers.map((layer) => {
            const transform = evaluateAnimationTrack(shot.animation.layers[layer.id], playhead) ?? layer.transform;
            return (
              <button
                type="button"
                className={`canvas-layer layer-${layer.kind}${selectedLayerId === layer.id ? " is-selected" : ""}`}
                style={layerStyle(layer, transform)}
                key={layer.id}
                aria-label={`Select layer: ${layer.name}`}
                aria-pressed={selectedLayerId === layer.id}
                onClick={() => onLayerSelect(layer.id)}
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
        <span className="canvas-safe-area" aria-hidden="true" />
        <div className="canvas-caption"><span>SHOT 01</span><span>THE CROSSING</span></div>
      </div>
      <div className="canvas-footnote"><span>Selected shot composition</span><span>Changes are not saved</span></div>
    </div>
  );
}