import { describe, expect, it } from "vitest";
import { evaluateAnimationTrack } from "../data/animation";
import { sampleStory } from "../data/sampleStory";
import type { Shot, StoryBeat } from "../types/story";
import {
  mapScrollToProgress,
  progressThroughBeat,
  resolveShotAtProgress,
  visibilityThroughBeat,
} from "./progress";

const beat: StoryBeat = {
  id: "camera-beat",
  track: "camera",
  label: "Ease in",
  start: 0.2,
  duration: 0.4,
};

const firstShot = sampleStory.chapters[0].scenes[0].shots[0];
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