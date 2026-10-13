# Milestone 2: Deterministic Path Compiler

## Allocation ownership

Schema v3 stores authored `traversalWeight` on canonical narrative Beats. Composition shots have no traversal-weight field and are not linked to those Beats. The path compiler therefore accepts a generic, explicitly ordered list of `{ id, traversalWeight }` allocations and does not inspect or mutate a Story.

The existing Player still plays the first composition scene's shots in array order. Its established policy gives every shot an equal share, so the Player adapter compiles each shot as `{ id: shot.id, traversalWeight: 1 }`. This preserves current behavior without transferring Beat weights to shots or introducing an unauthored relationship. A future narrative-driven Player needs an explicit Beat-to-composition contract before it can use authored Beat weights.

## Compiler contract

`compilePath(allocations)` returns the finite total traversal weight and derived normalized intervals with `start` and `end` coordinates. Input order is canonical; the compiler does not sort. Duplicate or blank IDs, non-positive or non-finite weights, overflowing totals, and weights too small to produce a distinct normalized interval are rejected with `PathCompilationError`. The input allocations and their Story data are not modified, and absolute scroll coordinates are never stored.

An empty allocation list compiles to total weight `0` and no intervals. `resolvePathPosition` returns the same frozen `{ kind: "empty" }` result for that path. For a non-empty path, resolver coordinates must be finite and in `[0, 1]`; the pure resolver rejects invalid coordinates. The current Player compatibility adapter first applies its existing `clampProgress` behavior, including mapping non-finite values to `0`.

Internal boundaries are assigned to the later interval. To make floating-point boundary behavior consistent, a coordinate up to `8 * Number.EPSILON` below a boundary is treated as that boundary and also resolves to the later interval. Coordinate `1` is special-cased to the final interval at local progress `1`; coordinate `0` selects the first interval at local progress `0`. Local progress is calculated from the compiled interval and clamped to `[0, 1]`.

## Viewport boundary

The compiler contains no React or DOM dependencies. `mapScrollToProgress` remains the viewport adapter: it derives normalized progress from `scrollY`, the measured runway top, runway height, and `window.innerHeight`. The Player runway remains `100svh + 200svh * shotCount` with a sticky `100svh` viewport, leaving a scroll range of approximately `200svh` per shot.

The Player preserves the latest normalized position on resize by reading it from a ref, waiting for one animation frame for viewport geometry to settle, and applying the inverse mapping once with `window.scrollTo`. Scroll events during that correction are not used to launch more corrections; the normalized progress is then recalculated from the target geometry. This avoids a resize feedback loop and keeps scroll compensation out of the compiler. The preservation is subject to browser scroll clamping and subpixel rounding.