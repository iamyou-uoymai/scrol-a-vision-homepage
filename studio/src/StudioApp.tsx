import { useEffect, useState } from "react";
import { DEFAULT_CAMERA_TRANSFORM, evaluateAnimationTrack, getAnimationTrack, type AnimationTransform } from "./data/animation";
import { createSampleStory, firstShot, loadStoredStory, parseImportedStory, saveStoredStory, serializeStory } from "./data/storyStorage";
import { Inspector } from "./components/Inspector";
import { KeyframeInspector } from "./components/KeyframeInspector";
import { ShotCanvas } from "./components/ShotCanvas";
import { StorySidebar } from "./components/StorySidebar";
import { Timeline } from "./components/Timeline";
import { Toolbar } from "./components/Toolbar";
import type { AnimationTarget, BeatTrack, CameraTransform, Keyframe, KeyframeUpdate, LayerTransform, Scene, Shot, Story, StoryBeat, VisualLayer, VisualLayerUpdate } from "./types/story";

type Selection = { type: "layer"; id: string } | { type: "beat"; id: string } | { type: "keyframe"; target: AnimationTarget; id: string };

function defaultSelection(shot: Shot): Selection {
  const layer = shot.layers[1] ?? shot.layers[0];
  if (layer) return { type: "layer", id: layer.id };
  const beat = shot.beats[0];
  return beat ? { type: "beat", id: beat.id } : { type: "layer", id: "" };
}

function createShot(index: number): Shot {
  return {
    id: crypto.randomUUID(),
    title: `Shot ${String(index).padStart(2, "0")}`,
    layers: [
      {
        id: crypto.randomUUID(),
        name: "River city at dusk",
        kind: "background",
        assetId: "hero-scene",
        transform: { x: 50, y: 50, scale: 100, rotation: 0, opacity: 100 },
      },
      {
        id: crypto.randomUUID(),
        name: "The traveler",
        kind: "character",
        transform: { x: 41, y: 57, scale: 100, rotation: 0, opacity: 100 },
      },
    ],
    beats: [],
    animation: { camera: [], layers: {} },
  };
}

function defaultAnimationTarget(shot: Shot): AnimationTarget {
  const layer = shot.layers.find((item) => item.kind === "character") ?? shot.layers[0];
  return layer ? { type: "layer", layerId: layer.id } : { type: "camera" };
}

function mergeKeyframe<TTransform extends AnimationTransform>(
  keyframe: Keyframe<TTransform>,
  update: KeyframeUpdate,
  progress: number,
): Keyframe<TTransform> {
  return {
    ...keyframe,
    ...update,
    progress,
    transform: { ...keyframe.transform, ...update.transform } as TTransform,
  };
}

