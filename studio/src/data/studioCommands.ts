import type { AnimationTarget, CameraTransform, Keyframe, KeyframeUpdate, LayerTransform, PresentationIntervalCue, PresentationIntervalCueUpdate, Scene, Shot, ShotAnimation, Story, VisualLayerUpdate } from "../types/story";
import { moveItemById } from "./studioPath";

export function reorderSceneShot(scene: Scene, shotId: string, direction: -1 | 1): Scene {
  return { ...scene, shots: moveItemById(scene.shots, shotId, direction) };
}

export function addCreativeInterval(story: Story, shotId: string, interval: PresentationIntervalCue): Story {
  let found = false;
  const chapters = story.composition.chapters.map((chapter) => ({
    ...chapter,
    scenes: chapter.scenes.map((scene) => ({
      ...scene,
      shots: scene.shots.map((shot) => {
        if (shot.id !== shotId) return shot;
        found = true;
        return { ...shot, creativeIntervals: [...(shot.creativeIntervals ?? []), interval] };
      }),
    })),
  }));
  if (!found) throw new RangeError(`Shot ${shotId} was not found.`);
  return { ...story, composition: { ...story.composition, chapters } };
}

export function updateCreativeInterval(story: Story, shotId: string, intervalId: string, update: PresentationIntervalCueUpdate): Story {
  return { ...story, composition: { ...story.composition, chapters: story.composition.chapters.map((chapter) => ({
    ...chapter,
    scenes: chapter.scenes.map((scene) => ({
      ...scene,
      shots: scene.shots.map((shot) => shot.id === shotId
        ? { ...shot, creativeIntervals: (shot.creativeIntervals ?? []).map((interval) => {
          if (interval.id !== intervalId) return interval;
          const next = { ...interval, ...update, id: interval.id };
          if (next.kind === "void") {
            const { audioChannel: _audioChannel, ...voidCue } = next;
            return voidCue as PresentationIntervalCue;
          }
          return next as PresentationIntervalCue;
        }) }
        : shot),
    })),
  })) } };
}

export function removeCreativeInterval(story: Story, shotId: string, intervalId: string): Story {
  return { ...story, composition: { ...story.composition, chapters: story.composition.chapters.map((chapter) => ({
    ...chapter,
    scenes: chapter.scenes.map((scene) => ({
      ...scene,
      shots: scene.shots.map((shot) => shot.id === shotId
        ? { ...shot, creativeIntervals: (shot.creativeIntervals ?? []).filter((interval) => interval.id !== intervalId) }
        : shot),
    })),
  })) } };
}

export function updateShotLayer(shot: Shot, layerId: string, update: VisualLayerUpdate): Shot {
  return {
    ...shot,
    layers: shot.layers.map((layer) => layer.id === layerId
      ? { ...layer, ...update, transform: { ...layer.transform, ...update.transform } } as typeof layer
      : layer),
  };
}

function mergeFrame<TTransform extends CameraTransform | LayerTransform>(
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

function framesForTarget<TTransform extends CameraTransform | LayerTransform>(
  shot: Shot,
  target: AnimationTarget,
): Keyframe<TTransform>[] {
  return (target.type === "camera" ? shot.animation.camera : shot.animation.layers[target.layerId] ?? []) as Keyframe<TTransform>[];
}

function assertKeyframePosition(
  track: readonly Keyframe<CameraTransform | LayerTransform>[],
  progress: number,
  excludingId?: string,
): void {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new RangeError("Keyframe position must be between 0% and 100%.");
  }
  if (track.some((frame) => frame.id !== excludingId && Math.abs(frame.progress - progress) < 1e-9)) {
    throw new RangeError("Another keyframe already exists at that position.");
  }
}

function allShotKeyframeIds(shot: Shot): Set<string> {
  return new Set([
    ...shot.animation.camera.map((frame) => frame.id),
    ...Object.values(shot.animation.layers).flatMap((track) => track.map((frame) => frame.id)),
  ]);
}

function updateTargetTrack<TTransform extends CameraTransform | LayerTransform>(
  shot: Shot,
  target: AnimationTarget,
  track: Keyframe<TTransform>[],
): Shot {
  if (target.type === "camera") return { ...shot, animation: { ...shot.animation, camera: track as Keyframe<CameraTransform>[] } };
  const layers = { ...shot.animation.layers };
  if (track.length) layers[target.layerId] = track as Keyframe<LayerTransform>[];
  else delete layers[target.layerId];
  return { ...shot, animation: { ...shot.animation, layers } as ShotAnimation };
}

export function insertShotKeyframe<TTransform extends CameraTransform | LayerTransform>(
  shot: Shot,
  target: AnimationTarget,
  keyframe: Keyframe<TTransform>,
): Shot {
  if (target.type === "layer" && !shot.layers.some((layer) => layer.id === target.layerId)) {
    throw new RangeError(`Layer ${target.layerId} was not found in shot ${shot.id}.`);
  }
  const track = framesForTarget<TTransform>(shot, target);
  assertKeyframePosition(track, keyframe.progress);
  if (typeof keyframe.id !== "string" || keyframe.id.trim().length === 0 || allShotKeyframeIds(shot).has(keyframe.id)) {
    throw new RangeError(`Keyframe ID "${keyframe.id}" is empty or already exists in shot ${shot.id}.`);
  }
  return updateTargetTrack(shot, target, [...track, keyframe].sort((left, right) => left.progress - right.progress));
}

export function duplicateShotKeyframe<TTransform extends CameraTransform | LayerTransform>(
  shot: Shot,
  target: AnimationTarget,
  keyframeId: string,
  duplicateId: string,
  progress: number,
): Shot {
  const source = framesForTarget<TTransform>(shot, target).find((frame) => frame.id === keyframeId);
  if (!source) throw new RangeError(`Keyframe ${keyframeId} was not found.`);
  if (duplicateId === keyframeId || allShotKeyframeIds(shot).has(duplicateId)) {
    throw new RangeError(`Keyframe ID "${duplicateId}" already exists in shot ${shot.id}.`);
  }
  return insertShotKeyframe(shot, target, {
    ...source,
    id: duplicateId,
    progress,
    transform: { ...source.transform },
  });
}

export function removeShotKeyframe(shot: Shot, target: AnimationTarget, keyframeId: string): Shot {
  const track = framesForTarget(shot, target);
  const remaining = track.filter((frame) => frame.id !== keyframeId);
  if (remaining.length === track.length) return shot;
  return updateTargetTrack(shot, target, remaining);
}

export function updateShotKeyframe(
  shot: Shot,
  target: AnimationTarget,
  keyframeId: string,
  update: KeyframeUpdate,
): Shot {
  const track = framesForTarget(shot, target);
  const existing = track.find((frame) => frame.id === keyframeId);
  if (!existing) return shot;
  const progress = update.progress ?? existing.progress;
  assertKeyframePosition(track, progress, keyframeId);
  const frames = track
    .map((keyframe) => keyframe.id === keyframeId ? mergeFrame(keyframe, update, progress) : keyframe)
    .sort((left, right) => left.progress - right.progress);
  return updateTargetTrack(shot, target, frames);
}