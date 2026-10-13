import type { Beat, CameraTransform, CompositionCue, CompositionCueTrack, DynamicShape, EasingMode, Keyframe, LayerTransform, Motif, PauseInterval, PresentationIntervalCue, PrimaryNarrativeFunction, Story, StoryV1, StoryV2, StoryV3, VisualLayer } from "../types/story";

const cueTracks: CompositionCueTrack[] = ["camera", "character", "dialogue", "sound", "scroll"];
const primaryFunctions: PrimaryNarrativeFunction[] = ["INTRODUCE", "CHANGE", "REVEAL", "EMPHASIZE", "RESOLVE", "INTERRUPT"];
const dynamicShapes: DynamicShape[] = ["FLAT", "ASCENDING", "DESCENDING", "PEAK", "VALLEY", "OSCILLATING"];
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

function validateLegacyStoryObject(value: unknown, schemaVersion: 1 | 2): void {
  if (!isRecord(value)) throw new StoryFormatError("The project must be a JSON object.");
  requireAllowedKeys(value, ["schemaVersion", "id", "title", "metadata", "chapters"], "story");
  if (value.schemaVersion !== schemaVersion) {
    throw new StoryFormatError(`Unsupported legacy story schema version: ${String(value.schemaVersion)}.`);
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
        shot.beats.forEach((cue, cueIndex) => validateCompositionCue(cue, `${shotPath}.beats[${cueIndex}]`, ids));
        if (schemaVersion === 2) validateAnimation(shot.animation, `${shotPath}.animation`, layerIds, ids);
      });
    });
  });
}

function validateCompositionCue(value: unknown, path: string, ids: Set<string>): asserts value is CompositionCue {
  if (!isRecord(value)) throw new StoryFormatError(`${path} must be an object.`);
  requireAllowedKeys(value, ["id", "track", "label", "start", "duration"], path);
  requireUniqueId(value.id, `${path}.id`, ids);
  if (typeof value.track !== "string" || !cueTracks.includes(value.track as CompositionCueTrack)) {
    throw new StoryFormatError(`${path}.track is not a supported composition cue track.`);
  }
  requireString(value.label, `${path}.label`);
  requireNormalized(value.start, `${path}.start`);
  requireNormalized(value.duration, `${path}.duration`, Number.EPSILON);
  if ((value.start as number) + (value.duration as number) > 1) {
    throw new StoryFormatError(`${path}.start and duration must fit within normalized progress 0–1.`);
  }
}

function validateNarrativeBeat(value: unknown, path: string, ids: Set<string>): asserts value is Beat {
  if (!isRecord(value)) throw new StoryFormatError(`${path} must be an object.`);
  requireAllowedKeys(value, ["id", "title", "purpose", "primaryFunction", "traversalWeight"], path);
  requireUniqueId(value.id, `${path}.id`, ids);
  requireString(value.title, `${path}.title`);
  if (value.purpose !== undefined) requireString(value.purpose, `${path}.purpose`);
  if (value.primaryFunction !== undefined && (typeof value.primaryFunction !== "string" || !primaryFunctions.includes(value.primaryFunction as PrimaryNarrativeFunction))) {
    throw new StoryFormatError(`${path}.primaryFunction must be one of ${primaryFunctions.join(", ")}.`);
  }
  if (value.traversalWeight !== undefined && (typeof value.traversalWeight !== "number" || !Number.isFinite(value.traversalWeight) || value.traversalWeight <= 0)) {
    throw new StoryFormatError(`${path}.traversalWeight must be a positive finite number.`);
  }
}

