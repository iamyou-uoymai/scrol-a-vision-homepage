import type { CompiledPath } from "../data/pathCompiler";
import type { CompositionPreview } from "../data/compositionPreview";
import type { NarrativePathAllocation, NarrativeUnitView } from "../data/studioPath";
import type { ShotPathAllocation } from "../player/progress";
import type { StudioSelectionProjection } from "../data/studioSelection";
import type { Shot } from "../types/story";

interface PathEditorProps {
  compositionPath: CompiledPath<ShotPathAllocation>;
  narrativePath: CompiledPath<NarrativePathAllocation>;
  selection: StudioSelectionProjection["path"];
  traversalPosition: number;
  compositionPreview: CompositionPreview;
  onTraversalChange: (position: number) => void;
  selectedPathSpan?: { start: number; end: number };
  onShotSelect: (shot: Shot) => void;
  onNarrativeSelect: (unit: NarrativeUnitView) => void;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function compositionIntervalSelected(
  selection: StudioSelectionProjection["path"],
  interval: CompiledPath<ShotPathAllocation>["intervals"][number],
): boolean {
  if (selection.object.domain !== "composition") return false;
  if (selection.object.kind === "scene") return true;
  if (selection.object.kind === "shot") return selection.object.id === interval.id;
  return selection.compositionContext.shotId === interval.id;
}

export function PathEditor({ compositionPath, narrativePath, selection, traversalPosition, compositionPreview, onTraversalChange, selectedPathSpan, onShotSelect, onNarrativeSelect }: PathEditorProps) {
  const compositionPreviewPosition = compositionPreview.traversalProgress;
  const hasCompositionPath = compositionPath.intervals.length > 0;
  const previewDescription = compositionPreview.kind === "active"
    ? `${percent(compositionPreviewPosition)} overall, ${compositionPreview.shot.title}, ${percent(compositionPreview.shotProgress)} Shot-local`
    : "No composition Shots";

  return (
    <section className="path-editor" aria-label="Path Editor">
      <div className="path-editor-heading">
        <div><span className="eyebrow">DERIVED COORDINATES</span><h2>Path Editor</h2></div>
        <span>Composition and narrative paths are independent.</span>
      </div>
      <div className="path-editor-row">
        <span className="path-editor-label">Composition</span>
        {compositionPath.intervals.length > 0 ? (
          <div className="path-track" role="group" aria-label="Composition Shot path">
            {compositionPath.intervals.map((interval) => {
              const start = interval.start * 100;
              const width = (interval.end - interval.start) * 100;
              const selected = compositionIntervalSelected(selection, interval);
              return (
                <button
                  type="button"
                  className={`path-segment path-segment-composition${selected ? " is-selected" : ""}`}
                  key={interval.id}
                  style={{ left: `${start}%`, width: `${width}%` }}
                  data-path-start={interval.start}
                  data-path-end={interval.end}
                  aria-label={`${interval.source.shot.title}, ${percent(interval.start)} to ${percent(interval.end)}`}
                  aria-pressed={selected}
                  title={`${interval.source.shot.title} · ${percent(interval.start)}–${percent(interval.end)}`}
                  onClick={() => onShotSelect(interval.source.shot)}
                >
                  <span>{interval.source.shot.title}</span>
                </button>
              );
            })}
            {hasCompositionPath && (
              <span
                className="path-preview-marker"
                style={{ left: `${compositionPreviewPosition * 100}%` }}
                title={`Composition preview ${percent(compositionPreviewPosition)}`}
                aria-hidden="true"
              />
            )}
            {selection.object.domain === "composition"
              && (selection.object.kind === "cue" || selection.object.kind === "keyframe" || selection.object.kind === "creative-interval")
              && selectedPathSpan && (
                <span
                  className={`path-object-span${selection.object.kind === "keyframe" ? " is-point" : ""}`}
                  style={{
                    left: `${selectedPathSpan.start * 100}%`,
                    width: `${Math.max((selectedPathSpan.end - selectedPathSpan.start) * 100, 0.12)}%`,
                  }}
                  aria-hidden="true"
                />
              )}
          </div>
        ) : <span className="path-editor-empty">No composition intervals.</span>}
        <output className="path-preview-position">{hasCompositionPath ? percent(compositionPreviewPosition) : ""}</output>
      </div>
      <div className="traversal-scrubber" role="group" aria-label="Composition traversal scrubber">
        <div className="traversal-scrubber-controls">
          <button type="button" className="traversal-endpoint-button" aria-label="Go to beginning of composition path" disabled={!hasCompositionPath} onClick={() => onTraversalChange(0)}>Start</button>
          <label className="traversal-scrubber-label" htmlFor="composition-traversal-position">TRAVERSAL</label>
          <input
            id="composition-traversal-position"
            className="traversal-scrubber-range"
            type="range"
            min="0"
            max="10000"
            step="1"
            value={Math.round(traversalPosition * 10000)}
            aria-label="Composition traversal position"
            aria-valuetext={previewDescription}
            disabled={!hasCompositionPath}
            onChange={(event) => onTraversalChange(Number(event.target.value) / 10000)}
          />
          <button type="button" className="traversal-endpoint-button" aria-label="Go to end of composition path" disabled={!hasCompositionPath} onClick={() => onTraversalChange(1)}>End</button>
        </div>
        <output className="traversal-scrubber-readout" aria-live="polite">
          {compositionPreview.kind === "active" ? (
            <><strong>{percent(compositionPreviewPosition)}</strong><span>overall · {compositionPreview.shot.title} · {percent(compositionPreview.shotProgress)} Shot-local</span></>
          ) : "No composition Shots"}
        </output>
        <p className="traversal-scrubber-limit">Studio preview resolves camera and layer transforms; cue tracks, transitions, audio, and narrative Beat paths are not executed.</p>
      </div>
      <div className="path-editor-row">
        <span className="path-editor-label">Narrative</span>
        {narrativePath.intervals.length > 0 ? (
          <div className="path-track" role="group" aria-label="Narrative Beat path">
            {narrativePath.intervals.map((interval) => {
              const selected = selection.object.domain === "narrative"
                && (selection.object.kind === "beat"
                  ? selection.object.id === interval.id
                  : selection.object.kind === "pause"
                    ? interval.source.unit.kind === "pause" && selection.object.id === interval.id
                  : selection.object.kind === "phrase"
                    ? selection.object.id === interval.source.unit.phraseId
                    : selection.object.kind === "passage"
                      ? selection.object.id === interval.source.unit.passageId
                      : selection.object.id === interval.source.unit.movementId);
              return (
                <button
                  type="button"
                  className={`path-segment path-segment-narrative${selected ? " is-selected" : ""}`}
                  key={interval.id}
                  style={{ left: `${interval.start * 100}%`, width: `${(interval.end - interval.start) * 100}%` }}
                  data-path-start={interval.start}
                  data-path-end={interval.end}
                  aria-label={`${interval.source.unit.title}, ${percent(interval.start)} to ${percent(interval.end)}`}
                  aria-pressed={selected}
                  title={`${interval.source.unit.title} · weight ${interval.traversalWeight} · ${percent(interval.start)}–${percent(interval.end)}`}
                  onClick={() => onNarrativeSelect(interval.source.unit)}
                >
                  <span>{interval.source.unit.title}</span>
                </button>
              );
            })}
          </div>
        ) : <span className="path-editor-empty">No narrative Beats authored.</span>}
      </div>
      <div className="path-editor-scale" aria-hidden="true"><span>0%</span><span>100%</span></div>
    </section>
  );
}