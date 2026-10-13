import { describe, expect, it } from "vitest";
import { sampleStory } from "./sampleStory";
import { parseStory, parseStoryJson, StoryFormatError } from "./storyFormat";
import { LEGACY_STORY_STORAGE_KEY, LEGACY_STORY_V2_STORAGE_KEY, loadStoredStory, parseImportedStory, saveStoredStory, serializeStory, STORY_STORAGE_KEY } from "./storyStorage";
import type { Shot, Story, StoryV1, StoryV2 } from "../types/story";

function copySample(): Story {
  return JSON.parse(JSON.stringify(sampleStory)) as Story;
}

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const writes: string[] = [];
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { writes.push(key); values.set(key, value); },
    read: (key = STORY_STORAGE_KEY) => values.get(key) ?? null,
    writes,
  };
}

function copyLegacySampleV2(): StoryV2 {
  const story = copySample();
  return {
    schemaVersion: 2,
    id: story.id,
    title: story.title,
    metadata: story.metadata,
    chapters: story.composition.chapters.map((chapter) => ({
      ...chapter,
      scenes: chapter.scenes.map((scene) => ({
        ...scene,
        shots: scene.shots.map(({ cues, ...shot }) => ({
          ...shot,
          beats: cues.map((cue) => ({ ...cue })),
        })),
      })),
    })),
  };
}

function copyLegacySample(): StoryV1 {
  const story = copyLegacySampleV2();
  return {
    schemaVersion: 1,
    id: story.id,
    title: story.title,
    metadata: story.metadata,
    chapters: story.chapters.map((chapter) => ({
      ...chapter,
      scenes: chapter.scenes.map((scene) => ({
        ...scene,
        shots: scene.shots.map(({ animation: _animation, ...shot }) => shot),
      })),
    })),
  };
}

