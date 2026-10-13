import { describe, expect, it } from "vitest";
import { discoveryStoryFixture } from "./discoveryStory";
import {
  addBeat,
  addMovement,
  addPassage,
  addPause,
  addPhrase,
  addMotif,
  findNarrativeItem,
  moveNarrativeItem,
  removeBeat,
  removeMovement,
  removePassage,
  removePause,
  removePhrase,
  removeMotif,
  updateBeat,
  updateMovement,
  updatePassage,
  updatePause,
  updatePhrase,
  updateMotif,
} from "./narrativeCommands";
import type { Beat, Movement, Motif, Passage, PauseInterval, Phrase, Story } from "../types/story";

function copyStory(): Story {
  return JSON.parse(JSON.stringify(discoveryStoryFixture)) as Story;
}

describe("canonical narrative authoring commands", () => {
  it("creates and edits every canonical level without regenerating IDs", () => {
    const story = copyStory();
    const movement: Movement = { id: "movement-new", title: "New Movement", passages: [] };
    const passage: Passage = { id: "passage-new", title: "New Passage", phrases: [] };
    const phrase: Phrase = { id: "phrase-new", title: "New Phrase", beats: [] };
    const beat: Beat = { id: "beat-new", title: "New Beat", traversalWeight: 1 };

    let edited = addMovement(story, movement);
    edited = addPassage(edited, movement.id, passage);
    edited = addPhrase(edited, passage.id, phrase);
    edited = addBeat(edited, phrase.id, beat);
    edited = updateMovement(edited, movement.id, { title: "Reframed Movement", purpose: "A changed dramatic condition." });
    edited = updatePassage(edited, passage.id, { title: "Reframed Passage", dominantPurpose: "One dominant purpose." });
    edited = updatePhrase(edited, phrase.id, { title: "Reframed Phrase", narrativeIdea: "A connected turn." });
    edited = updateBeat(edited, beat.id, { title: "Reframed Beat", purpose: "The character discovers a clue.", primaryFunction: "REVEAL", traversalWeight: 1.5 });

    expect(findNarrativeItem(edited, "movement", movement.id)).toMatchObject({ id: movement.id, title: "Reframed Movement" });
    expect(findNarrativeItem(edited, "passage", passage.id)).toMatchObject({ id: passage.id, title: "Reframed Passage" });
    expect(findNarrativeItem(edited, "phrase", phrase.id)).toMatchObject({ id: phrase.id, title: "Reframed Phrase" });
    expect(findNarrativeItem(edited, "beat", beat.id)).toMatchObject({ id: beat.id, title: "Reframed Beat", traversalWeight: 1.5 });
    expect(story.movements.some((item) => item.id === movement.id)).toBe(false);
  });

  it("inserts and reorders all hierarchy levels by explicit sibling order", () => {
    const story = copyStory();
    const movement = story.movements[0];
    const passage = movement.passages[0];
    const phrase = passage.phrases[0];
    const originalBeatIds = phrase.beats.map((beat) => beat.id);

    const withMovement = addMovement(story, { id: "movement-inserted", title: "Inserted", passages: [] }, 0);
    expect(withMovement.movements.map((item) => item.id)[0]).toBe("movement-inserted");
    const withPassage = addPassage(story, movement.id, { id: "passage-inserted", title: "Inserted", phrases: [] }, 0);
    expect(withPassage.movements[0].passages[0].id).toBe("passage-inserted");
    const withPhrase = addPhrase(story, passage.id, { id: "phrase-inserted", title: "Inserted", beats: [] }, 0);
    expect(withPhrase.movements[0].passages[0].phrases[0].id).toBe("phrase-inserted");
    const withBeat = addBeat(story, phrase.id, { id: "beat-inserted", title: "Inserted", traversalWeight: 1 }, 1);
    expect(withBeat.movements[0].passages[0].phrases[0].beats.map((beat) => beat.id)).toEqual([
      originalBeatIds[0], "beat-inserted", originalBeatIds[1],
    ]);

    const twoMovements = addMovement(story, { id: "movement-extra", title: "Extra", passages: [] });
    const twoPassages = addPassage(story, movement.id, { id: "passage-extra", title: "Extra", phrases: [] });
    const twoPhrases = addPhrase(story, passage.id, { id: "phrase-extra", title: "Extra", beats: [] });
    expect(moveNarrativeItem(twoMovements, "movement", "movement-extra", -1).movements[0].id).toBe("movement-extra");
    expect(moveNarrativeItem(twoPassages, "passage", "passage-extra", -1).movements[0].passages[0].id).toBe("passage-extra");
    expect(moveNarrativeItem(twoPhrases, "phrase", "phrase-extra", -1).movements[0].passages[0].phrases.map((item) => item.id)).toEqual([
      "phrase-observation", "phrase-attraction", "phrase-extra", "phrase-reveal",
    ]);
    expect(moveNarrativeItem(story, "beat", originalBeatIds[1], -1).movements[0].passages[0].phrases[0].beats[0].id).toBe(originalBeatIds[1]);
  });

  it("removes canonical units and cleans only explicit references to removed IDs", () => {
    const story = copyStory();
    const passage = story.movements[0].passages[0];
    const targetBeat = passage.phrases[2].beats[1];
    passage.annotations = { ...passage.annotations, dominantBeatId: targetBeat.id };
    story.motifs = [{ id: "motif-test", name: "The object", identity: "A distinct object.", occurrenceIds: [targetBeat.id] }];

    const withoutBeat = removeBeat(story, targetBeat.id);
    expect(withoutBeat.movements[0].passages[0].annotations?.dominantBeatId).toBeUndefined();
    expect(withoutBeat.motifs?.[0].occurrenceIds).toEqual([]);
    expect(findNarrativeItem(withoutBeat, "beat", targetBeat.id)).toBeUndefined();

    expect(removePhrase(story, passage.phrases[2].id).movements[0].passages[0].phrases).toHaveLength(2);
    expect(removePassage(story, passage.id).movements[0].passages).toHaveLength(0);
    expect(removeMovement(story, story.movements[0].id).movements).toHaveLength(0);
  });

  it("creates, edits and removes explicit Motifs without changing occurrence IDs", () => {
    const story = copyStory();
    const motif: Motif = {
      id: "motif-new",
      name: "The object",
      identity: "A recurring physical object.",
      occurrenceIds: ["beat-object-becomes-visible", "layer-recognition-caption"],
    };
    const withMotif = addMotif(story, motif);
    const updated = updateMotif(withMotif, motif.id, { significance: "Its meaning changes after recognition." });

    expect(updated.motifs?.[0]).toEqual({ ...motif, significance: "Its meaning changes after recognition." });
    expect(removeMotif(updated, motif.id).motifs).toEqual([]);
    expect(story.motifs).toBeUndefined();
  });

  it("creates, edits and removes Passage-owned Pause intervals with stable IDs", () => {
    const story = copyStory();
    const passage = story.movements[0].passages[0];
    const pause: PauseInterval = { id: "pause-first", intent: "Hold on the room." };
    const secondPause: PauseInterval = { id: "pause-second", afterBeatId: "beat-room-enters-view", traversalWeight: 0.5 };

    const withPauses = addPause(addPause(story, passage.id, pause), passage.id, secondPause, 0);
    const updated = updatePause(withPauses, pause.id, { afterBeatId: "beat-room-texture-and-emptiness", traversalWeight: 0.75 });

    expect(findNarrativeItem(updated, "pause", pause.id)).toEqual({
      id: pause.id,
      intent: pause.intent,
      afterBeatId: "beat-room-texture-and-emptiness",
      traversalWeight: 0.75,
    });
    expect(updated.movements[0].passages[0].pauses?.map((item) => item.id)).toEqual([secondPause.id, pause.id]);
    expect(removePause(updated, pause.id).movements[0].passages[0].pauses).toEqual([secondPause]);
    expect(story.movements[0].passages[0].pauses).toBeUndefined();
  });

  it("reanchors a Pause after deleting its Beat to the nearest preceding survivor or Passage entry", () => {
    const story = copyStory();
    const passage = story.movements[0].passages[0];
    passage.pauses = [
      { id: "pause-after-middle", afterBeatId: "beat-sound-redirects-attention", traversalWeight: 0.4 },
      { id: "pause-after-first", afterBeatId: "beat-room-enters-view", traversalWeight: 0.3 },
    ];

    const withoutMiddle = removeBeat(story, "beat-sound-redirects-attention");
    expect(withoutMiddle.movements[0].passages[0].pauses?.[0].afterBeatId).toBe("beat-room-texture-and-emptiness");

    const withoutFirst = removeBeat(story, "beat-room-enters-view");
    expect(withoutFirst.movements[0].passages[0].pauses?.[1].afterBeatId).toBeUndefined();
  });
});