export function StudioApp() {
  const [initialProject] = useState(() => {
    try {
      return loadStoredStory(window.localStorage);
    } catch {
      return loadStoredStory();
    }
  });
  const [story, setStory] = useState<Story>(initialProject.story);
  const [canAutoSave, setCanAutoSave] = useState(initialProject.canAutoSave);
  const [saveStatus, setSaveStatus] = useState(initialProject.status);
  const [feedback, setFeedback] = useState("");
  const [selectedSceneId, setSelectedSceneId] = useState(() => initialProject.story.chapters[0]?.scenes[0]?.id ?? "");
  const [selectedShotId, setSelectedShotId] = useState(() => firstShot(initialProject.story)?.id ?? "");
  const [selection, setSelection] = useState<Selection>(() => {
    const shot = firstShot(initialProject.story);
    return shot ? defaultSelection(shot) : { type: "layer", id: "" };
  });
  const [animationTarget, setAnimationTarget] = useState<AnimationTarget>(() => {
    const shot = firstShot(initialProject.story);
    return shot ? defaultAnimationTarget(shot) : { type: "camera" };
  });
  const [playhead, setPlayhead] = useState(0.32);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!canAutoSave) return;
    setSaveStatus("Saving changes…");
    const timeout = window.setTimeout(() => {
      try {
        saveStoredStory(window.localStorage, story);
        setSaveStatus("Saved locally");
      } catch {
        setSaveStatus("Could not save; export a backup");
      }
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [story, canAutoSave]);

  const currentChapter = story.chapters[0];
  const currentScene = currentChapter?.scenes.find((scene) => scene.id === selectedSceneId) ?? currentChapter?.scenes[0];
  const activeShot = currentScene?.shots.find((shot) => shot.id === selectedShotId) ?? currentScene?.shots[0];

  if (!currentScene || !activeShot) return null;

  const selectedLayer = selection.type === "layer"
    ? activeShot.layers.find((layer) => layer.id === selection.id)
    : undefined;
  const selectedBeat = selection.type === "beat"
    ? activeShot.beats.find((beat) => beat.id === selection.id)
    : undefined;
  const selectedKeyframe = selection.type === "keyframe"
    ? getAnimationTrack(activeShot, selection.target).find((keyframe) => keyframe.id === selection.id)
    : undefined;
  const activeAnimationTarget = animationTarget.type === "camera" || activeShot.layers.some((layer) => layer.id === animationTarget.layerId)
    ? animationTarget
    : defaultAnimationTarget(activeShot);
  const selectedLayerForCanvas = selectedLayer?.id ?? (
    selection.type === "keyframe" && selection.target.type === "layer" ? selection.target.layerId : undefined
  );
  let selectedKeyframeTargetLabel = "";
  if (selection.type === "keyframe") {
    const target = selection.target;
    if (target.type === "camera") selectedKeyframeTargetLabel = "Camera";
    else selectedKeyframeTargetLabel = activeShot.layers.find((layer) => layer.id === target.layerId)?.name ?? "Layer";
  }

  function commitStory(update: (current: Story) => Story) {
    setStory((current) => {
      const next = update(current);
      return { ...next, metadata: { ...next.metadata, updatedAt: new Date().toISOString() } };
    });
  }

  function updateActiveShot(update: (shot: Shot) => Shot) {
    commitStory((currentStory) => ({
      ...currentStory,
      chapters: currentStory.chapters.map((chapter) => ({
        ...chapter,
        scenes: chapter.scenes.map((scene) => ({
          ...scene,
          shots: scene.shots.map((shot) => shot.id === activeShot.id ? update(shot) : shot),
        })),
      })),
    }));
  }

  function updateLayer(id: string, update: VisualLayerUpdate) {
    updateActiveShot((shot) => ({
      ...shot,
      layers: shot.layers.map((layer) => layer.id === id
        ? { ...layer, ...update, transform: { ...layer.transform, ...update.transform } } as VisualLayer
        : layer),
    }));
  }

  function updateBeat(id: string, update: Partial<StoryBeat>) {
    updateActiveShot((shot) => ({
      ...shot,
      beats: shot.beats.map((beat) => {
        if (beat.id !== id) return beat;
        const next = { ...beat, ...update };
        next.start = Math.max(0, Math.min(1, next.start));
        next.duration = Math.max(Number.EPSILON, Math.min(1 - next.start, next.duration));
        return next;
      }),
    }));
  }

  function addKeyframe(target: AnimationTarget) {
    const existing = getAnimationTrack(activeShot, target).find((keyframe) => Math.abs(keyframe.progress - playhead) < 1e-9);
    if (existing) {
      setSelection({ type: "keyframe", target, id: existing.id });
      setFeedback(`Selected the existing keyframe at ${Math.round(existing.progress * 100)}%.`);
      return;
    }

    if (target.type === "camera") {
      const transform = evaluateAnimationTrack(activeShot.animation.camera, playhead) ?? DEFAULT_CAMERA_TRANSFORM;
      const keyframe: Keyframe<CameraTransform> = {
        id: crypto.randomUUID(),
        progress: playhead,
        transform: { ...transform },
        easing: "ease-in-out",
      };
      updateActiveShot((shot) => ({
        ...shot,
        animation: { ...shot.animation, camera: [...shot.animation.camera, keyframe].sort((left, right) => left.progress - right.progress) },
      }));
      setSelection({ type: "keyframe", target, id: keyframe.id });
      setAnimationTarget(target);
      setFeedback("");
      return;
    }

    const layer = activeShot.layers.find((item) => item.id === target.layerId);
    if (!layer) return;
    const transform = evaluateAnimationTrack(activeShot.animation.layers[target.layerId], playhead) ?? layer.transform;
    const keyframe: Keyframe<LayerTransform> = {
      id: crypto.randomUUID(),
      progress: playhead,
      transform: { ...transform },
      easing: "ease-in-out",
    };
    updateActiveShot((shot) => {
      const track = shot.animation.layers[target.layerId] ?? [];
      return {
        ...shot,
        animation: {
          ...shot.animation,
          layers: {
            ...shot.animation.layers,
            [target.layerId]: [...track, keyframe].sort((left, right) => left.progress - right.progress),
          },
        },
      };
    });
    setSelection({ type: "keyframe", target, id: keyframe.id });
    setAnimationTarget(target);
    setFeedback("");
  }

  function updateKeyframe(target: AnimationTarget, id: string, update: KeyframeUpdate) {
    const track = getAnimationTrack(activeShot, target);
    const keyframe = track.find((item) => item.id === id);
    if (!keyframe) return;
    const progress = update.progress ?? keyframe.progress;
    if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
      setFeedback("Keyframe position must be between 0% and 100%.");
      return;
    }
    if (track.some((item) => item.id !== id && Math.abs(item.progress - progress) < 1e-9)) {
      setFeedback("Another keyframe already exists at that position.");
      return;
    }

    if (target.type === "camera") {
      const frames = activeShot.animation.camera
        .map((frame) => frame.id === id ? mergeKeyframe(frame, update, progress) : frame)
        .sort((left, right) => left.progress - right.progress);
      updateActiveShot((shot) => ({ ...shot, animation: { ...shot.animation, camera: frames } }));
    } else {
      const frames = (activeShot.animation.layers[target.layerId] ?? [])
        .map((frame) => frame.id === id ? mergeKeyframe(frame, update, progress) : frame)
        .sort((left, right) => left.progress - right.progress);
      updateActiveShot((shot) => ({
        ...shot,
        animation: { ...shot.animation, layers: { ...shot.animation.layers, [target.layerId]: frames } },
      }));
    }
    setFeedback("");
  }

  function removeKeyframe(target: AnimationTarget, id: string) {
    if (target.type === "camera") {
      updateActiveShot((shot) => ({
        ...shot,
        animation: { ...shot.animation, camera: shot.animation.camera.filter((frame) => frame.id !== id) },
      }));
    } else {
      updateActiveShot((shot) => {
        const layers = { ...shot.animation.layers };
        const remaining = (layers[target.layerId] ?? []).filter((frame) => frame.id !== id);
        if (remaining.length) layers[target.layerId] = remaining;
        else delete layers[target.layerId];
        return { ...shot, animation: { ...shot.animation, layers } };
      });
    }
    setSelection(target.type === "layer" ? { type: "layer", id: target.layerId } : defaultSelection(activeShot));
    setFeedback("");
  }

  function selectAnimationTarget(target: AnimationTarget) {
    setAnimationTarget(target);
    const keyframe = getAnimationTrack(activeShot, target)[0];
    if (keyframe) setSelection({ type: "keyframe", target, id: keyframe.id });
    else if (target.type === "layer") setSelection({ type: "layer", id: target.layerId });
    else setSelection(defaultSelection(activeShot));
  }

  function addShot() {
    const nextShot = createShot(currentScene.shots.length + 1);
    commitStory((currentStory) => ({
      ...currentStory,
      chapters: currentStory.chapters.map((chapter) => ({
        ...chapter,
        scenes: chapter.scenes.map((scene) => scene.id === currentScene.id
          ? { ...scene, shots: [...scene.shots, nextShot] }
          : scene),
      })),
    }));
    setSelectedShotId(nextShot.id);
    setSelection(defaultSelection(nextShot));
    setAnimationTarget(defaultAnimationTarget(nextShot));
  }

  function addScene() {
    const scene: Scene = {
      id: crypto.randomUUID(),
      title: `Scene ${String(currentChapter.scenes.length + 1).padStart(2, "0")}`,
      shots: [createShot(1)],
    };
    commitStory((currentStory) => ({
      ...currentStory,
      chapters: currentStory.chapters.map((chapter) => chapter.id === currentChapter.id
        ? { ...chapter, scenes: [...chapter.scenes, scene] }
        : chapter),
    }));
    setSelectedSceneId(scene.id);
    setSelectedShotId(scene.shots[0].id);
    setSelection(defaultSelection(scene.shots[0]));
    setAnimationTarget(defaultAnimationTarget(scene.shots[0]));
  }

  function removeSelectedScene() {
    if (currentChapter.scenes.length < 2) return;
    const remainingScenes = currentChapter.scenes.filter((scene) => scene.id !== currentScene.id);
    const nextScene = remainingScenes[0];
    const nextShot = nextScene.shots[0];
    commitStory((currentStory) => ({
      ...currentStory,
      chapters: currentStory.chapters.map((chapter) => chapter.id === currentChapter.id
        ? { ...chapter, scenes: remainingScenes }
        : chapter),
    }));
    setSelectedSceneId(nextScene.id);
    setSelectedShotId(nextShot.id);
    setSelection(defaultSelection(nextShot));
    setAnimationTarget(defaultAnimationTarget(nextShot));
  }

  function selectScene(scene: Scene) {
    const nextShot = scene.shots[0];
    setSelectedSceneId(scene.id);
    setSelectedShotId(nextShot.id);
    setSelection(defaultSelection(nextShot));
    setAnimationTarget(defaultAnimationTarget(nextShot));
  }

  function removeSelectedShot() {
    if (currentScene.shots.length < 2) return;
    const remainingShots = currentScene.shots.filter((shot) => shot.id !== activeShot.id);
    commitStory((currentStory) => ({
      ...currentStory,
      chapters: currentStory.chapters.map((chapter) => ({
        ...chapter,
        scenes: chapter.scenes.map((scene) => scene.id === currentScene.id
          ? { ...scene, shots: remainingShots }
          : scene),
      })),
    }));
    setSelectedShotId(remainingShots[0].id);
    setSelection(defaultSelection(remainingShots[0]));
    setAnimationTarget(defaultAnimationTarget(remainingShots[0]));
  }

  function addBeat(track: BeatTrack) {
    const labels: Record<BeatTrack, string> = {
      camera: "Camera move",
      character: "Character beat",
      dialogue: "New dialogue",
      sound: "Sound cue",
      scroll: "Scroll hold",
    };
    const beat: StoryBeat = {
      id: crypto.randomUUID(),
      track,
      label: labels[track],
      start: Math.min(playhead, 0.82),
      duration: 0.16,
    };
    updateActiveShot((shot) => ({ ...shot, beats: [...shot.beats, beat] }));
    setSelection({ type: "beat", id: beat.id });
  }

  function removeSelectedBeat() {
    if (!selectedBeat) return;
    updateActiveShot((shot) => ({ ...shot, beats: shot.beats.filter((beat) => beat.id !== selectedBeat.id) }));
    setSelection({ type: "layer", id: activeShot.layers[0]?.id ?? "" });
  }

  function selectAsset(assetId: string) {
    const layer = activeShot.layers.find((item) =>
      ("assetId" in item && item.assetId === assetId) || item.id === assetId || (assetId === "character" && item.kind === "character"),
    );
    if (layer) {
      setSelection({ type: "layer", id: layer.id });
      setAnimationTarget({ type: "layer", layerId: layer.id });
    }
  }

  function exportProject() {
    const contents = serializeStory(story);
    const file = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    const filename = story.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "story";
    link.href = url;
    link.download = `${filename}.story.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback(`Exported ${story.title}.`);
  }

  async function importProject(file: File) {
    try {
      const imported = parseImportedStory(await file.text());
      const importedShot = firstShot(imported);
      if (!importedShot) throw new Error("The project does not contain a shot the Studio can open.");
      setStory(imported);
      setCanAutoSave(true);
      setSelectedSceneId(imported.chapters[0].scenes[0].id);
      setSelectedShotId(importedShot.id);
      setSelection(defaultSelection(importedShot));
      setAnimationTarget(defaultAnimationTarget(importedShot));
      setPlayhead(0.32);
      setFeedback(`Imported ${imported.title}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The project could not be imported.";
      setFeedback(`Import failed. ${message} Your current project is unchanged.`);
    }
  }

  function resetProject() {
    const resetStory = createSampleStory();
    const resetShot = firstShot(resetStory);
    if (!resetShot) return;
    setStory(resetStory);
    setCanAutoSave(true);
    setSelectedSceneId(resetStory.chapters[0].scenes[0].id);
    setSelectedShotId(resetShot.id);
    setSelection(defaultSelection(resetShot));
    setAnimationTarget(defaultAnimationTarget(resetShot));
    setPlayhead(0.32);
    setFeedback("Sample project restored.");
  }

  return (
    <div className={`studio-shell${previewing ? " is-previewing" : ""}`}>
      <Toolbar
        projectName={story.title}
        previewing={previewing}
        saveStatus={saveStatus}
        feedback={feedback}
        onProjectNameChange={(title) => commitStory((current) => ({ ...current, title }))}
        onPreviewToggle={() => setPreviewing((current) => !current)}
        onExport={exportProject}
        onImportFile={importProject}
        onReset={resetProject}
      />
      <div className="editor-layout">
        {!previewing && (
          <StorySidebar
            story={story}
            activeShot={activeShot}
            selectedLayerId={selectedLayer?.id}
            saveStatus={saveStatus}
            selectedSceneId={currentScene.id}
            onSceneSelect={selectScene}
            onAddScene={addScene}
            onRemoveScene={removeSelectedScene}
            onShotSelect={(shot) => {
              setSelectedShotId(shot.id);
              setSelection(defaultSelection(shot));
              setAnimationTarget(defaultAnimationTarget(shot));
            }}
            onAddShot={addShot}
            onRemoveShot={removeSelectedShot}
            onAssetSelect={selectAsset}
          />
        )}
        <main className="composition-area" aria-label="Shot composition">
          <div className="composition-heading">
            <div>
              <span className="eyebrow">{currentScene.title}</span>
              <h1>{activeShot.title}</h1>
            </div>
            {previewing && <span className="preview-note">Shot preview · no story playback</span>}
          </div>
          <ShotCanvas
            shot={activeShot}
            playhead={playhead}
            selectedLayerId={selectedLayerForCanvas}
            onLayerSelect={(id) => {
              setSelection({ type: "layer", id });
              setAnimationTarget({ type: "layer", layerId: id });
            }}
          />
        </main>
        {!previewing && (selection.type === "keyframe" && selectedKeyframe ? (
            <KeyframeInspector
              keyframe={selectedKeyframe}
              target={selection.target}
              targetLabel={selectedKeyframeTargetLabel}
              onUpdate={(update) => updateKeyframe(selection.target, selection.id, update)}
              onRemove={() => removeKeyframe(selection.target, selection.id)}
            />
          ) : (
            <Inspector
              layer={selectedLayer}
              beat={selectedBeat}
              onLayerUpdate={(update) => selectedLayer && updateLayer(selectedLayer.id, update)}
              onBeatUpdate={(update) => selectedBeat && updateBeat(selectedBeat.id, update)}
              onBeatRemove={removeSelectedBeat}
            />
          ))}
      </div>
      {!previewing && (
        <Timeline
          shot={activeShot}
          playhead={playhead}
          onPlayheadChange={setPlayhead}
          onBeatSelect={(id) => setSelection({ type: "beat", id })}
          onBeatAdd={addBeat}
          animationTarget={activeAnimationTarget}
          selectedKeyframe={selection.type === "keyframe" ? { id: selection.id, target: selection.target } : undefined}
          onAnimationTargetChange={selectAnimationTarget}
          onKeyframeAdd={addKeyframe}
          onKeyframeSelect={(target, id) => {
            setAnimationTarget(target);
            setSelection({ type: "keyframe", target, id });
          }}
        />
      )}
    </div>
  );
}