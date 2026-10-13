import type { Beat, Movement, Motif, Passage, PauseInterval, Phrase, Story } from "../types/story";
import { moveItemById } from "./studioPath";

export type NarrativeKind = "movement" | "passage" | "phrase" | "beat" | "pause";
export type NarrativeItem = Movement | Passage | Phrase | Beat | PauseInterval;

function insertAt<T>(items: readonly T[], item: T, index = items.length): T[] {
  const next = [...items];
  const position = Math.max(0, Math.min(next.length, Math.trunc(index)));
  next.splice(position, 0, item);
  return next;
}

export function findNarrativeItem(story: Story, kind: NarrativeKind, id: string): NarrativeItem | undefined {
  for (const movement of story.movements) {
    if (kind === "movement" && movement.id === id) return movement;
    for (const passage of movement.passages) {
      if (kind === "passage" && passage.id === id) return passage;
      for (const phrase of passage.phrases) {
        if (kind === "phrase" && phrase.id === id) return phrase;
        if (kind === "beat") {
          const beat = phrase.beats.find((item) => item.id === id);
          if (beat) return beat;
        }
      }
      if (kind === "pause") {
        const pause = passage.pauses?.find((item) => item.id === id);
        if (pause) return pause;
      }
    }
  }
  return undefined;
}

export function addMovement(story: Story, movement: Movement, index?: number): Story {
  return { ...story, movements: insertAt(story.movements, movement, index) };
}

export function addPassage(story: Story, movementId: string, passage: Passage, index?: number): Story {
  let found = false;
  const movements = story.movements.map((movement) => {
    if (movement.id !== movementId) return movement;
    found = true;
    return { ...movement, passages: insertAt(movement.passages, passage, index) };
  });
  if (!found) throw new RangeError(`Movement ${movementId} was not found.`);
  return { ...story, movements };
}

export function addPhrase(story: Story, passageId: string, phrase: Phrase, index?: number): Story {
  let found = false;
  const movements = story.movements.map((movement) => ({
    ...movement,
    passages: movement.passages.map((passage) => {
      if (passage.id !== passageId) return passage;
      found = true;
      return { ...passage, phrases: insertAt(passage.phrases, phrase, index) };
    }),
  }));
  if (!found) throw new RangeError(`Passage ${passageId} was not found.`);
  return { ...story, movements };
}

export function addBeat(story: Story, phraseId: string, beat: Beat, index?: number): Story {
  let found = false;
  const movements = story.movements.map((movement) => ({
    ...movement,
    passages: movement.passages.map((passage) => ({
      ...passage,
      phrases: passage.phrases.map((phrase) => {
        if (phrase.id !== phraseId) return phrase;
        found = true;
        return { ...phrase, beats: insertAt(phrase.beats, beat, index) };
      }),
    })),
  }));
  if (!found) throw new RangeError(`Phrase ${phraseId} was not found.`);
  return { ...story, movements };
}

export function addPause(story: Story, passageId: string, pause: PauseInterval, index?: number): Story {
  let found = false;
  const movements = story.movements.map((movement) => ({
    ...movement,
    passages: movement.passages.map((passage) => {
      if (passage.id !== passageId) return passage;
      found = true;
      return { ...passage, pauses: insertAt(passage.pauses ?? [], pause, index) };
    }),
  }));
  if (!found) throw new RangeError(`Passage ${passageId} was not found.`);
  return { ...story, movements };
}

export function updateMovement(story: Story, id: string, update: Partial<Movement>): Story {
  return { ...story, movements: story.movements.map((item) => item.id === id ? { ...item, ...update, id: item.id } : item) };
}

export function updatePassage(story: Story, id: string, update: Partial<Passage>): Story {
  return {
    ...story,
    movements: story.movements.map((movement) => ({
      ...movement,
      passages: movement.passages.map((item) => item.id === id ? { ...item, ...update, id: item.id } : item),
    })),
  };
}

export function updatePhrase(story: Story, id: string, update: Partial<Phrase>): Story {
  return {
    ...story,
    movements: story.movements.map((movement) => ({
      ...movement,
      passages: movement.passages.map((passage) => ({
        ...passage,
        phrases: passage.phrases.map((item) => item.id === id ? { ...item, ...update, id: item.id } : item),
      })),
    })),
  };
}

