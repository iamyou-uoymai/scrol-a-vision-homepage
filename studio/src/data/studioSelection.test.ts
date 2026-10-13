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

  it("keeps selection and preview position independent", () => {
    const selection = { object: { domain: "composition", kind: "shot", id: "shot-1" } as const, compositionContext };
    const initial: StudioEditorState = { selection, previewPosition: 0.32 };
    const previewMoved = studioEditorReducer(initial, { type: "set-preview-position", position: 0.8 });
    const selectionChanged = studioEditorReducer(previewMoved, {
      type: "select",
      selection: { object: { domain: "narrative", kind: "phrase", id: "phrase-1" }, compositionContext },
    });

    expect(previewMoved.selection).toBe(selection);
    expect(selectionChanged.previewPosition).toBe(0.8);
    expect(selectionChanged.selection.object).toEqual({ domain: "narrative", kind: "phrase", id: "phrase-1" });
  });
});