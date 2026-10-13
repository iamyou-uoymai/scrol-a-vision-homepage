# Milestone 1: Legacy-to-canonical mapping

This document records the migration contract before application code changes. It follows the canonical hierarchy and separation of narrative intent from presentation data in Blueprint v1.0 §§5 and 9, and the distinction between Beat function and compositional technique in Creative Standard v1.2.

## Legacy format

The current portable format is schema v2: `Story → Chapter → Scene → Shot`. A Shot contains visual layers, camera/layer keyframes, and `beats` with a track, label, normalized start, and duration. Those track entries describe timeline intervals; they do not contain narrative purpose or a primary narrative function.

Legacy schema v1 has the same Chapter/Scene/Shot and layer data, but no authored animation tracks. The existing v1 migration adds empty camera and layer tracks.

## Migration contract

The new format uses `schemaVersion: 3` independently of `grammarVersion`. A migrated legacy story has `grammarVersion: null` because its authoring standard was not recorded. New stories explicitly identify the grammar version they use.

| Legacy data | Canonical-format destination | Migration rule |
|---|---|---|
| Story ID, title, timestamps | Story ID, title, metadata | Preserve exactly. |
| Chapter, Scene, Shot IDs, titles, and array order | `composition.chapters`, nested scenes, and shots | Preserve as presentation/composition organization. Do not reinterpret any of these as Movement, Passage, or Phrase. |
| Layer IDs, order, kind, name, transforms, text, speaker, and asset IDs | Composition Shot layers | Preserve exactly. Do not rewrite asset identifiers or infer project-relative paths. |
| Existing shot `beats` track entries | Composition Shot `cues` | Rename the container only. Preserve each cue's ID, track/channel, label, start, duration, and order. Do not convert them into canonical narrative Beats or infer cue-to-Beat links. |
| Schema v2 camera and layer keyframes | Composition Shot animation | Preserve exactly, including keyframe IDs, order, progress, transforms, easing, and target layer IDs. |
| Schema v1 without animation | Composition Shot animation | Retain established v1 behavior by adding empty camera and layer tracks. |
| No canonical narrative hierarchy in legacy input | Story `movements: []` | Do not fabricate narrative units, purpose text, Beat functions, traversal weights, or associations from legacy labels or indices. This is a valid incomplete draft. |
| No recorded creative-standard version | Story `grammarVersion: null` | Preserve the uncertainty; do not claim legacy work was authored against v1.2. |

Thus, **no legacy Chapter, Scene, Shot, or track entry is assigned a canonical narrative identity**. Existing ordering and presentation remain usable by the current Studio and Player, while canonical authoring can be added without erasing or misrepresenting legacy content.

## Migration and persistence safety

1. Validate legacy JSON against its original version's complete format before conversion.
2. Convert into a new object without mutating the input or the original stored JSON.
3. Validate the resulting schema-v3 story, including IDs across canonical and composition objects, references, and all preserved presentation data.
4. Return the converted object only when both validation stages succeed. Import or migration failure leaves the caller's current project unchanged.
5. Read the existing v2 and v1 storage keys as legacy sources. Save migrated data under a new v3 key; never overwrite legacy bytes as part of loading or migration.

## Decisions deferred

- Mapping a Shot or cue to a canonical Beat requires author intent and is not derivable from legacy data.
- Chapter/Scene-to-Movement/Passage mapping is semantically ambiguous; no automatic mapping is made.
- Legacy allocation does not express traversal weights. A later authoring or path-compiler milestone must define allocations without silently changing the current equal-shot playback.
- A missing legacy `grammarVersion` remains unknown. Any future user-directed assignment should be an explicit edit, not an implicit migration.

## Discovery fixture convention

The Discovery story will use the documented observation, attraction, reveal, local Dominant, and Exit as narrative intent. Stable IDs, traversal weights, detailed Beat wording, assets, camera values, cue timing, and the illustrative composition needed to exercise the current renderer are implementation fixture choices, not details prescribed by either reference document. They will be labeled as illustrative in the fixture.
