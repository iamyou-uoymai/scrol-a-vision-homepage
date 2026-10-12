import { clampProgress } from "../data/animation";
import type { Shot, StoryBeat } from "../types/story";

export { clampProgress } from "../data/animation";

export interface ShotPlaybackPosition {
  shot: Shot;
  index: number;
  localProgress: number;
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

export function resolveShotAtProgress(
  shots: readonly Shot[] | undefined,
  progress: number,
): ShotPlaybackPosition | undefined {
  if (!shots?.length) return undefined;

  const normalized = clampProgress(progress);
  let index = shots.length - 1;
  for (let boundary = 1; boundary < shots.length; boundary += 1) {
    if (normalized < boundary / shots.length) {
      index = boundary - 1;
      break;
    }
  }

  const start = index / shots.length;
  const end = (index + 1) / shots.length;
  const localProgress = normalized <= start
    ? 0
    : normalized >= end
      ? 1
      : (normalized - start) / (end - start);

  return { shot: shots[index], index, localProgress };
}

export function easeProgress(progress: number): number {
  const value = clampProgress(progress);
  return value * value * (3 - 2 * value);
}

export function progressThroughBeat(progress: number, beat?: StoryBeat): number {
  if (!beat) return 0;
  const localProgress = (clampProgress(progress) - beat.start) / beat.duration;
  return easeProgress(localProgress);
}

export function visibilityThroughBeat(progress: number, beat?: StoryBeat): number {
  if (!beat) return 0;
  const value = clampProgress(progress);
  const end = beat.start + beat.duration;
  if (value < beat.start || value > end) return 0;
  if (end - value <= Number.EPSILON) return 0;
  const fadeLength = beat.duration * 0.18;
  const fadeIn = easeProgress((value - beat.start) / fadeLength);
  const fadeOut = easeProgress((end - value) / fadeLength);
  return Math.min(fadeIn, fadeOut);
}
