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

export function updateShotKeyframe(
  shot: Shot,
  target: AnimationTarget,
  keyframeId: string,
  update: KeyframeUpdate,
): Shot {
  if (target.type === "camera") {
    const camera = shot.animation.camera
      .map((keyframe) => keyframe.id === keyframeId
        ? mergeFrame(keyframe, update, update.progress ?? keyframe.progress)
        : keyframe)
      .sort((left, right) => left.progress - right.progress);
    return { ...shot, animation: { ...shot.animation, camera } };
  }

  const layers = { ...shot.animation.layers };
  const frames = (layers[target.layerId] ?? [])
    .map((keyframe) => keyframe.id === keyframeId
      ? mergeFrame(keyframe, update, update.progress ?? keyframe.progress)
      : keyframe)
    .sort((left, right) => left.progress - right.progress);
  layers[target.layerId] = frames;
  return { ...shot, animation: { ...shot.animation, layers } as ShotAnimation };
}