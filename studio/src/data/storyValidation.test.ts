import { describe, expect, it } from "vitest";
import { discoveryStoryFixture } from "./discoveryStory";
import { validateStory } from "./storyValidation";
import type { Story } from "../types/story";

function copyDiscovery(): Story {
  return JSON.parse(JSON.stringify(discoveryStoryFixture)) as Story;
}

describe("story validation categories", () => {
  it("reports published hierarchy constraints as structural blockers while retaining draft saves", () => {
    const draft = copyDiscovery();
    draft.movements[0].passages[0].phrases[0].beats = [];
    const report = validateStory(draft);

    expect(report.schemaValid).toBe(true);
    expect(report.draftSavable).toBe(true);
    expect(report.publicationReady).toBe(false);
    expect(report.structural).toContainEqual(expect.objectContaining({ code: "PHRASE_MINIMUM_BEATS", objectId: "phrase-observation", blocksPublication: true }));
    expect(report.playback.every((issue) => issue.category === "playback")).toBe(true);
  });

  it("distinguishes an invalid primary function from an absent draft function", () => {
    const missing = copyDiscovery();
    delete missing.movements[0].passages[0].phrases[0].beats[0].primaryFunction;
    expect(validateStory(missing).structural).toContainEqual(expect.objectContaining({ code: "BEAT_PRIMARY_FUNCTION_REQUIRED", blocksPublication: true }));

    const invalid = copyDiscovery();
    (invalid.movements[0].passages[0].phrases[0].beats[0] as unknown as Record<string, unknown>).primaryFunction = "CAMERA";
    const report = validateStory(invalid);
    expect(report.schemaValid).toBe(false);
    expect(report.structural[0].code).toBe("INVALID_STORY_STRUCTURE");
  });

  it("classifies zero, negative, and non-finite weights as playback errors", () => {
    for (const weight of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const story = copyDiscovery();
      story.movements[0].passages[0].phrases[0].beats[0].traversalWeight = weight;
      const report = validateStory(story);
      expect(report.playback[0]).toMatchObject({ code: "INVALID_TRAVERSAL_WEIGHT", blocksPublication: true });
      expect(report.structural).toEqual([]);
    }
  });

  it("reports missing traversal allocation without rejecting an incomplete draft", () => {
    const story = copyDiscovery();
    delete story.movements[0].passages[0].phrases[0].beats[0].traversalWeight;
    const report = validateStory(story);

    expect(report.schemaValid).toBe(true);
    expect(report.draftSavable).toBe(true);
    expect(report.playback).toContainEqual(expect.objectContaining({ code: "TRAVERSAL_WEIGHT_REQUIRED", blocksPublication: true }));
  });

  it("keeps an unallocated Pause saveable but reports its missing path allocation", () => {
    const story = copyDiscovery();
    story.movements[0].passages[0].pauses = [{ id: "pause-unallocated", afterBeatId: "beat-room-enters-view" }];

    const report = validateStory(story);

    expect(report.schemaValid).toBe(true);
    expect(report.draftSavable).toBe(true);
    expect(report.playback).toContainEqual(expect.objectContaining({
      code: "PAUSE_TRAVERSAL_WEIGHT_REQUIRED",
      objectId: "pause-unallocated",
      blocksPublication: true,
    }));
  });

  it("reports unresolved runtime requirements without claiming they are implemented", () => {
    const story = copyDiscovery();
    story.movements[0].passages[0].pauses = [
      { id: "pause-pending", afterBeatId: "beat-room-enters-view", traversalWeight: 0.4 },
    ];
    story.composition.chapters[0].scenes[0].shots[0].creativeIntervals = [
      { id: "silence-pending", kind: "silence", start: 0.3, end: 0.5 },
      { id: "void-pending", kind: "void", start: 0.4, end: 0.6 },
    ];
    const report = validateStory(story);

    expect(report.playback.filter((issue) => ["SILENCE_CUE_NOT_EXECUTED", "VOID_CUE_NOT_EXECUTED"].includes(issue.code))).toHaveLength(2);
    expect(report.playback.some((issue) => issue.code === "NARRATIVE_PATH_NOT_PLAYED" && issue.blocksPublication)).toBe(true);
    expect(report.playback.some((issue) => issue.code === "PLAYER_ASSET_UNRESOLVED" && issue.objectId === "layer-room-observation-background")).toBe(true);
  });

  it("keeps editorial questions advisory and identifies explicit Motif review", () => {
    const story = copyDiscovery();
    delete story.movements[0].passages[0].annotations?.exit;
    story.motifs = [{ id: "motif-object-review", name: "The object", identity: "The same object recurs.", occurrenceIds: ["beat-object-becomes-visible"] }];
    story.movements[0].passages[0].pauses = [{ id: "pause-review", traversalWeight: 0.4 }];
    const report = validateStory(story);

    expect(report.editorial.some((issue) => issue.code === "PASSAGE_EXIT_REVIEW")).toBe(true);
    expect(report.editorial.some((issue) => issue.code === "PATH_SPACING_REVIEW")).toBe(true);
    expect(report.editorial.some((issue) => issue.code === "MOTIF_RECURRENCE_REVIEW")).toBe(true);
    expect(report.editorial.some((issue) => issue.code === "PAUSE_INTENT_REVIEW")).toBe(true);
    expect(report.editorial.every((issue) => issue.severity === "prompt" && !issue.blocksPublication)).toBe(true);
  });
});