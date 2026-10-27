import { describe, expect, it } from "vitest";
import { fitFrameInViewport, UNIVERSAL_FRAME_SIZE } from "./viewportFrame";

describe("fitFrameInViewport", () => {
  it.each([
    [390, 844],
    [1920, 1080],
    [1000, 1000],
    [280, 1000],
  ])("fits a 9:16 frame inside %sx%s without cropping or stretching", (viewportWidth, viewportHeight) => {
    const fitted = fitFrameInViewport(viewportWidth, viewportHeight);

    expect(fitted.width).toBeLessThanOrEqual(viewportWidth);
    expect(fitted.height).toBeLessThanOrEqual(viewportHeight);
    expect(fitted.width / fitted.height).toBeCloseTo(9 / 16);
    expect(fitted.left).toBeGreaterThanOrEqual(0);
    expect(fitted.top).toBeGreaterThanOrEqual(0);
    expect(fitted.left + fitted.width).toBeCloseTo(viewportWidth - fitted.left);
    expect(fitted.top + fitted.height).toBeCloseTo(viewportHeight - fitted.top);
  });

  it("returns an empty frame for zero-sized or invalid viewports", () => {
    expect(fitFrameInViewport(0, 800)).toEqual({ left: 0, top: 0, width: 0, height: 0, scale: 0 });
    expect(fitFrameInViewport(800, Number.NaN)).toEqual({ left: 0, top: 0, width: 0, height: 0, scale: 0 });
  });

  it("uses the fixed 1080 x 1920 logical frame", () => {
    expect(UNIVERSAL_FRAME_SIZE).toEqual({ width: 1080, height: 1920 });
    expect(fitFrameInViewport(1080, 1920)).toEqual({
      left: 0,
      top: 0,
      width: 1080,
      height: 1920,
      scale: 1,
    });
  });
});