export type LayerKind = "background" | "character" | "dialogue";

export type BeatTrack = "camera" | "character" | "dialogue" | "sound" | "scroll";
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

export type EasingMode = "linear" | "ease-in-out";

export interface Keyframe<TTransform extends CameraTransform | LayerTransform> {
  id: string;
  progress: NormalizedProgress;
  transform: TTransform;
  easing: EasingMode;
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

export interface StoryBeat {
  id: string;
  track: BeatTrack;
  label: string;
  start: NormalizedProgress;
  duration: NormalizedProgress;
}

export interface Shot {
  id: string;
  title: string;
  layers: VisualLayer[];
  beats: StoryBeat[];
  animation: ShotAnimation;
}

export interface Scene {
  id: string;
  title: string;
  shots: Shot[];
}

export interface Chapter {
  id: string;
  title: string;
  scenes: Scene[];
}

export interface Story {
  schemaVersion: 2;
  id: string;
  title: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
  };
  chapters: Chapter[];
}

export type LegacyShotV1 = Omit<Shot, "animation">;
export type LegacySceneV1 = Omit<Scene, "shots"> & { shots: LegacyShotV1[] };
export type LegacyChapterV1 = Omit<Chapter, "scenes"> & { scenes: LegacySceneV1[] };

export interface StoryV1 extends Omit<Story, "schemaVersion" | "chapters"> {
  schemaVersion: 1;
  chapters: LegacyChapterV1[];
}