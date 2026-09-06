# Tasks: Attach a hook from a list, not from memory

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contract**: [contracts/hook-catalog.md](./contracts/hook-catalog.md) · **Size**: normal

## Phase 1: Foundational

The catalog itself. Every story reads it, so nothing else starts until it exists.

### Tests

- [x] **T001** Catalog cases: both registries read, de-duplication on the identifier, the placement derived from the lifecycle key, an entry with no command name skipped, an unreadable registry contributing nothing, and a project with no registry at all · `speckit-extension/tests/test_builder_flow.py`

**⟶ Wait for T001, then Wave 1 — the reader and the shape it fills (different files, independent):**

- [x] **T002** [P] Read every hook command the project's registries carry, de-duplicated, each with its description, its registering extension and its usual placement · `speckit-extension/scripts/build-pipeline.py`
- [x] **T003** [P] Declare the offered-entry shape and add `commands` to the choices the panel receives · `src/protocol/pipeline.ts`

**⟶ Wait for Wave 1, then:**

- [x] **T004** Put the catalog in `choices`, beside skills and nodes · `speckit-extension/scripts/pipeline-graph.py`

**Checkpoint**: the panel receives a per-project list of what it could attach.

---

## Phase 2: User Story 1 — Pick the thing instead of spelling it (P1)

**Goal**: choosing a kind offers what this project has for that kind, described, with typing still available.

**Independent Test**: attach the automatic commit without typing any part of its name.

### Tests

- [x] **T005** [US1] Form cases: the picker lists the chosen kind's entries, a kind change clears the previous choice, choosing writes the entry's exact identifier, typing by hand still submits, an empty catalog says so, and the instruction kind shows no picker · `webview/src/pipeline-builder/__tests__/AttachForm.test.tsx`

### Implementation

**⟶ Wave 2 — the form (one file, sequential):**

- [x] **T006** [US1] Widen the offered entries from bare names to entries, so skills, nodes and commands are all read the same way · `webview/src/pipeline-builder/AttachForm.tsx`
- [x] **T007** [US1] Show the entries through the panel's own menu, with the description under each row, and keep the free-text field beside it · `webview/src/pipeline-builder/AttachForm.tsx`
- [x] **T008** [US1] Say the list is empty rather than showing an empty control, and show no picker for an instruction · `webview/src/pipeline-builder/AttachForm.tsx`

**Checkpoint**: User Story 1 is independently functional.

---

## Phase 3: User Story 2 — The list is what this project has (P1)

**Goal**: the offered commands come from the project's registries and nowhere else.

**Independent Test**: remove an extension from the registry; its commands stop being offered with no other change.

### Tests

- [x] **T009** [US2] Registry cases: an extension's hooks offered with the registry's own descriptions, an absent extension offering nothing, and Companion's own four always present · `speckit-extension/tests/test_builder_flow.py`

**Checkpoint**: covered by Phase 1's reader; this phase proves the derivation is honest rather than adding code.

---

## Phase 4: User Story 3 — Say where each one usually goes (P2)

**Goal**: an entry says where it normally attaches, or says nothing.

**Independent Test**: read an entry without knowing the pipeline and learn where the hook belongs.

### Tests

- [x] **T010** [US3] Placement cases: a lifecycle key rendered as a readable placement, and a key that does not have that shape yielding none · `speckit-extension/tests/test_builder_flow.py`

### Implementation

**⟶ Wave 3 — the row (single task):**

- [x] **T011** [US3] Render the placement and the registering extension on the row, omitting either when absent · `webview/src/pipeline-builder/AttachForm.tsx`

**Checkpoint**: User Story 3 is independently functional.

---

## Phase 5: Polish

**Wave 4 — the surfaces and the record (different files, independent):**

- [x] **T012** [P] A story showing the picker open on a project with the git extension installed · `webview/src/pipeline-builder/__stories__/Components.stories.tsx`
- [x] **T013** [P] Document attaching from the list in the builder guide · `docs/pipeline-builder.md`
- [x] **T014** [P] User-facing release note · `CHANGELOG.md`
- [x] **T015** [P] Release note for the catalog the spec-kit side now emits · `speckit-extension/CHANGELOG.md`

**⟶ Wait for Wave 4, then:**

- [x] **T016** Fold this work into the capability that owns the emission · `speckit-extension/scripts/capture-runtime.spec.md`
- [x] **T017** Validate against the Success Criteria: both suites, both compiles, shape parity, command emissions, the shape check, and drift back to zero · `package.json`, `speckit-extension/tests/`

---

## Dependencies & Execution Order

Foundational → Story 1 → Story 2 → Story 3 → Polish.

- **Foundational**: the test comes first; the reader and the protocol shape are independent of each other; putting the catalog in `choices` waits on both.
- **Story 1**: three tasks in one file, in order. Nothing else can start until the catalog exists.
- **Story 2** adds no code — it proves Phase 1's reader is honest about what a project has.
- **Story 3** is one row change, waiting on Story 1's rendering.
- **Polish**: the four surfaces are independent; the capability fold waits on the work being finished; the suite run is last.
