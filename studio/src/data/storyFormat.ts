import type { BeatTrack, CameraTransform, EasingMode, Keyframe, LayerTransform, Story, StoryV1, VisualLayer } from "../types/story";

const beatTracks: BeatTrack[] = ["camera", "character", "dialogue", "sound", "scroll"];
const layerKinds = ["background", "character", "dialogue"] as const;
const easingModes: EasingMode[] = ["linear", "ease-in-out"];

export class StoryFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoryFormatError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireAllowedKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const unknownKey = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknownKey) throw new StoryFormatError(`${path}.${unknownKey} is not part of the portable story format.`);
}

function requireString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new StoryFormatError(`${path} must be a non-empty string.`);
  }
}

function requireArray(value: unknown, path: string, allowEmpty = true): asserts value is unknown[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new StoryFormatError(`${path} must be${allowEmpty ? " an array" : " a non-empty array"}.`);
  }
}

function requireUniqueId(value: unknown, path: string, ids: Set<string>): asserts value is string {
  requireString(value, path);
  if (ids.has(value)) throw new StoryFormatError(`${path} duplicates an existing story item ID.`);
  ids.add(value);
}

function requireNormalized(value: unknown, path: string, minimum = 0): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > 1) {
    throw new StoryFormatError(`${path} must be a number between ${minimum} and 1.`);
  }
}

function validateLayer(value: unknown, path: string, ids: Set<string>): asserts value is VisualLayer {
  if (!isRecord(value)) throw new StoryFormatError(`${path} must be an object.`);
  const allowedLayerKeys = value.kind === "background"
    ? ["id", "name", "kind", "assetId", "transform"]
    : value.kind === "character"
      ? ["id", "name", "kind", "assetId", "transform"]
      : ["id", "name", "kind", "text", "speaker", "transform"];
  requireAllowedKeys(value, allowedLayerKeys, path);
  requireUniqueId(value.id, `${path}.id`, ids);
  requireString(value.name, `${path}.name`);
  if (typeof value.kind !== "string" || !layerKinds.includes(value.kind as typeof layerKinds[number])) {
    throw new StoryFormatError(`${path}.kind must be background, character, or dialogue.`);
  }
  if (!isRecord(value.transform)) throw new StoryFormatError(`${path}.transform must be an object.`);
  requireAllowedKeys(value.transform, ["x", "y", "scale", "rotation", "opacity"], `${path}.transform`);
  for (const key of ["x", "y", "scale", "rotation", "opacity"] as const) {
    const number = value.transform[key];
    if (typeof number !== "number" || !Number.isFinite(number)) {
      throw new StoryFormatError(`${path}.transform.${key} must be a finite number.`);
    }
  }
  if (value.kind === "background") requireString(value.assetId, `${path}.assetId`);
  if (value.kind === "dialogue") requireString(value.text, `${path}.text`);
  if (value.assetId !== undefined) requireString(value.assetId, `${path}.assetId`);
  if (value.speaker !== undefined) requireString(value.speaker, `${path}.speaker`);
}

function validateKeyframes<TTransform extends CameraTransform | LayerTransform>(
  value: unknown,
  path: string,
  ids: Set<string>,
  transformKeys: readonly string[],
): asserts value is Keyframe<TTransform>[] {
  requireArray(value, path);
  let previousProgress = -1;
  value.forEach((keyframe, index) => {
    const keyframePath = `${path}[${index}]`;
    if (!isRecord(keyframe)) throw new StoryFormatError(`${keyframePath} must be an object.`);
    requireAllowedKeys(keyframe, ["id", "progress", "transform", "easing"], keyframePath);
    requireUniqueId(keyframe.id, `${keyframePath}.id`, ids);
    const progress = keyframe.progress;
    requireNormalized(progress, `${keyframePath}.progress`);
    if (progress <= previousProgress) {
      throw new StoryFormatError(`${keyframePath}.progress must be strictly increasing; duplicate or out-of-order keyframes are not allowed.`);
    }
    previousProgress = progress;
    if (typeof keyframe.easing !== "string" || !easingModes.includes(keyframe.easing as EasingMode)) {
      throw new StoryFormatError(`${keyframePath}.easing must be linear or ease-in-out.`);
    }
    if (!isRecord(keyframe.transform)) throw new StoryFormatError(`${keyframePath}.transform must be an object.`);
    requireAllowedKeys(keyframe.transform, transformKeys, `${keyframePath}.transform`);
    for (const key of transformKeys) {
      const number = keyframe.transform[key];
      if (typeof number !== "number" || !Number.isFinite(number)) {
        throw new StoryFormatError(`${keyframePath}.transform.${key} must be a finite number.`);
      }
    }
  });
}

function validateAnimation(value: unknown, path: string, layerIds: Set<string>, ids: Set<string>): void {
  if (!isRecord(value)) throw new StoryFormatError(`${path} must be an object.`);
  requireAllowedKeys(value, ["camera", "layers"], path);
  validateKeyframes<CameraTransform>(value.camera, `${path}.camera`, ids, ["x", "y", "scale", "rotation"]);
  if (!isRecord(value.layers)) throw new StoryFormatError(`${path}.layers must be an object.`);
  Object.entries(value.layers).forEach(([layerId, keyframes]) => {
    if (!layerIds.has(layerId)) throw new StoryFormatError(`${path}.layers.${layerId} references an unknown visual layer.`);
    validateKeyframes<LayerTransform>(keyframes, `${path}.layers.${layerId}`, ids, ["x", "y", "scale", "rotation", "opacity"]);
  });
}