export function updateBeat(story: Story, id: string, update: Partial<Beat>): Story {
  return {
    ...story,
    movements: story.movements.map((movement) => ({
      ...movement,
      passages: movement.passages.map((passage) => ({
        ...passage,
        phrases: passage.phrases.map((phrase) => ({
          ...phrase,
          beats: phrase.beats.map((item) => item.id === id ? { ...item, ...update, id: item.id } : item),
        })),
      })),
    })),
  };
}

export function updatePause(story: Story, id: string, update: Partial<PauseInterval>): Story {
  return { ...story, movements: story.movements.map((movement) => ({
    ...movement,
    passages: movement.passages.map((passage) => ({
      ...passage,
      pauses: passage.pauses?.map((pause) => pause.id === id ? { ...pause, ...update, id: pause.id } : pause),
    })),
  })) };
}

export function moveNarrativeItem(story: Story, kind: NarrativeKind, id: string, direction: -1 | 1): Story {
  if (kind === "movement") {
    return { ...story, movements: moveItemById(story.movements, id, direction) };
  }
  if (kind === "passage") {
    return { ...story, movements: story.movements.map((movement) => ({
      ...movement,
      passages: movement.passages.some((item) => item.id === id)
        ? moveItemById(movement.passages, id, direction)
        : movement.passages,
    })) };
  }
  if (kind === "phrase") {
    return { ...story, movements: story.movements.map((movement) => ({
      ...movement,
      passages: movement.passages.map((passage) => ({
        ...passage,
        phrases: passage.phrases.some((item) => item.id === id)
          ? moveItemById(passage.phrases, id, direction)
          : passage.phrases,
      })),
    })) };
  }
  if (kind === "pause") return story;
  return { ...story, movements: story.movements.map((movement) => ({
    ...movement,
    passages: movement.passages.map((passage) => ({
      ...passage,
      phrases: passage.phrases.map((phrase) => ({
        ...phrase,
        beats: phrase.beats.some((item) => item.id === id)
          ? moveItemById(phrase.beats, id, direction)
          : phrase.beats,
      })),
    })),
  })) };
}

function collectMovementIds(movement: Movement): Set<string> {
  return new Set([
    movement.id,
    ...movement.passages.flatMap((passage) => [
      passage.id,
      ...(passage.pauses ?? []).map((pause) => pause.id),
      ...passage.phrases.flatMap((phrase) => [phrase.id, ...phrase.beats.map((beat) => beat.id)]),
    ]),
  ]);
}

function collectPassageIds(passage: Passage): Set<string> {
  return new Set([
    passage.id,
    ...(passage.pauses ?? []).map((pause) => pause.id),
    ...passage.phrases.flatMap((phrase) => [phrase.id, ...phrase.beats.map((beat) => beat.id)]),
  ]);
}

function collectPhraseIds(phrase: Phrase): Set<string> {
  return new Set([phrase.id, ...phrase.beats.map((beat) => beat.id)]);
}

function reanchorPauses(storyBeforeRemoval: Story, storyAfterRemoval: Story, removedBeatIds: ReadonlySet<string>): Story {
  if (removedBeatIds.size === 0) return storyAfterRemoval;
  return {
    ...storyAfterRemoval,
    movements: storyAfterRemoval.movements.map((movement) => ({
      ...movement,
      passages: movement.passages.map((passage) => {
        const originalPassage = storyBeforeRemoval.movements.flatMap((item) => item.passages).find((item) => item.id === passage.id);
        if (!originalPassage?.pauses?.length) return passage;
        const originalBeats = originalPassage.phrases.flatMap((phrase) => phrase.beats);
        const survivingIds = new Set(passage.phrases.flatMap((phrase) => phrase.beats.map((beat) => beat.id)));
        const pauses = passage.pauses?.map((pause) => {
          if (!pause.afterBeatId || !removedBeatIds.has(pause.afterBeatId)) return pause;
          const anchorIndex = originalBeats.findIndex((beat) => beat.id === pause.afterBeatId);
          const previousSurvivor = originalBeats.slice(0, Math.max(0, anchorIndex)).reverse().find((beat) => survivingIds.has(beat.id));
          return { ...pause, afterBeatId: previousSurvivor?.id };
        });
        return { ...passage, pauses };
      }),
    })),
  };
}

