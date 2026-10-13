import { describe, expect, it } from "vitest";
import { discoveryStoryFixture } from "./discoveryStory";
import { listNarrativeUnits, compileNarrativePath, moveItemById, narrativeSelectionSpan, narrativeUnitMatchesSelection, projectLocalPathSpan } from "./studioPath";

describe("Studio path projections", () => {
  it("derives narrative intervals in authored order from Beat traversal weights", () => {
    const path = compileNarrativePath(discoveryStoryFixture);

    expect(path.totalTraversalWeight).toBeCloseTo(8.2, 12);
    expect(path.intervals).toHaveLength(7);
    expect(path.intervals[0]).toMatchObject({
      id: "beat-room-enters-view",
      start: 0,
      end: 1 / 8.2,
    });
    expect(path.intervals[1].start).toBe(path.intervals[0].end);
    expect(path.intervals[path.intervals.length - 1].end).toBe(1);
  });

  it("places a weighted Pause after its anchored Beat in the compiled narrative path", () => {
    const story = JSON.parse(JSON.stringify(discoveryStoryFixture)) as typeof discoveryStoryFixture;
    story.movements[0].passages[0].pauses = [{
      id: "pause-after-sound",
      afterBeatId: "beat-sound-redirects-attention",
      traversalWeight: 0.8,
      intent: "Hold the redirected attention.",
    }];

    const path = compileNarrativePath(story);
    const ids = path.intervals.map((interval) => interval.id);
    const pauseIndex = ids.indexOf("pause-after-sound");
    const pauseInterval = path.intervals[pauseIndex];

    expect(path.totalTraversalWeight).toBeCloseTo(9, 12);
    expect(ids[pauseIndex - 1]).toBe("beat-sound-redirects-attention");
    expect(ids[pauseIndex + 1]).toBe("beat-sound-source-withheld");
    expect(narrativeSelectionSpan(path, { domain: "narrative", kind: "pause", id: "pause-after-sound" })).toEqual({
      start: pauseInterval.start,
      end: pauseInterval.end,
    });
  });

  it("selects parent narrative units as derived spans over their child Beat intervals", () => {
    const path = compileNarrativePath(discoveryStoryFixture);
    const units = path.intervals.map((interval) => interval.source.unit);
    const phrase = { domain: "narrative", kind: "phrase", id: "phrase-attraction" } as const;
    const selected = units.filter((unit) => narrativeUnitMatchesSelection(unit, phrase));

    expect(selected.map((unit) => unit.id)).toEqual([
      "beat-sound-redirects-attention",
      "beat-sound-source-withheld",
    ]);
    expect(selected[0].movementId).toBe("movement-discovery");
    expect(selected[0].passageId).toBe("passage-discovery-p03");
    expect(narrativeSelectionSpan(path, phrase)).toEqual({
      start: path.intervals[2].start,
      end: path.intervals[3].end,
    });
  });

  it("projects cue spans and keyframe points from Shot-local positions into compiled global coordinates", () => {
    const shotInterval = { id: "shot-1", traversalWeight: 2, start: 0.25, end: 0.75, source: { id: "shot-1", traversalWeight: 2 } };

    expect(projectLocalPathSpan(shotInterval, 0.2, 0.3)).toEqual({ start: 0.35, end: 0.5 });
    expect(projectLocalPathSpan(shotInterval, 0.4, 0)).toEqual({ start: 0.45, end: 0.45 });
    expect(() => projectLocalPathSpan(shotInterval, 0.8, 0.3)).toThrow(RangeError);
  });

  it("lists canonical units read-only in their authored hierarchy order", () => {
    const units = listNarrativeUnits(discoveryStoryFixture);

    expect(units.slice(0, 4).map(({ kind, id, depth }) => ({ kind, id, depth }))).toEqual([
      { kind: "movement", id: "movement-discovery", depth: 0 },
      { kind: "passage", id: "passage-discovery-p03", depth: 1 },
      { kind: "phrase", id: "phrase-observation", depth: 2 },
      { kind: "beat", id: "beat-room-enters-view", depth: 3 },
    ]);
  });

  it("reorders composition objects without replacing their stable IDs or object identities", () => {
    const shots = discoveryStoryFixture.composition.chapters[0].scenes[0].shots;
    const originalIds = shots.map((shot) => shot.id);
    const reordered = moveItemById(shots, shots[0].id, 1);

    expect(reordered.map((shot) => shot.id)).toEqual([originalIds[1], originalIds[0], originalIds[2]]);
    expect(reordered[1]).toBe(shots[0]);
    expect(reordered[0]).toBe(shots[1]);
    expect(shots.map((shot) => shot.id)).toEqual(originalIds);
  });
});