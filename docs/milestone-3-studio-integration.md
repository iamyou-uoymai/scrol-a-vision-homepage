# Milestone 3: Studio Integration

## Selection and preview state

The Studio has one `StudioSelection` containing a selected authored object and composition context (`sceneId`, `shotId`). The selected object is a canonical narrative unit or a composition Scene, Shot, layer, cue, or keyframe. The composition context lets the existing Stage and editing controls remain available while a narrative unit is selected; it is not a semantic link between the narrative unit and the contextual Shot. Preview position is an independent field in the editor reducer, so scrubbing does not change selection and selection does not change preview position.

Navigator, Stage, Path Editor, and Inspector receive projections of the same selection. Canonical Movement, Passage, Phrase, and Beat rows are read-only. The Inspector displays narrative intent and derived path span; the Stage states that no composition link is defined and continues to show the contextual Shot. Selecting a Scene or Shot shows its derived details. Layer, cue, and keyframe editing remains in the existing composition workflow.

## Separate derived paths

The composition path contains the selected Scene's Shots in array order, each adapted to equal traversal weight `1` to match existing Player playback. Shot IDs remain stable when the Studio reorders the objects. The narrative path contains canonical Beats in Movement/Passage/Phrase authored order and uses their authored `traversalWeight`. A selected parent unit displays the span of its descendant Beat intervals. These are independent paths; no Beat-to-Shot mapping is inferred.

The Path Editor derives normalized coordinates from the path compiler at render time. It does not write absolute coordinates into story data. Cue spans and keyframe positions are composed from authored local positions inside the compiled Shot interval. Its live preview marker is derived from the selected composition Shot's global interval and the separate preview position.

## Resize preservation

The Player stores the latest normalized scroll progress in a ref. On viewport resize it captures that value, waits for the next animation frame, computes the corresponding scroll position using the newly measured runway and viewport dimensions, and performs a single scroll correction. Scroll events during a pending correction do not trigger another correction. If wheel, touch, pointer, or scroll-key input begins before that frame, the correction is canceled and progress is read from the user's resulting position instead. The Player then records progress from the corrected geometry. Browser scroll clamping and subpixel rounding can produce small residual differences near document limits.

## Remaining boundaries

The canonical hierarchy is displayable and selectable but is not editable through grammar-aware commands. The Stage cannot render a narrative Beat independently because there is no Beat-to-composition contract. The Player still plays the first composition Chapter and Scene only; it does not switch to canonical narrative path weights. Existing cue/keyframe inspectors remain composition-specific.