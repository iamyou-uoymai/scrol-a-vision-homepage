import type { AnimationKeyframe, AnimationTarget, CameraTransform, Keyframe, LayerTransform, Shot } from "../types/story";

export type AnimationTransform = CameraTransform | LayerTransform;

export const DEFAULT_CAMERA_TRANSFORM: CameraTransform = {
  x: 0,
  y: 0,
  scale: 100,
  rotation: 0,
};

export function getAnimationTrack(shot: Shot, target: AnimationTarget): readonly AnimationKeyframe[] {
  if (target.type === "camera") return shot.animation.camera;
  return shot.animation.layers[target.layerId] ?? [];
}

export function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(1, progress));
}

function easeInOut(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

function interpolateTransform<TTransform extends AnimationTransform>(
  from: TTransform,
  to: TTransform,
  progress: number,
): TTransform {
  const transform: CameraTransform = {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    scale: from.scale + (to.scale - from.scale) * progress,
    rotation: from.rotation + (to.rotation - from.rotation) * progress,
  };
  if ("opacity" in from && "opacity" in to) {
    return { ...transform, opacity: from.opacity + (to.opacity - from.opacity) * progress } as TTransform;
  }
  return transform as TTransform;
}

export function evaluateAnimationTrack<TTransform extends AnimationTransform>(
  keyframes: readonly Keyframe<TTransform>[] | undefined,
  progress: number,
): TTransform | undefined {
  if (!keyframes?.length) return undefined;
  const normalized = clampProgress(progress);
  if (keyframes.length === 1 || normalized <= keyframes[0].progress) return keyframes[0].transform;

  const lastKeyframe = keyframes[keyframes.length - 1];
  if (normalized >= lastKeyframe.progress) return lastKeyframe.transform;

  const rightIndex = keyframes.findIndex((keyframe) => keyframe.progress >= normalized);
  const from = keyframes[rightIndex - 1];
  const to = keyframes[rightIndex];
  const segmentProgress = (normalized - from.progress) / (to.progress - from.progress);
  const easedProgress = from.easing === "ease-in-out" ? easeInOut(segmentProgress) : segmentProgress;
  return interpolateTransform(from.transform, to.transform, easedProgress);
}