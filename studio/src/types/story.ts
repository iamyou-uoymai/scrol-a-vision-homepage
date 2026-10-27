export type LayerKind = "background" | "character" | "dialogue";

export type CompositionCueTrack = "camera" | "character" | "dialogue" | "sound" | "scroll";
export type NormalizedProgress = number;

export interface LayerTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export interface CameraTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export type EasingMode = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export interface Keyframe<TTransform extends CameraTransform | LayerTransform> {
  id: string;
  progress: NormalizedProgress;
  transform: TTransform;
  easing?: EasingMode;
}

export interface ShotAnimation {
  camera: Keyframe<CameraTransform>[];
  layers: Record<string, Keyframe<LayerTransform>[]>;
}

export type AnimationTarget = { type: "camera" } | { type: "layer"; layerId: string };
export type AnimationKeyframe = Keyframe<CameraTransform> | Keyframe<LayerTransform>;
export type KeyframeUpdate = {
  progress?: NormalizedProgress;
  easing?: EasingMode;
  transform?: Partial<CameraTransform & LayerTransform>;
};

interface LayerBase {
  id: string;
  name: string;
  transform: LayerTransform;
}

export interface BackgroundLayer extends LayerBase {
  kind: "background";
  assetId: string;
}

export interface CharacterLayer extends LayerBase {
  kind: "character";
  assetId?: string;
}

export interface DialogueLayer extends LayerBase {
  kind: "dialogue";
  text: string;
  speaker?: string;
}

export type VisualLayer = BackgroundLayer | CharacterLayer | DialogueLayer;
export type VisualLayerUpdate = {
  name?: string;
  assetId?: string;
  text?: string;
  speaker?: string;
  transform?: Partial<LayerTransform>;
};

export interface CompositionCue {
  id: string;
  track: CompositionCueTrack;
  label: string;
  start: NormalizedProgress;
  duration: NormalizedProgress;
}

export interface LegacyShotV2 {
  id: string;
  title: string;
  layers: VisualLayer[];
  beats: CompositionCue[];
  animation: ShotAnimation;
}

export interface LegacySceneV2 {
  id: string;
  title: string;
  shots: LegacyShotV2[];
}

export interface LegacyChapterV2 {
  id: string;
  title: string;
  scenes: LegacySceneV2[];
}

export interface StoryV2 {
  schemaVersion: 2;
  id: string;
  title: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
  };
  chapters: LegacyChapterV2[];
}

export type LegacyShotV1 = Omit<LegacyShotV2, "animation">;
export type LegacySceneV1 = Omit<LegacySceneV2, "shots"> & { shots: LegacyShotV1[] };
export type LegacyChapterV1 = Omit<LegacyChapterV2, "scenes"> & { scenes: LegacySceneV1[] };

export interface StoryV1 extends Omit<StoryV2, "schemaVersion" | "chapters"> {
  schemaVersion: 1;
  chapters: LegacyChapterV1[];
}

export type PrimaryNarrativeFunction =
  | "INTRODUCE"
  | "CHANGE"
  | "REVEAL"
  | "EMPHASIZE"
  | "RESOLVE"
  | "INTERRUPT";

export type DynamicShape = "FLAT" | "ASCENDING" | "DESCENDING" | "PEAK" | "VALLEY" | "OSCILLATING";

export interface PassageDynamic {
  shape: DynamicShape;
  channel?: string;
}

export interface PauseInterval {
  id: string;
  afterBeatId?: string;
  traversalWeight?: number;
  intent?: string;
}

export interface SilenceCue {
  id: string;
  kind: "silence";
  start: NormalizedProgress;
  end: NormalizedProgress;
  audioChannel?: string;
  intent?: string;
}

export interface VoidCue {
  id: string;
  kind: "void";
  start: NormalizedProgress;
  end: NormalizedProgress;
  intent?: string;
}

export type PresentationIntervalCue = SilenceCue | VoidCue;
export interface PresentationIntervalCueUpdate {
  kind?: PresentationIntervalCue["kind"];
  start?: NormalizedProgress;
  end?: NormalizedProgress;
  audioChannel?: string;
  intent?: string;
}

export interface Motif {
  id: string;
  name: string;
  identity?: string;
  significance?: string;
  occurrenceIds: string[];
}

export interface Beat {
  id: string;
  title: string;
  purpose?: string;
  primaryFunction?: PrimaryNarrativeFunction;
  traversalWeight?: number;
}

export interface Phrase {
  id: string;
  title: string;
  narrativeIdea?: string;
  beats: Beat[];
}

export interface PassageAnnotations {
  entry?: string;
  development?: string;
  dominantBeatId?: string;
  exit?: string;
}

export interface Passage {
  id: string;
  title: string;
  dominantPurpose?: string;
  annotations?: PassageAnnotations;
  tempoLabel?: string;
  dynamics?: PassageDynamic[];
  pauses?: PauseInterval[];
  phrases: Phrase[];
}

export interface Movement {
  id: string;
  title: string;
  purpose?: string;
  conditionNote?: string;
  passages: Passage[];
}

export interface CompositionShot {
  id: string;
  title: string;
  layers: VisualLayer[];
  cues: CompositionCue[];
  creativeIntervals?: PresentationIntervalCue[];
  animation: ShotAnimation;
}

export interface CompositionScene {
  id: string;
  title: string;
  shots: CompositionShot[];
}

export interface CompositionChapter {
  id: string;
  title: string;
  scenes: CompositionScene[];
}

export interface StoryComposition {
  chapters: CompositionChapter[];
}

export interface StoryV3 {
  schemaVersion: 3;
  grammarVersion: string | null;
  id: string;
  title: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
  };
  movements: Movement[];
  motifs?: Motif[];
  composition: StoryComposition;
}

export type Story = StoryV3;
export type Shot = CompositionShot;
export type Scene = CompositionScene;
export type Chapter = CompositionChapter;