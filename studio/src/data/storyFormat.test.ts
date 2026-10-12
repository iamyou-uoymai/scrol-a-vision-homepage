import { describe, expect, it } from "vitest";
import { sampleStory } from "./sampleStory";
import { parseStory, parseStoryJson, StoryFormatError } from "./storyFormat";
import { LEGACY_STORY_STORAGE_KEY, loadStoredStory, parseImportedStory, saveStoredStory, serializeStory, STORY_STORAGE_KEY } from "./storyStorage";
import type { LegacyShotV1, Story, StoryV1 } from "../types/story";

function copySample(): Story {
  return JSON.parse(JSON.stringify(sampleStory)) as Story;
}

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    read: (key = STORY_STORAGE_KEY) => values.get(key) ?? null,
  };
}

function copyLegacySample(): StoryV1 {
  const legacy = JSON.parse(JSON.stringify(sampleStory)) as StoryV1;
  legacy.schemaVersion = 1;
  for (const chapter of legacy.chapters) {
    for (const scene of chapter.scenes) {
      for (const shot of scene.shots) {
        delete (shot as LegacyShotV1 & { animation?: unknown }).animation;
      }
    }
  }
  return legacy;
}

describe("portable story format", () => {
  it("round-trips the sample story as versioned JSON", () => {
    const exported = serializeStory(copySample());
    expect(parseStoryJson(exported)).toEqual(sampleStory);
    expect(parseImportedStory(exported).chapters[0].scenes[0].shots[0].animation).toEqual(
      sampleStory.chapters[0].scenes[0].shots[0].animation,
    );
  });

  it("preserves edited keyframe positions and transforms through JSON export and import", () => {
    const story = copySample();
    const cameraKeyframe = story.chapters[0].scenes[0].shots[0].animation.camera[1];
    cameraKeyframe.progress = 0.72;
    cameraKeyframe.transform.x = -14;
    cameraKeyframe.transform.scale = 124;

    const imported = parseImportedStory(serializeStory(story));
    expect(imported.chapters[0].scenes[0].shots[0].animation.camera[1]).toEqual(cameraKeyframe);
  });

  it("migrates valid version 1 projects to version 2 with empty authored tracks", () => {
    const legacy = copyLegacySample();
    const migrated = parseStory(legacy);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.chapters[0].scenes[0].shots[0].animation).toEqual({ camera: [], layers: {} });
    expect(legacy.schemaVersion).toBe(1);
  });

  it("rejects malformed keyframe positions, unknown targets, and unknown animation fields", () => {
    const duplicate = copySample();
    duplicate.chapters[0].scenes[0].shots[0].animation.camera[1].progress = 0;
    expect(() => parseStory(duplicate)).toThrow("strictly increasing");

    const unordered = copySample();
    unordered.chapters[0].scenes[0].shots[0].animation.camera[0].progress = 0.7;
    expect(() => parseStory(unordered)).toThrow("strictly increasing");

    const unknownLayer = copySample();
    unknownLayer.chapters[0].scenes[0].shots[0].animation.layers.missing = [];
    expect(() => parseStory(unknownLayer)).toThrow("unknown visual layer");

    const unknownTrack = copySample() as Story & { chapters: Array<{ scenes: Array<{ shots: Array<{ animation: Record<string, unknown> }> }> }> };
    unknownTrack.chapters[0].scenes[0].shots[0].animation.cameraTrack = [];
    expect(() => parseStory(unknownTrack)).toThrow("not part of the portable story format");
  });

  it("rejects malformed JSON with a useful error", () => {
    expect(() => parseImportedStory("{not json")).toThrow("not valid JSON");
  });

  it("rejects unsupported versions and editor-only fields", () => {
    const outdated = { ...copySample(), schemaVersion: 3 };
    expect(() => parseStory(outdated)).toThrow("Unsupported story schema version");

    const withSelection = { ...copySample(), selectedShotId: "shot-bridge" };
    expect(() => parseStory(withSelection)).toThrow("not part of the portable story format");
  });

  it("rejects duplicate IDs and beats that exceed normalized progress", () => {
    const duplicateId = copySample();
    duplicateId.chapters[0].scenes[0].shots[0].beats[0].id = duplicateId.id;
    expect(() => parseStory(duplicateId)).toThrow("duplicates an existing story item ID");

    const overflowingBeat = copySample();
    overflowingBeat.chapters[0].scenes[0].shots[0].beats[0].start = 0.8;
    expect(() => parseStory(overflowingBeat)).toThrow("must fit within normalized progress");
  });

  it("requires discriminated layer fields", () => {
    const invalidLayer = copySample();
    const background = invalidLayer.chapters[0].scenes[0].shots[0].layers[0];
    if (background.kind === "background") delete (background as Partial<typeof background>).assetId;
    expect(() => parseStory(invalidLayer)).toThrow("assetId must be a non-empty string");
  });
});

