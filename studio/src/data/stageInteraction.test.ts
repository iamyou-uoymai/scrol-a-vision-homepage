import { describe, expect, it } from "vitest";
import { moveLayerFromPointerDelta, pointerAngle, pointerDeltaInFrame, resolveLayerTransformEditTarget, rotationFromPointerAngles, scaleFromPointerDistance, shotProgressFromTrackPointer } from "./stageInteraction";

describe("Stage transform interaction math", () => {
  it("converts screen drag through camera rotation and zoom into normalized layer position", () => {
    const moved = moveLayerFromPointerDelta(
      { x: 50, y: 50 },
      { x: 0, y: 20 },
      { x: 0, y: 0, scale: 200, rotation: 90 },
      { x: 500, y: 300 },
    );

    expect(moved.x).toBeCloseTo(52);
    expect(moved.y).toBeCloseTo(50);
  });

  it("keeps normalized drag distance consistent across Stage viewport sizes", () => {
    const compact = moveLayerFromPointerDelta(
      { x: 50, y: 50 },
      { x: 25, y: 15 },
      { x: 0, y: 0, scale: 100, rotation: 0 },
      { x: 500, y: 300 },
    );
    const wide = moveLayerFromPointerDelta(
      { x: 50, y: 50 },
      { x: 50, y: 30 },
      { x: 0, y: 0, scale: 100, rotation: 0 },
      { x: 1000, y: 600 },
    );

    expect(compact).toEqual({ x: 55, y: 55 });
    expect(wide).toEqual(compact);
  });

  it("keeps authored movement invariant when the logical frame is uniformly fitted", () => {
    const compactDelta = pointerDeltaInFrame({ x: 17.36111111111111, y: 8.680555555555555 }, 0.3472222222222222);
    const desktopDelta = pointerDeltaInFrame({ x: 23.4375, y: 11.71875 }, 0.46875);
    const compact = moveLayerFromPointerDelta(
      { x: 50, y: 50 },
      compactDelta,
      { x: 0, y: 0, scale: 100, rotation: 0 },
      { x: 1080, y: 1920 },
    );
    const desktop = moveLayerFromPointerDelta(
      { x: 50, y: 50 },
      desktopDelta,
      { x: 0, y: 0, scale: 100, rotation: 0 },
      { x: 1080, y: 1920 },
    );

    expect(compact.x).toBeCloseTo(desktop.x);
    expect(compact.y).toBeCloseTo(desktop.y);
    expect(compact.x).toBeCloseTo(54.62963);
    expect(compact.y).toBeCloseTo(51.30208);
    expect(pointerDeltaInFrame({ x: 1, y: 1 }, 0)).toEqual({ x: 0, y: 0 });
  });

  it("maps Timeline pointer positions into bounded Shot-local progress", () => {
    expect(shotProgressFromTrackPointer(150, 100, 200)).toBeCloseTo(0.25);
    expect(shotProgressFromTrackPointer(166.000003, 100, 200)).toBe(0.33);
    expect(shotProgressFromTrackPointer(90, 100, 200)).toBe(0);
    expect(shotProgressFromTrackPointer(340, 100, 200)).toBe(1);
    expect(shotProgressFromTrackPointer(150, 100, 0)).toBeUndefined();
  });

  it("clamps dragged centers to the authored Stage coordinate range", () => {
    expect(moveLayerFromPointerDelta(
      { x: 99, y: 1 },
      { x: 100, y: -100 },
      { x: 0, y: 0, scale: 100, rotation: 0 },
      { x: 500, y: 500 },
    )).toEqual({ x: 100, y: 0 });
  });

  it("scales uniformly from the layer center and respects the Inspector range", () => {
    expect(scaleFromPointerDistance(100, 50, 75, 40, 160)).toBe(150);
    expect(scaleFromPointerDistance(100, 50, 200, 40, 160)).toBe(160);
  });

  it("rotates around the supplied pivot using the shortest angular change", () => {
    const degrees = (value: number) => value * Math.PI / 180;
    const pivot = { x: 100, y: 100 };
    const startAngle = pointerAngle({ x: 150, y: 100 }, pivot);
    const currentAngle = pointerAngle({ x: 100 + 50 * Math.cos(degrees(2)), y: 100 + 50 * Math.sin(degrees(2)) }, pivot);

    expect(rotationFromPointerAngles(179, startAngle, currentAngle)).toBeCloseTo(-179);
  });

  it("allows base edits only for static layers and keyframe edits only at the selected playhead position", () => {
    const track = [{ id: "start", progress: 0 }, { id: "arrival", progress: 0.33 }];

    expect(resolveLayerTransformEditTarget([], undefined, 0.5)).toEqual({ kind: "base" });
    expect(resolveLayerTransformEditTarget(track, undefined, 0.33)).toBeUndefined();
    expect(resolveLayerTransformEditTarget(track, "arrival", 0.32)).toBeUndefined();
    expect(resolveLayerTransformEditTarget(track, "arrival", 0.33)).toEqual({ kind: "keyframe", keyframeId: "arrival" });
  });
});