function validatePresentationInterval(value: unknown, path: string, ids: Set<string>): asserts value is PresentationIntervalCue {
  if (!isRecord(value)) throw new StoryFormatError(`${path} must be an object.`);
  const kind = value.kind;
  if (kind !== "silence" && kind !== "void") throw new StoryFormatError(`${path}.kind must be silence or void.`);
  requireAllowedKeys(value, kind === "silence" ? ["id", "kind", "start", "end", "audioChannel", "intent"] : ["id", "kind", "start", "end", "intent"], path);
  requireUniqueId(value.id, `${path}.id`, ids);
  requireNormalized(value.start, `${path}.start`);
  requireNormalized(value.end, `${path}.end`);
  if ((value.end as number) <= (value.start as number)) {
    throw new StoryFormatError(`${path}.end must be greater than ${path}.start.`);
  }
  if (kind === "silence" && value.audioChannel !== undefined) requireString(value.audioChannel, `${path}.audioChannel`);
  if (value.intent !== undefined) requireString(value.intent, `${path}.intent`);
}

function validatePauseInterval(value: unknown, path: string, ids: Set<string>, passageBeatIds: Set<string>): asserts value is PauseInterval {
  if (!isRecord(value)) throw new StoryFormatError(`${path} must be an object.`);
  requireAllowedKeys(value, ["id", "afterBeatId", "traversalWeight", "intent"], path);
  requireUniqueId(value.id, `${path}.id`, ids);
  if (value.afterBeatId !== undefined) {
    requireString(value.afterBeatId, `${path}.afterBeatId`);
    if (!passageBeatIds.has(value.afterBeatId as string)) throw new StoryFormatError(`${path}.afterBeatId must reference a Beat in the same Passage.`);
  }
  if (value.traversalWeight !== undefined && (typeof value.traversalWeight !== "number" || !Number.isFinite(value.traversalWeight) || value.traversalWeight <= 0)) {
    throw new StoryFormatError(`${path}.traversalWeight must be a positive finite number.`);
  }
  if (value.intent !== undefined) requireString(value.intent, `${path}.intent`);
}

function validateMotif(value: unknown, path: string, ids: Set<string>, occurrenceTargetIds: Set<string>): asserts value is Motif {
  if (!isRecord(value)) throw new StoryFormatError(`${path} must be an object.`);
  requireAllowedKeys(value, ["id", "name", "identity", "significance", "occurrenceIds"], path);
  requireUniqueId(value.id, `${path}.id`, ids);
  requireString(value.name, `${path}.name`);
  if (value.identity !== undefined) requireString(value.identity, `${path}.identity`);
  if (value.significance !== undefined) requireString(value.significance, `${path}.significance`);
  requireArray(value.occurrenceIds, `${path}.occurrenceIds`);
  const occurrences = new Set<string>();
  value.occurrenceIds.forEach((occurrenceId, index) => {
    const occurrencePath = `${path}.occurrenceIds[${index}]`;
    requireString(occurrenceId, occurrencePath);
    if (occurrences.has(occurrenceId)) throw new StoryFormatError(`${occurrencePath} duplicates a Motif occurrence.`);
    if (!occurrenceTargetIds.has(occurrenceId)) throw new StoryFormatError(`${occurrencePath} references an unknown story object.`);
    occurrences.add(occurrenceId);
  });
}

