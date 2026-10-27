import { describe, expect, it } from "vitest";
import {
  projectStudioSelection,
  studioEditorReducer,
  type StudioEditorState,
} from "./studioSelection";

const compositionContext = { sceneId: "scene-1", shotId: "shot-1" };

describe("Studio selection projections", () => {
  it("projects one selected composition layer into Navigator, Stage, Path Editor, and Inspector", () => {
    const selectedLayer = { domain: "composition", kind: "layer", id: "layer-1" } as const;
    const projection = projectStudioSelection({ object: selectedLayer, compositionContext });

    expect(projection.navigator.object).toBe(selectedLayer);
    expect(projection.navigator.compositionContext).toBe(compositionContext);
    expect(projection.stage).toMatchObject({ selectedLayerId: "layer-1", narrativeSelection: false });
    expect(projection.path.object).toBe(selectedLayer);
    expect(projection.inspector).toBe(selectedLayer);
  });

  it("projects a selected layer keyframe onto its layer in the Stage while retaining keyframe Inspector selection", () => {
    const selectedKeyframe = {
      domain: "composition",
      kind: "keyframe",
      id: "keyframe-traveler-arrival",
      target: { type: "layer", layerId: "layer-traveler" },
    } as const;
    const projection = projectStudioSelection({ object: selectedKeyframe, compositionContext });

    expect(projection.stage).toMatchObject({ selectedLayerId: "layer-traveler", narrativeSelection: false });
    expect(projection.inspector).toBe(selectedKeyframe);
    expect(projection.path.object).toBe(selectedKeyframe);
  });

  it("keeps narrative selection visible without implying a composition or Shot link", () => {
    const selectedBeat = { domain: "narrative", kind: "beat", id: "beat-1" } as const;
    const projection = projectStudioSelection({ object: selectedBeat, compositionContext });

    expect(projection.navigator.object).toBe(selectedBeat);
    expect(projection.stage).toMatchObject({
      compositionContext,
      selectedLayerId: undefined,
      narrativeSelection: true,
    });
    expect(projection.path.object).toBe(selectedBeat);
    expect(projection.inspector).toBe(selectedBeat);
  });

  it("keeps traversal position, Shot-local position, and selection independent", () => {
    const selection = { object: { domain: "composition", kind: "shot", id: "shot-1" } as const, compositionContext };
    const initial: StudioEditorState = { selection, shotPosition: 0.32, traversalPosition: 0.16 };
    const traversalMoved = studioEditorReducer(initial, { type: "set-traversal-position", position: 0.8 });
    const selectionChanged = studioEditorReducer(traversalMoved, {
      type: "select",
      selection: { object: { domain: "narrative", kind: "phrase", id: "phrase-1" }, compositionContext },
    });
    const shotPositionMoved = studioEditorReducer(selectionChanged, { type: "set-shot-position", position: 0.72 });

    expect(traversalMoved.selection).toBe(selection);
    expect(traversalMoved.shotPosition).toBe(0.32);
    expect(selectionChanged.traversalPosition).toBe(0.8);
    expect(shotPositionMoved.traversalPosition).toBe(0.8);
    expect(shotPositionMoved.shotPosition).toBe(0.72);
    expect(selectionChanged.selection.object).toEqual({ domain: "narrative", kind: "phrase", id: "phrase-1" });
  });
});