describe("portable story format", () => {
  it("round-trips the sample story as versioned JSON", () => {
    const exported = serializeStory(copySample());
    expect(parseStoryJson(exported)).toEqual(sampleStory);
    expect(parseImportedStory(exported).composition.chapters[0].scenes[0].shots[0].animation).toEqual(
      sampleStory.composition.chapters[0].scenes[0].shots[0].animation,
    );
  });

  it("preserves edited keyframe positions and transforms through JSON export and import", () => {
    const story = copySample();
    const cameraKeyframe = story.composition.chapters[0].scenes[0].shots[0].animation.camera[1];
    cameraKeyframe.progress = 0.72;
    cameraKeyframe.transform.x = -14;
    cameraKeyframe.transform.scale = 124;

    const imported = parseImportedStory(serializeStory(story));
    expect(imported.composition.chapters[0].scenes[0].shots[0].animation.camera[1]).toEqual(cameraKeyframe);
  });

  it("preserves authored shot order and per-shot animation through export, import, save, and reload", () => {
    const story = copySample();
    const scene = story.composition.chapters[0].scenes[0];
    const secondShot: Shot = {
      id: "shot-beyond-bridge",
      title: "Beyond the bridge",
      layers: [],
      cues: [],
      animation: {
        camera: [
          { id: "keyframe-beyond-bridge-camera", progress: 0, transform: { x: 18, y: -3, scale: 115, rotation: 2 }, easing: "linear" },
        ],
        layers: {},
      },
    };
    scene.shots.push(secondShot);

    const imported = parseImportedStory(serializeStory(story));
    expect(imported.composition.chapters[0].scenes[0].shots.map((shot) => shot.id)).toEqual([
      "shot-bridge",
      "shot-beyond-bridge",
    ]);
    expect(imported.composition.chapters[0].scenes[0].shots[1].animation).toEqual(secondShot.animation);

    const storage = createMemoryStorage();
    saveStoredStory(storage, imported);
    const reloaded = loadStoredStory(storage).story;
    expect(reloaded.composition.chapters[0].scenes[0].shots.map((shot) => shot.id)).toEqual([
      "shot-bridge",
      "shot-beyond-bridge",
    ]);
    expect(reloaded.composition.chapters[0].scenes[0].shots[1].animation.camera[0].transform.x).toBe(18);
  });

  it("migrates valid version 1 projects through version 2 to version 3 without inventing narrative units", () => {
    const legacy = copyLegacySample();
    const migrated = parseStory(legacy);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.grammarVersion).toBeNull();
    expect(migrated.movements).toEqual([]);
    expect(migrated.composition.chapters[0].scenes[0].shots[0].animation).toEqual({ camera: [], layers: {} });
    expect(legacy.schemaVersion).toBe(1);
  });

  it("migrates schema version 2 while preserving every presentation field and order", () => {
    const legacy = copyLegacySampleV2();
    const original = JSON.parse(JSON.stringify(legacy)) as StoryV2;
    const migrated = parseStory(legacy);

    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.grammarVersion).toBeNull();
    expect(migrated.movements).toEqual([]);
    expect(migrated.composition.chapters).toHaveLength(legacy.chapters.length);
    expect(migrated.composition.chapters[0].id).toBe(legacy.chapters[0].id);
    expect(migrated.composition.chapters[0].scenes[0].id).toBe(legacy.chapters[0].scenes[0].id);
    expect(migrated.composition.chapters[0].scenes[0].shots.map((shot) => shot.id)).toEqual(
      legacy.chapters[0].scenes[0].shots.map((shot) => shot.id),
    );
    expect(migrated.composition.chapters[0].scenes[0].shots[0].cues).toEqual(legacy.chapters[0].scenes[0].shots[0].beats);
    expect(migrated.composition.chapters[0].scenes[0].shots[0].layers).toEqual(legacy.chapters[0].scenes[0].shots[0].layers);
    expect(migrated.composition.chapters[0].scenes[0].shots[0].animation).toEqual(legacy.chapters[0].scenes[0].shots[0].animation);
    expect(legacy).toEqual(original);
  });

  it("rejects malformed keyframe positions, unknown targets, and unknown animation fields", () => {
    const duplicate = copySample();
    duplicate.composition.chapters[0].scenes[0].shots[0].animation.camera[1].progress = 0;
    expect(() => parseStory(duplicate)).toThrow("strictly increasing");

    const unordered = copySample();
    unordered.composition.chapters[0].scenes[0].shots[0].animation.camera[0].progress = 0.7;
    expect(() => parseStory(unordered)).toThrow("strictly increasing");

    const unknownLayer = copySample();
    unknownLayer.composition.chapters[0].scenes[0].shots[0].animation.layers.missing = [];
    expect(() => parseStory(unknownLayer)).toThrow("unknown visual layer");

    const unknownTrack = copySample();
    (unknownTrack.composition.chapters[0].scenes[0].shots[0].animation as unknown as Record<string, unknown>).cameraTrack = [];
    expect(() => parseStory(unknownTrack)).toThrow("not part of the portable story format");
  });

  it("rejects malformed JSON with a useful error", () => {
    expect(() => parseImportedStory("{not json")).toThrow("not valid JSON");
  });

  it("rejects unsupported versions and editor-only fields", () => {
    const outdated = { ...copySample(), schemaVersion: 4 };
    expect(() => parseStory(outdated)).toThrow("Unsupported story schema version");

    const withSelection = { ...copySample(), selectedShotId: "shot-bridge" };
    expect(() => parseStory(withSelection)).toThrow("not part of the portable story format");
  });

  it("rejects duplicate IDs and beats that exceed normalized progress", () => {
    const duplicateId = copySample();
    duplicateId.composition.chapters[0].scenes[0].shots[0].cues[0].id = duplicateId.id;
    expect(() => parseStory(duplicateId)).toThrow("duplicates an existing story item ID");

    const overflowingCue = copySample();
    overflowingCue.composition.chapters[0].scenes[0].shots[0].cues[0].start = 0.8;
    expect(() => parseStory(overflowingCue)).toThrow("must fit within normalized progress");
  });

  it("requires discriminated layer fields", () => {
    const invalidLayer = copySample();
    const background = invalidLayer.composition.chapters[0].scenes[0].shots[0].layers[0];
    if (background.kind === "background") delete (background as Partial<typeof background>).assetId;
    expect(() => parseStory(invalidLayer)).toThrow("assetId must be a non-empty string");
  });
});

