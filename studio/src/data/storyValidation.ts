import { compileNarrativePath } from "./studioPath";
import { parseStory } from "./storyFormat";
import type { Beat, Story, VisualLayer } from "../types/story";

export type ValidationCategory = "structural" | "playback" | "editorial";
export type ValidationSeverity = "error" | "warning" | "prompt";

export interface StoryDiagnostic {
  category: ValidationCategory;
  code: string;
  severity: ValidationSeverity;
  message: string;
  suggestion: string;
  objectId?: string;
  blocksPublication: boolean;
}

export interface StoryValidationReport {
  schemaValid: boolean;
  draftSavable: boolean;
  publicationReady: boolean;
  structural: StoryDiagnostic[];
  playback: StoryDiagnostic[];
  editorial: StoryDiagnostic[];
}

function diagnostic(
  category: ValidationCategory,
  code: string,
  severity: ValidationSeverity,
  message: string,
  suggestion: string,
  objectId?: string,
  blocksPublication = false,
): StoryDiagnostic {
  return { category, code, severity, message, suggestion, objectId, blocksPublication };
}

function structuralFormatDiagnostic(message: string): StoryDiagnostic {
  if (message.toLowerCase().includes("traversalweight")) {
    return diagnostic("playback", "INVALID_TRAVERSAL_WEIGHT", "error", message, "Use a finite traversal weight greater than zero.", undefined, true);
  }
  if (message.toLowerCase().includes("duplicate")) {
    return diagnostic("structural", "DUPLICATE_STABLE_ID", "error", message, "Assign a unique stable ID to the affected story object.", undefined, true);
  }
  if (message.toLowerCase().includes("reference") || message.toLowerCase().includes("unknown visual layer")) {
    return diagnostic("structural", "BROKEN_REFERENCE", "error", message, "Repair or remove the reference without changing unrelated authored content.", undefined, true);
  }
  return diagnostic("structural", "INVALID_STORY_STRUCTURE", "error", message, "Correct the invalid schema value or parent relationship.", undefined, true);
}

function playerCanResolveLayer(layer: VisualLayer): boolean {
  if (layer.kind === "background") return layer.assetId === "hero-scene";
  if (layer.kind === "character") return layer.assetId === undefined || layer.assetId === "traveler";
  return true;
}

function collectBeats(story: Story): Array<{ beat: Beat; passageId: string; phraseId: string }> {
  return story.movements.flatMap((movement) => movement.passages.flatMap((passage) => passage.phrases.flatMap((phrase) => (
    phrase.beats.map((beat) => ({ beat, passageId: passage.id, phraseId: phrase.id }))
  ))));
}

function appendPublishedHierarchyFindings(story: Story, findings: StoryDiagnostic[]): void {
  if (story.movements.length === 0) {
    findings.push(diagnostic("structural", "STORY_REQUIRES_MOVEMENT", "error", "A conforming published Story contains at least one Movement.", "Add a Movement, or keep this empty Story as an incomplete draft.", story.id, true));
  }

  story.movements.forEach((movement) => {
    if (movement.passages.length === 0) {
      findings.push(diagnostic("structural", "MOVEMENT_REQUIRES_PASSAGE", "error", "A conforming published Movement contains at least one Passage.", "Add a Passage, or keep this Movement incomplete while drafting.", movement.id, true));
    }
    movement.passages.forEach((passage) => {
      if (passage.phrases.length === 0) {
        findings.push(diagnostic("structural", "PASSAGE_REQUIRES_PHRASE", "error", "A conforming published Passage contains at least one Phrase.", "Add a Phrase, or keep this Passage incomplete while drafting.", passage.id, true));
      }
      if (!passage.dominantPurpose) {
        findings.push(diagnostic("structural", "PASSAGE_PURPOSE_REQUIRED", "error", "A conforming published Passage needs one dominant narrative purpose.", "Describe what single experience or progression holds the Passage together.", passage.id, true));
      }
      passage.phrases.forEach((phrase) => {
        if (phrase.beats.length < 2) {
          findings.push(diagnostic("structural", "PHRASE_MINIMUM_BEATS", "error", "A conforming published Phrase contains at least two Beats.", "Add a Beat or keep this Phrase as an incomplete draft.", phrase.id, true));
        }
      });
    });
  });

  collectBeats(story).forEach(({ beat }) => {
    if (!beat.purpose) {
      findings.push(diagnostic("structural", "BEAT_PURPOSE_REQUIRED", "error", "A conforming published Beat needs a narrative purpose statement.", "Describe the change and its narrative relevance, not only a presentation technique.", beat.id, true));
    }
    if (!beat.primaryFunction) {
      findings.push(diagnostic("structural", "BEAT_PRIMARY_FUNCTION_REQUIRED", "error", "A conforming published Beat has one primary narrative function.", "Choose INTRODUCE, CHANGE, REVEAL, EMPHASIZE, RESOLVE, or INTERRUPT.", beat.id, true));
    }
  });
}

