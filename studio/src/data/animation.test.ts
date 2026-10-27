import { describe, expect, it } from "vitest";
import { evaluateAnimationTrack } from "./animation";
import type { CameraTransform, EasingMode, Keyframe, LayerTransform } from "../types/story";

const start: LayerTransform = { x: 10, y: 20, scale: 80, rotation: -10, opacity: 40 };
const end: LayerTransform = { x: 50, y: 60, scale: 120, rotation: 30, opacity: 100 };
const linearFrames: Keyframe<LayerTransform>[] = [
  { id: "start", progress: 0, transform: start, easing: "linear" },
  { id: "end", progress: 1, transform: end, easing: "linear" },
];
type EasingCase = readonly [
  easing: EasingMode,
  quarterX: number,
  quarterY: number,
  quarterScale: number,
  quarterRotation: number,
  quarterOpacity: number,
  middleX: number,
  middleY: number,
  middleScale: number,
  middleRotation: number,
  middleOpacity: number,
];

const easingCases: readonly EasingCase[] = [
  ["linear", 20, 30, 90, 0, 55, 30, 40, 100, 10, 70],
  ["ease-in", 12.5, 22.5, 82.5, -7.5, 43.75, 20, 30, 90, 0, 55],
  ["ease-out", 27.5, 37.5, 97.5, 7.5, 66.25, 40, 50, 110, 20, 85],
  ["ease-in-out", 16.25, 26.25, 86.25, -3.75, 49.375, 30, 40, 100, 10, 70],
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

  it("uses each outgoing easing mode for compatible transform properties", () => {
    for (const [easing, quarterX, quarterY, quarterScale, quarterRotation, quarterOpacity, middleX, middleY, middleScale, middleRotation, middleOpacity] of easingCases) {
      const frames: Keyframe<LayerTransform>[] = [
        { ...linearFrames[0], easing },
        linearFrames[1],
      ];

      expect(evaluateAnimationTrack(frames, 0)).toEqual(start);
      expect(evaluateAnimationTrack(frames, 0.25)).toEqual({
        x: quarterX,
        y: quarterY,
        scale: quarterScale,
        rotation: quarterRotation,
        opacity: quarterOpacity,
      });
      expect(evaluateAnimationTrack(frames, 0.5)).toEqual({
        x: middleX,
        y: middleY,
        scale: middleScale,
        rotation: middleRotation,
        opacity: middleOpacity,
      });
      expect(evaluateAnimationTrack(frames, 1)).toEqual(end);
    }
  });

  it.each(["linear", "ease-in", "ease-out", "ease-in-out"] as const)("is deterministic for direct, forward, and reverse %s seeks", (easing) => {
    const frames: Keyframe<LayerTransform>[] = [
      { ...linearFrames[0], easing },
      linearFrames[1],
    ];
    const direct = evaluateAnimationTrack(frames, 0.37);
    evaluateAnimationTrack(frames, 0.91);
    const forward = evaluateAnimationTrack(frames, 0.37);
    evaluateAnimationTrack(frames, 0.08);
    const reverse = evaluateAnimationTrack(frames, 0.37);

    expect(forward).toEqual(direct);
    expect(reverse).toEqual(direct);
  });

  it("treats a keyframe without an explicit easing as linear", () => {
    const frames: Keyframe<LayerTransform>[] = [
      { id: "start", progress: 0, transform: start },
      { id: "end", progress: 1, transform: end },
    ];

    expect(evaluateAnimationTrack(frames, 0.25)?.x).toBe(20);
  });

  it("applies easing consistently to camera transform properties", () => {
    const cameraFrames: Keyframe<CameraTransform>[] = [
      { id: "camera-start", progress: 0, transform: { x: 0, y: 10, scale: 100, rotation: -20 }, easing: "ease-out" },
      { id: "camera-end", progress: 1, transform: { x: 40, y: 50, scale: 200, rotation: 20 }, easing: "linear" },
    ];

    expect(evaluateAnimationTrack(cameraFrames, 0.25)).toEqual({ x: 17.5, y: 27.5, scale: 143.75, rotation: -2.5 });
  });
});