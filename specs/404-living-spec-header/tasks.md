# Tasks: Living Spec Header

**Feature**: 404-living-spec-header | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Format: `- [ ] **T###** [P] [US#] Description · file`

## Phase 1: Setup

No setup work. The change lands entirely in existing modules with existing tooling.

## Phase 2: Foundational — shared types

Blocks every story: both sides of the extension/webview boundary need the fact bundle's shape before anything can carry it.

**Wave 1 — independent (different files):**

- [x] **T001** [P] Add the `LivingHeaderMeta` interface — capability name, spec path, location, claimed patterns, and the optional requirement count, scenario count, coverage and drift fields · `src/features/spec-viewer/types.ts`
- [x] **T002** [P] Mirror `LivingHeaderMeta` on the webview side and add the optional `livingMeta` field to the navigation state · `webview/src/spec-viewer/types.ts`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T003** Carry `livingMeta` through the HTML generator into the initial navigation state · `src/features/spec-viewer/html/generator.ts`

**Checkpoint**: the fact bundle can travel from the extension to the header, still empty.

## Phase 3: User Story 1 — the title reads the way the author wrote it (P1)

**Goal**: a living spec's displayed title comes from its own first heading.

**Independent Test**: open a capability whose heading differs from its folder name; the tab and page heading both show the author's wording.

### Tests

- [x] **T004** Write failing tests for title derivation: heading with the suffix, heading without it, heading with an en dash and a hyphen variant, mixed casing preserved, no heading at all, heading after front matter, heading that is only the suffix · `src/features/spec-viewer/__tests__/livingDocs.test.ts`

### Implementation

- [x] **T005** [US1] Add `livingSpecTitle(content, fallback)` — first level-one heading, trailing suffix stripped, whitespace and emphasis cleaned, fallback when unusable · `src/features/spec-viewer/livingDocs.ts`

**⟶ Wait for T005, then:**

**Wave 2 — independent (different files):**

- [x] **T006** [P] [US1] Use the derived title for the panel title, the tab label and the header title on both the open and the tier-switch paths · `src/features/spec-viewer/specViewerProvider.ts`
- [x] **T007** [P] [US1] Add the authored-title modifier that disables the slug capitalization, and apply the truncation trio · `webview/styles/spec-viewer/_content.css`

**⟶ Wait for Wave 2, then:**

- [x] **T008** [US1] Apply the authored-title class when the title came from a heading · `webview/src/spec-viewer/components/SpecHeader.tsx`

**Checkpoint**: a capability with a written heading displays it correctly, with product casing intact.

## Phase 4: User Story 2 — DRAFT is said once (P1)

**Goal**: the badge stops carrying hover text that repeats itself.

**Independent Test**: hover a draft living spec's badge — nothing appears; hover a feature spec's badge — the date still appears.

### Tests

- [x] **T009** [US2] Write failing tests: the badge sets no hover text when there is no created date, and still sets status-plus-date when there is · `webview/src/spec-viewer/components/__tests__/SpecHeader.test.tsx`

### Implementation

- [x] **T010** [US2] Set the badge's hover text only when a created date exists; omit the attribute entirely otherwise · `webview/src/spec-viewer/components/SpecHeader.tsx`

**Checkpoint**: DRAFT appears in the badge and the body banner, nowhere else. The banner and its marker are untouched.

## Phase 5: User Story 3 — the header answers what and why (P1)

**Goal**: the living-spec header shows size, coverage, drift, claimed files and location.

**Independent Test**: open an adopted capability with a coverage tier and drifted sources; all five facts are visible without scrolling or opening a config file.

### Tests

- [x] **T011** [US3] Write failing tests for the fact derivation: requirement and scenario counts, absence rather than zero on an empty or unreadable document, and a capability that resolves to nothing · `src/features/spec-viewer/__tests__/livingHeaderMeta.test.ts`

### Implementation

- [x] **T012** [US3] Add `countLivingFacts(content)` — distinct requirement identifiers and acceptance scenarios, both absent when none are found · `src/features/spec-viewer/livingHeaderMeta.ts`

