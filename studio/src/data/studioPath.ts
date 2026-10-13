import { compilePath } from "./pathCompiler";
import type { CompiledPath, CompiledPathInterval, TraversalAllocation } from "./pathCompiler";
import type { Beat, PauseInterval, Story } from "../types/story";
import type { StudioObjectSelection } from "./studioSelection";

export interface NarrativeUnitView {
  domain: "narrative";
  kind: "movement" | "passage" | "phrase" | "beat" | "pause";
  id: string;
  title: string;
  depth: number;
  parentId?: string;
  orderIndex: number;
  siblingCount: number;
  movementId: string;
  passageId?: string;
  phraseId?: string;
  detail?: string;
  primaryFunction?: Beat["primaryFunction"];
  traversalWeight?: number;
  afterBeatId?: string;
}

export interface NarrativePathAllocation extends TraversalAllocation {
  unit: NarrativeUnitView & { kind: "beat" | "pause"; traversalWeight: number };
}

function pauseUnit(
  pause: PauseInterval,
  movementId: string,
  passageId: string,
  orderIndex: number,
  siblingCount: number,
): NarrativeUnitView {
  return {
    domain: "narrative",
    kind: "pause",
    id: pause.id,
    title: "Pause",
    depth: pause.afterBeatId ? 4 : 2,
    parentId: pause.afterBeatId ?? passageId,
    orderIndex,
    siblingCount,
    movementId,
    passageId,
    detail: pause.intent,
    traversalWeight: pause.traversalWeight,
    afterBeatId: pause.afterBeatId,
  };
}

export function listNarrativeUnits(story: Story): NarrativeUnitView[] {
  const units: NarrativeUnitView[] = [];
  story.movements.forEach((movement, movementIndex) => {
    units.push({
      domain: "narrative",
      kind: "movement",
      id: movement.id,
      title: movement.title,
      depth: 0,
      orderIndex: movementIndex,
      siblingCount: story.movements.length,
      movementId: movement.id,
      detail: movement.purpose ?? movement.conditionNote,
    });
    movement.passages.forEach((passage, passageIndex) => {
      units.push({
        domain: "narrative",
        kind: "passage",
        id: passage.id,
        title: passage.title,
        depth: 1,
        parentId: movement.id,
        orderIndex: passageIndex,
        siblingCount: movement.passages.length,
        movementId: movement.id,
        passageId: passage.id,
        detail: passage.dominantPurpose,
      });
      const passagePauses = passage.pauses ?? [];
      const appendPausesAfter = (afterBeatId?: string) => {
        const matches = passagePauses.filter((pause) => pause.afterBeatId === afterBeatId);
        matches.forEach((pause, pauseIndex) => units.push(pauseUnit(pause, movement.id, passage.id, pauseIndex, matches.length)));
      };
      appendPausesAfter();
      passage.phrases.forEach((phrase, phraseIndex) => {
        units.push({
          domain: "narrative",
          kind: "phrase",
          id: phrase.id,
          title: phrase.title,
          depth: 2,
          parentId: passage.id,
          orderIndex: phraseIndex,
          siblingCount: passage.phrases.length,
          movementId: movement.id,
          passageId: passage.id,
          phraseId: phrase.id,
          detail: phrase.narrativeIdea,
        });
        phrase.beats.forEach((beat, beatIndex) => {
          units.push({
            domain: "narrative",
            kind: "beat",
            id: beat.id,
            title: beat.title,
            depth: 3,
            parentId: phrase.id,
            orderIndex: beatIndex,
            siblingCount: phrase.beats.length,
            movementId: movement.id,
            passageId: passage.id,
            phraseId: phrase.id,
            detail: beat.purpose,
            primaryFunction: beat.primaryFunction,
            traversalWeight: beat.traversalWeight,
          });
          appendPausesAfter(beat.id);
        });
      });
    });
  });
  return units;
}

export function compileNarrativePath(story: Story): CompiledPath<NarrativePathAllocation> {
  const allocations = listNarrativeUnits(story)
    .filter((unit): unit is NarrativeUnitView & { kind: "beat" | "pause"; traversalWeight: number } => (
      (unit.kind === "beat" || unit.kind === "pause")
      && typeof unit.traversalWeight === "number"
      && Number.isFinite(unit.traversalWeight)
      && unit.traversalWeight > 0
    ))
    .map((unit) => ({ id: unit.id, traversalWeight: unit.traversalWeight, unit: { ...unit, traversalWeight: unit.traversalWeight } }));
  return compilePath(allocations);
}

export function narrativeUnitMatchesSelection(
  unit: NarrativePathAllocation["unit"],
  selection: StudioObjectSelection,
): boolean {
  if (selection.domain !== "narrative") return false;
  if (selection.kind === "pause") return unit.kind === "pause" && unit.id === selection.id;
  if (unit.kind === "pause" && selection.kind === "beat") return false;
  if (selection.kind === "movement") return unit.movementId === selection.id;
  if (selection.kind === "passage") return unit.passageId === selection.id;
  if (selection.kind === "phrase") return unit.phraseId === selection.id;
  return unit.id === selection.id;
}

export function narrativeSelectionSpan(
  path: CompiledPath<NarrativePathAllocation>,
  selection: StudioObjectSelection,
): { start: number; end: number } | undefined {
  const selectedIntervals = path.intervals.filter(({ source }) => narrativeUnitMatchesSelection(source.unit, selection));
  if (selectedIntervals.length === 0) return undefined;
  return {
    start: selectedIntervals[0].start,
    end: selectedIntervals[selectedIntervals.length - 1].end,
  };
}

export function projectLocalPathSpan<TAllocation extends TraversalAllocation>(
  interval: CompiledPathInterval<TAllocation>,
  localStart: number,
  localDuration: number,
): { start: number; end: number } {
  if (!Number.isFinite(localStart) || !Number.isFinite(localDuration) || localStart < 0 || localDuration < 0 || localStart + localDuration > 1) {
    throw new RangeError("Local path spans must be finite and fit within [0, 1].");
  }
  const intervalSpan = interval.end - interval.start;
  return {
    start: interval.start + intervalSpan * localStart,
    end: interval.start + intervalSpan * (localStart + localDuration),
  };
}

export function moveItemById<TItem extends { id: string }>(
  items: readonly TItem[],
  id: string,
  direction: -1 | 1,
): TItem[] {
  const currentIndex = items.findIndex((item) => item.id === id);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= items.length) return [...items];
  const next = [...items];
  [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
  return next;
}