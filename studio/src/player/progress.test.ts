import { describe, expect, it } from "vitest";
import type { StoryBeat } from "../types/story";
import {
  mapScrollToProgress,
  progressThroughBeat,
  visibilityThroughBeat,
} from "./progress";

const beat: StoryBeat = {
  id: "camera-beat",
  track: "camera",
  label: "Ease in",
  start: 0.2,
  duration: 0.4,
};

describe("scroll runtime progress", () => {
  it("maps the runway start, midpoint, and end to normalized progress", () => {
    expect(mapScrollToProgress(100, 100, 1_100, 600)).toBe(0);
    expect(mapScrollToProgress(350, 100, 1_100, 600)).toBe(0.5);
    expect(mapScrollToProgress(600, 100, 1_100, 600)).toBe(1);
  });

  it("clamps scroll positions outside the runway and handles a non-scrollable runway", () => {
    expect(mapScrollToProgress(-100, 100, 1_100, 600)).toBe(0);
    expect(mapScrollToProgress(900, 100, 1_100, 600)).toBe(1);
    expect(mapScrollToProgress(100, 100, 500, 600)).toBe(0);
    expect(mapScrollToProgress(101, 100, 500, 600)).toBe(1);
  });

  it("eases deterministically through a beat's normalized timing window", () => {
    expect(progressThroughBeat(0.1, beat)).toBe(0);
    expect(progressThroughBeat(0.4, beat)).toBe(0.5);
    expect(progressThroughBeat(0.8, beat)).toBe(1);
  });

  it("fades dialogue in and out within its normalized beat window", () => {
    expect(visibilityThroughBeat(0.19, beat)).toBe(0);
    expect(visibilityThroughBeat(0.2, beat)).toBe(0);
    expect(visibilityThroughBeat(0.4, beat)).toBe(1);
    expect(visibilityThroughBeat(0.6, beat)).toBe(0);
    expect(visibilityThroughBeat(0.61, beat)).toBe(0);
  });

});