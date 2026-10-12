import type { ChangeEvent } from "react";
import type { AnimationKeyframe, AnimationTarget, KeyframeUpdate } from "../types/story";

interface KeyframeInspectorProps {
  keyframe: AnimationKeyframe;
  target: AnimationTarget;
  targetLabel: string;
  onUpdate: (update: KeyframeUpdate) => void;
  onRemove: () => void;
}

type TransformField = "x" | "y" | "scale" | "rotation" | "opacity";

const layerFields: { key: TransformField; label: string; min: number; max: number; suffix: string }[] = [
  { key: "x", label: "X position", min: 0, max: 100, suffix: "%" },
  { key: "y", label: "Y position", min: 0, max: 100, suffix: "%" },
  { key: "scale", label: "Scale", min: 20, max: 300, suffix: "%" },
  { key: "rotation", label: "Rotation", min: -180, max: 180, suffix: "°" },
  { key: "opacity", label: "Opacity", min: 0, max: 100, suffix: "%" },
];

const cameraFields = [
  { key: "x", label: "X position", min: -100, max: 100, suffix: "%" },
  { key: "y", label: "Y position", min: -100, max: 100, suffix: "%" },
  { key: "scale", label: "Scale", min: 20, max: 300, suffix: "%" },
  { key: "rotation", label: "Rotation", min: -180, max: 180, suffix: "°" },
] as const;

export function KeyframeInspector({ keyframe, target, targetLabel, onUpdate, onRemove }: KeyframeInspectorProps) {
  const fields = target.type === "camera" ? cameraFields : layerFields;
  const transform = keyframe.transform;
  const values: Record<TransformField, number> = {
    x: transform.x,
    y: transform.y,
    scale: transform.scale,
    rotation: transform.rotation,
    opacity: "opacity" in transform ? transform.opacity : 100,
  };

  function handleTransformChange(key: TransformField, event: ChangeEvent<HTMLInputElement>) {
    const patch = { [key]: Number(event.target.value) } as NonNullable<KeyframeUpdate["transform"]>;
    onUpdate({ transform: patch });
  }

  return (
    <aside className="inspector-panel keyframe-inspector" aria-label="Keyframe properties">
      <div className="panel-heading"><h2>Keyframe</h2><span className="track-chip">{targetLabel}</span></div>
      <div className="field-row keyframe-meta-fields">
        <label className="field-group">
          <span>Position</span>
          <span className="number-field-wrap">
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={Number((keyframe.progress * 100).toFixed(1))}
              aria-label="Keyframe position"
              onChange={(event) => {
                const progress = Number(event.target.value) / 100;
                if (Number.isFinite(progress)) onUpdate({ progress });
              }}
            />
            <i>%</i>
          </span>
        </label>
        <label className="field-group">
          <span>Ease to next</span>
          <select
            className="keyframe-easing-select"
            value={keyframe.easing}
            aria-label="Keyframe easing"
            onChange={(event) => onUpdate({ easing: event.target.value as AnimationKeyframe["easing"] })}
          >
            <option value="linear">Linear</option>
            <option value="ease-in-out">Ease in / out</option>
          </select>
        </label>
      </div>
      <div className="property-fields keyframe-transform-fields">
        {fields.map((field) => (
          <label className="property-field" key={field.key}>
            <span className="property-label">{field.label}</span>
            <span className="range-value">{values[field.key]}{field.suffix}</span>
            <input
              className="keyframe-transform-input"
              type="number"
              min={field.min}
              max={field.max}
              step="0.1"
              value={Number(values[field.key].toFixed(1))}
              aria-label={`Keyframe ${field.label}`}
              onChange={(event) => handleTransformChange(field.key, event)}
            />
          </label>
        ))}
      </div>
      <button type="button" className="destructive-action" onClick={onRemove}>Remove keyframe</button>
    </aside>
  );
}