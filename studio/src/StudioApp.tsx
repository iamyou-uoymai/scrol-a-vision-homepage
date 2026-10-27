import { useEffect, useMemo, useReducer, useState } from "react";
import { clampProgress, DEFAULT_CAMERA_TRANSFORM, evaluateAnimationTrack, getAnimationTrack } from "./data/animation";
import { resolveCompositionPreview, traversalCoordinateForShotProgress } from "./data/compositionPreview";
import { createSampleStory, firstShot, loadStoredStory, parseImportedStory, saveStoredStory, serializeStory } from "./data/storyStorage";
import { Inspector } from "./components/Inspector";
import { KeyframeInspector } from "./components/KeyframeInspector";
import { ShotCanvas } from "./components/ShotCanvas";
import { StorySidebar } from "./components/StorySidebar";
import { Timeline } from "./components/Timeline";
import { Toolbar } from "./components/Toolbar";
import type { AnimationTarget, Beat, CameraTransform, CompositionCue, CompositionCueTrack, Keyframe, KeyframeUpdate, LayerTransform, Motif, Passage, PauseInterval, Phrase, PresentationIntervalCue, PresentationIntervalCueUpdate, Scene, Shot, Story, VisualLayerUpdate } from "./types/story";
import { compileNarrativePath, listNarrativeUnits, narrativeSelectionSpan, projectLocalPathSpan } from "./data/studioPath";
import type { NarrativeUnitView } from "./data/studioPath";
import { projectStudioSelection, studioEditorReducer } from "./data/studioSelection";
import type { StudioEditorState, StudioObjectSelection } from "./data/studioSelection";
import { duplicateShotKeyframe, insertShotKeyframe, reorderSceneShot, removeShotKeyframe, updateShotKeyframe, updateShotLayer } from "./data/studioCommands";
import { resolveLayerTransformEditTarget } from "./data/stageInteraction";
import type { StageTransformEditTarget } from "./data/stageInteraction";
import { addCreativeInterval, removeCreativeInterval, updateCreativeInterval } from "./data/studioCommands";
import { addBeat, addMovement, addPassage, addPause, addPhrase, addMotif, findNarrativeItem, moveNarrativeItem, removeBeat, removeMovement, removePassage, removePause, removePhrase, removeMotif, updateBeat, updateMovement, updateMotif, updatePassage, updatePause, updatePhrase } from "./data/narrativeCommands";
import type { NarrativeItem, NarrativeKind } from "./data/narrativeCommands";
import { validateStory } from "./data/storyValidation";
import { ValidationPanel } from "./components/ValidationPanel";
import { compileShotPath } from "./player/progress";

function defaultSelection(shot: Shot): StudioObjectSelection {
  const layer = shot.layers[1] ?? shot.layers[0];
  if (layer) return { domain: "composition", kind: "layer", id: layer.id };
  const cue = shot.cues[0];
  return cue
    ? { domain: "composition", kind: "cue", id: cue.id }
    : { domain: "composition", kind: "shot", id: shot.id };
}

function createInitialEditorState(story: Story): StudioEditorState {
  const scene = story.composition.chapters[0]?.scenes[0];
  const shot = scene?.shots[0];
  const shotPosition = 0.32;
  const path = compileShotPath(scene?.shots);
  return {
    selection: {
      object: shot ? defaultSelection(shot) : { domain: "composition", kind: "scene", id: scene?.id ?? "" },
      compositionContext: { sceneId: scene?.id ?? "", shotId: shot?.id ?? "" },
    },
    shotPosition,
    traversalPosition: shot ? traversalCoordinateForShotProgress(path, shot.id, shotPosition) ?? 0 : 0,
  };
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
    cues: [],
    animation: { camera: [], layers: {} },
  };
}

function defaultAnimationTarget(shot: Shot): AnimationTarget {
  const layer = shot.layers.find((item) => item.kind === "character") ?? shot.layers[0];
  return layer ? { type: "layer", layerId: layer.id } : { type: "camera" };
}

