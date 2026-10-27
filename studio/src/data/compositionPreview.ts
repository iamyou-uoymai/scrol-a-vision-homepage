import { DEFAULT_CAMERA_TRANSFORM, clampProgress, evaluateAnimationTrack } from "./animation";
import { resolveShotAtCompiledPath } from "../player/progress";
import { PATH_BOUNDARY_TOLERANCE } from "./pathCompiler";
import type { CompiledPath } from "./pathCompiler";
import type { CameraTransform, LayerTransform, Shot } from "../types/story";
import type { ShotPathAllocation } from "../player/progress";

export interface EmptyCompositionPreview {
  readonly kind: "empty";
  readonly traversalProgress: number;
}

export interface ActiveCompositionPreview {
  readonly kind: "active";
  readonly traversalProgress: number;
  readonly shot: Shot;
  readonly shotIndex: number;
  readonly shotProgress: number;
  readonly cameraTransform: CameraTransform;
  readonly layerTransforms: Readonly<Record<string, LayerTransform>>;
}

export type CompositionPreview = EmptyCompositionPreview | ActiveCompositionPreview;

export function resolveCompositionPreview(
  path: CompiledPath<ShotPathAllocation>,
  traversalProgress: number,
): CompositionPreview {
  const normalizedProgress = clampProgress(traversalProgress);
  const position = resolveShotAtCompiledPath(path, normalizedProgress);
  if (!position) return { kind: "empty", traversalProgress: normalizedProgress };

  const { shot, index: shotIndex, localProgress: shotProgress } = position;
  const cameraTransform = evaluateAnimationTrack(shot.animation.camera, shotProgress) ?? DEFAULT_CAMERA_TRANSFORM;
  const layerTransforms = Object.fromEntries(shot.layers.map((layer) => {
    const transform = evaluateAnimationTrack(shot.animation.layers[layer.id], shotProgress) ?? layer.transform;
    return [layer.id, { ...transform }];
  })) as Record<string, LayerTransform>;

  return {
    kind: "active",
    traversalProgress: normalizedProgress,
    shot,
    shotIndex,
    shotProgress,
    cameraTransform: { ...cameraTransform },
    layerTransforms,
  };
}

export function traversalCoordinateForShotProgress(
  path: CompiledPath<ShotPathAllocation>,
  shotId: string,
  shotProgress: number,
): number | undefined {
  const interval = path.intervals.find((item) => item.id === shotId);
  if (!interval) return undefined;
  const normalizedShotProgress = clampProgress(shotProgress);
  if (normalizedShotProgress === 1 && interval.end < 1) {
    const inset = PATH_BOUNDARY_TOLERANCE * 2;
    return Math.max(interval.start, interval.end - inset);
  }
  return interval.start + (interval.end - interval.start) * normalizedShotProgress;
}