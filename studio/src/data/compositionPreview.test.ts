import { describe, expect, it } from "vitest";
import { compilePath } from "./pathCompiler";
import type { CompiledPath } from "./pathCompiler";
import { resolveCompositionPreview, traversalCoordinateForShotProgress } from "./compositionPreview";
import type { ShotPathAllocation } from "../player/progress";
import type { Shot } from "../types/story";
import { sampleStory } from "./sampleStory";
import { loadStoredStory, saveStoredStory, serializeStory } from "./storyStorage";

function createShot(id: string, startX: number, endX: number): Shot {
  const layerId = `layer-${id}`;
  return {
    id,
    title: id,
    layers: [{
      id: layerId,
      name: `${id} layer`,
      kind: "character",
      transform: { x: startX, y: 50, scale: 100, rotation: 0, opacity: 100 },
    }],
    cues: [],
    animation: {
      camera: [
        { id: `camera-${id}-start`, progress: 0, transform: { x: startX, y: 0, scale: 100, rotation: 0 }, easing: "linear" },
        { id: `camera-${id}-end`, progress: 1, transform: { x: endX, y: 0, scale: 100, rotation: 0 }, easing: "linear" },
      ],
      layers: {
        [layerId]: [
          { id: `${layerId}-start`, progress: 0, transform: { x: startX, y: 50, scale: 100, rotation: 0, opacity: 100 }, easing: "linear" },
          { id: `${layerId}-end`, progress: 1, transform: { x: endX, y: 50, scale: 120, rotation: 20, opacity: 40 }, easing: "linear" },
        ],
      },
    },
  };
}

function weightedPath(shots: readonly Shot[], weights: readonly number[]): CompiledPath<ShotPathAllocation> {
  return compilePath(shots.map((shot, index) => ({
    id: shot.id,
    traversalWeight: weights[index],
    shot,
  })));
}

function activePreview(path: CompiledPath<ShotPathAllocation>, progress: number) {
  const preview = resolveCompositionPreview(path, progress);
  if (preview.kind !== "active") throw new Error("An active preview is required.");
  return preview;
}

describe("deterministic composition preview", () => {
  const shots = [createShot("shot-a", 0, 100), createShot("shot-b", 20, 80), createShot("shot-c", 40, 60)];
  const path = weightedPath(shots, [2, 1, 3]);

  it("resolves the beginning, middle, and end using compiled weighted intervals", () => {
    expect(activePreview(path, 0)).toMatchObject({ shot: shots[0], shotIndex: 0, shotProgress: 0 });
    expect(activePreview(path, 0.25)).toMatchObject({ shot: shots[0], shotIndex: 0, shotProgress: 0.75 });
    expect(activePreview(path, 1)).toMatchObject({ shot: shots[2], shotIndex: 2, shotProgress: 1 });
    expect(activePreview(path, 0.25).cameraTransform.x).toBe(75);
    expect(activePreview(path, 0.25).layerTransforms["layer-shot-a"].x).toBe(75);
  });

  it("resolves an exact Shot boundary to the later Shot at local zero", () => {
    expect(activePreview(path, 0.5)).toMatchObject({ shot: shots[2], shotIndex: 2, shotProgress: 0 });
  });

  it("returns identical resolved transforms for forward, reverse, and repeated seeks", () => {
    const first = activePreview(path, 0.25);
    activePreview(path, 0.9);
    const reverse = activePreview(path, 0.25);
    const repeated = activePreview(path, 0.25);

    expect(reverse).toEqual(first);
    expect(repeated).toEqual(first);
  });

  it("evaluates selected camera and layer easing identically for direct and reverse traversal seeks", () => {
    const source = createShot("shot-eased", 0, 100);
    const layerId = "layer-shot-eased";
    const layerTrack = source.animation.layers[layerId];
    const shot: Shot = {
      ...source,
      animation: {
        camera: [{ ...source.animation.camera[0], easing: "ease-in" }, source.animation.camera[1]],
        layers: { [layerId]: [{ ...layerTrack[0], easing: "ease-out" }, layerTrack[1]] },
      },
    };
    const path = weightedPath([shot], [1]);
    const before = JSON.stringify(shot);
    const direct = activePreview(path, 0.25);

    expect(direct.cameraTransform.x).toBeCloseTo(6.25);
    expect(direct.layerTransforms[layerId].x).toBeCloseTo(43.75);
    activePreview(path, 0.82);
    const reverse = activePreview(path, 0.25);

    expect(reverse).toEqual(direct);
    expect(JSON.stringify(shot)).toBe(before);
  });

  it("maps Shot-local coordinates through the compiled interval, not an assumed equal share", () => {
    const coordinate = traversalCoordinateForShotProgress(path, "shot-b", 0.5);
    const resolved = activePreview(path, coordinate ?? 0);

    expect(coordinate).toBeCloseTo(5 / 12, 14);
    expect(resolved.shot).toBe(shots[1]);
    expect(resolved.shotProgress).toBeCloseTo(0.5, 14);
    expect(traversalCoordinateForShotProgress(path, "missing-shot", 0.5)).toBeUndefined();
  });

  it("keeps an interior Shot's explicit 100% position inside that Shot", () => {
    const coordinate = traversalCoordinateForShotProgress(path, "shot-b", 1);
    const resolved = activePreview(path, coordinate ?? 0);

    expect(coordinate).toBeLessThan(path.intervals[1].end);
    expect(resolved.shot).toBe(shots[1]);
    expect(resolved.shotProgress).toBeCloseTo(1, 12);
  });

  it("returns an empty preview for an empty path and clamps invalid progress like the Player resolver", () => {
    expect(resolveCompositionPreview(compilePath([]), 0.5)).toEqual({ kind: "empty", traversalProgress: 0.5 });
    expect(activePreview(path, Number.NaN)).toMatchObject({ shot: shots[0], traversalProgress: 0, shotProgress: 0 });
    expect(() => weightedPath([shots[0], shots[0]], [1, 1])).toThrow(/ID .* duplicated/);
    expect(() => weightedPath(shots, [0, 1, 1])).toThrow(/positive finite traversalWeight/);
  });

  it("does not mutate authored story data and preserves it through save/reload", () => {
    const story = JSON.parse(JSON.stringify(sampleStory)) as typeof sampleStory;
    const sceneShots = story.composition.chapters[0].scenes[0].shots;
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };
    sceneShots[0].animation.camera[0].easing = "ease-in";
    sceneShots[0].animation.layers["layer-traveler"][0].easing = "ease-out";
    const before = serializeStory(story);
    const samplePath = weightedPath(sceneShots, sceneShots.map(() => 1));

    resolveCompositionPreview(samplePath, 0.37);
    expect(serializeStory(story)).toBe(before);
    saveStoredStory(adapter, story);
    const reloaded = loadStoredStory(adapter).story;
    const saved = serializeStory(reloaded);
    resolveCompositionPreview(weightedPath(reloaded.composition.chapters[0].scenes[0].shots, sceneShots.map(() => 1)), 0.37);

    expect(serializeStory(reloaded)).toBe(saved);
    expect(loadStoredStory(adapter).story).toEqual(reloaded);
    expect(saved).toBe(before);
  });
});