function appendPlaybackFindings(story: Story, findings: StoryDiagnostic[]): void {
  const beats = collectBeats(story);
  const pauses = story.movements.flatMap((movement) => movement.passages).flatMap((passage) => passage.pauses ?? []);
  if (beats.length === 0 && pauses.length === 0) {
    findings.push(diagnostic("playback", "NO_NARRATIVE_BEATS", "warning", "No narrative Beats are available for a compiled narrative path.", "Add weighted Beats when the narrative path is ready to be reviewed.", undefined, false));
  } else {
    const missingWeight = beats.filter(({ beat }) => beat.traversalWeight === undefined);
    missingWeight.forEach(({ beat }) => findings.push(diagnostic(
      "playback",
      "TRAVERSAL_WEIGHT_REQUIRED",
      "error",
      "This Beat has no traversal allocation, so it cannot receive a derived path interval.",
      "Enter a positive finite traversal weight; the value controls relative path distance, not elapsed time.",
      beat.id,
      true,
    )));
    pauses.filter((pause) => pause.traversalWeight === undefined).forEach((pause) => findings.push(diagnostic(
      "playback",
      "PAUSE_TRAVERSAL_WEIGHT_REQUIRED",
      "error",
      "This Pause has no traversal allocation, so it cannot receive a derived narrative path interval.",
      "Enter a positive finite traversal weight; it represents relative path distance, not a timed wait.",
      pause.id,
      true,
    )));
    findings.push(diagnostic(
      "playback",
      "NARRATIVE_PATH_NOT_PLAYED",
      "warning",
      "The current Player advances through composition Shots and does not play the compiled narrative Beat path.",
      "Treat the narrative path as an authoring projection only until a separate playback contract is implemented; no Beat-to-Shot link is inferred.",
      undefined,
      true,
    ));
    try {
      compileNarrativePath(story);
    } catch (error) {
      findings.push(diagnostic(
        "playback",
        "NARRATIVE_PATH_CANNOT_COMPILE",
        "error",
        error instanceof Error ? error.message : "The narrative path could not be compiled.",
        "Resolve invalid, duplicate, or numerically indistinguishable traversal allocations.",
        undefined,
        true,
      ));
    }
  }

  const chapters = story.composition.chapters;
  if (chapters.length > 1 || chapters[0]?.scenes.length > 1) {
    findings.push(diagnostic(
      "playback",
      "PLAYER_SCOPE_LIMITED",
      "warning",
      "The current Player renders only the first Chapter and first Scene; later composition sections remain authored but are not traversed.",
      "Review the supported playback scope before treating this project as a complete runtime experience.",
      undefined,
      false,
    ));
  }

  chapters.flatMap((chapter) => chapter.scenes).flatMap((scene) => scene.shots).forEach((shot) => {
    shot.creativeIntervals?.forEach((interval) => findings.push(diagnostic(
      "playback",
      interval.kind === "silence" ? "SILENCE_CUE_NOT_EXECUTED" : "VOID_CUE_NOT_EXECUTED",
      "error",
      `${interval.kind[0].toUpperCase()}${interval.kind.slice(1)} is recorded as an explicit Shot-local interval, but the current Player does not execute it.`,
      "Keep the authored annotation, but do not rely on it for runtime behavior until interval playback is specified and implemented.",
      interval.id,
      true,
    )));

    shot.cues.filter((cue) => cue.track !== "dialogue").forEach((cue) => findings.push(diagnostic(
      "playback",
      "COMPOSITION_CUE_NOT_EXECUTED",
      "warning",
      `The current Player does not execute the ${cue.track} cue “${cue.label}”; its authored timing is retained as composition metadata.`,
      "Do not treat this cue as a runtime camera, character, sound, or scroll effect in the current Player.",
      cue.id,
      true,
    )));

    shot.layers.filter((layer) => !playerCanResolveLayer(layer)).forEach((layer) => findings.push(diagnostic(
      "playback",
      "PLAYER_ASSET_UNRESOLVED",
      "error",
      `The current Player has no renderer mapping for asset “${"assetId" in layer ? layer.assetId : "(missing asset ID)"}” on layer “${layer.name}”.`,
      "Add a supported asset resolver or replace the placeholder with a known Player asset; this is not an intentional Void.",
      layer.id,
      true,
    )));
  });
}

