# Scrol-a-Vision Homepage Specification

## Decisions
- Visual identity: cinematic dark.
- Product stage: concept.
- Main visual: cinematic illustrated scene.

## Product statement
Scrol-a-Vision is a proposed authoring environment for visual stories that unfold through movement, rhythm and reader-controlled pacing.

## Design direction
Use a near-black charcoal background, warm off-white typography, restrained amber accents, fine separators, editorial serif headlines and spacious composition. The page should feel like a serious creative studio, not a generic SaaS dashboard.

## Sections
1. Minimal navigation: Concept, Workflow, Principles, and a real GitHub link only if configured.
2. Hero: “Stories, directed by scrolling.” with a cinematic illustrated landscape and concept CTA.
3. Problem: “Animation tools understand motion. Storytellers think in scenes.”
4. Workflow: Compose, Direct, Publish.
5. Directing model: Story → Movement → Passage → Phrase → Beat, alongside an illustrative composition path for Shots and presentation cues. Do not imply Beat-to-Shot links.
6. Principles: Story first, reader-controlled pacing, creative collaboration, portable stories.
7. Closing CTA: “Help shape a medium where movement, rhythm and narrative are composed together.”
8. Footer with current year.

## Scope and truthfulness
This is a concept-stage homepage. Do not imply that the editor, publishing pipeline, or collaboration features are already functional. The timeline is a visual mock-up. Do not add authentication, a backend, billing, a CMS, or a fake beta signup.

## Interaction and accessibility
Use normal browser scrolling and in-page navigation. Reveal animations must respect `prefers-reduced-motion`. Keep the page responsive, semantic, keyboard-accessible, and readable without animation.

## Implementation
The current prototype uses semantic HTML, CSS, and minimal JavaScript in `index.html`, plus the local hero illustration in `assets/hero-scene.jpg`. No backend or external runtime dependency is required.
