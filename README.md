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

Open `http://localhost:5173/` for the homepage, `http://localhost:5173/studio/` for the Studio, and `http://localhost:5173/player/` for the scroll Player. Both apps read the same saved version 2 story from browser `localStorage`; each can also open validated exported story JSON. Build all pages with `npm run build`; `npm run preview` serves the build.

Run the story-format, storage, keyframe-evaluation, and player-progress tests with `npm test`.

## Player behavior
- Portable stories use schema version 2. Version 1 stories are strictly validated and migrated in memory to version 2 with empty animation tracks; their original version 1 localStorage bytes are preserved under the legacy key. New edits/autosaves use `scrol-a-vision.story.v2`. Invalid or unknown animation data is rejected rather than discarded.
- Each shot stores `animation.camera` and `animation.layers`, where layer-track keys are visual-layer IDs. A keyframe has a unique ID, normalized `progress`, a typed transform, and an outgoing `easing` mode (`linear` or `ease-in-out`). Camera transforms use X/Y percentages, percentage scale, and degrees of rotation; visual layer transforms also include opacity.
- The Studio timeline's Animation selector chooses the camera or a visual layer. Add keyframe captures its current evaluated state at the playhead; keyframe markers select frames, and the inspector edits normalized position, transform, and easing or removes the selected frame. Duplicate positions are selected when adding and rejected when editing; stored tracks must be strictly increasing.
- The Player currently uses the first chapter, scene, and shot. It starts from saved local data and can open a validated exported story JSON file for the current session.
- Scroll progress is `clamp((scrollY - runwayTop) / (runwayHeight - viewportHeight), 0, 1)`. The runway is three viewport heights, so the sticky scene maps its scrollable two-viewport range from 0 to 1.
- Both Studio preview and Player use `evaluateAnimationTrack` from `studio/src/data/animation.ts`. Evaluation clamps invalid/out-of-range progress, interpolates adjacent keyframes with the outgoing frame's easing, holds the first/last state outside the track, and returns no state for an empty track. Missing camera tracks use the centered 100% camera; missing layer tracks use the layer's authored base transform. A single keyframe holds its state for the full progress range.
- The layer coordinate system uses percentage `x` and `y` anchors within the viewport. From each anchor, the local CSS transform list is `translate(-50%, -50%) rotate(rotation) scale(scale)`; the shared camera transform is on the parent world and moves/scales the composed scene without affecting reader controls.
- Dialogue visibility is derived from each dialogue beat's normalized `start` and `duration`; scrolling backward reverses it. `hero-scene` resolves to bundled local `assets/player-city-demo.jpg`, and the sample character uses bundled `assets/traveler.svg`. Other asset identifiers do not yet have an asset-library resolver. Sound beats remain visual timeline data only.

## Notes
- The homepage timeline remains an illustrative mock-up.
- The Studio saves version 2 story JSON to browser `localStorage` and supports JSON import/export. Reset sample is the explicit recovery path when saved data cannot be read.
- The Studio and Player have no backend, database, multi-chapter playback, sound playback, or general asset-library resolver.
- The hero artwork is in `assets/hero-scene.jpg`.
- The homepage itself does not depend on the Studio's JavaScript bundle.