function validateCanonicalStoryObject(value: unknown): asserts value is StoryV3 {
  if (!isRecord(value)) throw new StoryFormatError("The project must be a JSON object.");
  requireAllowedKeys(value, ["schemaVersion", "grammarVersion", "id", "title", "metadata", "movements", "motifs", "composition"], "story");
  if (value.schemaVersion !== 3) {
    throw new StoryFormatError(`Unsupported story schema version: ${String(value.schemaVersion)}. This Studio supports version 3 and migrates versions 1 and 2.`);
  }
  if (value.grammarVersion !== null) requireString(value.grammarVersion, "story.grammarVersion");

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

  requireArray(value.movements, "story.movements");
  value.movements.forEach((movement, movementIndex) => {
    const movementPath = `story.movements[${movementIndex}]`;
    if (!isRecord(movement)) throw new StoryFormatError(`${movementPath} must be an object.`);
    requireAllowedKeys(movement, ["id", "title", "purpose", "conditionNote", "passages"], movementPath);
    requireUniqueId(movement.id, `${movementPath}.id`, ids);
    requireString(movement.title, `${movementPath}.title`);
    if (movement.purpose !== undefined) requireString(movement.purpose, `${movementPath}.purpose`);
    if (movement.conditionNote !== undefined) requireString(movement.conditionNote, `${movementPath}.conditionNote`);
    requireArray(movement.passages, `${movementPath}.passages`);
    movement.passages.forEach((passage, passageIndex) => {
      const passagePath = `${movementPath}.passages[${passageIndex}]`;
      if (!isRecord(passage)) throw new StoryFormatError(`${passagePath} must be an object.`);
      requireAllowedKeys(passage, ["id", "title", "dominantPurpose", "annotations", "tempoLabel", "dynamics", "pauses", "phrases"], passagePath);
      requireUniqueId(passage.id, `${passagePath}.id`, ids);
      requireString(passage.title, `${passagePath}.title`);
      if (passage.dominantPurpose !== undefined) requireString(passage.dominantPurpose, `${passagePath}.dominantPurpose`);
      if (passage.tempoLabel !== undefined) requireString(passage.tempoLabel, `${passagePath}.tempoLabel`);
      if (passage.dynamics !== undefined) {
        requireArray(passage.dynamics, `${passagePath}.dynamics`);
        passage.dynamics.forEach((dynamic, dynamicIndex) => {
          const dynamicPath = `${passagePath}.dynamics[${dynamicIndex}]`;
          if (!isRecord(dynamic)) throw new StoryFormatError(`${dynamicPath} must be an object.`);
          requireAllowedKeys(dynamic, ["shape", "channel"], dynamicPath);
          if (typeof dynamic.shape !== "string" || !dynamicShapes.includes(dynamic.shape as DynamicShape)) {
            throw new StoryFormatError(`${dynamicPath}.shape must be one of ${dynamicShapes.join(", ")}.`);
          }
          if (dynamic.channel !== undefined) requireString(dynamic.channel, `${dynamicPath}.channel`);
        });
      }
      const passageBeatIds = new Set<string>();
      if (passage.annotations !== undefined) {
        if (!isRecord(passage.annotations)) throw new StoryFormatError(`${passagePath}.annotations must be an object.`);
        requireAllowedKeys(passage.annotations, ["entry", "development", "dominantBeatId", "exit"], `${passagePath}.annotations`);
        for (const key of ["entry", "development", "exit"] as const) {
          if (passage.annotations[key] !== undefined) requireString(passage.annotations[key], `${passagePath}.annotations.${key}`);
        }
      }
      requireArray(passage.phrases, `${passagePath}.phrases`);
      passage.phrases.forEach((phrase, phraseIndex) => {
        const phrasePath = `${passagePath}.phrases[${phraseIndex}]`;
        if (!isRecord(phrase)) throw new StoryFormatError(`${phrasePath} must be an object.`);
        requireAllowedKeys(phrase, ["id", "title", "narrativeIdea", "beats"], phrasePath);
        requireUniqueId(phrase.id, `${phrasePath}.id`, ids);
        requireString(phrase.title, `${phrasePath}.title`);
        if (phrase.narrativeIdea !== undefined) requireString(phrase.narrativeIdea, `${phrasePath}.narrativeIdea`);
        requireArray(phrase.beats, `${phrasePath}.beats`);
        phrase.beats.forEach((beat, beatIndex) => {
          const beatPath = `${phrasePath}.beats[${beatIndex}]`;
          validateNarrativeBeat(beat, beatPath, ids);
          passageBeatIds.add((beat as Beat).id);
        });
      });
      if (passage.pauses !== undefined) {
        requireArray(passage.pauses, `${passagePath}.pauses`);
        passage.pauses.forEach((pause, pauseIndex) => validatePauseInterval(pause, `${passagePath}.pauses[${pauseIndex}]`, ids, passageBeatIds));
      }
      if (isRecord(passage.annotations) && passage.annotations.dominantBeatId !== undefined) {
        requireString(passage.annotations.dominantBeatId, `${passagePath}.annotations.dominantBeatId`);
        if (!passageBeatIds.has(passage.annotations.dominantBeatId as string)) {
          throw new StoryFormatError(`${passagePath}.annotations.dominantBeatId must reference a Beat in the same Passage.`);
        }
      }
    });
  });

  if (!isRecord(value.composition)) throw new StoryFormatError("story.composition must be an object.");
  requireAllowedKeys(value.composition, ["chapters"], "story.composition");
  requireArray(value.composition.chapters, "story.composition.chapters", false);
  value.composition.chapters.forEach((chapter, chapterIndex) => {
    const chapterPath = `story.composition.chapters[${chapterIndex}]`;
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
        requireAllowedKeys(shot, ["id", "title", "layers", "cues", "creativeIntervals", "animation"], shotPath);
        requireUniqueId(shot.id, `${shotPath}.id`, ids);
        requireString(shot.title, `${shotPath}.title`);
        requireArray(shot.layers, `${shotPath}.layers`);
        const layerIds = new Set<string>();
        shot.layers.forEach((layer, layerIndex) => {
          validateLayer(layer, `${shotPath}.layers[${layerIndex}]`, ids);
          if (isRecord(layer) && typeof layer.id === "string") layerIds.add(layer.id);
        });
        requireArray(shot.cues, `${shotPath}.cues`);
        shot.cues.forEach((cue, cueIndex) => validateCompositionCue(cue, `${shotPath}.cues[${cueIndex}]`, ids));
        if (shot.creativeIntervals !== undefined) {
          requireArray(shot.creativeIntervals, `${shotPath}.creativeIntervals`);
          shot.creativeIntervals.forEach((cue, cueIndex) => validatePresentationInterval(cue, `${shotPath}.creativeIntervals[${cueIndex}]`, ids));
        }
        validateAnimation(shot.animation, `${shotPath}.animation`, layerIds, ids);
      });
    });
  });

  if (value.motifs !== undefined) {
    requireArray(value.motifs, "story.motifs");
    const occurrenceTargetIds = new Set(ids);
    occurrenceTargetIds.delete(value.id as string);
    value.motifs.forEach((motif, motifIndex) => validateMotif(motif, `story.motifs[${motifIndex}]`, ids, occurrenceTargetIds));
  }
}

