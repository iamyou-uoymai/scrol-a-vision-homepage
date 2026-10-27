import type { AnimationTarget } from "../types/story";

export type StudioObjectSelection =
  | { domain: "composition"; kind: "scene" | "shot" | "layer" | "cue"; id: string }
  | { domain: "composition"; kind: "creative-interval"; id: string }
  | { domain: "composition"; kind: "keyframe"; id: string; target: AnimationTarget }
  | { domain: "narrative"; kind: "movement" | "passage" | "phrase" | "beat" | "pause"; id: string }
  | { domain: "editorial"; kind: "motif"; id: string };

export interface CompositionContext {
  sceneId: string;
  shotId: string;
}

export interface StudioSelection {
  object: StudioObjectSelection;
  compositionContext: CompositionContext;
}

export interface StudioEditorState {
  selection: StudioSelection;
  shotPosition: number;
  traversalPosition: number;
}

export type StudioEditorAction =
  | { type: "select"; selection: StudioSelection }
  | { type: "set-shot-position"; position: number }
  | { type: "set-traversal-position"; position: number };

export interface StudioSelectionProjection {
  navigator: {
    object: StudioObjectSelection;
    compositionContext: CompositionContext;
  };
  stage: {
    object: StudioObjectSelection;
    compositionContext: CompositionContext;
    selectedLayerId?: string;
    narrativeSelection: boolean;
  };
  path: {
    object: StudioObjectSelection;
    compositionContext: CompositionContext;
  };
  inspector: StudioObjectSelection;
}

export function studioEditorReducer(state: StudioEditorState, action: StudioEditorAction): StudioEditorState {
  if (action.type === "select") return { ...state, selection: action.selection };
  if (action.type === "set-shot-position") return { ...state, shotPosition: action.position };
  return { ...state, traversalPosition: action.position };
}

export function projectStudioSelection(selection: StudioSelection): StudioSelectionProjection {
  const { object, compositionContext } = selection;
  const selectedLayerId = object.domain === "composition"
    ? object.kind === "layer"
      ? object.id
      : object.kind === "keyframe" && object.target.type === "layer"
        ? object.target.layerId
        : undefined
    : undefined;

  return {
    navigator: { object, compositionContext },
    stage: {
      object,
      compositionContext,
      selectedLayerId,
      narrativeSelection: object.domain === "narrative",
    },
    path: { object, compositionContext },
    inspector: object,
  };
}