function cleanNarrativeReferences(story: Story, removedIds: ReadonlySet<string>): Story {
  return {
    ...story,
    movements: story.movements.map((movement) => ({
      ...movement,
      passages: movement.passages.map((passage) => {
        const dominantBeatId = passage.annotations?.dominantBeatId;
        return dominantBeatId && removedIds.has(dominantBeatId)
          ? { ...passage, annotations: { ...passage.annotations, dominantBeatId: undefined } }
          : passage;
      }),
    })),
    motifs: story.motifs?.map((motif) => ({
      ...motif,
      occurrenceIds: motif.occurrenceIds.filter((occurrenceId) => !removedIds.has(occurrenceId)),
    })),
  };
}

export function removeMovement(story: Story, id: string): Story {
  const removed = story.movements.find((movement) => movement.id === id);
  if (!removed) return story;
  const base = { ...story, movements: story.movements.filter((movement) => movement.id !== id) };
  return cleanNarrativeReferences(base, collectMovementIds(removed));
}

export function removePassage(story: Story, id: string): Story {
  const removed = story.movements.flatMap((movement) => movement.passages).find((passage) => passage.id === id);
  if (!removed) return story;
  const base = { ...story, movements: story.movements.map((movement) => ({
    ...movement,
    passages: movement.passages.filter((passage) => passage.id !== id),
  })) };
  return cleanNarrativeReferences(base, collectPassageIds(removed));
}

export function removePhrase(story: Story, id: string): Story {
  const removed = story.movements.flatMap((movement) => movement.passages).flatMap((passage) => passage.phrases).find((phrase) => phrase.id === id);
  if (!removed) return story;
  const base = { ...story, movements: story.movements.map((movement) => ({
    ...movement,
    passages: movement.passages.map((passage) => ({ ...passage, phrases: passage.phrases.filter((phrase) => phrase.id !== id) })),
  })) };
  const removedIds = collectPhraseIds(removed);
  const removedBeatIds = new Set(removed.beats.map((beat) => beat.id));
  return cleanNarrativeReferences(reanchorPauses(story, base, removedBeatIds), removedIds);
}

export function removeBeat(story: Story, id: string): Story {
  const exists = story.movements.some((movement) => movement.passages.some((passage) => passage.phrases.some((phrase) => phrase.beats.some((beat) => beat.id === id))));
  if (!exists) return story;
  const base = { ...story, movements: story.movements.map((movement) => ({
    ...movement,
    passages: movement.passages.map((passage) => ({
      ...passage,
      phrases: passage.phrases.map((phrase) => ({ ...phrase, beats: phrase.beats.filter((beat) => beat.id !== id) })),
    })),
  })) };
  const passage = story.movements.flatMap((movement) => movement.passages).find((item) => item.phrases.some((phrase) => phrase.beats.some((beat) => beat.id === id)));
  const removedIds = new Set([id]);
  const reanchored = passage ? reanchorPauses(story, base, removedIds) : base;
  return cleanNarrativeReferences(reanchored, removedIds);
}

export function removePause(story: Story, id: string): Story {
  const exists = story.movements.some((movement) => movement.passages.some((passage) => passage.pauses?.some((pause) => pause.id === id)));
  if (!exists) return story;
  const base = { ...story, movements: story.movements.map((movement) => ({
    ...movement,
    passages: movement.passages.map((passage) => ({ ...passage, pauses: passage.pauses?.filter((pause) => pause.id !== id) })),
  })) };
  return cleanNarrativeReferences(base, new Set([id]));
}

export function addMotif(story: Story, motif: Motif, index?: number): Story {
  return { ...story, motifs: insertAt(story.motifs ?? [], motif, index) };
}

export function updateMotif(story: Story, id: string, update: Partial<Motif>): Story {
  return { ...story, motifs: (story.motifs ?? []).map((item) => item.id === id ? { ...item, ...update, id: item.id } : item) };
}

export function removeMotif(story: Story, id: string): Story {
  return { ...story, motifs: (story.motifs ?? []).filter((motif) => motif.id !== id) };
}