**⟶ Wait for T012, then:**

- [x] **T013** [US3] Add `buildLivingHeaderMeta(root, specPath, content)` — match the capability from the project configuration, fold in the counts, and return nothing when the capability cannot be resolved · `src/features/spec-viewer/livingHeaderMeta.ts`

**⟶ Wait for T013, then:**

**Wave 3 — independent (different files):**

- [x] **T014** [P] [US3] Build the fact bundle when a living spec renders and pass it into the initial navigation state · `src/features/spec-viewer/specViewerProvider.ts`
- [x] **T015** [P] [US3] Render the facts row — counts, coverage, drift marker with its accessible label — using the pinned wording · `webview/src/spec-viewer/components/SpecHeader.tsx`
- [x] **T016** [P] [US3] Style the facts row, pattern chips and location chip; body tokens for values, muted only for the path; every chip truncates · `webview/styles/spec-viewer/_content.css`

**⟶ Wait for Wave 3, then:**

- [x] **T017** [US3] Render the claimed-patterns row: label, up to three pattern chips, and an overflow chip carrying the rest · `webview/src/spec-viewer/components/SpecHeader.tsx`
- [x] **T018** [US3] Render the spec location chip with the sidebar's own explanation as its hover text · `webview/src/spec-viewer/components/SpecHeader.tsx`

**Checkpoint**: the header answers "what is this capability" and "why did it load for this change" on sight.

## Phase 6: User Story 4 — the two surfaces agree (P2)

**Goal**: coverage and drift in the header are the sidebar's own numbers.

**Independent Test**: the header's figures and the sidebar row's figures are produced by one call, not two implementations.

- [x] **T019** [US4] Resolve coverage and drift through the sidebar's `readCapabilityHealth` after first paint, and push them to the open panel as a navigation-state update so nothing waits on git · `src/features/spec-viewer/specViewerProvider.ts`
- [x] **T020** [US4] Write the test that pins the reuse: the header's health fields come from the shared computation and stay absent when it yields nothing · `src/features/spec-viewer/__tests__/livingHeaderMeta.test.ts`

**Checkpoint**: one derivation, two surfaces.

## Phase 7: Polish

**Wave 4 — independent (different files):**

- [x] **T021** [P] Add living-spec stories: draft and live, with and without coverage, with and without drift, a long title, and many claimed patterns · `webview/src/spec-viewer/components/SpecHeader.stories.tsx`
- [x] **T022** [P] Update the "Reading Specs" subsection to describe what the living-spec header shows · `README.md`
- [x] **T023** [P] Document the living-spec header and badge behavior · `docs/viewer-states.md`
- [x] **T024** [P] Note that the sidebar's coverage and drift are now also shown in the viewer, from the same computation · `docs/sidebar.md`
- [x] **T025** [P] Add the release-notes entry under Unreleased · `CHANGELOG.md`

**⟶ Wait for Wave 4, then:**

- [x] **T026** Verify against the Success Criteria: compile, full test run, and a package build since the webview changed · repository root

## Dependencies & Execution Order

Setup (none) → Foundational → Stories 1, 2, 3 → Story 4 → Polish.

- **Phase 2**: Wave 1 (T001, T002) blocks T003.
- **Phase 3**: T004 first, then T005, which blocks Wave 2 (T006, T007), which blocks T008.
- **Phase 4**: T009 then T010. Independent of Phase 3 — different concern in the same component, so it lands after Phase 3 to avoid two edits colliding in one file.
- **Phase 5**: T011 then T012 then T013, which blocks Wave 3 (T014, T015, T016), which blocks T017 and T018.
- **Phase 6**: T019 depends on Phase 5's bundle; T020 follows it.
- **Phase 7**: Wave 4 (T021–T025) is fully parallel, all different files; T026 last.

### Parallel Opportunities

Waves 1, 2, 3 and 4 each group tasks that touch different files with no shared dependency. Wave 4 is the widest — five documentation and story files with nothing between them. The header component (`SpecHeader.tsx`) is edited in Phases 3, 4 and 5, so those edits are deliberately never placed in the same wave.
