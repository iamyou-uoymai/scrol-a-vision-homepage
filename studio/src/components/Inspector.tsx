import type { ChangeEvent } from "react";
import type { CompositionCue, Motif, PresentationIntervalCue, PresentationIntervalCueUpdate, Scene, Shot, Story, VisualLayer, VisualLayerUpdate } from "../types/story";
import type { NarrativeItem, NarrativeKind } from "../data/narrativeCommands";
import type { StudioObjectSelection } from "../data/studioSelection";
import { CreativeIntervalInspector } from "./CreativeIntervalInspector";
import { NarrativeInspector } from "./NarrativeInspector";

interface MotifOccurrenceTarget {
  id: string;
  label: string;
}

interface InspectorProps {
  selection: StudioObjectSelection;
  layer?: VisualLayer;
  hasAnimationTrack?: boolean;
  cue?: CompositionCue;
  creativeInterval?: PresentationIntervalCue;
  narrativeItem?: NarrativeItem;
  motif?: Motif;
  story: Story;
  motifTargets: readonly MotifOccurrenceTarget[];
  selectedScene: Scene;
  selectedShot: Shot;
  pathSpan?: { start: number; end: number };
  onNarrativeUpdate: (kind: NarrativeKind, id: string, update: Partial<NarrativeItem>) => void;
  onMotifUpdate: (id: string, update: Partial<Motif>) => void;
  onMotifRemove: (id: string) => void;
  onCreativeIntervalUpdate: (id: string, update: PresentationIntervalCueUpdate) => void;
  onCreativeIntervalRemove: () => void;
  onLayerUpdate: (update: VisualLayerUpdate) => void;
  onCueUpdate: (update: Partial<CompositionCue>) => void;
  onCueRemove: () => void;
}

const transformFields = [
  { key: "x", label: "X position", min: 0, max: 100, suffix: "%" },
  { key: "y", label: "Y position", min: 0, max: 100, suffix: "%" },
  { key: "scale", label: "Scale", min: 40, max: 160, suffix: "%" },
  { key: "rotation", label: "Rotation", min: -180, max: 180, suffix: "°" },
  { key: "opacity", label: "Opacity", min: 0, max: 100, suffix: "%" },
] as const;

export function Inspector({ selection, layer, hasAnimationTrack = false, cue, creativeInterval, narrativeItem, motif, story, motifTargets, selectedScene, selectedShot, pathSpan, onNarrativeUpdate, onMotifUpdate, onMotifRemove, onCreativeIntervalUpdate, onCreativeIntervalRemove, onLayerUpdate, onCueUpdate, onCueRemove }: InspectorProps) {
  if (cue) {
    return (
      <aside className="inspector-panel" aria-label="Composition cue properties">
        <div className="panel-heading"><h2>Cue</h2><span className={`track-chip track-${cue.track}`}>{cue.track}</span></div>
        <label className="field-label" htmlFor="cue-label">Name</label>
        <input id="cue-label" className="text-field" value={cue.label} onChange={(event) => onCueUpdate({ label: event.target.value })} />
        <div className="field-row">
          <label className="field-group"><span>Start</span><span className="number-field-wrap"><input type="number" min="0" max={Math.floor((1 - cue.duration) * 100)} value={Math.round(cue.start * 100)} onChange={(event) => onCueUpdate({ start: Math.min(1 - cue.duration, Math.max(0, Number(event.target.value) / 100)) })} /><i>%</i></span></label>
          <label className="field-group"><span>Length</span><span className="number-field-wrap"><input type="number" min="1" max={Math.floor((1 - cue.start) * 100)} value={Math.round(cue.duration * 100)} onChange={(event) => onCueUpdate({ duration: Math.min(1 - cue.start, Math.max(0.01, Number(event.target.value) / 100)) })} /><i>%</i></span></label>
        </div>
        <button type="button" className="destructive-action" onClick={onCueRemove}>Remove cue</button>
      </aside>
    );
  }

  if (creativeInterval) {
    return <CreativeIntervalInspector interval={creativeInterval} onUpdate={(update) => onCreativeIntervalUpdate(creativeInterval.id, update)} onRemove={onCreativeIntervalRemove} />;
  }

  if (selection.domain === "narrative" || selection.domain === "editorial") {
    return (
      <NarrativeInspector
        selection={selection}
        item={narrativeItem}
        motif={motif}
        story={story}
        pathSpan={pathSpan}
        motifTargets={motifTargets}
        onNarrativeUpdate={onNarrativeUpdate}
        onMotifUpdate={onMotifUpdate}
        onMotifRemove={onMotifRemove}
      />
    );
  }

  if (selection.domain === "composition" && (selection.kind === "scene" || selection.kind === "shot")) {
    const title = selection.kind === "scene" ? selectedScene.title : selectedShot.title;
    return (
      <aside className="inspector-panel" aria-label={`${selection.kind} details`}>
        <div className="panel-heading"><h2>{selection.kind}</h2><span className="read-only-chip">COMPOSITION</span></div>
        <strong className="selection-title">{title}</strong>
        {pathSpan && <div className="selection-property"><span>Derived path</span><strong>{`${(pathSpan.start * 100).toFixed(1)}%–${(pathSpan.end * 100).toFixed(1)}%`}</strong></div>}
      </aside>
    );
  }

  if (!layer) {
    return <aside className="inspector-panel" aria-label="Properties"><div className="empty-inspector">Select a layer or cue to inspect it.</div></aside>;
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
      <div className="transform-heading"><span>Base transform</span><span>Layer defaults</span></div>
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
      <p className="inspector-hint">{hasAnimationTrack
        ? "Editing the base transform. The animation track drives the Stage; select a keyframe to edit an authored state."
        : "Layer edits update the canvas immediately."}</p>
    </aside>
  );
}