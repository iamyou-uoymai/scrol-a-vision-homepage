import type { Scene, Shot, Story } from "../types/story";

interface StorySidebarProps {
  story: Story;
  activeShot: Shot;
  selectedLayerId?: string;
  selectedSceneId: string;
  saveStatus: string;
  onSceneSelect: (scene: Scene) => void;
  onAddScene: () => void;
  onRemoveScene: () => void;
  onShotSelect: (shot: Shot) => void;
  onAddShot: () => void;
  onRemoveShot: () => void;
  onAssetSelect: (assetId: string) => void;
}

export function StorySidebar({ story, activeShot, selectedLayerId, selectedSceneId, saveStatus, onSceneSelect, onAddScene, onRemoveScene, onShotSelect, onAddShot, onRemoveShot, onAssetSelect }: StorySidebarProps) {
  const chapter = story.chapters[0];
  const scene = chapter.scenes.find((item) => item.id === selectedSceneId) ?? chapter.scenes[0];

  return (
    <aside className="story-sidebar" aria-label="Story and assets">
      <section className="sidebar-section hierarchy-section">
        <div className="panel-heading"><h2>Story</h2><span className="panel-count">01</span></div>
        <div className="hierarchy-path">
          <div className="hierarchy-item story-item"><span className="tree-mark" />{story.title}</div>
          <div className="hierarchy-item chapter-item"><span className="tree-mark" />{chapter.title}</div>
          <div className="scene-heading">
            <span>SCENES</span>
            <button type="button" className="text-action" onClick={onAddScene}>Add scene</button>
          </div>
          <div className="scene-list">
            {chapter.scenes.map((item, index) => (
              <button type="button" className={`scene-item${item.id === scene.id ? " is-active" : ""}`} key={item.id} onClick={() => onSceneSelect(item)} aria-current={item.id === scene.id ? "page" : undefined}>
                <span className="scene-index">{String(index + 1).padStart(2, "0")}</span>
                {item.title}
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
              <button
                type="button"
                className={`shot-item${shot.id === activeShot.id ? " is-active" : ""}`}
                key={shot.id}
                onClick={() => onShotSelect(shot)}
                aria-current={shot.id === activeShot.id ? "page" : undefined}
              >
                <span className="shot-index">{String(index + 1).padStart(2, "0")}</span>
                <span>{shot.title}</span>
              </button>
            ))}
          </div>
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