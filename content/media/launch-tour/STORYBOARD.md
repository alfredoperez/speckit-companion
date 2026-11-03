---
format: 1920x1080
duration: 62s
message: "spec-kit gets a face: see and steer everything your AI builds"
arc: PAS with feature-benefit cascade (hook → pain → product intro → viewer demo cycle → Overview demo cycle → breadth → plan components → work in progress → other apps → CTA)
audience: developers who use GitHub Spec Kit or spec-driven development with Claude, Copilot, Gemini or Codex
mode: collaborative
music: none
captions: skipped (no narration; every frame carries its own on-screen line)
---

## Video direction

- **Palette:** frame.md's dark register only. Ground `ink-black` with the violet glow and dot grid from the posed frames; text `cream`; the accent (`fire-orange`, remapped to violet) only on the one highlighted word of each headline, the kicker and the stub rule. The product screens keep their own light colours inside a rounded window with a thin violet edge and a soft drop shadow. No second accent.
- **Type:** display role (Figtree 800, sentence case) for headlines, label role (JetBrains Mono uppercase) for kickers and pane labels. Nothing under 28px.
- **Motion grammar:** silent film, so the on-screen headline is the cue. Each frame opens with the kicker and headline only; the product window enters a beat later, then the camera move named in the frame runs across the rest of the shot. Long-tail eases (power3 out), no bounce. Camera moves are slow pans and pushes over the real screenshot, never a rebuilt UI. Recordings (states, Copilot board, Claude Code) play as video inside the window.
- **Rhythm:** shots are 2.5 to 4.5 seconds; most reveal then move. Held frames: 2 (title), 15 (Coming next) and 19 (close) are deliberate stills after their one entrance. Hard cuts between frames inside an act; crossfades at act changes as `transition_in` says.
- **Layout invariants:** every frame is posed in `compositions/frames/NN-*.html` and the confirmed sketch wins: keep each window's position and crop, add motion only. Captions are skipped, so the bottom band may hold the window as posed.
- **Never:** the slideshow failure (everything on screen at t=0, then frozen), the screensaver failure (elements floating on their own), rebuilt UI in place of a screenshot, cursors, browser chrome added by us, gradients other than the two violet glows, em dashes in any text.

## Frame 1 — Hook: the spec nobody reads
- type: hook
- blueprint: kinetic-type-beats (Adapt)
- duration: 3s
- transition_in: cut
- scene: Raw spec.md scrolls fast behind, the line lands on top in two beats
- voiceover: "You wrote the spec. | Then nobody read it."
- asset_candidates: raw-spec.png
- status: built
- src: compositions/frames/01-hook.html
- focal: assets/raw-spec.png
- roles: raw-spec = background (dim ~22%)

The pain, in the viewer's own words. The raw markdown is a texture, dimmed, moving; the two short lines hard-cut in.

Adapt: the statement builds across two hard-cut beats; the raw markdown is a slow-scrolling texture, not a picture.
Scene 1 (0.0–1.4s): raw markdown fills the frame dimmed and scrolls upward slowly the whole shot; the kicker and line one "You wrote the spec." slam in left-aligned, upper-left third.
Scene 2 (1.4–3.0s): line two "Then nobody read it." hard-cuts in under it in the accent colour; the scroll continues underneath, then holds.

## Frame 2 — Product intro
- type: product_intro
- blueprint: titlecard-reveal (Reproduce)
- duration: 2.5s
- transition_in: cut
- scene: Mark and "SpecKit Companion" land; tagline "See and steer everything your AI builds"
- voiceover: "SpecKit Companion. | See and steer everything your AI builds."
- asset_candidates: moss.svg
- status: built
- src: compositions/frames/02-intro.html
- focal: assets/moss.svg
- roles: moss = supporting

Reproduce: one restrained move, then a still hold.
Scene 1 (0.0–0.8s): the mark and "SpecKit Companion" rise in together on a slide-up crossfade, centered.
Scene 2 (0.8–2.5s): the tagline fades up under it; the card holds still.

## Frame 3 — Before and after
- type: product_intro
- blueprint: comparison-split (Reproduce)
- duration: 3s
- transition_in: crossfade
- scene: The raw markdown on the left flips to the rendered viewer on the right
- voiceover: "Same spec. | Now you can read it."
- asset_candidates: raw-spec.png, tall-viewer.png
- status: built
- src: compositions/frames/03-before-after.html
- focal: assets/tall-viewer.png
- roles: raw-spec = supporting · tall-viewer = cutout

Reproduce: two windows from opposite wings with mirrored book-open tilts; the payoff is the rendered side.
Scene 1 (0.0–0.6s): kicker and headline enter, top-left.
Scene 2 (0.6–1.6s): the raw spec window swings in from the left wing with its label, split-screen.
Scene 3 (1.6–3.0s): the viewer window swings in from the right wing; both settle flat and hold; the right one slightly brighter.

