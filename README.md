# Scrol-a-Vision

The public homepage is a static, responsive concept page. The Studio and scroll Player are separate React and TypeScript prototypes served at `/studio/` and `/player/` by Vite.

## Run the homepage
The existing static workflow is still available. Open `index.html` directly, or serve the folder with Python:

```bash
python -m http.server 8000
```

Visit `http://localhost:8000`. This command serves the homepage without requiring Node.js.

## Run the homepage and Studio
Install the Studio dependencies once, then start Vite:

```bash
npm install
npm run dev
```

Open `http://localhost:5173/` for the homepage, `http://localhost:5173/studio/` for the Studio, and `http://localhost:5173/player/` for the scroll Player. Both apps read the same saved version 3 story from browser `localStorage`; each can also open validated exported story JSON. Versions 1 and 2 are validated and migrated on read, with their original storage bytes retained. Build all pages with `npm run build`; `npm run preview` serves the build.

Run the story-format, storage, path-compiler, keyframe-evaluation, and player-progress tests with `npm test`.

## Player behavior
- Portable stories use schema version 3, with `schemaVersion` separate from `grammarVersion`. The canonical narrative hierarchy is `Story -> Movement -> Passage -> Phrase -> Beat`; its narrative Beats have a purpose and one primary function. Existing chapters, scenes, shots, cues, layers, assets, camera data, and keyframes live under `composition` and are not narrative units. Versions 1 and 2 are strictly validated and migrated without assigning narrative meaning; their original localStorage bytes remain under their legacy keys. New edits/autosaves use `scrol-a-vision.story.v3`. Invalid or unknown data is rejected rather than discarded.
- A timed composition cue has an ID, a presentation track, a label, normalized start, and duration. It is distinct from a canonical narrative Beat. The existing timeline and Player use these cue intervals for visual timing; sound cues remain data only.
- Each shot stores `animation.camera` and `animation.layers`, where layer-track keys are visual-layer IDs. A keyframe has a unique ID, normalized `progress`, a typed transform, and an outgoing `easing` mode (`linear` or `ease-in-out`). Camera transforms use X/Y percentages, percentage scale, and degrees of rotation; visual layer transforms also include opacity.
- The Studio timeline's Animation selector chooses the camera or a visual layer. Add keyframe captures its current evaluated state at the playhead; keyframe markers select frames, and the inspector edits normalized position, transform, and easing or removes the selected frame. Duplicate positions are selected when adding and rejected when editing; stored tracks must be strictly increasing.
- The Player currently uses the first composition chapter and its first scene. It plays that scene's shots in array order. The runway height is `100svh + (200svh * shot count)`; its computed scrollable range is split into equal shot segments. Within a segment, local progress runs from 0 to 1. Exact boundaries select the next shot at local progress 0, progress 100% selects the final shot at local progress 1, and shots transition with a hard cut. The Player does not advance into later scenes or chapters. Draft validation permits empty canonical narrative arrays and incomplete Phrase Beat lists; the existing composition chapter/scene/shot path remains required for the Studio and Player.
- Overall scroll progress is `clamp((scrollY - runwayTop) / (runwayHeight - viewportHeight), 0, 1)`. The pure path compiler resolves ordered intervals from positive traversal weights; the current Player adapts composition shots with weight `1` each to preserve equal shares. Canonical narrative Beat weights are not connected to composition shots. On viewport resize, the Player preserves its latest normalized progress by recalculating scroll position once on the next animation frame.
- The Studio keeps a single selected-object target plus composition context separate from preview position. Navigator, Stage, Path Editor and Inspector project that selection. Canonical Movement, Passage, Phrase and Beat rows are selectable and read-only; the composition Shot path and narrative Beat path are separate compiler-derived displays, with no assumed Beat-to-Shot mapping. Cue and keyframe coordinates are derived within their composition Shot intervals; no absolute coordinates are stored.
- Both Studio preview and Player use `evaluateAnimationTrack` from `studio/src/data/animation.ts`. Evaluation clamps invalid/out-of-range progress, interpolates adjacent keyframes with the outgoing frame's easing, holds the first/last state outside the track, and returns no state for an empty track. Missing camera tracks use the centered 100% camera; missing layer tracks use the layer's authored base transform. A single keyframe holds its state for the full progress range.
- The layer coordinate system uses percentage `x` and `y` anchors within the viewport. From each anchor, the local CSS transform list is `translate(-50%, -50%) rotate(rotation) scale(scale)`; the shared camera transform is on the parent world and moves/scales the composed scene without affecting reader controls.
- Dialogue visibility is derived from each active shot's dialogue beats using that shot's local progress; scrolling backward reverses it. `hero-scene` resolves to bundled local `assets/player-city-demo.jpg`, and the sample character uses bundled `assets/traveler.svg`. Other asset identifiers do not yet have an asset-library resolver. Sound beats remain visual timeline data only.

## Notes
- The homepage timeline remains an illustrative mock-up.
- The Studio saves version 3 story JSON to browser `localStorage` and supports JSON import/export. Reset sample is the explicit recovery path when saved data cannot be read. See `docs/milestone-1-legacy-mapping.md` and `docs/milestone-1-discovery-fixture.md` for the migration contract and fixture notes.
- The Studio and Player have no backend, database, multi-scene or multi-chapter playback, transition editor (shot boundaries are hard cuts), sound playback, or general asset-library resolver. Studio shot array order is Player order and can be changed without changing stable Shot IDs. Narrative-unit editing and explicit Beat-to-composition linking are not implemented.
- The hero artwork is in `assets/hero-scene.jpg`.
- The homepage itself does not depend on the Studio's JavaScript bundle.
