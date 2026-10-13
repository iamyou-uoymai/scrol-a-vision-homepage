import { sampleStory } from "./sampleStory";
import { parseStory, parseStoryJson, StoryFormatError } from "./storyFormat";
import type { Story } from "../types/story";

export const STORY_STORAGE_KEY = "scrol-a-vision.story.v3";
export const LEGACY_STORY_V2_STORAGE_KEY = "scrol-a-vision.story.v2";
export const LEGACY_STORY_STORAGE_KEY = "scrol-a-vision.story.v1";

export interface StoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface StoryLoadResult {
  story: Story;
  canAutoSave: boolean;
  status: string;
}

function copyStory(story: Story): Story {
  return JSON.parse(JSON.stringify(story)) as Story;
}

export function loadStoredStory(storage?: StoryStorage): StoryLoadResult {
  if (!storage) {
    return { story: copyStory(sampleStory), canAutoSave: false, status: "Browser storage is unavailable; changes are in memory." };
  }

  let saved: string | null;
  let legacyV2: string | null = null;
  let legacyV1: string | null = null;
  try {
    saved = storage.getItem(STORY_STORAGE_KEY);
    if (saved === null) legacyV2 = storage.getItem(LEGACY_STORY_V2_STORAGE_KEY);
    if (saved === null && legacyV2 === null) legacyV1 = storage.getItem(LEGACY_STORY_STORAGE_KEY);
  } catch {
    return { story: copyStory(sampleStory), canAutoSave: false, status: "Saved project could not be read; reset or import to enable saving." };
  }
  if (saved === null && legacyV2 === null && legacyV1 === null) return { story: copyStory(sampleStory), canAutoSave: true, status: "Sample project" };

  try {
    const legacyVersion = saved !== null ? undefined : legacyV2 !== null ? 2 : 1;
    const story = parseStoryJson(saved ?? legacyV2 ?? legacyV1 ?? "");
    return {
      story,
      canAutoSave: true,
      status: legacyVersion ? `Project restored and migrated from version ${legacyVersion}` : "Project restored",
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The saved project is invalid.";
    return {
      story: copyStory(sampleStory),
      canAutoSave: false,
      status: `${detail} Reset or import a project to replace the saved data.`,
    };
  }
}

export function serializeStory(story: Story): string {
  return JSON.stringify(parseStory(story), null, 2);
}

export function saveStoredStory(storage: StoryStorage, story: Story): void {
  storage.setItem(STORY_STORAGE_KEY, serializeStory(story));
}

export function parseImportedStory(json: string): Story {
  try {
    return parseStoryJson(json);
  } catch (error) {
    if (error instanceof StoryFormatError) throw error;
    throw new StoryFormatError("The selected file could not be imported.");
  }
}

export function createSampleStory(): Story {
  return copyStory(sampleStory);
}

export function firstShot(story: Story) {
  return story.composition.chapters[0]?.scenes[0]?.shots[0];
}