import type { Motif, Scene, Shot, Story } from "../types/story";
import type { NarrativeUnitView } from "../data/studioPath";
import type { StudioSelectionProjection } from "../data/studioSelection";

interface StorySidebarProps {
  story: Story;
  activeShot: Shot;
  selectedLayerId?: string;
  selection: StudioSelectionProjection["navigator"];
  narrativeUnits: readonly NarrativeUnitView[];
  motifs: readonly Motif[];
  saveStatus: string;
  onSceneSelect: (scene: Scene) => void;
  onAddScene: () => void;
  onRemoveScene: () => void;
  onShotSelect: (shot: Shot) => void;
  onShotMove: (shotId: string, direction: -1 | 1) => void;
  onNarrativeSelect: (unit: NarrativeUnitView) => void;
  onNarrativeAddMovement: () => void;
  onNarrativeAddChild: (unit: NarrativeUnitView) => void;
  onNarrativeAddPause: (unit: NarrativeUnitView) => void;
  onNarrativeRemove: (unit: NarrativeUnitView) => void;
  onNarrativeMove: (unit: NarrativeUnitView, direction: -1 | 1) => void;
  onMotifSelect: (motif: Motif) => void;
  onMotifAdd: () => void;
  onAddShot: () => void;
  onRemoveShot: () => void;
  onAssetSelect: (assetId: string) => void;
}