describe("local story storage", () => {
  it("restores valid data and saves an exported project", () => {
    const storage = createMemoryStorage();
    const story = copySample();
    story.title = "Edited at the bridge";
    story.chapters[0].scenes[0].shots[0].animation.layers["layer-traveler"][1].transform.x = 52;
    saveStoredStory(storage, story);

    const restored = loadStoredStory(storage);
    expect(restored.canAutoSave).toBe(true);
    expect(restored.story.title).toBe("Edited at the bridge");
    expect(restored.story.chapters[0].scenes[0].shots[0].animation.layers["layer-traveler"][1].transform.x).toBe(52);
    expect(JSON.parse(storage.read() ?? "null").schemaVersion).toBe(2);
    expect(STORY_STORAGE_KEY).toBe("scrol-a-vision.story.v2");
  });

  it("does not overwrite malformed or outdated saved bytes", () => {
    const malformed = "{broken";
    const storage = createMemoryStorage({ [STORY_STORAGE_KEY]: malformed });
    const loaded = loadStoredStory(storage);

    expect(loaded.canAutoSave).toBe(false);
    expect(loaded.status).toContain("Reset or import");
    expect(storage.read()).toBe(malformed);

    const outdated = JSON.stringify({ ...copySample(), schemaVersion: 3 });
    const outdatedStorage = createMemoryStorage({ [STORY_STORAGE_KEY]: outdated });
    expect(loadStoredStory(outdatedStorage).canAutoSave).toBe(false);
    expect(outdatedStorage.read()).toBe(outdated);
  });

  it("migrates a v1 local project without overwriting its original storage bytes", () => {
    const legacyBytes = JSON.stringify(copyLegacySample());
    const storage = createMemoryStorage({ [LEGACY_STORY_STORAGE_KEY]: legacyBytes });
    const migrated = loadStoredStory(storage);

    expect(migrated.story.schemaVersion).toBe(2);
    expect(migrated.canAutoSave).toBe(true);
    expect(migrated.status).toContain("migrated from version 1");
    expect(migrated.story.chapters[0].scenes[0].shots[0].animation).toEqual({ camera: [], layers: {} });
    expect(storage.read(LEGACY_STORY_STORAGE_KEY)).toBe(legacyBytes);

    saveStoredStory(storage, migrated.story);
    expect(JSON.parse(storage.read() ?? "null").schemaVersion).toBe(2);
    expect(storage.read(LEGACY_STORY_STORAGE_KEY)).toBe(legacyBytes);
  });

  it("loads the sample if no project exists", () => {
    const loaded = loadStoredStory(createMemoryStorage());
    expect(loaded.story).toEqual(sampleStory);
    expect(loaded.canAutoSave).toBe(true);
  });

  it("keeps invalid imported content separate from the valid sample", () => {
    const sample = copySample();
    expect(() => parseImportedStory("[]")).toThrow(StoryFormatError);
    expect(sample.title).toBe("After the Storm");
  });
});