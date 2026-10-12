import type { Story } from "../types/story";

export const sampleStory: Story = {
  schemaVersion: 2,
  id: "story-after-the-storm",
  title: "After the Storm",
  metadata: {
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
  },
  chapters: [
    {
      id: "chapter-one",
      title: "The Crossing",
      scenes: [
        {
          id: "scene-bridge",
          title: "At the old bridge",
          shots: [
            {
              id: "shot-bridge",
              title: "The Bridge",
              layers: [
                {
                  id: "layer-river-city",
                  name: "River city at dusk",
                  kind: "background",
                  assetId: "hero-scene",
                  transform: { x: 50, y: 50, scale: 100, rotation: 0, opacity: 100 },
                },
                {
                  id: "layer-traveler",
                  name: "The traveler",
                  kind: "character",
                  transform: { x: 41, y: 57, scale: 100, rotation: -3, opacity: 100 },
                },
              ],
              beats: [
                { id: "beat-camera", track: "camera", label: "Ease in", start: 0.08, duration: 0.4 },
                { id: "beat-arrival", track: "character", label: "Looks ahead", start: 0.18, duration: 0.15 },
                { id: "beat-dialogue", track: "dialogue", label: "A long way home", start: 0.39, duration: 0.28 },
                { id: "beat-wind", track: "sound", label: "Wind through the arches", start: 0.62, duration: 0.2 },
                { id: "beat-scroll", track: "scroll", label: "Hold", start: 0.76, duration: 0.12 },
              ],
              animation: {
                camera: [
                  { id: "keyframe-camera-start", progress: 0, transform: { x: 0, y: 0, scale: 100, rotation: 0 }, easing: "ease-in-out" },
                  { id: "keyframe-camera-end", progress: 0.48, transform: { x: -2.5, y: 0.8, scale: 110, rotation: 0 }, easing: "linear" },
                ],
                layers: {
                  "layer-traveler": [
                    { id: "keyframe-traveler-start", progress: 0, transform: { x: 41, y: 57, scale: 100, rotation: -3, opacity: 100 }, easing: "ease-in-out" },
                    { id: "keyframe-traveler-arrival", progress: 0.33, transform: { x: 44.5, y: 55.5, scale: 104.5, rotation: -1, opacity: 96 }, easing: "linear" },
                  ],
                },
              },
            },
          ],
        },
      ],
    },
  ],
};