export function StorySidebar({ story, activeShot, selectedLayerId, selection, narrativeUnits, motifs, saveStatus, onSceneSelect, onAddScene, onRemoveScene, onShotSelect, onShotMove, onNarrativeSelect, onNarrativeAddMovement, onNarrativeAddChild, onNarrativeAddPause, onNarrativeRemove, onNarrativeMove, onMotifSelect, onMotifAdd, onAddShot, onRemoveShot, onAssetSelect }: StorySidebarProps) {
  const chapter = story.composition.chapters[0];
  const scene = chapter.scenes.find((item) => item.id === selection.compositionContext.sceneId) ?? chapter.scenes[0];
  const narrativeFocused = selection.object.domain === "narrative";

  return (
    <aside className="story-sidebar" aria-label="Story and assets">
      <section className="sidebar-section hierarchy-section">
        <div className="panel-heading"><h2>Story</h2><span className="panel-count">01</span></div>
        <div className="hierarchy-path">
          <div className="hierarchy-item story-item"><span className="tree-mark" />{story.title}</div>
          <div className="hierarchy-item chapter-item"><span className="tree-mark" />{chapter.title}</div>
          <div className="narrative-heading"><span>NARRATIVE</span><button type="button" className="text-action" onClick={onNarrativeAddMovement}>+ Movement</button></div>
          {narrativeUnits.length > 0 ? (
            <div className="narrative-unit-list">
              {narrativeUnits.map((unit) => {
                const selected = selection.object.domain === "narrative" && selection.object.id === unit.id;
                const childLabel = unit.kind === "movement" ? "Passage" : unit.kind === "passage" ? "Phrase" : unit.kind === "phrase" ? "Beat" : undefined;
                return (
                  <div className="narrative-unit-row" key={unit.id}>
                    <button
                      type="button"
                      className={`narrative-unit narrative-${unit.kind}${selected ? " is-selected" : ""}`}
                      style={{ paddingLeft: `${8 + unit.depth * 12}px` }}
                      aria-current={selected ? "true" : undefined}
                      onClick={() => onNarrativeSelect(unit)}
                    >
                      <span className="narrative-unit-title">{unit.title}</span>
                      {unit.kind === "beat" && unit.primaryFunction && <small>{unit.primaryFunction}</small>}
                    </button>
                    <div className="narrative-unit-actions">
                      {childLabel && <button type="button" aria-label={`Add ${childLabel} to ${unit.title}`} title={`Add ${childLabel}`} onClick={() => onNarrativeAddChild(unit)}>+</button>}
                      {unit.kind === "passage" && <button type="button" aria-label={`Add Pause to ${unit.title}`} title="Add Pause interval" onClick={() => onNarrativeAddPause(unit)}>P</button>}
                      {unit.kind !== "pause" && <button type="button" aria-label={`Move ${unit.title} earlier`} title="Move earlier" disabled={unit.orderIndex === 0} onClick={() => onNarrativeMove(unit, -1)}>↑</button>}
                      {unit.kind !== "pause" && <button type="button" aria-label={`Move ${unit.title} later`} title="Move later" disabled={unit.orderIndex === unit.siblingCount - 1} onClick={() => onNarrativeMove(unit, 1)}>↓</button>}
                      <button type="button" className="narrative-delete" aria-label={`Remove ${unit.kind} ${unit.title}`} title={`Remove ${unit.kind}`} onClick={() => onNarrativeRemove(unit)}>×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="narrative-empty">No narrative units authored.</p>}
          <div className="narrative-heading motif-heading"><span>MOTIFS</span><button type="button" className="text-action" onClick={onMotifAdd}>+ Motif</button></div>
          {motifs.length > 0 ? (
            <div className="motif-list">
              {motifs.map((motif) => {
                const selected = selection.object.domain === "editorial" && selection.object.kind === "motif" && selection.object.id === motif.id;
                return <button type="button" className={`motif-item${selected ? " is-selected" : ""}`} key={motif.id} aria-current={selected ? "true" : undefined} onClick={() => onMotifSelect(motif)}>{motif.name}<small>{motif.occurrenceIds.length}</small></button>;
              })}
            </div>
          ) : <p className="narrative-empty motif-empty">No Motifs recorded.</p>}
          <div className="scene-heading">
            <span>SCENES</span>
            <button type="button" className="text-action" onClick={onAddScene}>Add scene</button>
          </div>
          <div className="scene-list">
            {chapter.scenes.map((item, index) => (
              <button
                type="button"
                className={`scene-item${item.id === scene.id ? narrativeFocused ? " is-context" : " is-active" : ""}`}
                key={item.id}
                onClick={() => onSceneSelect(item)}
                aria-current={item.id === scene.id && selection.object.domain === "composition" && selection.object.kind === "scene" ? "page" : undefined}
              >
                <span className="scene-index">{String(index + 1).padStart(2, "0")}</span>
                {item.title}
                {index === 0 && <span className="scene-player-badge">PLAYER</span>}
              </button>
            ))}
          </div>
          {chapter.scenes.length > 1 && <button type="button" className="remove-shot" onClick={onRemoveScene}>Remove selected scene</button>}
          <div className="shot-heading">
            <span>SHOTS</span>
            <button type="button" className="text-action" onClick={onAddShot}>Add shot</button>
          </div>
          <div className="shot-list">
            {scene.shots.map((shot, index) => (
              <div className="shot-row" key={shot.id}>
                <button
                  type="button"
                  className={`shot-item${shot.id === activeShot.id ? narrativeFocused || (selection.object.domain === "composition" && selection.object.kind === "scene") ? " is-context" : " is-active" : ""}`}
                  onClick={() => onShotSelect(shot)}
                  aria-current={shot.id === activeShot.id && selection.object.domain === "composition" && selection.object.kind === "shot" && selection.object.id === shot.id ? "page" : undefined}
                >
                  <span className="shot-index">{String(index + 1).padStart(2, "0")}</span>
                  <span>{shot.title}</span>
                </button>
                <button type="button" className="shot-order-button" aria-label={`Move ${shot.title} earlier`} disabled={index === 0} onClick={() => onShotMove(shot.id, -1)}>^</button>
                <button type="button" className="shot-order-button" aria-label={`Move ${shot.title} later`} disabled={index === scene.shots.length - 1} onClick={() => onShotMove(shot.id, 1)}>v</button>
              </div>
            ))}
          </div>
          <p className="shot-playback-note">
            {scene.id === chapter.scenes[0].id
              ? "Player order · equal scroll per shot · hard cuts at boundaries"
              : "Player is scoped to the first scene of the first chapter."}
          </p>
          {scene.shots.length > 1 && (
            <button type="button" className="remove-shot" onClick={onRemoveShot}>Remove selected shot</button>
          )}
        </div>
      </section>

      <section className="sidebar-section assets-section">
        <div className="panel-heading"><h2>Assets</h2><span className="panel-count">02</span></div>
        <div className="asset-list">
          <button
            type="button"
            className={`asset-item${selectedLayerId === activeShot.layers.find((layer) => layer.kind === "background" && layer.assetId === "hero-scene")?.id ? " is-selected" : ""}`}
            onClick={() => onAssetSelect("hero-scene")}
          >
            <span className="asset-thumb landscape-thumb" aria-hidden="true" />
            <span><strong>River city at dusk</strong><small>Background · JPG</small></span>
          </button>
          <button
            type="button"
            className={`asset-item${selectedLayerId === activeShot.layers.find((layer) => layer.kind === "character")?.id ? " is-selected" : ""}`}
            onClick={() => onAssetSelect("character")}
          >
            <span className="asset-thumb character-thumb" aria-hidden="true"><span /></span>
            <span><strong>The traveler</strong><small>Character · Vector</small></span>
          </button>
        </div>
      </section>
      <div className="sidebar-footer"><span className="status-dot" />{saveStatus}</div>
    </aside>
  );
}