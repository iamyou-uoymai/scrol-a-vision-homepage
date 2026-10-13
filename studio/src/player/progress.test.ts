import { describe, expect, it } from "vitest";
import { evaluateAnimationTrack } from "../data/animation";
import { sampleStory } from "../data/sampleStory";
import type { CompositionCue, Shot } from "../types/story";
import {
  compileShotPath,
  mapScrollToProgress,
  resolveShotAtCompiledPath,
  progressThroughCue,
  resolveShotAtProgress,
  scrollPositionForProgress,
  visibilityThroughCue,
} from "./progress";

const cue: CompositionCue = {
  id: "camera-beat",
  track: "camera",
  label: "Ease in",
  start: 0.2,
  duration: 0.4,
};

const firstShot = sampleStory.composition.chapters[0].scenes[0].shots[0];
const secondShot: Shot = {
  ...firstShot,
  id: "shot-second",
  title: "The Turn",
  animation: {
    camera: [
      { id: "second-camera-start", progress: 0, transform: { x: 12, y: 0, scale: 100, rotation: 0 }, easing: "linear" },
      { id: "second-camera-end", progress: 1, transform: { x: 32, y: 0, scale: 100, rotation: 0 }, easing: "linear" },
    ],
    layers: {
      "layer-traveler": [
        { id: "second-traveler-start", progress: 0, transform: { x: 20, y: 50, scale: 100, rotation: 0, opacity: 100 }, easing: "linear" },
        { id: "second-traveler-end", progress: 1, transform: { x: 40, y: 50, scale: 100, rotation: 0, opacity: 100 }, easing: "linear" },
      ],
    },
  },
};

describe("scroll runtime progress", () => {
  it("maps the runway start, midpoint, and end to normalized progress", () => {
    expect(mapScrollToProgress(100, 100, 1_100, 600)).toBe(0);
    expect(mapScrollToProgress(350, 100, 1_100, 600)).toBe(0.5);
    expect(mapScrollToProgress(600, 100, 1_100, 600)).toBe(1);
  });

  it("converts normalized progress to scroll and back for viewport geometry", () => {
    for (const progress of [0, 0.1, 0.5, 0.93, 1]) {
      const scrollPosition = scrollPositionForProgress(progress, 120, 2_200, 600);
      expect(mapScrollToProgress(scrollPosition, 120, 2_200, 600)).toBeCloseTo(progress, 14);
    }
    expect(scrollPositionForProgress(0.7, 120, 500, 600)).toBe(120);
  });

  it("maps a single shot's entire scene range to its local progress", () => {
    expect(resolveShotAtProgress([firstShot], 0.42)).toEqual({
      shot: firstShot,
      index: 0,
      localProgress: 0.42,
    });
  });

  it("returns no active shot for an empty scene", () => {
    expect(resolveShotAtProgress([], 0.5)).toBeUndefined();
    expect(resolveShotAtProgress(undefined, 0.5)).toBeUndefined();
  });

  it("plays shots in array order with equal shares and starts the next shot at exact boundaries", () => {
    const shots = [firstShot, secondShot, { ...secondShot, id: "shot-third", title: "The Return" }];
    const firstBoundary = 1 / shots.length;
    const secondBoundary = 2 / shots.length;

    const before = resolveShotAtProgress(shots, firstBoundary - 1e-8);
    expect(before?.shot.id).toBe(firstShot.id);
    expect(before?.localProgress).toBeCloseTo(1, 6);
    expect(resolveShotAtProgress(shots, firstBoundary)).toMatchObject({ shot: secondShot, index: 1, localProgress: 0 });
    expect(resolveShotAtProgress(shots, firstBoundary + 1e-8)).toMatchObject({ shot: secondShot, index: 1 });
    expect(resolveShotAtProgress(shots, secondBoundary)).toMatchObject({ index: 2, localProgress: 0 });
    expect(resolveShotAtProgress(shots, 1)).toMatchObject({ index: 2, localProgress: 1 });
  });

  it("uses the compiler for Player shot paths while keeping equal-share clamping behavior", () => {
    const shots = [firstShot, secondShot];
    const path = compileShotPath(shots);

    expect(path.intervals.map(({ id, traversalWeight, start, end }) => ({ id, traversalWeight, start, end }))).toEqual([
      { id: firstShot.id, traversalWeight: 1, start: 0, end: 0.5 },
      { id: secondShot.id, traversalWeight: 1, start: 0.5, end: 1 },
    ]);
    expect(resolveShotAtCompiledPath(path, 0.5)).toMatchObject({
      shot: secondShot,
      index: 1,
      localProgress: 0,
    });
    expect(resolveShotAtProgress(shots, Number.NaN)).toMatchObject({
      shot: firstShot,
      index: 0,
      localProgress: 0,
    });
    expect(resolveShotAtProgress(shots, 1.5)).toMatchObject({
      shot: secondShot,
      index: 1,
      localProgress: 1,
    });
  });

  it("evaluates the active shot's authored camera and layer tracks at local progress", () => {
    const position = resolveShotAtProgress([firstShot, secondShot], 0.75);
    expect(position).toMatchObject({ shot: secondShot, index: 1, localProgress: 0.5 });
    expect(evaluateAnimationTrack(position?.shot.animation.camera, position?.localProgress ?? 0)?.x).toBe(22);
    expect(evaluateAnimationTrack(position?.shot.animation.layers["layer-traveler"], position?.localProgress ?? 0)?.x).toBe(30);
  });

  it("maps the same progress identically when traversed forward or backward", () => {
    const shots = [firstShot, secondShot];
    const samples = [0, 0.2, 0.5, 0.8, 1];
    const forward = new Map(samples.map((progress) => [progress, resolveShotAtProgress(shots, progress)]));

    for (const progress of [...samples].reverse()) {
      expect(resolveShotAtProgress(shots, progress)).toEqual(forward.get(progress));
    }
  });

  it("clamps scroll positions outside the runway and handles a non-scrollable runway", () => {
    expect(mapScrollToProgress(-100, 100, 1_100, 600)).toBe(0);
    expect(mapScrollToProgress(900, 100, 1_100, 600)).toBe(1);
    expect(mapScrollToProgress(100, 100, 500, 600)).toBe(0);
    expect(mapScrollToProgress(101, 100, 500, 600)).toBe(1);
  });

  it("eases deterministically through a cue's normalized timing window", () => {
    expect(progressThroughCue(0.1, cue)).toBe(0);
    expect(progressThroughCue(0.4, cue)).toBe(0.5);
    expect(progressThroughCue(0.8, cue)).toBe(1);
  });

  it("fades dialogue in and out within its normalized cue window", () => {
    expect(visibilityThroughCue(0.19, cue)).toBe(0);
    expect(visibilityThroughCue(0.2, cue)).toBe(0);
    expect(visibilityThroughCue(0.4, cue)).toBe(1);
    expect(visibilityThroughCue(0.6, cue)).toBe(0);
    expect(visibilityThroughCue(0.61, cue)).toBe(0);
  });

});