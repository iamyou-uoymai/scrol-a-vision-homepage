import { describe, expect, it } from "vitest";
import { sampleStory } from "./sampleStory";
import { addCreativeInterval, duplicateShotKeyframe, insertShotKeyframe, removeCreativeInterval, removeShotKeyframe, reorderSceneShot, updateCreativeInterval, updateShotKeyframe, updateShotLayer } from "./studioCommands";
import type { Keyframe, LayerTransform, Scene, Story } from "../types/story";

const scene = sampleStory.composition.chapters[0].scenes[0];

describe("composition editing commands", () => {
  it("reorders shots without regenerating their stable IDs", () => {
    const sourceShot = scene.shots[0];
    const shots = [
      sourceShot,
      { ...sourceShot, id: "shot-extra", title: "Extra Shot" },
      { ...sourceShot, id: "shot-final", title: "Final Shot" },
    ];
    const testScene: Scene = { ...scene, shots };
    const originalIds = shots.map((shot) => shot.id);
    const result = reorderSceneShot(testScene, shots[0].id, 1);

    expect(result.shots.map((shot) => shot.id)).toEqual([originalIds[1], originalIds[0], originalIds[2]]);
    expect(result.shots[1]).toBe(shots[0]);
    expect(testScene.shots.map((shot) => shot.id)).toEqual(originalIds);
  });

  it("updates a layer's authored transform without changing its ID or unrelated fields", () => {
    const shot = scene.shots[0];
    const layer = shot.layers[0];
    const updated = updateShotLayer(shot, layer.id, { name: "Retitled", transform: { x: 23 } });

    expect(updated.layers[0]).toMatchObject({
      id: layer.id,
      name: "Retitled",
      kind: layer.kind,
      transform: { x: 23, y: layer.transform.y, scale: layer.transform.scale },
    });
    expect(shot.layers[0].name).toBe(layer.name);
  });

  it("preserves cues, animation tracks, and other layers when applying a Stage base transform", () => {
    const shot = scene.shots[0];
    const layer = shot.layers.find((item) => item.kind === "character");
    if (!layer) throw new Error("Sample character layer is required.");
    const otherLayer = shot.layers.find((item) => item.id !== layer.id);
    const updated = updateShotLayer(shot, layer.id, { transform: { x: 48, y: 62, scale: 120, rotation: 18 } });

    expect(updated.layers.find((item) => item.id === layer.id)).toEqual({
      ...layer,
      transform: { ...layer.transform, x: 48, y: 62, scale: 120, rotation: 18 },
    });
    expect(updated.layers.find((item) => item.id === otherLayer?.id)).toBe(otherLayer);
    expect(updated.cues).toBe(shot.cues);
    expect(updated.animation).toBe(shot.animation);
    expect(layer.transform).toEqual({ x: 41, y: 57, scale: 100, rotation: -3, opacity: 100 });
  });

  it("updates and sorts camera keyframes while retaining ID and transform fields", () => {
    const shot = scene.shots[0];
    const original = shot.animation.camera[1];
    const updated = updateShotKeyframe(shot, { type: "camera" }, original.id, {
      progress: 0.25,
      transform: { x: 27 },
    });

    expect(updated.animation.camera.map((keyframe) => keyframe.progress)).toEqual([0, 0.25]);
    expect(updated.animation.camera[1]).toMatchObject({
      id: original.id,
      transform: { x: 27, y: original.transform.y, scale: original.transform.scale },
    });
    expect(shot.animation.camera[1]).toEqual(original);
  });

  it("updates a layer keyframe on its existing target track", () => {
    const shot = scene.shots[0];
    const layerId = Object.keys(shot.animation.layers)[0];
    const original = shot.animation.layers[layerId][0];
    const updated = updateShotKeyframe(shot, { type: "layer", layerId }, original.id, {
      transform: { opacity: 43 },
    });

    expect(updated.animation.layers[layerId][0]).toMatchObject({
      id: original.id,
      transform: { opacity: 43, x: original.transform.x, y: original.transform.y },
    });
    expect(updated.animation.layers[layerId]).toHaveLength(shot.animation.layers[layerId].length);
  });

  it("inserts a complete layer keyframe in Shot-local order without changing other data", () => {
    const shot = scene.shots[0];
    const layerId = "layer-traveler";
    const layer = shot.layers.find((item) => item.id === layerId);
    if (!layer) throw new Error("Sample traveler layer is required.");
    const frame: Keyframe<LayerTransform> = {
      id: "keyframe-traveler-middle",
      progress: 0.72,
      transform: { ...layer.transform, x: 71 },
      easing: "linear",
    };
    const updated = insertShotKeyframe(shot, { type: "layer", layerId }, frame);

    expect(updated.animation.layers[layerId].map((item) => item.progress)).toEqual([0, 0.33, 0.72]);
    expect(updated.animation.layers[layerId][2]).toEqual(frame);
    expect(updated.animation.camera).toBe(shot.animation.camera);
    expect(updated.layers.find((item) => item.id === layerId)).toBe(layer);
    expect(updated.cues).toBe(shot.cues);
  });

  it("duplicates a keyframe with a new ID and full authored state at a requested position", () => {
    const shot = scene.shots[0];
    const target = { type: "layer", layerId: "layer-traveler" } as const;
    const source = shot.animation.layers[target.layerId][1];
    const updated = duplicateShotKeyframe(shot, target, source.id, "keyframe-traveler-copy", 0.72);
    const duplicate = updated.animation.layers[target.layerId][2];

    expect(duplicate).toEqual({ ...source, id: "keyframe-traveler-copy", progress: 0.72, transform: { ...source.transform } });
    expect(duplicate.id).not.toBe(source.id);
    expect(shot.animation.layers[target.layerId][1]).toBe(source);
    expect(updated.animation.camera).toBe(shot.animation.camera);
    expect(updated.layers).toBe(shot.layers);
    expect(updated.cues).toBe(shot.cues);
  });

  it("rejects invalid and occupied keyframe positions for insert, move, and duplicate", () => {
    const shot = scene.shots[0];
    const target = { type: "layer", layerId: "layer-traveler" } as const;
    const frame = shot.animation.layers[target.layerId][1];

    expect(() => insertShotKeyframe(shot, target, { ...frame, id: "out-of-range", progress: 1.01 })).toThrow(/between 0% and 100%/);
    expect(() => insertShotKeyframe(shot, target, { ...frame, id: "occupied", progress: 0 })).toThrow(/already exists/);
    expect(() => updateShotKeyframe(shot, target, frame.id, { progress: 0 })).toThrow(/already exists/);
    expect(() => updateShotKeyframe(shot, target, frame.id, { progress: Number.NaN })).toThrow(/between 0% and 100%/);
    expect(() => duplicateShotKeyframe(shot, target, frame.id, "copy-invalid", -0.1)).toThrow(/between 0% and 100%/);
    expect(() => duplicateShotKeyframe(shot, target, frame.id, "copy-occupied", 0)).toThrow(/already exists/);
  });

  it("deletes only the requested keyframe and removes an empty layer track", () => {
    const shot = scene.shots[0];
    const target = { type: "layer", layerId: "layer-traveler" } as const;
    const [first, second] = shot.animation.layers[target.layerId];
    const updated = removeShotKeyframe(shot, target, first.id);

    expect(updated.animation.layers[target.layerId]).toEqual([second]);
    expect(updated.animation.camera).toBe(shot.animation.camera);
    expect(updated.layers).toBe(shot.layers);
    expect(updated.cues).toBe(shot.cues);
    expect(removeShotKeyframe(updated, target, second.id).animation.layers[target.layerId]).toBeUndefined();
  });

  it("updates only the selected layer keyframe while preserving the base transform and neighboring frame", () => {
    const shot = scene.shots[0];
    const layerId = "layer-traveler";
    const track = shot.animation.layers[layerId];
    const selectedFrame = track[1];
    const neighboringFrame = track[0];
    const layer = shot.layers.find((item) => item.id === layerId);
    const updated = updateShotKeyframe(shot, { type: "layer", layerId }, selectedFrame.id, {
      transform: { x: 47, rotation: 4 },
    });

    expect(updated.animation.layers[layerId][0]).toBe(neighboringFrame);
    expect(updated.animation.layers[layerId][1]).toMatchObject({
      id: selectedFrame.id,
      progress: selectedFrame.progress,
      transform: { ...selectedFrame.transform, x: 47, rotation: 4 },
    });
    expect(updated.layers.find((item) => item.id === layerId)).toBe(layer);
    expect(updated.cues).toBe(shot.cues);
    expect(updated.animation.camera).toBe(shot.animation.camera);
    expect(selectedFrame.transform.x).toBe(44.5);
  });

  it("stores overlapping typed intervals as explicit shot-local composition data", () => {
    const story = JSON.parse(JSON.stringify(sampleStory)) as Story;
    const shotId = story.composition.chapters[0].scenes[0].shots[0].id;
    const silence = { id: "interval-silence", kind: "silence" as const, start: 0.2, end: 0.6, audioChannel: "ambience", intent: "Reduce ambient sound." };
    const voidCue = { id: "interval-void", kind: "void" as const, start: 0.3, end: 0.5, intent: "Reduce visual information." };
    let updated = addCreativeInterval(story, shotId, silence);
    updated = addCreativeInterval(updated, shotId, voidCue);
    updated = updateCreativeInterval(updated, shotId, silence.id, { end: 0.7, intent: "Extend the attentive interval." });

    expect(updated.composition.chapters[0].scenes[0].shots[0].creativeIntervals).toEqual([
      { ...silence, end: 0.7, intent: "Extend the attentive interval." },
      voidCue,
    ]);
    const changedToVoid = updateCreativeInterval(updated, shotId, silence.id, { kind: "void" });
    expect(changedToVoid.composition.chapters[0].scenes[0].shots[0].creativeIntervals?.[0]).toEqual({
      id: silence.id,
      kind: "void",
      start: silence.start,
      end: 0.7,
      intent: "Extend the attentive interval.",
    });
    expect(removeCreativeInterval(updated, shotId, silence.id).composition.chapters[0].scenes[0].shots[0].creativeIntervals).toEqual([voidCue]);
    expect(story.composition.chapters[0].scenes[0].shots[0].creativeIntervals).toBeUndefined();
  });
});