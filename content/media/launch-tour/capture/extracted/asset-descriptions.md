# Asset inventory

Every asset is a real capture of SpecKit Companion, light theme (Bearded Theme Light), taken by the repo's own scripts. No asset is generated. Sizes are pixels.

## The problem

- `raw-spec.png` (2880x1824) — a spec-kit spec.md as raw markdown in a plain editor: line numbers, `##` headings, `**Given**` in asterisks. The "before".

## The viewer (VS Code extension)

- `tall-viewer.png` (1720x2034) — the viewer on a finished spec, "Capture Plain SpecKit Runs With Hooks Only": header with COMPLETED, branch and date, "36/36 tasks · 9/12 traced · 7 concerns", the step tabs (Overview, Specification, Requirements, Plan, Data Model, Hooks, Research, Tasks), then "User Scenarios & Testing" with the US-1 story card (Critical) and its acceptance scenarios with Given/When/Then coloured; the floating footer "Run complete · Converge · Archive · Reactivate" at the bottom. Tall: made for a slow vertical pan.
- `tall-tasks.png` (1716x1964) — the Tasks tab with the page header hidden: PHASE 1 Setup and PHASE 2 Foundational badges, ticked tasks T001 to T005, file chips under each, and under each task a line of what the assistant did with the files it touched. Tall, pans well.

## The footer that runs spec-kit

- `footer-next-plan.png` (582x136) — "Next: Plan · Regenerate · Plan" (Plan button solid green).
- `footer-step-running.png` (1064x136) — "Step running, actions unlock when it settles · Regenerate · Other actions".
- `footer-converge.png` (842x136) — "Run complete · Converge · Archive · Reactivate".
- `footer-refine.png` (804x136) — "Next: Plan · Regenerate · Plan · Refine (1)".

## Comments

- `comment-editor.png` (1516x698) — "Why this exists" with two lines: one has an APPLIED comment card, one a PENDING card; under it the comment editor open, "Commenting on line 11", a note typed, "Suggest removing line · Cancel · Add Comment".

## The Overview

- `tall-overview-intent.png` (1556x992) — INTENT sentence, RUN OVERVIEW with per-step times (Specify 1m 45s, Plan 1m 26s, Tasks, Implement 14m 23s), then APPROACH, WORKING AREA and SIZE.
- `tall-overview-expectations.png` (1556x1156) — EXPECTATIONS "The fence around the work": "Must stay true" and "Deliberately out of scope" lists.
- `tall-overview-verified.png` (1556x1950) — VERIFIED "What was checked, and what happened", "7 checked · 2 reported", each check ticked with its result and the command it ran. Tall, pans well.
- `tall-overview-decisions.png` (1556x1082) — DECISIONS, each with what it chose and what it rejected.
- `tall-overview-coverage.png` (1556x1442) — COVERAGE "Requirement → task → test", "9/12 traced": FR ids, task chips, evidence ("1 test" green, "No test linked" amber).

## The sidebar

- `rich-sidebar-specs.png` (778x584) — Specs pane: Active (2), Completed (8) with real spec names and ages.
- `rich-sidebar-bugs.png` (778x364) — Bugs pane: To fix, Verified, Closed, each with severity and verdict.
- `rich-sidebar-ideas.png` (778x408) — Ideas pane: Assessing, Decided with go / needs-clarification / kill.
- `rich-sidebar-living.png` (778x452) — Living Specs pane: capabilities with "9/9 covered", "7/9 covered · drift".
- `rich-sidebar-steering.png` (778x892) — Steering pane: Companion, Claude Code, SpecKit Project Files with Constitution, Scripts and Templates expanded.

## Living specs

- `living-drift-window.png` (2480x1600) — whole VS Code window: Living Specs tree on the left, "Photo Storage" capability page on the right with COVERS paths, a requirement marked "Drifted" with "1 test", its WHEN/THEN scenario, and the "1 requirement drifted · Adopt an area · Validate · Sync" bar.

## Workflow builder (work in progress)

- `builder-board.png` (3120x1960) — the pipeline as columns specify / plan / tasks / implement, nodes grouped by phase (GATHER, AUTHOR, CHECK, WRAP-UP), a BEFORE hook on a node, "2 steps differ from shipped", "+ Add step".

## Plan components (work in progress)

- `tall-block-states.png` (1516x1174) — "States" heading and a STATES card "Waiting change, 5 states": a state diagram (Queued, Sending, Sent, Cancelled, Dropped), Sending picked with its ways out listed.
- `tall-block-calls.png` (1516x574) — "Call paths" heading and a CALLS card "Offline favorite": a call tree with new-file badges and changed rows, a note under it.
- `tall-block-screen.png` (1516x528) — "Screens" heading and a SCREEN card "Header": a sketched nav bar with a numbered note.
- `tall-block-code.png` (1516x758) — a CALLS card on top, and a CODE card `src/entities/article/article.api.ts line 44` with a note pinned under the line.
- `plan-blocks-state-shows-screen.png` (1452x1402) — a STATES card with InReview picked and its screen sketch shown under it.
- `plan-blocks-states-clicks.mp4` (1452x1038, 11s) — recording: clicking through the Waiting change states, each showing its sentence and ways out.
- `plan-blocks-calls-strike.mp4` (1516x846, 12s) — recording: striking one call from the Offline favorite card and leaving a comment on another.
- `plan-blocks-state-screen.mp4` (1452x1386, 8.5s) — recording: picking a state shows its screen under the card, picking another takes it away.

## The other apps

- `board.png` (2360x1328) — the GitHub Copilot app board: spec list with progress bars on the left, a spec's step rail (Specify, Plan, Tasks done, Implement), "Next: Implement · Run implement", tabs Overview / Spec / Plan / Tasks / Activity.
- `board-narrow-detail.png` (840x1520) — the board in a narrow window on one spec.
- `board-run-steps.mp4` (1920x1236, 17s) — recording: a run on the Copilot board moving through its steps.
- `mod-steps-timed-pane.png` (1854x1538) — the Claude Code mod's pane: STEPS with times, DOCUMENTS, TASKS, "Next: /speckit-implement", key hints. Dark terminal look.
- `mod-steps-timed-band.png` (2208x242) — the band above the Claude Code prompt: spec name, "Plan done · Tasks 0/4 · Implement next".
- `mod-session-start.mp4` (1920x1032, 26s) — recording: Claude Code starts, the mod opens its pane beside the transcript, tasks tick.

## Brand

- `mascot.png` (344x512) — Specky, the moss-sprite mascot holding a glowing seedling. Transparent.
- `moss.svg` — the SpecKit Companion mark.