## Frame 4 — Stories as cards
- type: feature_showcase
- blueprint: device-surface-showcase (Adapt)
- duration: 4s
- transition_in: cut
- scene: Floating viewer window pans down from the header through the US-1 card into Given/When/Then
- voiceover: "Stories become cards. | Scenarios in colour."
- asset_candidates: tall-viewer.png
- status: built
- src: compositions/frames/04-stories.html
- focal: assets/tall-viewer.png
- roles: tall-viewer = cutout

Adapt: a static tour by vertical pan over one tall real screenshot instead of cycling screens.
Scene 1 (0.0–0.6s): kicker and headline enter top-left; the viewer window rises in below, centered, ~75% of frame.
Scene 2 (0.6–3.6s): the window's content pans down from the US-1 story card into the Given/When/Then scenarios at a steady pace.
Scene 3 (3.6–4.0s): the pan eases out on the coloured scenarios and holds.

## Frame 5 — Tasks you can click
- type: feature_showcase
- blueprint: transcript-scroll-artifact-reveal (Reproduce)
- duration: 3.5s
- transition_in: cut
- scene: The tasks page scrolls: phase badges, ticks, file chips, what the AI did under each task
- voiceover: "Every task, its files, | and what the AI did."
- asset_candidates: tall-tasks.png
- status: built
- src: compositions/frames/05-tasks.html
- focal: assets/tall-tasks.png
- roles: tall-tasks = cutout

Reproduce: read the generated work as evidence by scrolling one long surface.
Scene 1 (0.0–0.6s): kicker and headline enter; the tasks window rises in, centered.
Scene 2 (0.6–3.5s): the tasks page scrolls up through Phase 1 into Phase 2, ticks and file chips passing at reading speed; eases to a stop.

## Frame 6 — The footer runs spec-kit
- type: feature_showcase
- blueprint: fixed-anchor-cycle (Adapt)
- duration: 3.5s
- transition_in: cut
- scene: One pinned footer slot hard-cuts through its states: Next: Plan, Step running, Refine (1), Run complete
- voiceover: "One button, | always the next step."
- asset_candidates: footer-next-plan.png, footer-step-running.png, footer-refine.png, footer-converge.png
- status: built
- src: compositions/frames/06-footer.html
- focal: assets/footer-next-plan.png
- roles: footer-next-plan = cutout · footer-step-running = supporting · footer-refine = supporting · footer-converge = supporting

Adapt: keep the pinned slot; the four footer states light up one after another in their posed places instead of swapping in one spot.
Scene 1 (0.0–0.5s): kicker and headline enter top-left.
Scene 2 (0.5–1.3s): "Before the plan" footer pops in bright with its label.
Scene 3 (1.3–2.1s): "While a step runs" brightens as the first dims slightly.
Scene 4 (2.1–2.8s): "With a pending comment" (Refine (1)) brightens.
Scene 5 (2.8–3.5s): "When the run is complete" brightens and all four hold.

## Frame 7 — Comments and Refine
- type: feature_showcase
- blueprint: camera-journey (Adapt)
- duration: 3.5s
- transition_in: cut
- scene: Camera dives to the open comment editor with the note typed, then travels to the pending and applied cards above
- voiceover: "Leave a note on a line. | Refine sends it back to the AI."
- asset_candidates: comment-editor.png, footer-refine.png
- status: built
- src: compositions/frames/07-comments.html
- focal: assets/comment-editor.png
- roles: comment-editor = cutout · footer-refine = supporting

Adapt: a two-leg push over one screenshot: from the typed note up to the two comment cards. footer-refine is not shown here; it appears in frame 6.
Scene 1 (0.0–0.6s): kicker and headline enter; the comment window rises in, centered, already pushed in on the open editor and its typed note.
Scene 2 (0.6–2.6s): the camera travels up to the APPLIED and PENDING comment cards above it, easing out.
Scene 3 (2.6–3.5s): pulls back slightly to show the whole window and holds.

## Frame 8 — Overview: intent and timing
- type: feature_showcase
- blueprint: device-surface-showcase (Adapt)
- duration: 3.5s
- transition_in: crossfade
- scene: The Overview's intent and per-step timing, the run times reveal one by one
- voiceover: "When it finishes, | it leaves a record."
- asset_candidates: tall-overview-intent.png
- status: built
- src: compositions/frames/08-overview-record.html
- focal: assets/tall-overview-intent.png
- roles: tall-overview-intent = cutout

Adapt: one surface, revealed region by region.
Scene 1 (0.0–0.6s): kicker and headline enter; the Overview window rises in, centered.
Scene 2 (0.6–2.6s): a gentle push toward the RUN OVERVIEW row so the per-step times read big.
Scene 3 (2.6–3.5s): settles and holds.

