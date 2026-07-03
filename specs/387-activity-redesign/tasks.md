# Tasks: Activity panel redesign

**Feature**: 387-activity-redesign · **Plan**: [plan.md](./plan.md)

## Phase 1: Setup

No setup tasks.

## Phase 2: Foundational (blocks all stories)

**Wave 1 — independent (different files):**

- [x] **T001** [P] `activityTab` signal + tab model (ids, labels, non-empty predicates, default-tab rule) with unit tests · `webview/src/spec-viewer/signals.ts`, `webview/src/spec-viewer/activityTabsModel.ts`, `webview/src/spec-viewer/components/cards/__tests__/activityTabsModel.test.ts`
- [x] **T002** [P] Hero stats derivation (tasks done/total, covered/total, checks, concerns, trusted active time) with unit tests · `webview/src/spec-viewer/activityHeroModel.ts`, test beside it

## Phase 3: US1 — Hero (P1)

- [x] **T003** [US1] `ActivityHero.tsx` — status line + big-numeral chips + mini donut; chips set the tab signal; CSS (hero, chips, pulse-dot) · `webview/src/spec-viewer/components/ActivityHero.tsx`, `_activity.css`

## Phase 4: US2 — Plan section (P1)

- [x] **T004** [US2] `PlanSection.tsx` — intent lede, Context list, fence, approach+sizing prose; CSS (lede scale, labels) · `webview/src/spec-viewer/components/PlanSection.tsx`, `_activity.css`

## Phase 5: US3 — Tabs (P1)

- [x] **T005** [US3] `ActivityTabs.tsx` — tablist/tab/tabpanel semantics, arrow keys, badges, only non-empty; recompose `ActivityPanel.tsx` (hero + plan + tabs hosting existing cards); CSS (tab bar echoing step-nav) · `ActivityTabs.tsx`, `ActivityPanel.tsx`, `_activity.css`

## Phase 6: US4 — Signature elements (P2)

**Wave 1 — independent (different card files):**

- [x] **T006** [P] [US4] Coverage: SVG donut + state-tinted requirement chips (keep exceptions-first + disclosure) · `cards/CoverageCard.tsx`, `_activity.css`
- [x] **T007** [P] [US4] Verified as pass/warning pills; Decisions circled ordinals · `cards/VerifiedCard.tsx`, `cards/DecisionsCard.tsx`, `_activity.css`
- [x] **T008** [P] [US4] Phases: duration bars proportional to trusted spans (bars only where durationTrusted) · `cards/PhasesCard.tsx`, `_activity.css`

## Phase 7: US5 — Legacy degradation + stories

- [x] **T009** [US5] Panel-level stories: rich (385/387 payload), sparse legacy, mid-pipeline; degradation checks; update touched card stories · `components/ActivityPanel.stories.tsx`, card stories

## Phase 8: Visual verification gate

- [x] **T010** Storybook screenshots (headless) of the three states → iterate; `npx impeccable detect` on rendered story URLs + `webview/styles/spec-viewer/` + new components → zero findings; design-taste critique applied; shots saved for the PR · repo root

## Phase 9: Polish

**Wave 1 — independent:**

- [x] **T011** [P] README Activity section rewrite + root CHANGELOG entry · `README.md`, `CHANGELOG.md`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T012** Full gate: jest + tsc + webview typecheck; SC validation · repo root

## Dependencies & Execution Order

Foundational (T001/T002 parallel) → Hero/Plan/Tabs (T003→T004→T005, shared CSS file sequential) → elements wave (T006-T008 parallel) → stories (T009) → visual gate (T010) → polish (T011→T012).
