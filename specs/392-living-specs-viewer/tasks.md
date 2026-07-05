# Tasks: Living specs render readably in the viewer

**Feature**: 392-living-specs-viewer · [spec.md](./spec.md) · [plan.md](./plan.md)

## Phase 1: Setup

*(none — no structure or tooling prerequisites)*

## Phase 2: Foundational

**Wave 1 — independent (different files):**

- [x] **T001** [P] Extend `LivingSpecsView` with `capabilities?: CapabilityContentView[]` per data-model.md · src/core/types/specContext.ts
- [x] **T002** [P] Mirror the type change in the webview copy · webview/src/spec-viewer/types.ts

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T003** New loader `livingSpecsContent.ts`: `enrichLivingSpecs(view, workspaceRoot, featureSpecPath)` — resolve via `readLivingSpecs`, capped best-effort reads, parse title/purpose/`###` requirement blocks (marker-stripped), delta counts from the feature spec's delta blocks (capability-marker + most-specific targeting) · src/features/spec-viewer/livingSpecsContent.ts

## Phase 3: User Story 1 — Read the capability without leaving the viewer (P1)

**Goal**: per-capability content flows to the webview and renders as open disclosures with requirement rows.

**Independent Test**: unit-test the parser on the writer-emitted shape; render the rich story payload.

### Tests

- [x] **T004** Loader unit tests (tmp-dir fixtures): parse purpose + requirement rows, marker stripping, load order, colocated resolution reuse · src/features/spec-viewer/__tests__/livingSpecsContent.test.ts

### Implementation

**Wave 1 — independent (different files):**

- [x] **T005** [P] [US1] Enrich the derived state's `livingSpecs` via the loader at the provider seam · src/features/spec-viewer/specViewerProvider.ts
- [x] **T006** [P] [US1] Card renders `capabilities[]`: `<details open>` per capability, purpose line, requirement rows (id chip + text, text nodes); names-only fallback preserved · webview/src/spec-viewer/components/cards/LivingSpecsCard.tsx
- [x] **T007** [P] [US1] Styles: `.living-specs-cap` disclosure, purpose, requirement rows, unavailable note — token-driven · webview/styles/spec-viewer/_activity.css

**Checkpoint**: rich payloads render readably end to end.

## Phase 4: User Story 2 — See the fold-back result (P1)

### Implementation

**Wave 1 — independent (different files):**

- [x] **T008** [P] [US2] Delta-count parsing cases in the loader tests (marker-targeted, most-specific default, absent-when-no-blocks) · src/features/spec-viewer/__tests__/livingSpecsContent.test.ts *(after T004 — same file)*
- [x] **T009** [P] [US2] Card renders folded-back tag + delta counts (`+N added · N modified …`, kinds present only) · webview/src/spec-viewer/components/cards/LivingSpecsCard.tsx *(after T006 — same file)*

**Checkpoint**: synced capabilities show their fold-back outcome.

## Phase 5: User Story 3 — Degrade exactly like the rest of the panel (P2)

### Implementation

**Wave 1 — independent (different files):**

- [x] **T010** [P] [US3] Degradation tests: missing file, out-of-root, oversized (cap), config absent → names-only, synced-not-loaded inclusion, dedupe · src/features/spec-viewer/__tests__/livingSpecsContent.test.ts *(after T008 — same file)*
- [x] **T011** [P] [US3] Committed demo fixture: `specs/_03_demo-living/` with spec.md + `.spec-context.json` carrying `livingSpecs` names (degraded real-viewer path in this config-less repo) · specs/_03_demo-living/

**Checkpoint**: every degraded state renders quietly; the demo fixture opens in the real viewer.

## Phase 6: Polish

**Wave 1 — independent (different files):**

- [x] **T012** [P] Stories: `RichContent`, `NamesOnly`, `ContentUnavailable` payloads · webview/src/spec-viewer/components/cards/LivingSpecsCard.stories.tsx
- [x] **T013** [P] Docs: README Activity section (Notes tab living-specs description) + root CHANGELOG entry · README.md, CHANGELOG.md
- [x] **T014** [P] Register the new demo fixture in the demo-fixtures note if CLAUDE.md's fixture table needs the row · CLAUDE.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T015** Verify: full jest + both tsc; Storybook screenshots of the three stories reviewed; demo fixture opened logic-checked via derivation test or story; validate SC-001…SC-004 · (no new files)

## Dependencies & Execution Order

- Foundational: T001+T002 parallel → T003 blocks everything.
- Test file serializes T004 → T008 → T010; card serializes T006 → T009.
- T005/T006/T007 parallel after T003; Polish wave parallel; T015 the final gate.
