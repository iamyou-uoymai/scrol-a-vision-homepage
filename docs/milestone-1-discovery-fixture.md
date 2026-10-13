# Milestone 1 Discovery Fixture

The executable fixture is `studio/src/data/discoveryStory.ts`. It declares `schemaVersion: 3` and `grammarVersion: "1.2"`, and is validated and JSON-round-tripped by `studio/src/data/storyCanonical.test.ts`.

## Source-defined content

Document A v1.2, Section 22, defines Passage P03, “Discovery,” as a character finding an object whose significance is not initially understood. The example gives the Entry (the character enters an abandoned room), three Phrases (Observation, Attraction, Reveal), the attraction of a sound toward a corner while its source remains undisclosed, the object's reveal, a local Dominant (the object fills the visual field), and the Exit (the character recognizes the object). The fixture uses these named narrative stages and keeps its Dominant/Exit annotations distinct from presentation cues.

The source does not specify a Movement wrapper for this worked Passage. The fixture includes one solely because the canonical Story hierarchy places Passages inside Movements.

## Illustrative choices

The following are implementation fixture content, not facts prescribed by either source document:

- The Movement title, purpose wording, and resulting-condition wording.
- Stable IDs and timestamps.
- Detailed Beat titles and purpose sentences, the six individual primary-function assignments, and the numerical traversal weights. Document A defines the function vocabulary but does not assign each Discovery event a required function.
- The specific three-shot composition, layer IDs, cue IDs/labels/timing, camera and character transforms, and keyframes.
- A generic abandoned-room asset identifier and recognition caption. The documents do not specify a character identity, the object's identity, dialogue, or media assets.
- The sound entry is a typed composition cue only. This milestone does not implement audio playback or connect cues to narrative Beats.

The current Player has no asset resolver for `discovery-room-placeholder`; that reference is deliberately visible as a placeholder in the fixture data and is not presented as a bundled/rendered asset. The fixture exercises schema safety and preservation, not final Discovery artwork.
