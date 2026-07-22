# Tasks: Dedupe Run Timing

- [x] **T001** Remove the redundant `phases-coverage` line and `phases-strip` (name + duration) block from `PhasesCard`, keeping `phases-overall` and `phases-events` + webview/src/spec-viewer/components/cards/PhasesCard.tsx
- [x] **T002** Add the render guard so `PhasesCard` returns `null` when it has neither overall stats nor per-phase events left to show + webview/src/spec-viewer/components/cards/PhasesCard.tsx
- [x] **T003** [P] Update `PhasesCard.stories.tsx` — drop strip-only variants, keep overall-stats + events variants, add an empty-collapses-to-null variant + webview/src/spec-viewer/components/cards/PhasesCard.stories.tsx
- [x] **T004** [P] Drop now-unused `phases-strip` / `phases-coverage` CSS rules; leave `phases-overall` / `phases-events` intact + webview/styles/spec-viewer/_activity.css
- [x] **T005** [P] Update `docs/viewer-states.md` where it describes the Phases card's strip + docs/viewer-states.md
- [x] **T006** Verify: open a spec with recorded timing and confirm the coverage line + phase strip render once (Overview only), and the Phases card still shows overall stamps + per-phase events + (verification)