## Frame 9 — Overview: what was proven
- type: feature_showcase
- blueprint: transcript-scroll-artifact-reveal (Reproduce)
- duration: 3.5s
- transition_in: cut
- scene: Verified checks scroll past, each with its tick and the command it ran
- voiceover: "Every check it ran, | and what came back."
- asset_candidates: tall-overview-verified.png
- status: built
- src: compositions/frames/09-overview-proof.html
- focal: assets/tall-overview-verified.png
- roles: tall-overview-verified = cutout

Reproduce: scroll the long Verified list as evidence.
Scene 1 (0.0–0.6s): kicker and headline enter; the Verified window rises in.
Scene 2 (0.6–3.5s): the checks scroll up, each tick and command passing at reading speed; eases to a stop.

## Frame 10 — Overview: the fence and the decisions
- type: feature_showcase
- blueprint: comparison-split (Reproduce)
- duration: 3s
- transition_in: cut
- scene: Expectations and Decisions open side by side like a book
- voiceover: "What had to stay true. | What it chose, and what it rejected."
- asset_candidates: tall-overview-expectations.png, tall-overview-decisions.png
- status: built
- src: compositions/frames/10-overview-fence.html
- focal: assets/tall-overview-decisions.png
- roles: tall-overview-expectations = supporting · tall-overview-decisions = cutout

Reproduce: two equal panels from opposite wings.
Scene 1 (0.0–0.5s): kicker and headline enter.
Scene 2 (0.5–1.4s): Expectations swings in from the left wing.
Scene 3 (1.4–3.0s): Decisions swings in from the right wing; both settle and hold.

## Frame 11 — Overview: requirement to task to test
- type: feature_showcase
- blueprint: camera-journey (Adapt)
- duration: 3s
- transition_in: cut
- scene: Camera travels along a coverage row: FR id, task chips, then lands on the evidence column
- voiceover: "Requirement, | task, | test."
- asset_candidates: tall-overview-coverage.png
- status: built
- src: compositions/frames/11-overview-coverage.html
- focal: assets/tall-overview-coverage.png
- roles: tall-overview-coverage = cutout

Adapt: one leg along a table row, landing on the evidence column.
Scene 1 (0.0–0.5s): kicker and headline enter; the coverage window rises in.
Scene 2 (0.5–2.4s): the camera pushes in and travels along the first rows, FR id to task chips to the evidence column.
Scene 3 (2.4–3.0s): lands on the evidence column and holds.

## Frame 12 — The sidebar
- type: benefit_highlight
- blueprint: grid-card-assemble (Reproduce)
- duration: 3.5s
- transition_in: cut
- scene: Five pane cards cascade in: Specs, Bugs, Ideas, Living Specs, Steering
- voiceover: "Specs, bugs, ideas, living specs, steering. | All in one sidebar."
- asset_candidates: rich-sidebar-specs.png, rich-sidebar-bugs.png, rich-sidebar-ideas.png, rich-sidebar-living.png, rich-sidebar-steering.png
- status: built
- src: compositions/frames/12-sidebar.html
- focal: assets/rich-sidebar-steering.png
- roles: rich-sidebar-specs = supporting · rich-sidebar-bugs = supporting · rich-sidebar-ideas = supporting · rich-sidebar-living = supporting · rich-sidebar-steering = cutout

Reproduce: five panes self-assemble in a staggered cascade and hold.
Scene 1 (0.0–0.5s): kicker and headline enter.
Scene 2 (0.5–2.3s): the five pane cards rise in left to right on a stagger, each with its label.
Scene 3 (2.3–3.5s): the row holds.

## Frame 13 — Living specs
- type: feature_showcase
- blueprint: zoom-out-workspace-reveal (Reproduce)
- duration: 4s
- transition_in: cut
- scene: Tight on the "Drifted" badge, then zoom out to the whole window with the tree and Sync
- voiceover: "Specs that live next to the code, | and say when it drifts."
- asset_candidates: living-drift-window.png
- status: built
- src: compositions/frames/13-living-specs.html
- focal: assets/living-drift-window.png
- roles: living-drift-window = cutout

Reproduce: open tight on the Drifted requirement, one continuous decelerating zoom-out to the whole window.
Scene 1 (0.0–1.2s): kicker and headline enter; the window opens tight on the "Drifted" badge and its requirement.
Scene 2 (1.2–3.4s): one continuous decelerating zoom-out reveals the whole window: the Living Specs tree, the capability page and the Sync bar.
Scene 3 (3.4–4.0s): holds.

