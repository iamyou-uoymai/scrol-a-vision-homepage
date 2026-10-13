import { describe, expect, it } from "vitest";
import { sampleStory } from "./sampleStory";
import { addCreativeInterval, removeCreativeInterval, reorderSceneShot, updateCreativeInterval, updateShotKeyframe, updateShotLayer } from "./studioCommands";
import type { Scene, Story } from "../types/story";

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