import { describe, expect, it } from "vitest";
import { discoveryStoryFixture } from "./discoveryStory";
import { parseStory, parseStoryJson, StoryFormatError } from "./storyFormat";
import { loadStoredStory, parseImportedStory, saveStoredStory, serializeStory, STORY_STORAGE_KEY } from "./storyStorage";
import type { Story } from "../types/story";

function copyDiscovery(): Story {
  return JSON.parse(JSON.stringify(discoveryStoryFixture)) as Story;
}

describe("canonical story schema v3", () => {
  it("validates the complete canonical hierarchy and Discovery narrative intent", () => {
    const story = parseStory(copyDiscovery());
    const movement = story.movements[0];
    const passage = movement.passages[0];

    expect(story.schemaVersion).toBe(3);
    expect(story.grammarVersion).toBe("1.2");
    expect(movement.id).toBe("movement-discovery");
    expect(passage.id).toBe("passage-discovery-p03");
    expect(passage.phrases.map((phrase) => phrase.title)).toEqual(["Observation", "Attraction", "Reveal"]);
    expect(passage.phrases.every((phrase) => phrase.beats.length >= 2)).toBe(true);
    expect(passage.phrases.flatMap((phrase) => phrase.beats).map((beat) => beat.primaryFunction)).toContain("REVEAL");
    expect(passage.annotations?.dominantBeatId).toBe("beat-object-fills-field");
  });

  it("accepts each source-defined primary narrative function", () => {
    const story = copyDiscovery();
    const beats = story.movements[0].passages[0].phrases.flatMap((phrase) => phrase.beats);
    const functions = ["INTRODUCE", "CHANGE", "REVEAL", "EMPHASIZE", "RESOLVE", "INTERRUPT"] as const;
    functions.forEach((primaryFunction, index) => { beats[index].primaryFunction = primaryFunction; });

    expect(parseStory(story).movements[0].passages[0].phrases.flatMap((phrase) => phrase.beats).slice(0, functions.length).map((beat) => beat.primaryFunction)).toEqual(functions);
  });

  it("round-trips the Discovery fixture with stable IDs and separate composition cues", () => {
    const exported = serializeStory(copyDiscovery());
    const imported = parseStoryJson(exported);

    expect(imported).toEqual(discoveryStoryFixture);
    expect(imported.movements[0].passages[0].phrases[2].beats[0].id).toBe("beat-object-becomes-visible");
    expect(imported.composition.chapters[0].scenes[0].shots[1].cues[0]).toMatchObject({
      id: "cue-sound-enters",
      track: "sound",
    });
    expect(imported.composition.chapters[0].scenes[0].shots[2].animation.camera).toHaveLength(3);
  });

  it("allows incomplete drafts without applying published-story Phrase requirements", () => {
    const draft = copyDiscovery();
    draft.movements = [];
    expect(parseStory(draft)).toEqual(draft);

    const emptyPhraseDraft = copyDiscovery();
    emptyPhraseDraft.movements[0].passages[0].phrases[0].beats = [];
    expect(parseStory(emptyPhraseDraft)).toEqual(emptyPhraseDraft);

    const noComposition = copyDiscovery();
    noComposition.composition.chapters = [];
    expect(() => parseStory(noComposition)).toThrow("story.composition.chapters must be a non-empty array");
  });

  it("keeps schema and grammar versions independent and rejects invalid version values", () => {
    const unknownGrammar = copyDiscovery();
    unknownGrammar.grammarVersion = null;
    expect(parseStory(unknownGrammar).grammarVersion).toBeNull();

    const missingGrammar = JSON.parse(JSON.stringify(copyDiscovery())) as Record<string, unknown>;
    delete missingGrammar.grammarVersion;
    expect(() => parseStory(missingGrammar)).toThrow("grammarVersion must be a non-empty string");

    const invalidGrammar = { ...copyDiscovery(), grammarVersion: 12 };
    expect(() => parseStory(invalidGrammar)).toThrow("grammarVersion must be a non-empty string");

    const futureSchema = { ...copyDiscovery(), schemaVersion: 4 };
    expect(() => parseStory(futureSchema)).toThrow("Unsupported story schema version");
  });

  it("rejects duplicate IDs across canonical and composition objects", () => {
    const duplicate = copyDiscovery();
    duplicate.composition.chapters[0].scenes[0].shots[0].id = duplicate.movements[0].passages[0].phrases[0].beats[0].id;
    expect(() => parseStory(duplicate)).toThrow("duplicates an existing story item ID");
  });

  it("rejects a dominant Beat reference whose parent is a different Passage", () => {
    const invalidParent = copyDiscovery();
    invalidParent.movements.push({
      id: "movement-second",
      title: "Second movement",
      passages: [{
        id: "passage-second",
        title: "Second passage",
        phrases: [{
          id: "phrase-second",
          title: "Second phrase",
          beats: [{
            id: "beat-elsewhere",
            title: "A separate change",
            purpose: "This Beat is nested in a different Passage.",
            primaryFunction: "CHANGE",
            traversalWeight: 1,
          }],
        }],
      }],
    });
    invalidParent.movements[0].passages[0].annotations!.dominantBeatId = "beat-elsewhere";

    expect(() => parseStory(invalidParent)).toThrow("must reference a Beat in the same Passage");
  });

  it("round-trips an incomplete Beat as a saveable draft", () => {
    const draft = copyDiscovery();
    const beat = draft.movements[0].passages[0].phrases[0].beats[0];
    delete beat.primaryFunction;
    delete beat.purpose;

    expect(parseStoryJson(serializeStory(draft))).toEqual(draft);
  });

  it("rejects an unsupported primary function and a supplied empty purpose", () => {
    const invalidFunction = copyDiscovery();
    (invalidFunction.movements[0].passages[0].phrases[0].beats[0] as unknown as Record<string, unknown>).primaryFunction = "CAMERA";
    expect(() => parseStory(invalidFunction)).toThrow("primaryFunction must be one of");

    const emptyPurpose = copyDiscovery();
    emptyPurpose.movements[0].passages[0].phrases[0].beats[0].purpose = " ";
    expect(() => parseStory(emptyPurpose)).toThrow("purpose must be a non-empty string");
  });

  it("preserves explicit overlapping Pause, Silence, and Void intervals", () => {
    const story = copyDiscovery();
    story.movements[0].passages[0].pauses = [
      { id: "pause-room-entry", afterBeatId: "beat-room-enters-view", traversalWeight: 0.6, intent: "Hold attention on the room." },
    ];
    story.composition.chapters[0].scenes[0].shots[0].creativeIntervals = [
      { id: "silence-room-entry", kind: "silence", start: 0.3, end: 0.5, audioChannel: "ambience" },
      { id: "void-room-entry", kind: "void", start: 0.4, end: 0.7, intent: "Reduce visual information." },
    ];

    expect(parseStoryJson(serializeStory(story))).toEqual(story);
    expect(() => parseStory({
      ...story,
      composition: {
        ...story.composition,
        chapters: story.composition.chapters.map((chapter) => ({
          ...chapter,
          scenes: chapter.scenes.map((scene) => ({
            ...scene,
            shots: scene.shots.map((shot) => shot.id === "shot-room-observation"
              ? { ...shot, creativeIntervals: [{ id: "bad-interval", kind: "void", start: 0.8, end: 0.8 }] }
              : shot),
          })),
        })),
      },
    })).toThrow("end must be greater than");
  });

  it("preserves Discovery authoring and existing composition through save, reload, export, and import", () => {
    const authored = copyDiscovery();
    const passage = authored.movements[0].passages[0];
    passage.tempoLabel = "SLOW into MODERATE";
    passage.dynamics = [{ shape: "ASCENDING", channel: "dramatic" }, { shape: "PEAK", channel: "visual" }];
    passage.annotations = { ...passage.annotations, entry: "The character enters the room." };
    const beat = passage.phrases[0].beats[0];
    beat.purpose = "Establish the abandoned room before attention shifts.";
    beat.primaryFunction = "INTRODUCE";
    beat.traversalWeight = 1.75;
    authored.motifs = [{
      id: "motif-discovery-object",
      name: "The object",
      identity: "The same physical object recurs.",
      significance: "Its meaning changes after recognition.",
      occurrenceIds: ["beat-object-becomes-visible", "beat-object-recognized"],
    }];
    passage.pauses = [{ id: "pause-discovery-entry", afterBeatId: "beat-room-enters-view", traversalWeight: 0.45, intent: "Let the room register." }];
    authored.composition.chapters[0].scenes[0].shots[0].creativeIntervals = [
      { id: "silence-discovery-reveal", kind: "silence", start: 0.72, end: 0.9 },
    ];
    const originalComposition = JSON.parse(JSON.stringify(authored.composition)) as Story["composition"];
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };

    saveStoredStory(storage, authored);
    const reloaded = loadStoredStory(storage).story;
    const imported = parseImportedStory(serializeStory(reloaded));

    expect(reloaded.movements).toEqual(authored.movements);
    expect(imported.movements).toEqual(authored.movements);
    expect(imported.motifs).toEqual(authored.motifs);
    expect(imported.composition).toEqual(originalComposition);
    expect(values.has(STORY_STORAGE_KEY)).toBe(true);
  });

  it("validates dynamic shapes and explicit Motif occurrence references", () => {
    const story = copyDiscovery();
    story.movements[0].passages[0].tempoLabel = "SLOW into MODERATE";
    story.movements[0].passages[0].dynamics = [
      { shape: "ASCENDING", channel: "visual" },
      { shape: "PEAK", channel: "dramatic" },
    ];
    story.motifs = [{
      id: "motif-object",
      name: "The object",
      identity: "A recurring object whose meaning changes.",
      significance: "Its meaning changes as the character recognizes it.",
      occurrenceIds: ["beat-object-becomes-visible", "layer-recognition-caption"],
    }];

    expect(parseStoryJson(serializeStory(story))).toEqual(story);

    const invalidShape = copyDiscovery();
    invalidShape.movements[0].passages[0].dynamics = [{ shape: "RISING" as never }];
    expect(() => parseStory(invalidShape)).toThrow("shape must be one of");

    const invalidMotif = copyDiscovery();
    invalidMotif.motifs = [{ id: "motif-missing-reference", name: "Unplaced", identity: "A reference", occurrenceIds: ["missing-id"] }];
    expect(() => parseStory(invalidMotif)).toThrow("references an unknown story object");
  });

  it("rejects malformed imported JSON as a StoryFormatError", () => {
    expect(() => parseStoryJson("{broken")).toThrow(StoryFormatError);
  });
});