## Frame 14 — Four plan components
- type: feature_showcase
- note: published, not work in progress
- blueprint: grid-card-assemble (Adapt)
- duration: 4.5s
- transition_in: cut
- scene: Four cards assemble, each labelled: States (clicks playing), Calls, Screen, Code
- voiceover: "Four new plan components: | states, calls, screens, code."
- asset_candidates: plan-blocks-states-clicks.mp4, tall-block-calls.png, tall-block-screen.png, tall-block-code.png
- status: built
- src: compositions/frames/14-plan-components.html
- focal: assets/plan-blocks-states-clicks.mp4
- roles: plan-blocks-states-clicks = cutout · tall-block-calls = supporting · tall-block-screen = supporting · tall-block-code = supporting

Adapt: four labelled cards assemble two by two; the States card is a live recording.
Scene 1 (0.0–0.5s): kicker and headline enter.
Scene 2 (0.5–1.1s): the States card enters top-left and its recording starts clicking through states.
Scene 3 (1.1–2.3s): Calls, Screen and Code enter on a stagger with their labels.
Scene 4 (2.3–4.5s): the grid holds while States keeps playing.

## Frame 15 — Work in progress card
- type: benefit_highlight
- blueprint: titlecard-reveal (Reproduce)
- duration: 1.5s
- transition_in: cut
- scene: Short breather card "Coming next", introducing only the workflow builder
- voiceover: "Coming next."
- asset_candidates: none
- status: built
- src: compositions/frames/15-coming-next.html
- focal: none
- roles: none

Reproduce: a short breather before the work-in-progress shot.
Scene 1 (0.0–0.5s): kicker and "Coming next." rise in, centered.
Scene 2 (0.5–1.5s): holds still.

## Frame 16 — Workflow builder
- type: feature_showcase
- blueprint: camera-journey (Adapt)
- duration: 3.5s
- transition_in: cut
- scene: Camera pans across the builder columns, pausing on the BEFORE hook and "2 steps differ from shipped"
- voiceover: "The pipeline as nodes. | Rearrange it."
- asset_candidates: builder-board.png
- status: built
- src: compositions/frames/16-builder.html
- focal: assets/builder-board.png
- roles: builder-board = cutout

Adapt: one lateral pan across the builder columns.
Scene 1 (0.0–0.6s): kicker and headline enter; the builder window rises in.
Scene 2 (0.6–3.0s): the camera pans right across specify, plan and tasks, passing the BEFORE hook.
Scene 3 (3.0–3.5s): eases out and holds.

## Frame 17 — The Copilot app
- type: feature_showcase
- blueprint: device-surface-showcase (Reproduce)
- duration: 3.5s
- transition_in: crossfade
- scene: The Copilot board recording plays in a floating window, the run moving through its steps
- voiceover: "The same run in the Copilot app."
- asset_candidates: board-run-steps.mp4, board.png
- status: built
- src: compositions/frames/17-copilot.html
- focal: assets/board-run-steps.mp4
- roles: board-run-steps = cutout · board = supporting

Reproduce: a floating window holds while the real flow plays. board.png is the fallback still only.
Scene 1 (0.0–0.6s): kicker and headline enter; the board window rises in and its recording starts.
Scene 2 (0.6–3.5s): the run moves through its steps in the recording; the window holds.

## Frame 18 — The Claude Code mod
- type: feature_showcase
- blueprint: device-surface-showcase (Reproduce)
- duration: 3.5s
- transition_in: cut
- scene: Claude Code starts and the mod's pane opens beside the transcript; the band above the prompt
- voiceover: "And beside Claude Code."
- asset_candidates: mod-session-start.mp4, mod-steps-timed-band.png
- status: built
- src: compositions/frames/18-claude-code.html
- focal: assets/mod-session-start.mp4
- roles: mod-session-start = cutout · mod-steps-timed-band = supporting

Reproduce: the real session plays in its window. The band still is not shown; the recording already contains the band.
Scene 1 (0.0–0.6s): kicker and headline enter; the terminal window rises in and its recording starts.
Scene 2 (0.6–3.5s): Claude Code starts and the mod's pane opens beside the transcript; holds.

## Frame 19 — CTA
- type: cta
- blueprint: logo-assemble-lockup (Adapt)
- duration: 3.5s
- transition_in: crossfade
- scene: Specky, the wordmark, speckit-companion.dev, four chips for the four pieces, "Free and open source"
- voiceover: "SpecKit Companion. | Free and open source. | speckit-companion.dev"
- asset_candidates: mascot.png, moss.svg
- status: built
- src: compositions/frames/19-cta.html
- focal: assets/mascot.png
- roles: mascot = cutout · moss = supporting

Adapt: the lockup assembles from its parts top to bottom, then holds.
Scene 1 (0.0–0.6s): Specky rises in, centered.
Scene 2 (0.6–1.6s): the wordmark, then the address, then the four chips cascade in under it.
Scene 3 (1.6–3.5s): the line "Free and open source..." fades up; the whole lockup holds.
