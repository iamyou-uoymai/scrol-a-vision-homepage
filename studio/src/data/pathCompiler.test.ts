import { describe, expect, it } from "vitest";
import {
  compilePath,
  localProgressAtCoordinate,
  PATH_BOUNDARY_TOLERANCE,
  resolvePathPosition,
} from "./pathCompiler";
import type { TraversalAllocation } from "./pathCompiler";

interface TestAllocation extends TraversalAllocation {
  title: string;
}

function allocation(id: string, traversalWeight = 1): TestAllocation {
  return { id, title: id, traversalWeight };
}

describe("deterministic path compiler", () => {
  it("normalizes unequal 2:1:3 weights and leaves authored allocations untouched", () => {
    const authored = [allocation("a", 2), allocation("b", 1), allocation("c", 3)];
    const authoredSnapshot = authored.map((item) => ({ ...item }));
    const path = compilePath(authored);

    expect(path.totalTraversalWeight).toBe(6);
    expect(path.intervals.map(({ id, start, end }) => ({ id, start, end }))).toEqual([
      { id: "a", start: 0, end: 1 / 3 },
      { id: "b", start: 1 / 3, end: 0.5 },
      { id: "c", start: 0.5, end: 1 },
    ]);
    expect(path.intervals[0].source).toBe(authored[0]);
    expect(authored).toEqual(authoredSnapshot);
  });

  it("assigns equal weights equal normalized shares", () => {
    const path = compilePath([allocation("a"), allocation("b"), allocation("c")]);

    expect(path.totalTraversalWeight).toBe(3);
    expect(path.intervals.map(({ start, end }) => [start, end])).toEqual([
      [0, 1 / 3],
      [1 / 3, 2 / 3],
      [2 / 3, 1],
    ]);
  });

  it("resolves exact internal boundaries to the later interval and 1 to the final endpoint", () => {
    const path = compilePath([allocation("a", 2), allocation("b", 1), allocation("c", 3)]);

    expect(resolvePathPosition(path, 1 / 3)).toMatchObject({ kind: "active", index: 1, localProgress: 0 });
    expect(resolvePathPosition(path, 0.5)).toMatchObject({ kind: "active", index: 2, localProgress: 0 });
    expect(resolvePathPosition(path, 1)).toMatchObject({ kind: "active", index: 2, localProgress: 1 });
  });

  it("uses the documented tolerance immediately before and after a boundary", () => {
    const path = compilePath([allocation("a", 1), allocation("b", 1)]);
    const boundary = path.intervals[0].end;
    const distance = PATH_BOUNDARY_TOLERANCE * 4;

    expect(resolvePathPosition(path, boundary - distance)).toMatchObject({ kind: "active", index: 0 });
    expect(resolvePathPosition(path, boundary + distance)).toMatchObject({ kind: "active", index: 1 });
    expect(resolvePathPosition(path, boundary - PATH_BOUNDARY_TOLERANCE / 2)).toMatchObject({ kind: "active", index: 1 });
  });

  it("calculates clamped local progress within a compiled interval", () => {
    const path = compilePath([allocation("a", 2), allocation("b", 1), allocation("c", 3)]);
    const first = path.intervals[0];

    expect(localProgressAtCoordinate(first, 1 / 6)).toBeCloseTo(0.5, 14);
    expect(localProgressAtCoordinate(first, 0)).toBe(0);
    expect(localProgressAtCoordinate(first, 1)).toBe(1);
  });

  it("resolves direct seeks identically regardless of traversal direction", () => {
    const path = compilePath([allocation("a", 2), allocation("b", 1), allocation("c", 3)]);
    const samples = [0, 0.1, 1 / 3, 0.42, 0.5, 0.9, 1];
    const forward = new Map(samples.map((coordinate) => [coordinate, resolvePathPosition(path, coordinate)]));

    for (const coordinate of [...samples].reverse()) {
      expect(resolvePathPosition(path, coordinate)).toEqual(forward.get(coordinate));
    }
    expect(resolvePathPosition(path, 0.42)).toMatchObject({ kind: "active", index: 1 });
  });

  it("returns the same stable empty result for an empty path", () => {
    const path = compilePath([]);

    expect(path).toEqual({ totalTraversalWeight: 0, intervals: [] });
    expect(resolvePathPosition(path, 0.5)).toBe(resolvePathPosition(path, 0.5));
    expect(resolvePathPosition(path, 0.5)).toEqual({ kind: "empty" });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects invalid traversal weight %s",
    (traversalWeight) => {
      expect(() => compilePath([allocation("invalid", traversalWeight)])).toThrow(
        /positive finite traversalWeight/,
      );
    },
  );

  it("rejects duplicate interval IDs and a non-finite total weight", () => {
    expect(() => compilePath([allocation("same", 1), allocation("same", 2)])).toThrow(/ID "same" is duplicated/);
    expect(() => compilePath([
      allocation("large-a", Number.MAX_VALUE),
      allocation("large-b", Number.MAX_VALUE),
    ])).toThrow(/total traversal weight is not finite/);
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects an invalid normalized coordinate %s",
    (coordinate) => {
      const path = compilePath([allocation("a")]);
      expect(() => resolvePathPosition(path, coordinate)).toThrow(RangeError);
    },
  );

  it("compiles and resolves a large path deterministically", () => {
    const count = 10_000;
    const path = compilePath(Array.from({ length: count }, (_, index) => allocation(`interval-${index}`)));
    const boundaryIndex = 4_321;

    expect(path.totalTraversalWeight).toBe(count);
    expect(path.intervals).toHaveLength(count);
    expect(path.intervals[0].start).toBe(0);
    expect(path.intervals[count - 1].end).toBe(1);
    expect(resolvePathPosition(path, boundaryIndex / count)).toMatchObject({
      kind: "active",
      index: boundaryIndex,
      localProgress: 0,
    });
  });
});