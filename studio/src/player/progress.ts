import { clampProgress } from "../data/animation";
import { compilePath, resolvePathPosition } from "../data/pathCompiler";
import type { CompiledPath, TraversalAllocation } from "../data/pathCompiler";
import type { CompositionCue, Shot } from "../types/story";

export { clampProgress } from "../data/animation";

export interface ShotPlaybackPosition {
  shot: Shot;
  index: number;
  localProgress: number;
}

export interface ShotPathAllocation extends TraversalAllocation {
  shot: Shot;
}

export function compileShotPath(shots: readonly Shot[] | undefined): CompiledPath<ShotPathAllocation> {
  return compilePath((shots ?? []).map((shot) => ({
    id: shot.id,
    traversalWeight: 1,
    shot,
  })));
}

export function mapScrollToProgress(
  scrollPosition: number,
  runwayStart: number,
  runwayHeight: number,
  viewportHeight: number,
): number {
  const scrollRange = Math.max(0, runwayHeight - viewportHeight);
  if (scrollRange === 0) return scrollPosition <= runwayStart ? 0 : 1;
  return clampProgress((scrollPosition - runwayStart) / scrollRange);
}

export function scrollPositionForProgress(
  progress: number,
  runwayStart: number,
  runwayHeight: number,
  viewportHeight: number,
): number {
  const scrollRange = Math.max(0, runwayHeight - viewportHeight);
  return runwayStart + clampProgress(progress) * scrollRange;
}

export function resolveShotAtProgress(
  shots: readonly Shot[] | undefined,
  progress: number,
): ShotPlaybackPosition | undefined {
  return resolveShotAtCompiledPath(compileShotPath(shots), progress);
}

export function resolveShotAtCompiledPath(
  path: CompiledPath<ShotPathAllocation>,
  progress: number,
): ShotPlaybackPosition | undefined {
  const position = resolvePathPosition(path, clampProgress(progress));
  if (position.kind === "empty") return undefined;
  return {
    shot: position.interval.source.shot,
    index: position.index,
    localProgress: position.localProgress,
  };
}

export function easeProgress(progress: number): number {
  const value = clampProgress(progress);
  return value * value * (3 - 2 * value);
}

export function progressThroughCue(progress: number, cue?: CompositionCue): number {
  if (!cue) return 0;
  const localProgress = (clampProgress(progress) - cue.start) / cue.duration;
  return easeProgress(localProgress);
}

export function visibilityThroughCue(progress: number, cue?: CompositionCue): number {
  if (!cue) return 0;
  const value = clampProgress(progress);
  const end = cue.start + cue.duration;
  if (value < cue.start || value > end) return 0;
  if (end - value <= Number.EPSILON) return 0;
  const fadeLength = cue.duration * 0.18;
  const fadeIn = easeProgress((value - cue.start) / fadeLength);
  const fadeOut = easeProgress((end - value) / fadeLength);
  return Math.min(fadeIn, fadeOut);
}
