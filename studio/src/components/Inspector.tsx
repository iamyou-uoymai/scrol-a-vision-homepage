import type { ChangeEvent } from "react";
import type { StoryBeat, VisualLayer, VisualLayerUpdate } from "../types/story";

interface InspectorProps {
  layer?: VisualLayer;
  beat?: StoryBeat;
  onLayerUpdate: (update: VisualLayerUpdate) => void;
  onBeatUpdate: (update: Partial<StoryBeat>) => void;
  onBeatRemove: () => void;
}

const transformFields = [
  { key: "x", label: "X position", min: 0, max: 100, suffix: "%" },
  { key: "y", label: "Y position", min: 0, max: 100, suffix: "%" },
  { key: "scale", label: "Scale", min: 40, max: 160, suffix: "%" },
  { key: "rotation", label: "Rotation", min: -180, max: 180, suffix: "°" },
  { key: "opacity", label: "Opacity", min: 0, max: 100, suffix: "%" },
] as const;

export function Inspector({ layer, beat, onLayerUpdate, onBeatUpdate, onBeatRemove }: InspectorProps) {
  if (beat) {
    return (
      <aside className="inspector-panel" aria-label="Beat properties">
        <div className="panel-heading"><h2>Beat</h2><span className={`track-chip track-${beat.track}`}>{beat.track}</span></div>
        <label className="field-label" htmlFor="beat-label">Name</label>
        <input id="beat-label" className="text-field" value={beat.label} onChange={(event) => onBeatUpdate({ label: event.target.value })} />
        <div className="field-row">
          <label className="field-group"><span>Start</span><span className="number-field-wrap"><input type="number" min="0" max={Math.floor((1 - beat.duration) * 100)} value={Math.round(beat.start * 100)} onChange={(event) => onBeatUpdate({ start: Math.min(1 - beat.duration, Math.max(0, Number(event.target.value) / 100)) })} /><i>%</i></span></label>
          <label className="field-group"><span>Length</span><span className="number-field-wrap"><input type="number" min="1" max={Math.floor((1 - beat.start) * 100)} value={Math.round(beat.duration * 100)} onChange={(event) => onBeatUpdate({ duration: Math.min(1 - beat.start, Math.max(0.01, Number(event.target.value) / 100)) })} /><i>%</i></span></label>
        </div>
        <button type="button" className="destructive-action" onClick={onBeatRemove}>Remove beat</button>
      </aside>
    );
  }

  if (!layer) {
    return <aside className="inspector-panel" aria-label="Properties"><div className="empty-inspector">Select a layer or beat to inspect it.</div></aside>;
  }

  function handleTransformChange(key: typeof transformFields[number]["key"], event: ChangeEvent<HTMLInputElement>) {
    const transform: Partial<VisualLayer["transform"]> = {};
    transform[key] = Number(event.target.value);
    onLayerUpdate({ transform });
  }

  return (
    <aside className="inspector-panel" aria-label="Layer properties">
      <div className="panel-heading"><h2>Inspector</h2><span className={`layer-type type-${layer.kind}`}>{layer.kind}</span></div>
      <label className="field-label" htmlFor="layer-name">Name</label>
      <input id="layer-name" className="text-field" value={layer.name} onChange={(event) => onLayerUpdate({ name: event.target.value })} />
      <div className="transform-heading"><span>Transform</span><span>Canvas space</span></div>
      <div className="property-fields">
        {transformFields.map((field) => {
          const value = layer.transform[field.key];
          return (
            <label className="property-field" key={field.key}>
              <span className="property-label">{field.label}</span>
              <span className="range-value">{value}{field.suffix}</span>
              <input type="range" min={field.min} max={field.max} step="1" value={value} aria-label={field.label} onChange={(event) => handleTransformChange(field.key, event)} />
            </label>
          );
        })}
      </div>
      <p className="inspector-hint">Layer edits update the canvas immediately.</p>
    </aside>
  );
}