export function migrateStoryV1ToV2(story: StoryV1): StoryV2 {
  validateLegacyStoryObject(story, 1);
  const sourceCopy = JSON.parse(JSON.stringify(story)) as StoryV1;
  const migrated: StoryV2 = {
    ...sourceCopy,
    schemaVersion: 2,
    chapters: sourceCopy.chapters.map((chapter) => ({
      ...chapter,
      scenes: chapter.scenes.map((scene) => ({
        ...scene,
        shots: scene.shots.map((shot) => ({ ...shot, animation: { camera: [], layers: {} } })),
      })),
    })),
  };
  validateLegacyStoryObject(migrated, 2);
  return migrated;
}

export function migrateStoryV2ToV3(story: StoryV2): Story {
  validateLegacyStoryObject(story, 2);
  const sourceCopy = JSON.parse(JSON.stringify(story)) as StoryV2;
  const migrated: StoryV3 = {
    schemaVersion: 3,
    grammarVersion: null,
    id: sourceCopy.id,
    title: sourceCopy.title,
    metadata: sourceCopy.metadata,
    movements: [],
    composition: {
      chapters: sourceCopy.chapters.map((chapter) => ({
        ...chapter,
        scenes: chapter.scenes.map((scene) => ({
          ...scene,
          shots: scene.shots.map(({ beats, ...shot }) => ({
            ...shot,
            cues: beats.map((cue) => ({ ...cue })),
          })),
        })),
      })),
    },
  };
  validateCanonicalStoryObject(migrated);
  return migrated;
}

export function parseStory(value: unknown): Story {
  if (isRecord(value) && value.schemaVersion === 1) {
    return migrateStoryV2ToV3(migrateStoryV1ToV2(value as unknown as StoryV1));
  }
  if (isRecord(value) && value.schemaVersion === 2) {
    return migrateStoryV2ToV3(value as unknown as StoryV2);
  }
  validateCanonicalStoryObject(value);
  return value;
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