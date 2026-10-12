import { clampProgress } from "../data/animation";
import type { StoryBeat } from "../types/story";

export { clampProgress } from "../data/animation";

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