describe("local story storage", () => {
  it("restores valid data and saves an exported project", () => {
    const storage = createMemoryStorage();
    const story = copySample();
    story.title = "Edited at the bridge";
    story.composition.chapters[0].scenes[0].shots[0].animation.layers["layer-traveler"][1].transform.x = 52;
    saveStoredStory(storage, story);

    const restored = loadStoredStory(storage);
    expect(restored.canAutoSave).toBe(true);
    expect(restored.story.title).toBe("Edited at the bridge");
    expect(restored.story.composition.chapters[0].scenes[0].shots[0].animation.layers["layer-traveler"][1].transform.x).toBe(52);
    expect(JSON.parse(storage.read() ?? "null").schemaVersion).toBe(3);
    expect(STORY_STORAGE_KEY).toBe("scrol-a-vision.story.v3");
  });

  it("does not overwrite malformed or outdated saved bytes", () => {
    const malformed = "{broken";
    const storage = createMemoryStorage({ [STORY_STORAGE_KEY]: malformed });
    const loaded = loadStoredStory(storage);

    expect(loaded.canAutoSave).toBe(false);
    expect(loaded.status).toContain("Reset or import");
    expect(storage.read()).toBe(malformed);

    const outdated = JSON.stringify({ ...copySample(), schemaVersion: 4 });
    const outdatedStorage = createMemoryStorage({ [STORY_STORAGE_KEY]: outdated });
    expect(loadStoredStory(outdatedStorage).canAutoSave).toBe(false);
    expect(outdatedStorage.read()).toBe(outdated);
  });

  it("migrates a v1 local project without overwriting its original storage bytes", () => {
    const legacyBytes = JSON.stringify(copyLegacySample());
    const storage = createMemoryStorage({ [LEGACY_STORY_STORAGE_KEY]: legacyBytes });
    const migrated = loadStoredStory(storage);

    expect(migrated.story.schemaVersion).toBe(3);
    expect(migrated.canAutoSave).toBe(true);
    expect(migrated.status).toContain("migrated from version 1");
    expect(migrated.story.composition.chapters[0].scenes[0].shots[0].animation).toEqual({ camera: [], layers: {} });
    expect(storage.read(LEGACY_STORY_STORAGE_KEY)).toBe(legacyBytes);

    saveStoredStory(storage, migrated.story);
    expect(JSON.parse(storage.read() ?? "null").schemaVersion).toBe(3);
    expect(storage.read(LEGACY_STORY_STORAGE_KEY)).toBe(legacyBytes);
  });

  it("migrates stored version 2 to version 3 while preserving its original bytes", () => {
    const legacyBytes = JSON.stringify(copyLegacySampleV2());
    const storage = createMemoryStorage({ [LEGACY_STORY_V2_STORAGE_KEY]: legacyBytes });
    const migrated = loadStoredStory(storage);

    expect(migrated.story.schemaVersion).toBe(3);
    expect(migrated.status).toContain("migrated from version 2");
    expect(migrated.story.composition.chapters[0].scenes[0].shots[0].cues).toEqual(
      copyLegacySampleV2().chapters[0].scenes[0].shots[0].beats,
    );
    expect(storage.read(LEGACY_STORY_V2_STORAGE_KEY)).toBe(legacyBytes);
    expect(storage.read(STORY_STORAGE_KEY)).toBeNull();
  });

  it("does not overwrite invalid legacy project bytes or write a partial migration", () => {
    const invalidLegacy = { ...copyLegacySampleV2(), title: "" };
    const legacyBytes = JSON.stringify(invalidLegacy);
    const storage = createMemoryStorage({ [LEGACY_STORY_V2_STORAGE_KEY]: legacyBytes });
    const loaded = loadStoredStory(storage);

    expect(loaded.canAutoSave).toBe(false);
    expect(loaded.story).toEqual(sampleStory);
    expect(storage.read(LEGACY_STORY_V2_STORAGE_KEY)).toBe(legacyBytes);
    expect(storage.read(STORY_STORAGE_KEY)).toBeNull();
    expect(storage.writes).toEqual([]);
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