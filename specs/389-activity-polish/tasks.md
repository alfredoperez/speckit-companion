# Tasks: Activity panel polish

**Feature**: 389-activity-polish · [spec.md](./spec.md) · [plan.md](./plan.md)

## Phase 1: Setup

*(none — no structure, config, or tooling prerequisites; the change edits existing files in place)*

## Phase 2: Foundational

**Wave 1 — independent (different files):**

- [ ] **T001** [P] Add `--text-label` token (theme-foreground `color-mix`, documented by contrast intent) · webview/styles/tokens.css
- [ ] **T002** [P] Add `warning?: boolean` to `ActivityTab`; Proof badge = uncovered count (>0 only), Notes badge = concern count (>0 only), Decisions/Work unchanged · webview/src/spec-viewer/activityTabsModel.ts

**⟶ Wait for Wave 1 to finish, then:**

- [ ] **T003** Update badge model unit tests: warning flag present on proof/notes badges, absent badge when clean, decisions/work counts unchanged · webview/src/spec-viewer/__tests__/activityModels.test.ts

## Phase 3: User Story 1 — The tab bar looks intentional (P1)

**Goal**: active tab shows only the accent underline on click; keyboard focus shows a visible ring.

**Independent Test**: click each tab (no box artifact), Tab-key onto the bar (ring appears).

### Implementation

- [ ] **T004** `:focus-visible` outline + `:focus:not(:focus-visible) { outline: none }` on `.activity-tabs__tab`; add `.activity-tabs__count--warning` tint · webview/styles/spec-viewer/_activity.css

**Checkpoint**: tab bar renders clean on click, focusable by keyboard, warning badge style available.

## Phase 4: User Story 2 — Each number appears once (P1)

**Goal**: single donut (hero), no counts in section headings, attention-only Proof/Notes badges.

**Independent Test**: fully-covered spec → one donut, no Proof/Notes badges; uncovered/concerned spec → warning badges.

### Implementation

**Wave 1 — independent (different files):**

- [ ] **T005** [P] Drop the header Donut and the `(covered/total)` count span; heading text "Coverage" · webview/src/spec-viewer/components/cards/CoverageCard.tsx
- [ ] **T006** [P] Render `activity-tabs__count--warning` class when `tab.warning` · webview/src/spec-viewer/components/ActivityTabs.tsx

**Checkpoint**: Proof tab shows one coverage representation; badges are attention-only.

## Phase 5: User Story 3 — Checks read as a row of pills (P2)

**Goal**: content-width wrapping pills titled "Checks".

**Independent Test**: 3 checks of varied length render inline, no ghost cell, no height mismatch.

### Implementation

**Wave 1 — independent (different files):**

- [ ] **T007** [P] Heading → "Checks", drop the count span · webview/src/spec-viewer/components/cards/VerifiedCard.tsx
- [ ] **T008** [P] `.activity-pill-grid` → wrapping flex row; pills content-width with internal max-width · webview/styles/spec-viewer/_activity.css *(after T004 — same file)*

**Checkpoint**: Proof tab's checks pack like tags.

## Phase 6: User Story 4 — Headings have a hierarchy again (P2)

**Goal**: Title Case section headings, legible micro-labels, no double markers, title-cased header.

**Independent Test**: Proof/Decisions tabs show cased headings, no coverage bullets; header reads "Phases Strip" for "phases strip".

### Implementation

**Wave 1 — independent (different files):**

- [ ] **T009** [P] Remove uppercase transform from `.activity-card__title` / `.activity-plan__heading`, bump size; point `.activity-inline-label` / `.activity-detail-label` / `.phases-overall__label` at `--text-label`; `list-style: none` on coverage list · webview/styles/spec-viewer/_activity.css *(after T008 — same file)*
- [ ] **T010** [P] Heading "The Plan" → "Plan" · webview/src/spec-viewer/components/PlanSection.tsx
- [ ] **T011** [P] `text-transform: capitalize` on `.spec-header-title` · webview/styles/spec-viewer/_content.css

**Checkpoint**: heading hierarchy restored; labels legible; header title cased.

## Phase 7: Polish

**Wave 1 — independent (different files):**

- [ ] **T012** [P] Stories: badge states (clean vs uncovered/concerned), pill wrap layout, cased headings · webview/src/spec-viewer/components/ActivityPanel.stories.tsx + cards/VerifiedCard.stories.tsx + cards/CoverageCard.stories.tsx
- [ ] **T013** [P] Docs: root CHANGELOG entry + README Activity subsection touch-up if it names the changed visuals · CHANGELOG.md, README.md

**⟶ Wait for Wave 1 to finish, then:**

- [ ] **T014** Verify: full jest + both tsc; Storybook screenshots of Proof/Decisions/Work reviewed (focus artifact gone, pills packed, one donut); validate against SC-001…SC-004 · (no new files)

## Dependencies & Execution Order

- Setup (none) → Foundational (T001+T002 parallel → T003) → stories in priority order → Polish.
- `_activity.css` serializes T004 → T008 → T009 (same file); everything else in a story's wave is parallel.
- T012/T013 wait on all story phases; T014 is the final gate.
