import { useState } from "react";
import type { Beat, DynamicShape, Motif, Passage, PassageDynamic, PauseInterval, Phrase, Movement, Story } from "../types/story";
import type { NarrativeItem, NarrativeKind } from "../data/narrativeCommands";
import type { StudioObjectSelection } from "../data/studioSelection";

interface MotifOccurrenceTarget {
  id: string;
  label: string;
}

interface NarrativeInspectorProps {
  selection: StudioObjectSelection;
  item?: NarrativeItem;
  motif?: Motif;
  story: Story;
  pathSpan?: { start: number; end: number };
  motifTargets: readonly MotifOccurrenceTarget[];
  onNarrativeUpdate: (kind: NarrativeKind, id: string, update: Partial<NarrativeItem>) => void;
  onMotifUpdate: (id: string, update: Partial<Motif>) => void;
  onMotifRemove: (id: string) => void;
}

const primaryFunctions = ["INTRODUCE", "CHANGE", "REVEAL", "EMPHASIZE", "RESOLVE", "INTERRUPT"] as const;
const dynamicShapes: DynamicShape[] = ["FLAT", "ASCENDING", "DESCENDING", "PEAK", "VALLEY", "OSCILLATING"];

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function NarrativeTextField({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return (
    <label className="narrative-field">
      <span>{label}</span>
      {multiline
        ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
        : <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

function NarrativeSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <label className="narrative-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function beatOptions(passage: Passage) {
  return passage.phrases.flatMap((phrase) => phrase.beats.map((beat) => ({ value: beat.id, label: `${phrase.title} / ${beat.title}` })));
}

export function NarrativeInspector({ selection, item, motif, story, pathSpan, motifTargets, onNarrativeUpdate, onMotifUpdate, onMotifRemove }: NarrativeInspectorProps) {
  const [newDynamicShape, setNewDynamicShape] = useState<DynamicShape | "">("");

  if (selection.domain === "editorial" && selection.kind === "motif" && motif) {
    return (
      <aside className="inspector-panel narrative-inspector" aria-label="Motif properties">
        <div className="panel-heading"><h2>Motif</h2><span className="read-only-chip">EDITORIAL</span></div>
        <NarrativeTextField label="Name" value={motif.name} onChange={(name) => onMotifUpdate(motif.id, { name })} />
        <NarrativeTextField label="Identity" value={motif.identity ?? ""} onChange={(identity) => onMotifUpdate(motif.id, { identity: identity || undefined })} multiline />
        <NarrativeTextField label="Significance" value={motif.significance ?? ""} onChange={(significance) => onMotifUpdate(motif.id, { significance: significance || undefined })} multiline />
        <fieldset className="motif-occurrence-picker">
          <legend>Recorded occurrences</legend>
          {motifTargets.map((target) => {
            const checked = motif.occurrenceIds.includes(target.id);
            return (
              <label key={target.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onMotifUpdate(motif.id, {
                    occurrenceIds: checked
                      ? motif.occurrenceIds.filter((id) => id !== target.id)
                      : [...motif.occurrenceIds, target.id],
                  })}
                />
                <span>{target.label}</span>
              </label>
            );
          })}
        </fieldset>
        <button type="button" className="destructive-action" onClick={() => onMotifRemove(motif.id)}>Remove Motif</button>
        <p className="inspector-hint">Occurrence links are explicit stable IDs. The editor does not infer recurrence or judge its meaning.</p>
      </aside>
    );
  }

  if (selection.domain !== "narrative" || !item) {
    return <aside className="inspector-panel" aria-label="Narrative properties"><div className="empty-inspector">Select a narrative unit or Motif to edit its fields.</div></aside>;
  }

  const kind = selection.kind as NarrativeKind;
  const update = (fields: Partial<NarrativeItem>) => onNarrativeUpdate(kind, item.id, fields);
  let fields;
  if (kind === "movement") {
    const movement = item as Movement;
    fields = <>
      <NarrativeTextField label="Purpose" value={movement.purpose ?? ""} onChange={(purpose) => update({ purpose: purpose || undefined })} multiline />
      <NarrativeTextField label="Condition note" value={movement.conditionNote ?? ""} onChange={(conditionNote) => update({ conditionNote: conditionNote || undefined })} multiline />
    </>;
  } else if (kind === "passage") {
    const passage = item as Passage;
    const selectedDominant = passage.annotations?.dominantBeatId ?? "";
    const dynamics = passage.dynamics ?? [];
    fields = <>
      <NarrativeTextField label="Dominant purpose" value={passage.dominantPurpose ?? ""} onChange={(dominantPurpose) => update({ dominantPurpose: dominantPurpose || undefined })} multiline />
      <div className="narrative-fields-heading">Passage roles <small>Optional roles, not hierarchy units</small></div>
      <NarrativeTextField label="Entry" value={passage.annotations?.entry ?? ""} onChange={(entry) => update({ annotations: { ...passage.annotations, entry: entry || undefined } })} multiline />
      <NarrativeTextField label="Development" value={passage.annotations?.development ?? ""} onChange={(development) => update({ annotations: { ...passage.annotations, development: development || undefined } })} multiline />
      <NarrativeSelect
        label="Dominant Beat"
        value={selectedDominant}
        options={[{ value: "", label: "No Dominant assigned" }, ...beatOptions(passage)]}
        onChange={(dominantBeatId) => update({ annotations: { ...passage.annotations, dominantBeatId: dominantBeatId || undefined } })}
      />
      <NarrativeTextField label="Exit / resulting condition" value={passage.annotations?.exit ?? ""} onChange={(exit) => update({ annotations: { ...passage.annotations, exit: exit || undefined } })} multiline />
      <NarrativeTextField label="Relative tempo label" value={passage.tempoLabel ?? ""} onChange={(tempoLabel) => update({ tempoLabel: tempoLabel || undefined })} />
      <div className="narrative-fields-heading">Dynamics <small>Relative contour, not numeric intensity</small></div>
      {dynamics.map((dynamic, index) => (
        <div className="dynamic-row" key={`${dynamic.shape}-${index}`}>
          <select
            aria-label={`Dynamic shape ${index + 1}`}
            value={dynamic.shape}
            onChange={(event) => {
              const next = [...dynamics];
              next[index] = { ...dynamic, shape: event.target.value as DynamicShape };
              update({ dynamics: next });
            }}
          >
            {dynamicShapes.map((shape) => <option value={shape} key={shape}>{shape}</option>)}
          </select>
          <input
            type="text"
            aria-label={`Dynamic channel ${index + 1}`}
            placeholder="Channel (optional)"
            value={dynamic.channel ?? ""}
            onChange={(event) => {
              const next: PassageDynamic[] = [...dynamics];
              next[index] = { ...dynamic, channel: event.target.value || undefined };
              update({ dynamics: next });
            }}
          />
          <button type="button" aria-label={`Remove dynamic ${index + 1}`} onClick={() => update({ dynamics: dynamics.filter((_, itemIndex) => itemIndex !== index) })}>×</button>
        </div>
      ))}
      <div className="add-dynamic-row">
        <select aria-label="New dynamic shape" value={newDynamicShape} onChange={(event) => setNewDynamicShape(event.target.value as DynamicShape | "")}>
          <option value="">Choose shape</option>
          {dynamicShapes.map((shape) => <option value={shape} key={shape}>{shape}</option>)}
        </select>
        <button type="button" className="text-action" disabled={!newDynamicShape} onClick={() => {
          if (!newDynamicShape) return;
          update({ dynamics: [...dynamics, { shape: newDynamicShape }] });
          setNewDynamicShape("");
        }}>Add dynamic</button>
      </div>
    </>;
  } else if (kind === "phrase") {
    const phrase = item as Phrase;
    fields = <NarrativeTextField label="Narrative idea" value={phrase.narrativeIdea ?? ""} onChange={(narrativeIdea) => update({ narrativeIdea: narrativeIdea || undefined })} multiline />;
  } else if (kind === "pause") {
    const pause = item as PauseInterval;
    const passage = story.movements.flatMap((movement) => movement.passages).find((parent) => parent.pauses?.some((entry) => entry.id === pause.id));
    const beats = passage?.phrases.flatMap((phrase) => phrase.beats) ?? [];
    fields = <>
      <p className="interval-definition">A Pause is an intentional interval of little or no narrative change. It does not require stillness, a timed wait, or silence.</p>
      <NarrativeSelect
        label="Position in Passage"
        value={pause.afterBeatId ?? ""}
        options={[{ value: "", label: "Passage entry · before first Beat" }, ...beats.map((beat) => ({ value: beat.id, label: `After · ${beat.title}` }))]}
        onChange={(afterBeatId) => update({ afterBeatId: afterBeatId || undefined })}
      />
      <label className="narrative-field">
        <span>Traversal weight</span>
        <input
          type="number"
          min="0.000001"
          step="0.1"
          value={pause.traversalWeight ?? ""}
          aria-describedby="pause-weight-hint"
          onChange={(event) => update({ traversalWeight: event.currentTarget.value === "" ? undefined : event.currentTarget.valueAsNumber })}
        />
      </label>
      <p id="pause-weight-hint" className="inspector-hint">Positive path allocation for a held narrative condition. It does not mean seconds or an automatic wait.</p>
      <NarrativeTextField label="Intent note" value={pause.intent ?? ""} onChange={(intent) => update({ intent: intent || undefined })} multiline />
    </>;
  } else {
    const beat = item as Beat;
    fields = <>
      <NarrativeTextField label="Purpose" value={beat.purpose ?? ""} onChange={(purpose) => update({ purpose: purpose || undefined })} multiline />
      <NarrativeSelect
        label="Primary narrative function"
        value={beat.primaryFunction ?? ""}
        options={[{ value: "", label: "Choose function" }, ...primaryFunctions.map((value) => ({ value, label: value }))]}
        onChange={(primaryFunction) => update({ primaryFunction: (primaryFunction || undefined) as Beat["primaryFunction"] })}
      />
      <label className="narrative-field">
        <span>Traversal weight</span>
        <input
          type="number"
          min="0.000001"
          step="0.1"
          value={beat.traversalWeight ?? ""}
          aria-describedby="traversal-weight-hint"
          onChange={(event) => update({ traversalWeight: event.currentTarget.value === "" ? undefined : event.currentTarget.valueAsNumber })}
        />
      </label>
      <p id="traversal-weight-hint" className="inspector-hint">Positive relative path allocation. Not seconds or a time duration.</p>
    </>;
  }

  return (
    <aside className="inspector-panel narrative-inspector" aria-label={`${kind} authoring fields`}>
      <div className="panel-heading"><h2>{kind[0].toUpperCase() + kind.slice(1)}</h2><span className="read-only-chip">NARRATIVE</span></div>
      {kind !== "pause" && <NarrativeTextField label="Title" value={"title" in item ? item.title : ""} onChange={(title) => update({ title })} />}
      {fields}
      {pathSpan && <div className="selection-property"><span>Derived path</span><strong>{`${percent(pathSpan.start)}–${percent(pathSpan.end)}`}</strong></div>}
      <p className="inspector-hint">Narrative fields remain separate from composition Shots and presentation cues.</p>
    </aside>
  );
}