function appendEditorialPrompts(story: Story, findings: StoryDiagnostic[]): void {
  story.movements.forEach((movement) => {
    if (!movement.purpose && !movement.conditionNote) {
      findings.push(diagnostic("editorial", "MOVEMENT_CONDITION_REVIEW", "prompt", "What dramatic condition changes or is deliberately reframed by this Movement?", "Record the intended progression or condition note when useful to collaborators.", movement.id));
    }
    movement.passages.forEach((passage) => {
      if (!passage.annotations?.entry) {
        findings.push(diagnostic("editorial", "PASSAGE_ENTRY_REVIEW", "prompt", "Can the Passage entry condition or visual field be described?", "Add an Entry annotation if it helps collaborators understand the starting condition.", passage.id));
      }
      if (!passage.annotations?.exit) {
        findings.push(diagnostic("editorial", "PASSAGE_EXIT_REVIEW", "prompt", "What resulting condition does this Passage leave, including any deliberately unresolved condition?", "Consider an Exit annotation; the Creative Standard treats Entry and Exit as roles, not mandatory hierarchy levels.", passage.id));
      }
      if (passage.tempoLabel) {
        findings.push(diagnostic("editorial", "PASSAGE_TEMPO_REVIEW", "prompt", `Review the relative tempo label “${passage.tempoLabel}” as an editorial description, not a seconds-based playback instruction.`, "Check that the label communicates intended relative pacing to collaborators.", passage.id));
      }
      passage.phrases.forEach((phrase) => {
        if (!phrase.narrativeIdea) {
          findings.push(diagnostic("editorial", "PHRASE_COHERENCE_REVIEW", "prompt", "Do the Beats in this Phrase form a recognisable idea, action, observation, or turn?", "Add a short narrative idea when it makes the grouping clearer.", phrase.id));
        }
      });
    });
  });

  const beats = collectBeats(story);
  if (beats.length > 0) {
    findings.push(diagnostic("editorial", "PATH_SPACING_REVIEW", "prompt", "What does the relative spacing between narrative changes make possible for attention, anticipation, impact, reflection, or contrast?", "Review the derived intervals at quick and deliberate traversal speeds; this is an editorial question, not an automatic quality score."));
  }
  beats.forEach(({ beat }) => {
    if (beat.purpose && beat.primaryFunction) {
      findings.push(diagnostic("editorial", "BEAT_PURPOSE_REVIEW", "prompt", `Does the purpose for “${beat.title}” state a narrative change and its relevance rather than only a technique?`, "Use the primary function as a question for review; software cannot prove the artistic choice.", beat.id));
    }
  });

  story.movements.flatMap((movement) => movement.passages).flatMap((passage) => passage.pauses ?? []).forEach((pause) => {
    if (!pause.intent) {
      findings.push(diagnostic("editorial", "PAUSE_INTENT_REVIEW", "prompt", "What minimal or absent narrative change makes this interval an intentional Pause?", "Add an intent note when the allocation alone does not explain the held condition.", pause.id));
    }
  });

  story.composition.chapters.flatMap((chapter) => chapter.scenes).flatMap((scene) => scene.shots).forEach((shot) => {
    shot.creativeIntervals?.filter((interval) => !interval.intent).forEach((interval) => findings.push(diagnostic(
      "editorial",
      "CREATIVE_INTERVAL_INTENT_REVIEW",
      "prompt",
      `Is this ${interval.kind} interval intentional, and what should a collaborator understand about it?`,
      "Add an intent note if the typed interval alone does not communicate the decision.",
      interval.id,
    )));
  });

  story.motifs?.forEach((motif) => {
    if (!motif.identity) {
      findings.push(diagnostic("editorial", "MOTIF_IDENTITY_REVIEW", "prompt", `Can collaborators recognize Motif “${motif.name}” across its recorded occurrences?`, "Add identifying details if the stable name alone does not make the intended recurrence clear.", motif.id));
    }
    if (motif.occurrenceIds.length < 2) {
      findings.push(diagnostic("editorial", "MOTIF_RECURRENCE_REVIEW", "prompt", `Motif “${motif.name}” has fewer than two recorded occurrences.`, "Confirm whether the recurrence is intentionally incomplete or add the relevant stable object IDs; software cannot judge whether the motif is recognisable.", motif.id));
    }
  });
}

export function validateStory(value: unknown): StoryValidationReport {
  const report: StoryValidationReport = {
    schemaValid: false,
    draftSavable: false,
    publicationReady: false,
    structural: [],
    playback: [],
    editorial: [],
  };

  let story: Story;
  try {
    story = parseStory(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The project is structurally invalid.";
    const issue = structuralFormatDiagnostic(message);
    report[issue.category].push(issue);
    return report;
  }

  report.schemaValid = true;
  report.draftSavable = true;
  appendPublishedHierarchyFindings(story, report.structural);
  appendPlaybackFindings(story, report.playback);
  appendEditorialPrompts(story, report.editorial);
  report.publicationReady = ![...report.structural, ...report.playback].some((issue) => issue.blocksPublication);
  return report;
}