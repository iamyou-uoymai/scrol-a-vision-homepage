import type { Story } from "../types/story";

export const discoveryStoryFixture: Story = {
  schemaVersion: 3,
  grammarVersion: "1.2",
  id: "story-discovery-fixture",
  title: "Discovery",
  metadata: {
    createdAt: "2026-10-13T00:00:00.000Z",
    updatedAt: "2026-10-13T00:00:00.000Z",
  },
  movements: [
    {
      id: "movement-discovery",
      title: "Discovery",
      purpose: "The character moves from seeing an abandoned room as empty to recognizing an object as significant.",
      conditionNote: "The character's understanding changes through the discovery.",
      passages: [
        {
          id: "passage-discovery-p03",
          title: "Discovery",
          dominantPurpose: "A character discovers an object whose significance is not initially understood.",
          annotations: {
            entry: "The character enters an abandoned room.",
            development: "The room is observed; a sound draws the character toward a corner before its source is fully disclosed.",
            dominantBeatId: "beat-object-fills-field",
            exit: "The character recognizes the object; its meaning has changed for the character and reader.",
          },
          phrases: [
            {
              id: "phrase-observation",
              title: "Observation",
              narrativeIdea: "The room is observed.",
              beats: [
                {
                  id: "beat-room-enters-view",
                  title: "The character enters the abandoned room",
                  purpose: "Establish the abandoned room as the field in which the discovery will occur.",
                  primaryFunction: "INTRODUCE",
                  traversalWeight: 1,
                },
                {
                  id: "beat-room-texture-and-emptiness",
                  title: "The room's texture and emptiness are noticed",
                  purpose: "Make the room's texture and emptiness perceptible before attention is drawn elsewhere.",
                  primaryFunction: "EMPHASIZE",
                  traversalWeight: 1.2,
                },
              ],
            },
            {
              id: "phrase-attraction",
              title: "Attraction",
              narrativeIdea: "A sound draws the character toward a corner while its source remains withheld.",
              beats: [
                {
                  id: "beat-sound-redirects-attention",
                  title: "A sound draws the character toward a corner",
                  purpose: "Redirect the character's attention and movement toward the source of the sound.",
                  primaryFunction: "CHANGE",
                  traversalWeight: 1.4,
                },
                {
                  id: "beat-sound-source-withheld",
                  title: "The sound's source remains unknown",
                  purpose: "Introduce an unresolved question by withholding the sound's source during the approach.",
                  primaryFunction: "INTRODUCE",
                  traversalWeight: 1.1,
                },
              ],
            },
            {
              id: "phrase-reveal",
              title: "Reveal",
              narrativeIdea: "The object becomes visible, receives emphasis, and is recognized.",
              beats: [
                {
                  id: "beat-object-becomes-visible",
                  title: "The object becomes visible",
                  purpose: "Make the previously withheld object available to the character and reader.",
                  primaryFunction: "REVEAL",
                  traversalWeight: 1.2,
                },
                {
                  id: "beat-object-fills-field",
                  title: "The object fills the visual field",
                  purpose: "Increase the object's prominence so its local importance is unmistakable.",
                  primaryFunction: "EMPHASIZE",
                  traversalWeight: 1.3,
                },
                {
                  id: "beat-object-recognized",
                  title: "The character recognizes the object",
                  purpose: "Resolve the immediate uncertainty by changing what the object means to the character.",
                  primaryFunction: "RESOLVE",
                  traversalWeight: 1,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  composition: {
    chapters: [
      {
        id: "composition-chapter-discovery",
        title: "Discovery composition",
        scenes: [
          {
            id: "composition-scene-abandoned-room",
            title: "Abandoned room",
            shots: [
              {
                id: "shot-room-observation",
                title: "Observe the room",
                layers: [
                  {
                    id: "layer-room-observation-background",
                    name: "Abandoned room placeholder",
                    kind: "background",
                    assetId: "discovery-room-placeholder",
                    transform: { x: 50, y: 50, scale: 100, rotation: 0, opacity: 100 },
                  },
                  {
                    id: "layer-room-observation-character",
                    name: "The character",
                    kind: "character",
                    transform: { x: 42, y: 58, scale: 90, rotation: 0, opacity: 100 },
                  },
                ],
                cues: [
                  { id: "cue-room-survey", track: "scroll", label: "Survey the room", start: 0, duration: 0.72 },
                  { id: "cue-room-camera-lateral", track: "camera", label: "Lateral room survey", start: 0.08, duration: 0.62 },
                ],
                animation: {
                  camera: [
                    { id: "keyframe-room-camera-start", progress: 0, transform: { x: 0, y: 0, scale: 100, rotation: 0 }, easing: "ease-in-out" },
                    { id: "keyframe-room-camera-end", progress: 0.72, transform: { x: -4, y: 0, scale: 104, rotation: 0 }, easing: "linear" },
                  ],
                  layers: {},
                },
              },
              {
                id: "shot-follow-sound",
                title: "Follow the sound",
                layers: [
                  {
                    id: "layer-sound-background",
                    name: "Abandoned room placeholder",
                    kind: "background",
                    assetId: "discovery-room-placeholder",
                    transform: { x: 50, y: 50, scale: 100, rotation: 0, opacity: 100 },
                  },
                  {
                    id: "layer-sound-character",
                    name: "The character",
                    kind: "character",
                    transform: { x: 57, y: 58, scale: 90, rotation: 0, opacity: 100 },
                  },
                ],
                cues: [
                  { id: "cue-sound-enters", track: "sound", label: "Faint sound; source withheld", start: 0.04, duration: 0.7 },
                  { id: "cue-camera-approach-corner", track: "camera", label: "Approach the corner", start: 0.2, duration: 0.64 },
                ],
                animation: {
                  camera: [
                    { id: "keyframe-sound-camera-start", progress: 0, transform: { x: 0, y: 0, scale: 100, rotation: 0 }, easing: "ease-in-out" },
                    { id: "keyframe-sound-camera-end", progress: 0.84, transform: { x: 8, y: -1, scale: 112, rotation: 0 }, easing: "linear" },
                  ],
                  layers: {
                    "layer-sound-character": [
                      { id: "keyframe-sound-character-start", progress: 0, transform: { x: 42, y: 58, scale: 90, rotation: 0, opacity: 100 }, easing: "ease-in-out" },
                      { id: "keyframe-sound-character-end", progress: 0.78, transform: { x: 57, y: 58, scale: 90, rotation: 0, opacity: 100 }, easing: "linear" },
                    ],
                  },
                },
              },
              {
                id: "shot-object-reveal",
                title: "Reveal and recognition",
                layers: [
                  {
                    id: "layer-reveal-background",
                    name: "Abandoned room placeholder",
                    kind: "background",
                    assetId: "discovery-room-placeholder",
                    transform: { x: 50, y: 50, scale: 100, rotation: 0, opacity: 100 },
                  },
                  {
                    id: "layer-reveal-character",
                    name: "The character",
                    kind: "character",
                    transform: { x: 54, y: 58, scale: 90, rotation: 0, opacity: 100 },
                  },
                  {
                    id: "layer-recognition-caption",
                    name: "Recognition caption placeholder",
                    kind: "dialogue",
                    text: "The character recognizes the object.",
                    speaker: "The character",
                    transform: { x: 50, y: 78, scale: 100, rotation: 0, opacity: 100 },
                  },
                ],
                cues: [
                  { id: "cue-object-approach", track: "camera", label: "Approach the object", start: 0, duration: 0.52 },
                  { id: "cue-object-emphasis", track: "character", label: "Object fills the field", start: 0.3, duration: 0.46 },
                  { id: "cue-recognition-caption", track: "dialogue", label: "Recognition", start: 0.68, duration: 0.28 },
                ],
                animation: {
                  camera: [
                    { id: "keyframe-reveal-camera-start", progress: 0, transform: { x: 0, y: 0, scale: 100, rotation: 0 }, easing: "ease-in-out" },
                    { id: "keyframe-reveal-camera-dominant", progress: 0.56, transform: { x: 4, y: -2, scale: 128, rotation: 0 }, easing: "ease-in-out" },
                    { id: "keyframe-reveal-camera-end", progress: 1, transform: { x: 4, y: -2, scale: 122, rotation: 0 }, easing: "linear" },
                  ],
                  layers: {},
                },
              },
            ],
          },
        ],
      },
    ],
  },
};

export const discoveryFixtureIllustrativeContent = [
  "The Movement wrapper and the selected wording for Beat purpose are fixture interpretations of the source example.",
  "All IDs, traversal weights, detailed Beat titles/functions, cue labels and timing, camera/layer transforms, and the three-shot breakdown are illustrative authoring choices.",
  "The abandoned-room background and recognition-caption asset treatment are placeholders; Document A does not specify assets, dialogue, a character identity, or the object's identity.",
  "Sound cues are presentation data only; this fixture does not add audio playback or link a cue to a narrative Beat.",
] as const;