function validateStoryObject(value: unknown, schemaVersion: 1 | 2): void {
  if (!isRecord(value)) throw new StoryFormatError("The project must be a JSON object.");
  requireAllowedKeys(value, ["schemaVersion", "id", "title", "metadata", "chapters"], "story");
  if (value.schemaVersion !== schemaVersion) {
    throw new StoryFormatError(`Unsupported story schema version: ${String(value.schemaVersion)}. This Studio supports version 2 and migrates version 1.`);
  }
  const ids = new Set<string>();
  requireUniqueId(value.id, "story.id", ids);
  requireString(value.title, "story.title");
  if (!isRecord(value.metadata)) throw new StoryFormatError("story.metadata must be an object.");
  requireAllowedKeys(value.metadata, ["createdAt", "updatedAt"], "story.metadata");
  for (const key of ["createdAt", "updatedAt"] as const) {
    requireString(value.metadata[key], `story.metadata.${key}`);
    if (Number.isNaN(Date.parse(value.metadata[key] as string))) {
      throw new StoryFormatError(`story.metadata.${key} must be a valid date.`);
    }
  }

  requireArray(value.chapters, "story.chapters", false);
  value.chapters.forEach((chapter, chapterIndex) => {
    const chapterPath = `story.chapters[${chapterIndex}]`;
    if (!isRecord(chapter)) throw new StoryFormatError(`${chapterPath} must be an object.`);
    requireAllowedKeys(chapter, ["id", "title", "scenes"], chapterPath);
    requireUniqueId(chapter.id, `${chapterPath}.id`, ids);
    requireString(chapter.title, `${chapterPath}.title`);
    requireArray(chapter.scenes, `${chapterPath}.scenes`, false);
    chapter.scenes.forEach((scene, sceneIndex) => {
      const scenePath = `${chapterPath}.scenes[${sceneIndex}]`;
      if (!isRecord(scene)) throw new StoryFormatError(`${scenePath} must be an object.`);
      requireAllowedKeys(scene, ["id", "title", "shots"], scenePath);
      requireUniqueId(scene.id, `${scenePath}.id`, ids);
      requireString(scene.title, `${scenePath}.title`);
      requireArray(scene.shots, `${scenePath}.shots`, false);
      scene.shots.forEach((shot, shotIndex) => {
        const shotPath = `${scenePath}.shots[${shotIndex}]`;
        if (!isRecord(shot)) throw new StoryFormatError(`${shotPath} must be an object.`);
        const shotKeys = schemaVersion === 1
          ? ["id", "title", "layers", "beats"]
          : ["id", "title", "layers", "beats", "animation"];
        requireAllowedKeys(shot, shotKeys, shotPath);
        requireUniqueId(shot.id, `${shotPath}.id`, ids);
        requireString(shot.title, `${shotPath}.title`);
        requireArray(shot.layers, `${shotPath}.layers`);
        const layerIds = new Set<string>();
        shot.layers.forEach((layer, layerIndex) => {
          validateLayer(layer, `${shotPath}.layers[${layerIndex}]`, ids);
          if (isRecord(layer) && typeof layer.id === "string") layerIds.add(layer.id);
        });
        requireArray(shot.beats, `${shotPath}.beats`);
        shot.beats.forEach((beat, beatIndex) => {
          const beatPath = `${shotPath}.beats[${beatIndex}]`;
          if (!isRecord(beat)) throw new StoryFormatError(`${beatPath} must be an object.`);
          requireAllowedKeys(beat, ["id", "track", "label", "start", "duration"], beatPath);
          requireUniqueId(beat.id, `${beatPath}.id`, ids);
          if (typeof beat.track !== "string" || !beatTracks.includes(beat.track as BeatTrack)) {
            throw new StoryFormatError(`${beatPath}.track is not a supported timeline track.`);
          }
          requireString(beat.label, `${beatPath}.label`);
          requireNormalized(beat.start, `${beatPath}.start`);
          requireNormalized(beat.duration, `${beatPath}.duration`, Number.EPSILON);
          if ((beat.start as number) + (beat.duration as number) > 1) {
            throw new StoryFormatError(`${beatPath}.start and duration must fit within normalized progress 0–1.`);
          }
        });
        if (schemaVersion === 2) validateAnimation(shot.animation, `${shotPath}.animation`, layerIds, ids);
      });
    });
  });
}

function migrateStoryV1(story: StoryV1): Story {
  return {
    ...story,
    schemaVersion: 2,
    chapters: story.chapters.map((chapter) => ({
      ...chapter,
      scenes: chapter.scenes.map((scene) => ({
        ...scene,
        shots: scene.shots.map((shot) => ({ ...shot, animation: { camera: [], layers: {} } })),
      })),
    })),
  };
}

export function parseStory(value: unknown): Story {
  if (isRecord(value) && value.schemaVersion === 1) {
    validateStoryObject(value, 1);
    const migrated = migrateStoryV1(value as unknown as StoryV1);
    validateStoryObject(migrated, 2);
    return migrated;
  }
  validateStoryObject(value, 2);
  return value as Story;
}

export function parseStoryJson(json: string): Story {
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    throw new StoryFormatError("This file is not valid JSON. Check the file contents and try again.");
  }
  return parseStory(value);
}