function createUniqueStoryId(story: Story, prefix: string): string {
  const usedIds = new Set<string>();
  const collectIds = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(collectIds);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    const record = value as Record<string, unknown>;
    if (typeof record.id === "string") usedIds.add(record.id);
    Object.values(record).forEach(collectIds);
  };
  collectIds(story);
  let id = `${prefix}-${crypto.randomUUID()}`;
  while (usedIds.has(id)) id = `${prefix}-${crypto.randomUUID()}`;
  return id;
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
  const [editorState, dispatchEditor] = useReducer(studioEditorReducer, initialProject.story, createInitialEditorState);
  const selection = editorState.selection;
  const playhead = editorState.shotPosition;
  const traversalPosition = editorState.traversalPosition;
  const [animationTarget, setAnimationTarget] = useState<AnimationTarget>(() => {
    const shot = firstShot(initialProject.story);
    return shot ? defaultAnimationTarget(shot) : { type: "camera" };
  });
  const [previewing, setPreviewing] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);

  function setSelection(object: StudioObjectSelection, compositionContext = selection.compositionContext) {
    dispatchEditor({ type: "select", selection: { object, compositionContext } });
  }

  function setPlayhead(position: number) {
    dispatchEditor({ type: "set-shot-position", position });
  }

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

  const currentChapter = story.composition.chapters[0];
  const currentScene = currentChapter?.scenes.find((scene) => scene.id === selection.compositionContext.sceneId) ?? currentChapter?.scenes[0];
  const activeShot = currentScene?.shots.find((shot) => shot.id === selection.compositionContext.shotId) ?? currentScene?.shots[0];
  const compositionPath = useMemo(() => compileShotPath(currentScene?.shots), [currentScene?.shots]);
  const compositionPreview = useMemo(
    () => resolveCompositionPreview(compositionPath, traversalPosition),
    [compositionPath, traversalPosition],
  );
  const previewShot = compositionPreview.kind === "active" ? compositionPreview.shot : undefined;
  const isActiveShotPreview = previewShot?.id === activeShot?.id;
  const narrativePath = useMemo(() => compileNarrativePath(story), [story]);
  const narrativeUnits = useMemo(() => listNarrativeUnits(story), [story]);
  const validationReport = useMemo(() => validateStory(story), [story]);
  const motifTargets = useMemo(() => {
    const compositionTargets = story.composition.chapters.flatMap((chapter) => [
      { id: chapter.id, label: `Chapter / ${chapter.title}` },
      ...chapter.scenes.flatMap((scene) => [
        { id: scene.id, label: `Scene / ${scene.title}` },
        ...scene.shots.flatMap((shot) => [
          { id: shot.id, label: `Shot / ${shot.title}` },
          ...shot.layers.map((layer) => ({ id: layer.id, label: `Layer / ${layer.name}` })),
          ...shot.cues.map((cue) => ({ id: cue.id, label: `Cue / ${cue.label}` })),
          ...(shot.creativeIntervals ?? []).map((interval) => ({ id: interval.id, label: `${interval.kind} / ${shot.title}` })),
        ]),
      ]),
    ]);
    return [
      ...narrativeUnits.map((unit) => ({ id: unit.id, label: `${unit.kind} / ${unit.title}` })),
      ...compositionTargets,
    ];
  }, [narrativeUnits, story.composition.chapters]);
  const selectionProjection = projectStudioSelection(selection);

  if (!currentScene || !activeShot) return null;

  const selectedObject = selection.object;
  const selectedLayer = selectedObject.domain === "composition" && selectedObject.kind === "layer"
    ? activeShot.layers.find((layer) => layer.id === selectedObject.id)
    : undefined;
  const selectedCue = selectedObject.domain === "composition" && selectedObject.kind === "cue"
    ? activeShot.cues.find((cue) => cue.id === selectedObject.id)
    : undefined;
  const selectedKeyframe = selectedObject.domain === "composition" && selectedObject.kind === "keyframe"
    ? getAnimationTrack(activeShot, selectedObject.target).find((keyframe) => keyframe.id === selectedObject.id)
    : undefined;
  const stageSelectedLayer = previewShot?.layers.find((layer) => layer.id === selectionProjection.stage.selectedLayerId);
  const stageSelectedLayerTrack = stageSelectedLayer && previewShot ? previewShot.animation.layers[stageSelectedLayer.id] ?? [] : [];
  const stageSelectedLayerKeyframe = isActiveShotPreview && selectedObject.domain === "composition"
    && selectedObject.kind === "keyframe"
    && selectedObject.target.type === "layer"
    && selectedObject.target.layerId === stageSelectedLayer?.id
    ? selectedKeyframe
    : undefined;
  const stageTransformEditTarget = stageSelectedLayer && isActiveShotPreview && compositionPreview.kind === "active"
    ? resolveLayerTransformEditTarget(stageSelectedLayerTrack, stageSelectedLayerKeyframe?.id, compositionPreview.shotProgress)
    : undefined;
  const stageTransformEditMessage = previewing
    ? "Preview mode is read-only; leave preview to manipulate this layer."
    : previewShot && !isActiveShotPreview
      ? `Previewing ${previewShot.title}; ${activeShot.title} remains the editing target.`
    : !previewShot
      ? "No composition Shot is available at this traversal position."
    : !stageSelectedLayer
      ? undefined
      : stageTransformEditTarget?.kind === "base"
        ? "Drag the layer to move it; use the corner and rotation handles to transform it."
        : stageTransformEditTarget?.kind === "keyframe" && stageSelectedLayerKeyframe
          ? `Editing the authored keyframe at ${Math.round(stageSelectedLayerKeyframe.progress * 100)}%. Other keyframes are unchanged.`
          : stageSelectedLayerKeyframe
            ? `Move the playhead to ${Math.round(stageSelectedLayerKeyframe.progress * 100)}% to edit this keyframe.`
            : "This layer is animated. Select one of its keyframes at the playhead to edit without changing the animation curve.";
  const selectedNarrativeUnit = selectedObject.domain === "narrative"
    ? narrativeUnits.find((unit) => unit.id === selectedObject.id)
    : undefined;
  const selectedNarrativeItem = selectedObject.domain === "narrative"
    ? findNarrativeItem(story, selectedObject.kind, selectedObject.id)
    : undefined;
  const selectedMotif = selectedObject.domain === "editorial" && selectedObject.kind === "motif"
    ? story.motifs?.find((motif) => motif.id === selectedObject.id)
    : undefined;
  const selectedCreativeInterval = selectedObject.domain === "composition" && selectedObject.kind === "creative-interval"
    ? activeShot.creativeIntervals?.find((interval) => interval.id === selectedObject.id)
    : undefined;
  const selectedNarrativeSpan = narrativeSelectionSpan(narrativePath, selectedObject);
  const selectedCompositionInterval = selectedObject.domain === "composition" && selectedObject.kind !== "scene"
    ? compositionPath.intervals.find((interval) => interval.id === (
      selectedObject.kind === "shot" ? selectedObject.id : selection.compositionContext.shotId
    ))
    : undefined;
  const selectedPathSpan = selectedObject.domain === "narrative"
    ? selectedNarrativeSpan
    : selectedObject.domain === "composition" && selectedObject.kind === "cue" && selectedCompositionInterval && selectedCue
      ? projectLocalPathSpan(selectedCompositionInterval, selectedCue.start, selectedCue.duration)
      : selectedObject.domain === "composition" && selectedObject.kind === "keyframe" && selectedCompositionInterval && selectedKeyframe
        ? projectLocalPathSpan(selectedCompositionInterval, selectedKeyframe.progress, 0)
      : selectedObject.domain === "composition" && selectedObject.kind === "creative-interval" && selectedCompositionInterval && selectedCreativeInterval
        ? projectLocalPathSpan(selectedCompositionInterval, selectedCreativeInterval.start, selectedCreativeInterval.end - selectedCreativeInterval.start)
    : selectedObject.kind === "scene"
      ? { start: 0, end: 1 }
      : selectedCompositionInterval
        ? { start: selectedCompositionInterval.start, end: selectedCompositionInterval.end }
        : undefined;
  const activeAnimationTarget = animationTarget.type === "camera" || activeShot.layers.some((layer) => layer.id === animationTarget.layerId)
    ? animationTarget
    : defaultAnimationTarget(activeShot);
  let selectedKeyframeTargetLabel = "";
  if (selectedObject.domain === "composition" && selectedObject.kind === "keyframe") {
    const target = selectedObject.target;
    if (target.type === "camera") selectedKeyframeTargetLabel = "Camera";
    else selectedKeyframeTargetLabel = activeShot.layers.find((layer) => layer.id === target.layerId)?.name ?? "Layer";
  }

  function setShotPositionAtPath(path: ReturnType<typeof compileShotPath>, shotId: string, position: number) {
    const normalizedPosition = clampProgress(position);
    setPlayhead(normalizedPosition);
    const coordinate = traversalCoordinateForShotProgress(path, shotId, normalizedPosition);
    if (coordinate !== undefined) dispatchEditor({ type: "set-traversal-position", position: coordinate });
  }

  function setActiveShotPosition(position: number) {
    setShotPositionAtPath(compositionPath, activeShot.id, position);
  }

  function setTraversalPosition(position: number) {
    const normalizedPosition = clampProgress(position);
    dispatchEditor({ type: "set-traversal-position", position: normalizedPosition });
    const preview = resolveCompositionPreview(compositionPath, normalizedPosition);
    if (preview.kind === "active" && preview.shot.id === activeShot.id) {
      setPlayhead(preview.shotProgress);
    }
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
      composition: { ...currentStory.composition, chapters: currentStory.composition.chapters.map((chapter) => ({
        ...chapter,
        scenes: chapter.scenes.map((scene) => ({
          ...scene,
          shots: scene.shots.map((shot) => shot.id === activeShot.id ? update(shot) : shot),
        })),
      })) },
    }));
  }

  function updateNarrative(kind: NarrativeKind, id: string, update: Partial<NarrativeItem>) {
    commitStory((current) => {
      if (kind === "movement") return updateMovement(current, id, update as Partial<import("./types/story").Movement>);
      if (kind === "passage") return updatePassage(current, id, update as Partial<Passage>);
      if (kind === "phrase") return updatePhrase(current, id, update as Partial<Phrase>);
      if (kind === "pause") return updatePause(current, id, update as Partial<PauseInterval>);
      return updateBeat(current, id, update as Partial<Beat>);
    });
  }

  function addNarrativeMovement() {
    const movement = { id: crypto.randomUUID(), title: "New Movement", passages: [] };
    commitStory((current) => addMovement(current, movement));
    setSelection({ domain: "narrative", kind: "movement", id: movement.id });
  }

  function addNarrativeChild(unit: NarrativeUnitView) {
    if (unit.kind === "movement") {
      const passage: Passage = { id: crypto.randomUUID(), title: "New Passage", phrases: [] };
      commitStory((current) => addPassage(current, unit.id, passage));
      setSelection({ domain: "narrative", kind: "passage", id: passage.id });
    } else if (unit.kind === "passage") {
      const phrase: Phrase = { id: crypto.randomUUID(), title: "New Phrase", beats: [] };
      commitStory((current) => addPhrase(current, unit.id, phrase));
      setSelection({ domain: "narrative", kind: "phrase", id: phrase.id });
    } else if (unit.kind === "phrase") {
      const beat: Beat = { id: crypto.randomUUID(), title: "New Beat" };
      commitStory((current) => addBeat(current, unit.id, beat));
      setSelection({ domain: "narrative", kind: "beat", id: beat.id });
    }
  }

  function addNarrativePause(unit: NarrativeUnitView) {
    if (unit.kind !== "passage") return;
    const pause: PauseInterval = { id: crypto.randomUUID() };
    commitStory((current) => addPause(current, unit.id, pause));
    setSelection({ domain: "narrative", kind: "pause", id: pause.id });
  }

  function removeNarrativeUnit(unit: NarrativeUnitView) {
    const removeUnit = unit.kind === "movement"
      ? removeMovement
      : unit.kind === "passage"
        ? removePassage
        : unit.kind === "phrase"
          ? removePhrase
          : unit.kind === "pause"
            ? removePause
            : removeBeat;
    commitStory((current) => removeUnit(current, unit.id));
    const parentSelection = unit.kind === "beat" && unit.phraseId
      ? { domain: "narrative" as const, kind: "phrase" as const, id: unit.phraseId }
      : unit.kind === "pause" && unit.passageId
        ? { domain: "narrative" as const, kind: "passage" as const, id: unit.passageId }
      : unit.kind === "phrase" && unit.passageId
        ? { domain: "narrative" as const, kind: "passage" as const, id: unit.passageId }
        : unit.kind === "passage"
          ? { domain: "narrative" as const, kind: "movement" as const, id: unit.movementId }
          : undefined;
    const remainingMovements = unit.kind === "movement"
      ? story.movements.filter((movement) => movement.id !== unit.id)
      : story.movements;
    if (parentSelection && findNarrativeItem(story, parentSelection.kind, parentSelection.id)) {
      setSelection(parentSelection);
    } else {
      const firstMovement = remainingMovements[0];
      setSelection(firstMovement
        ? { domain: "narrative", kind: "movement", id: firstMovement.id }
        : defaultSelection(activeShot));
    }
  }

  function moveNarrative(unit: NarrativeUnitView, direction: -1 | 1) {
    commitStory((current) => moveNarrativeItem(current, unit.kind, unit.id, direction));
  }

  function createMotif() {
    const motif: Motif = { id: crypto.randomUUID(), name: "New Motif", occurrenceIds: [] };
    commitStory((current) => addMotif(current, motif));
    setSelection({ domain: "editorial", kind: "motif", id: motif.id });
  }

  function updateAuthoredMotif(id: string, update: Partial<Motif>) {
    commitStory((current) => updateMotif(current, id, update));
  }

  function removeAuthoredMotif(id: string) {
    commitStory((current) => removeMotif(current, id));
    setSelection(defaultSelection(activeShot));
  }

  function addIntentionalInterval(kind: PresentationIntervalCue["kind"]) {
    if (!isActiveShotPreview) return;
    const start = Math.min(playhead, 0.74);
    const interval: PresentationIntervalCue = {
      id: crypto.randomUUID(),
      kind,
      start,
      end: Math.min(1, start + 0.16),
    };
    commitStory((current) => addCreativeInterval(current, activeShot.id, interval));
    setSelection({ domain: "composition", kind: "creative-interval", id: interval.id });
  }

  function editIntentionalInterval(id: string, update: PresentationIntervalCueUpdate) {
    commitStory((current) => updateCreativeInterval(current, activeShot.id, id, update));
  }

  function deleteIntentionalInterval() {
    if (!selectedCreativeInterval) return;
    commitStory((current) => removeCreativeInterval(current, activeShot.id, selectedCreativeInterval.id));
    setSelection(defaultSelection(activeShot));
  }

  function updateLayer(id: string, update: VisualLayerUpdate) {
    updateActiveShot((shot) => updateShotLayer(shot, id, update));
  }

  function updateLayerTransformFromStage(id: string, transform: Partial<LayerTransform>, target: StageTransformEditTarget) {
    if (target.kind === "base") {
      updateLayer(id, { transform });
      return;
    }
    updateKeyframe({ type: "layer", layerId: id }, target.keyframeId, { transform });
  }

  function updateCue(id: string, update: Partial<CompositionCue>) {
    updateActiveShot((shot) => ({
      ...shot,
      cues: shot.cues.map((cue) => {
        if (cue.id !== id) return cue;
        const next = { ...cue, ...update };
        next.start = Math.max(0, Math.min(1, next.start));
        next.duration = Math.max(Number.EPSILON, Math.min(1 - next.start, next.duration));
        return next;
      }),
    }));
  }

  function addKeyframe(target: AnimationTarget) {
    if (!isActiveShotPreview) {
      setFeedback("Preview this Shot before adding a keyframe at its Shot-local position.");
      return;
    }
    const existing = getAnimationTrack(activeShot, target).find((keyframe) => Math.abs(keyframe.progress - playhead) < 1e-9);
    if (existing) {
      setActiveShotPosition(existing.progress);
      setSelection({ domain: "composition", kind: "keyframe", target, id: existing.id });
      setFeedback(`Selected the existing keyframe at ${Math.round(existing.progress * 100)}%.`);
      return;
    }

    const layer = target.type === "layer" ? activeShot.layers.find((item) => item.id === target.layerId) : undefined;
    if (target.type === "layer" && !layer) return;
    const transform = target.type === "camera"
      ? evaluateAnimationTrack(activeShot.animation.camera, playhead) ?? DEFAULT_CAMERA_TRANSFORM
      : evaluateAnimationTrack(activeShot.animation.layers[target.layerId], playhead) ?? layer!.transform;
    const keyframe: Keyframe<CameraTransform | LayerTransform> = {
      id: createUniqueStoryId(story, "keyframe"),
      progress: playhead,
      transform: { ...transform },
      easing: "ease-in-out",
    };
    try {
      insertShotKeyframe(activeShot, target, keyframe);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not add keyframe.");
      return;
    }
    updateActiveShot((shot) => insertShotKeyframe(shot, target, keyframe));
    setActiveShotPosition(keyframe.progress);
    setSelection({ domain: "composition", kind: "keyframe", target, id: keyframe.id });
    setAnimationTarget(target);
    setFeedback("");
  }

  function duplicateKeyframe(target: AnimationTarget, id: string, progress: number) {
    const duplicateId = createUniqueStoryId(story, "keyframe");
    try {
      duplicateShotKeyframe(activeShot, target, id, duplicateId, progress);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not duplicate keyframe.");
      return;
    }
    updateActiveShot((shot) => duplicateShotKeyframe(shot, target, id, duplicateId, progress));
    setActiveShotPosition(progress);
    setSelection({ domain: "composition", kind: "keyframe", target, id: duplicateId });
    setAnimationTarget(target);
    setFeedback("");
  }

  function updateKeyframe(target: AnimationTarget, id: string, update: KeyframeUpdate) {
    const track = getAnimationTrack(activeShot, target);
    const keyframe = track.find((item) => item.id === id);
    if (!keyframe) return;
    const progress = update.progress ?? keyframe.progress;
    try {
      updateShotKeyframe(activeShot, target, id, { ...update, progress });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not update keyframe.");
      return;
    }
    updateActiveShot((shot) => updateShotKeyframe(shot, target, id, { ...update, progress }));
    if (update.progress !== undefined && selectedObject.domain === "composition" && selectedObject.kind === "keyframe" && selectedObject.id === id) {
      setActiveShotPosition(progress);
    }
    setFeedback("");
  }

  function removeKeyframe(target: AnimationTarget, id: string) {
    updateActiveShot((shot) => removeShotKeyframe(shot, target, id));
    setSelection(target.type === "layer"
      ? { domain: "composition", kind: "layer", id: target.layerId }
      : defaultSelection(activeShot));
    setFeedback("");
  }

  function selectAnimationTarget(target: AnimationTarget) {
    setAnimationTarget(target);
    const keyframe = getAnimationTrack(activeShot, target)[0];
    if (keyframe) {
      setActiveShotPosition(keyframe.progress);
      setSelection({ domain: "composition", kind: "keyframe", target, id: keyframe.id });
    }
    else if (target.type === "layer") setSelection({ domain: "composition", kind: "layer", id: target.layerId });
    else setSelection(defaultSelection(activeShot));
  }

  function addShot() {
    const nextShot = createShot(currentScene.shots.length + 1);
    const nextShots = [...currentScene.shots, nextShot];
    commitStory((currentStory) => ({
      ...currentStory,
      composition: { ...currentStory.composition, chapters: currentStory.composition.chapters.map((chapter) => ({
        ...chapter,
        scenes: chapter.scenes.map((scene) => scene.id === currentScene.id
          ? { ...scene, shots: nextShots }
          : scene),
      })) },
    }));
    setSelection(defaultSelection(nextShot), { sceneId: currentScene.id, shotId: nextShot.id });
    setAnimationTarget(defaultAnimationTarget(nextShot));
    setShotPositionAtPath(compileShotPath(nextShots), nextShot.id, playhead);
  }

  function moveShot(id: string, direction: -1 | 1) {
    commitStory((currentStory) => ({
      ...currentStory,
      composition: { ...currentStory.composition, chapters: currentStory.composition.chapters.map((chapter) => ({
        ...chapter,
        scenes: chapter.scenes.map((scene) => scene.id === currentScene.id
          ? reorderSceneShot(scene, id, direction)
          : scene),
      })) },
    }));
  }

  function addScene() {
    const scene: Scene = {
      id: crypto.randomUUID(),
      title: `Scene ${String(currentChapter.scenes.length + 1).padStart(2, "0")}`,
      shots: [createShot(1)],
    };
    commitStory((currentStory) => ({
      ...currentStory,
      composition: { ...currentStory.composition, chapters: currentStory.composition.chapters.map((chapter) => chapter.id === currentChapter.id
        ? { ...chapter, scenes: [...chapter.scenes, scene] }
        : chapter) },
    }));
    setSelection(defaultSelection(scene.shots[0]), { sceneId: scene.id, shotId: scene.shots[0].id });
    setAnimationTarget(defaultAnimationTarget(scene.shots[0]));
    setShotPositionAtPath(compileShotPath(scene.shots), scene.shots[0].id, playhead);
  }

  function removeSelectedScene() {
    if (currentChapter.scenes.length < 2) return;
    const remainingScenes = currentChapter.scenes.filter((scene) => scene.id !== currentScene.id);
    const nextScene = remainingScenes[0];
    const nextShot = nextScene.shots[0];
    commitStory((currentStory) => ({
      ...currentStory,
      composition: { ...currentStory.composition, chapters: currentStory.composition.chapters.map((chapter) => chapter.id === currentChapter.id
        ? { ...chapter, scenes: remainingScenes }
        : chapter) },
    }));
    setSelection(defaultSelection(nextShot), { sceneId: nextScene.id, shotId: nextShot.id });
    setAnimationTarget(defaultAnimationTarget(nextShot));
    setShotPositionAtPath(compileShotPath(nextScene.shots), nextShot.id, playhead);
  }

  function selectScene(scene: Scene) {
    const nextShot = scene.shots[0];
    setSelection({ domain: "composition", kind: "scene", id: scene.id }, { sceneId: scene.id, shotId: nextShot.id });
    setAnimationTarget(defaultAnimationTarget(nextShot));
    setShotPositionAtPath(compileShotPath(scene.shots), nextShot.id, playhead);
  }

  function removeSelectedShot() {
    if (currentScene.shots.length < 2) return;
    const remainingShots = currentScene.shots.filter((shot) => shot.id !== activeShot.id);
    commitStory((currentStory) => ({
      ...currentStory,
      composition: { ...currentStory.composition, chapters: currentStory.composition.chapters.map((chapter) => ({
        ...chapter,
        scenes: chapter.scenes.map((scene) => scene.id === currentScene.id
          ? { ...scene, shots: remainingShots }
          : scene),
      })) },
    }));
    setSelection(defaultSelection(remainingShots[0]), { sceneId: currentScene.id, shotId: remainingShots[0].id });
    setAnimationTarget(defaultAnimationTarget(remainingShots[0]));
    setShotPositionAtPath(compileShotPath(remainingShots), remainingShots[0].id, playhead);
  }

  function addCue(track: CompositionCueTrack) {
    if (!isActiveShotPreview) return;
    const labels: Record<CompositionCueTrack, string> = {
      camera: "Camera move",
      character: "Character beat",
      dialogue: "New dialogue",
      sound: "Sound cue",
      scroll: "Scroll hold",
    };
    const cue: CompositionCue = {
      id: crypto.randomUUID(),
      track,
      label: labels[track],
      start: Math.min(playhead, 0.82),
      duration: 0.16,
    };
    updateActiveShot((shot) => ({ ...shot, cues: [...shot.cues, cue] }));
    setSelection({ domain: "composition", kind: "cue", id: cue.id });
  }

  function removeSelectedCue() {
    if (!selectedCue) return;
    updateActiveShot((shot) => ({ ...shot, cues: shot.cues.filter((cue) => cue.id !== selectedCue.id) }));
    setSelection(defaultSelection(activeShot));
  }

  function selectAsset(assetId: string) {
    const layer = activeShot.layers.find((item) =>
      ("assetId" in item && item.assetId === assetId) || item.id === assetId || (assetId === "character" && item.kind === "character"),
    );
    if (layer) {
      setSelection({ domain: "composition", kind: "layer", id: layer.id });
      setAnimationTarget({ type: "layer", layerId: layer.id });
    }
  }

  function selectNarrativeUnit(unit: NarrativeUnitView) {
    setSelection({ domain: "narrative", kind: unit.kind, id: unit.id });
  }

  function selectDiagnosticObject(objectId?: string) {
    if (!objectId) return;
    const narrativeUnit = narrativeUnits.find((unit) => unit.id === objectId);
    if (narrativeUnit) {
      selectNarrativeUnit(narrativeUnit);
      return;
    }
    const motif = story.motifs?.find((item) => item.id === objectId);
    if (motif) {
      setSelection({ domain: "editorial", kind: "motif", id: motif.id });
      return;
    }

    const firstChapter = story.composition.chapters[0];
    for (const scene of firstChapter?.scenes ?? []) {
      const sceneShot = scene.shots[0];
      if (scene.id === objectId && sceneShot) {
        setSelection({ domain: "composition", kind: "scene", id: scene.id }, { sceneId: scene.id, shotId: sceneShot.id });
        return;
      }
      for (const shot of scene.shots) {
        const context = { sceneId: scene.id, shotId: shot.id };
        if (shot.id === objectId) {
          setSelection({ domain: "composition", kind: "shot", id: shot.id }, context);
          return;
        }
        const layer = shot.layers.find((item) => item.id === objectId);
        if (layer) {
          setSelection({ domain: "composition", kind: "layer", id: layer.id }, context);
          return;
        }
        const cue = shot.cues.find((item) => item.id === objectId);
        if (cue) {
          setSelection({ domain: "composition", kind: "cue", id: cue.id }, context);
          return;
        }
        const interval = shot.creativeIntervals?.find((item) => item.id === objectId);
        if (interval) {
          setSelection({ domain: "composition", kind: "creative-interval", id: interval.id }, context);
          return;
        }
      }
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
      const importedScene = imported.composition.chapters[0].scenes[0];
      setStory(imported);
      setCanAutoSave(true);
      setSelection(defaultSelection(importedShot), { sceneId: importedScene.id, shotId: importedShot.id });
      setAnimationTarget(defaultAnimationTarget(importedShot));
      setShotPositionAtPath(compileShotPath(importedScene.shots), importedShot.id, 0.32);
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
    const resetScene = resetStory.composition.chapters[0].scenes[0];
    setStory(resetStory);
    setCanAutoSave(true);
    setSelection(defaultSelection(resetShot), { sceneId: resetScene.id, shotId: resetShot.id });
    setAnimationTarget(defaultAnimationTarget(resetShot));
    setShotPositionAtPath(compileShotPath(resetScene.shots), resetShot.id, 0.32);
    setFeedback("Sample project restored.");
  }

  return (
    <div className={`studio-shell${previewing ? " is-previewing" : ""}`}>
      <Toolbar
        projectName={story.title}
        previewing={previewing}
        validationOpen={validationOpen}
        validationCount={validationReport.structural.length + validationReport.playback.length + validationReport.editorial.length}
        saveStatus={saveStatus}
        feedback={feedback}
        onProjectNameChange={(title) => commitStory((current) => ({ ...current, title }))}
        onPreviewToggle={() => setPreviewing((current) => !current)}
        onValidationToggle={() => setValidationOpen((current) => !current)}
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
            selection={selectionProjection.navigator}
            narrativeUnits={narrativeUnits}
            motifs={story.motifs ?? []}
            onSceneSelect={selectScene}
            onAddScene={addScene}
            onRemoveScene={removeSelectedScene}
            onShotSelect={(shot) => {
              setSelection({ domain: "composition", kind: "shot", id: shot.id }, { sceneId: currentScene.id, shotId: shot.id });
              setAnimationTarget(defaultAnimationTarget(shot));
              setShotPositionAtPath(compositionPath, shot.id, playhead);
            }}
            onShotMove={moveShot}
            onNarrativeSelect={selectNarrativeUnit}
            onNarrativeAddMovement={addNarrativeMovement}
            onNarrativeAddChild={addNarrativeChild}
            onNarrativeAddPause={addNarrativePause}
            onNarrativeRemove={removeNarrativeUnit}
            onNarrativeMove={moveNarrative}
            onMotifSelect={(motif) => setSelection({ domain: "editorial", kind: "motif", id: motif.id })}
            onMotifAdd={createMotif}
            onAddShot={addShot}
            onRemoveShot={removeSelectedShot}
            onAssetSelect={selectAsset}
          />
        )}
        <main className="composition-area" aria-label="Shot composition">
          <div className="composition-heading">
            <div>
              <span className="eyebrow">{currentScene.title}</span>
              <h1>{previewShot?.title ?? activeShot.title}</h1>
            </div>
            {previewing
              ? <span className="preview-note">Shot preview · no story playback</span>
              : previewShot && !isActiveShotPreview && <span className="preview-note">Editing {activeShot.title}</span>}
          </div>
          <ShotCanvas
            shot={previewShot ?? activeShot}
            playhead={compositionPreview.kind === "active" ? compositionPreview.shotProgress : 0}
            resolvedPreview={compositionPreview.kind === "active" ? compositionPreview : undefined}
            selection={selectionProjection.stage}
            selectedCue={isActiveShotPreview ? selectedCue : undefined}
            narrativeSelectionLabel={selectedNarrativeUnit?.title}
            transformEditTarget={stageTransformEditTarget}
            transformEditMessage={stageTransformEditMessage}
            editable={!previewing && isActiveShotPreview}
            onLayerSelect={(id) => {
              const stageShot = previewShot ?? activeShot;
              setSelection({ domain: "composition", kind: "layer", id }, { sceneId: currentScene.id, shotId: stageShot.id });
              setAnimationTarget({ type: "layer", layerId: id });
              if (compositionPreview.kind === "active") {
                setShotPositionAtPath(compositionPath, stageShot.id, compositionPreview.shotProgress);
              }
            }}
            onLayerTransformChange={updateLayerTransformFromStage}
          />
        </main>
        {!previewing && (selectedObject.domain === "composition" && selectedObject.kind === "keyframe" && selectedKeyframe ? (
            <KeyframeInspector
              keyframe={selectedKeyframe}
              target={selectedObject.target}
              targetLabel={selectedKeyframeTargetLabel}
              playhead={playhead}
              keyframePositions={getAnimationTrack(activeShot, selectedObject.target).map((frame) => frame.progress)}
              onUpdate={(update) => updateKeyframe(selectedObject.target, selectedObject.id, update)}
              onDuplicate={(progress) => duplicateKeyframe(selectedObject.target, selectedObject.id, progress)}
              onRemove={() => removeKeyframe(selectedObject.target, selectedObject.id)}
            />
          ) : (
            <Inspector
              selection={selectionProjection.inspector}
              narrativeItem={selectedNarrativeItem}
              motif={selectedMotif}
              story={story}
              creativeInterval={selectedCreativeInterval}
              motifTargets={motifTargets}
              pathSpan={selectedPathSpan}
              selectedScene={currentScene}
              selectedShot={activeShot}
              onNarrativeUpdate={updateNarrative}
              onMotifUpdate={updateAuthoredMotif}
              onMotifRemove={removeAuthoredMotif}
              onCreativeIntervalUpdate={editIntentionalInterval}
              onCreativeIntervalRemove={deleteIntentionalInterval}
              layer={selectedLayer}
              hasAnimationTrack={Boolean(selectedLayer && activeShot.animation.layers[selectedLayer.id]?.length)}
              cue={selectedCue}
              onLayerUpdate={(update) => selectedLayer && updateLayer(selectedLayer.id, update)}
              onCueUpdate={(update) => selectedCue && updateCue(selectedCue.id, update)}
              onCueRemove={removeSelectedCue}
            />
          ))}
      </div>
      {!previewing && (
        <Timeline
          shot={activeShot}
          isActiveShotPreview={isActiveShotPreview}
          traversalPosition={traversalPosition}
          compositionPreview={compositionPreview}
          onTraversalChange={setTraversalPosition}
          compositionPath={compositionPath}
          narrativePath={narrativePath}
          selection={selectionProjection.path}
          selectedPathSpan={selectedPathSpan}
          onPathShotSelect={(shot) => {
            setSelection({ domain: "composition", kind: "shot", id: shot.id }, { sceneId: currentScene.id, shotId: shot.id });
            setAnimationTarget(defaultAnimationTarget(shot));
            setShotPositionAtPath(compositionPath, shot.id, playhead);
          }}
          onNarrativeSelect={selectNarrativeUnit}
          playhead={playhead}
          onPlayheadChange={setActiveShotPosition}
          onCueSelect={(id) => setSelection({ domain: "composition", kind: "cue", id })}
          onCueAdd={addCue}
          onCreativeIntervalAdd={addIntentionalInterval}
          onCreativeIntervalSelect={(id) => setSelection({ domain: "composition", kind: "creative-interval", id })}
          animationTarget={activeAnimationTarget}
          selectedKeyframe={selectedObject.domain === "composition" && selectedObject.kind === "keyframe" ? { id: selectedObject.id, target: selectedObject.target } : undefined}
          onAnimationTargetChange={selectAnimationTarget}
          onKeyframeAdd={addKeyframe}
          onKeyframeMove={(target, id, progress) => updateKeyframe(target, id, { progress })}
          onKeyframeSelect={(target, id) => {
            setAnimationTarget(target);
            const keyframe = getAnimationTrack(activeShot, target).find((frame) => frame.id === id);
            if (keyframe) setActiveShotPosition(keyframe.progress);
            setSelection({ domain: "composition", kind: "keyframe", target, id });
          }}
        />
      )}
      {!previewing && validationOpen && (
        <ValidationPanel report={validationReport} onClose={() => setValidationOpen(false)} onSelectObject={selectDiagnosticObject} />
      )}
    </div>
  );
}