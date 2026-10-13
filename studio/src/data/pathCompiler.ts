export interface TraversalAllocation {
  id: string;
  traversalWeight: number;
}

export interface CompiledPathInterval<TAllocation extends TraversalAllocation> {
  readonly id: string;
  readonly traversalWeight: number;
  readonly start: number;
  readonly end: number;
  readonly source: TAllocation;
}

export interface CompiledPath<TAllocation extends TraversalAllocation> {
  readonly totalTraversalWeight: number;
  readonly intervals: readonly CompiledPathInterval<TAllocation>[];
}

export interface EmptyPathResolution {
  readonly kind: "empty";
}

export interface ActivePathResolution<TAllocation extends TraversalAllocation> {
  readonly kind: "active";
  readonly interval: CompiledPathInterval<TAllocation>;
  readonly index: number;
  readonly localProgress: number;
}

export type PathResolution<TAllocation extends TraversalAllocation> =
  | EmptyPathResolution
  | ActivePathResolution<TAllocation>;

export const PATH_BOUNDARY_TOLERANCE = Number.EPSILON * 8;

export class PathCompilationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathCompilationError";
  }
}

const emptyPathResolution: EmptyPathResolution = Object.freeze({ kind: "empty" });

function addCompensated(sum: number, compensation: number, value: number): [number, number] {
  const adjusted = value - compensation;
  const next = sum + adjusted;
  return [next, (next - sum) - adjusted];
}

export function compilePath<TAllocation extends TraversalAllocation>(
  allocations: readonly TAllocation[],
): CompiledPath<TAllocation> {
  if (!Array.isArray(allocations)) {
    throw new PathCompilationError("Path allocations must be an array.");
  }

  const ids = new Set<string>();
  const validated: Array<{ source: TAllocation; id: string; traversalWeight: number }> = [];
  let totalTraversalWeight = 0;
  let totalCompensation = 0;

  allocations.forEach((allocation, index) => {
    if (typeof allocation !== "object" || allocation === null) {
      throw new PathCompilationError(`Path allocation at index ${index} must be an object.`);
    }
    const { id, traversalWeight } = allocation;
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new PathCompilationError(`Path allocation at index ${index} must have a non-empty stable ID.`);
    }
    if (ids.has(id)) {
      throw new PathCompilationError(`Path allocation ID "${id}" is duplicated at index ${index}.`);
    }
    if (typeof traversalWeight !== "number" || !Number.isFinite(traversalWeight) || traversalWeight <= 0) {
      throw new PathCompilationError(`Path allocation "${id}" must have a positive finite traversalWeight.`);
    }

    ids.add(id);
    validated.push({ source: allocation, id, traversalWeight });
    [totalTraversalWeight, totalCompensation] = addCompensated(
      totalTraversalWeight,
      totalCompensation,
      traversalWeight,
    );
    if (!Number.isFinite(totalTraversalWeight)) {
      throw new PathCompilationError(`The total traversal weight is not finite after allocation "${id}".`);
    }
  });

  if (validated.length === 0) {
    return Object.freeze({ totalTraversalWeight: 0, intervals: Object.freeze([]) });
  }

  const intervals: CompiledPathInterval<TAllocation>[] = [];
  let cumulativeWeight = 0;
  let cumulativeCompensation = 0;
  let start = 0;

  validated.forEach(({ source, id, traversalWeight }, index) => {
    [cumulativeWeight, cumulativeCompensation] = addCompensated(
      cumulativeWeight,
      cumulativeCompensation,
      traversalWeight,
    );
    const end = index === validated.length - 1
      ? 1
      : Math.min(1, cumulativeWeight / totalTraversalWeight);
    if (end <= start) {
      throw new PathCompilationError(
        `Path allocation "${id}" is too small relative to the total traversal weight to produce a distinct normalized interval.`,
      );
    }

    intervals.push(Object.freeze({ id, traversalWeight, start, end, source }));
    start = end;
  });

  return Object.freeze({
    totalTraversalWeight,
    intervals: Object.freeze(intervals),
  });
}

function assertNormalizedCoordinate(coordinate: number): void {
  if (typeof coordinate !== "number" || !Number.isFinite(coordinate)) {
    throw new RangeError("Path coordinate must be a finite number between 0 and 1.");
  }
  if (coordinate < 0 || coordinate > 1) {
    throw new RangeError(`Path coordinate ${coordinate} is outside the normalized range [0, 1].`);
  }
}

export function localProgressAtCoordinate<TAllocation extends TraversalAllocation>(
  interval: CompiledPathInterval<TAllocation>,
  coordinate: number,
): number {
  assertNormalizedCoordinate(coordinate);
  const span = interval.end - interval.start;
  if (!Number.isFinite(interval.start) || !Number.isFinite(interval.end) || span <= 0) {
    throw new RangeError("The compiled interval must have finite, increasing start and end coordinates.");
  }
  return Math.max(0, Math.min(1, (coordinate - interval.start) / span));
}

export function resolvePathPosition<TAllocation extends TraversalAllocation>(
  path: CompiledPath<TAllocation>,
  coordinate: number,
): PathResolution<TAllocation> {
  assertNormalizedCoordinate(coordinate);
  if (!Array.isArray(path.intervals)) {
    throw new TypeError("A compiled path must contain an intervals array.");
  }
  if (path.intervals.length === 0) return emptyPathResolution;

  const lastIndex = path.intervals.length - 1;
  if (coordinate === 1) {
    const interval = path.intervals[lastIndex];
    return { kind: "active", interval, index: lastIndex, localProgress: 1 };
  }
  if (coordinate === 0) {
    const interval = path.intervals[0];
    return { kind: "active", interval, index: 0, localProgress: 0 };
  }

  let low = 0;
  let high = lastIndex;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const boundary = path.intervals[middle].end;
    if (coordinate < boundary - PATH_BOUNDARY_TOLERANCE) high = middle;
    else low = middle + 1;
  }

  const interval = path.intervals[low];
  return {
    kind: "active",
    interval,
    index: low,
    localProgress: localProgressAtCoordinate(interval, coordinate),
  };
}