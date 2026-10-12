import { describe, expect, it } from "vitest";
import { evaluateAnimationTrack } from "./animation";
import type { Keyframe, LayerTransform } from "../types/story";

const start: LayerTransform = { x: 10, y: 20, scale: 80, rotation: -10, opacity: 40 };
const end: LayerTransform = { x: 50, y: 60, scale: 120, rotation: 30, opacity: 100 };
const linearFrames: Keyframe<LayerTransform>[] = [
  { id: "start", progress: 0, transform: start, easing: "linear" },
  { id: "end", progress: 1, transform: end, easing: "linear" },
];

describe("evaluateAnimationTrack", () => {
  it("returns the initial and final authored states at progress endpoints", () => {
    expect(evaluateAnimationTrack(linearFrames, 0)).toEqual(start);
    expect(evaluateAnimationTrack(linearFrames, 1)).toEqual(end);
  });

  it("interpolates all visual transform fields between adjacent keyframes", () => {
    expect(evaluateAnimationTrack(linearFrames, 0.5)).toEqual({
      x: 30,
      y: 40,
      scale: 100,
      rotation: 10,
      opacity: 70,
    });
  });

  it("returns the same state when progress is evaluated in reverse", () => {
    const forwardState = evaluateAnimationTrack(linearFrames, 0.25);
    evaluateAnimationTrack(linearFrames, 0.8);
    expect(evaluateAnimationTrack(linearFrames, 0.25)).toEqual(forwardState);
  });

  it("uses the first keyframe for empty-range boundaries and the only frame for a single frame track", () => {
    const singleFrame = [{ id: "only", progress: 0.4, transform: end, easing: "ease-in-out" }] satisfies Keyframe<LayerTransform>[];
    expect(evaluateAnimationTrack([], 0.5)).toBeUndefined();
    expect(evaluateAnimationTrack(singleFrame, 0)).toEqual(end);
    expect(evaluateAnimationTrack(singleFrame, 0.9)).toEqual(end);
  });

  it("clamps out-of-range and non-finite progress deterministically", () => {
    expect(evaluateAnimationTrack(linearFrames, -1)).toEqual(start);
    expect(evaluateAnimationTrack(linearFrames, 2)).toEqual(end);
    expect(evaluateAnimationTrack(linearFrames, Number.NaN)).toEqual(start);
    expect(evaluateAnimationTrack(linearFrames, Number.POSITIVE_INFINITY)).toEqual(start);
  });

  it("uses the outgoing keyframe easing mode", () => {
    const easedFrames: Keyframe<LayerTransform>[] = [
      { ...linearFrames[0], easing: "ease-in-out" },
      linearFrames[1],
    ];
    expect(evaluateAnimationTrack(easedFrames, 0.25)?.x).toBeCloseTo(16.25);
  });
});