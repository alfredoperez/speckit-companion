---
description: "Task list for Pipeline + the sdd-lean Preset"
---

# Tasks: Pipeline + the sdd-lean Preset

**Input**: Design documents from `/specs/132-sdd-lean-pipeline/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not requested as TDD. Two verification tasks are included where they protect a stated success criterion (shape parity SC-003, toggle mapping FR-006/R2) — they are guards, not a test-first phase.

**Organization**: By user story. The four canonical SDD-lean command bodies are **foundational** — both US1 (preset overrides) and US2 (namespaced commands) consume them, which is what keeps their output identical (FR-005/SC-003).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (setup, foundational, polish carry no story label)
- Exact file paths included

## Path Conventions

- spec-kit extension assets (the bulk): `speckit-extension/` (preset, commands, extension.yml, its own README/CHANGELOG)
- VS Code extension surface: root `package.json`, `src/features/settings/`, `tests/`
- Per the dual-extension rule, `speckit-extension/**` changes update **its** README/CHANGELOG/version; the `speckit.features.sddLean` setting updates the **root** README/CHANGELOG.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the preset bundle skeleton.

- [X] T001 Create the preset bundle skeleton: directory `speckit-extension/presets/sdd-lean/commands/` and `speckit-extension/presets/sdd-lean/README.md` (purpose + the `specify preset add --dev ./speckit-extension/presets/sdd-lean` install line).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Author the canonical SDD-lean shape, once, as the four pipeline command bodies. These are the shared source for both US1 and US2.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — US1 wires these into the preset manifest and US2 embeds them into the namespaced commands.

- [X] T002 [P] Author the canonical SDD-lean **specify** body in `speckit-extension/presets/sdd-lean/commands/speckit.specify.md` — Overview, Functional Requirements (testable), Success Criteria, Assumptions; **no user-story / user-scenario section** (per data-model.md "SDD-lean command body").
- [X] T003 [P] Author the canonical SDD-lean **plan** body in `speckit-extension/presets/sdd-lean/commands/speckit.plan.md` — lean form (Summary, Technical Context, short approach, explicit Out-of-Scope).
- [X] T004 [P] Author the canonical SDD-lean **tasks** body in `speckit-extension/presets/sdd-lean/commands/speckit.tasks.md` — dependency-ordered checklist organized by **files/dependencies**, not grouped under user stories.
- [X] T005 [P] Author the canonical SDD-lean **implement** body in `speckit-extension/presets/sdd-lean/commands/speckit.implement.md` — execute `tasks.md` in dependency order; checklist semantics unchanged.

**Checkpoint**: The four canonical bodies exist — US1 and US2 can both proceed (and reuse them).

---

## Phase 3: User Story 1 - Stock commands produce the SDD-lean shape automatically (Priority: P1) 🎯 MVP

**Goal**: With the `sdd-lean` preset installed, stock `/speckit.specify`/`plan`/`tasks` emit the SDD-lean shape — no new command for the user to learn.

**Independent Test**: Install the preset, run stock `/speckit.specify` against a sample description → `spec.md` has no user-story section (SC-001).

- [X] T006 [US1] Write `speckit-extension/presets/sdd-lean/preset.yml` per `contracts/preset-manifest.md`: `schema_version: "1.0"`, `preset.id: sdd-lean`, `requires.speckit_version: ">=0.8.5"`, `provides.templates[]` = four `type: command` entries that `replaces:` `speckit.specify`/`plan`/`tasks`/`implement` (`strategy: replace`) pointing at the Phase-2 files, plus tags.
- [X] T007 [US1] Validate the manifest against the contract: `specify preset add --dev ./speckit-extension/presets/sdd-lean` succeeds; `specify preset list` shows `sdd-lean` enabled; `specify preset info sdd-lean` lists exactly the four overrides; `specify preset resolve speckit.specify` reports `sdd-lean` as the winning layer.
- [ ] T008 [US1] In a scratch feature dir with the preset enabled, run stock `/speckit.specify` and confirm `spec.md` has **no** user-story section (SC-001); spot-check stock `/speckit.plan` (lean) and `/speckit.tasks` (files/deps axis). Clean up the scratch dir afterward.

**Checkpoint**: Stock pipeline commands produce the SDD-lean shape — MVP delivered.

---

## Phase 4: User Story 2 - Explicit opt-in pipeline via namespaced commands (Priority: P2)

**Goal**: `/speckit.companion.specify`/`plan`/`tasks`/`implement` produce the SDD-lean shape directly, independent of preset state.

**Independent Test**: With `sdd-lean` **disabled**, run `/speckit.companion.specify` → still no user-story section, and its headings match the preset-path output (FR-004 / SC-003).

- [X] T009 [P] [US2] Create `speckit-extension/commands/speckit.companion.specify.md` embedding the canonical specify body from T002, with the companion-command frontmatter (mirror existing `speckit.companion.capture.md` style).
- [X] T010 [P] [US2] Create `speckit-extension/commands/speckit.companion.plan.md` embedding the canonical plan body from T003.
- [X] T011 [P] [US2] Create `speckit-extension/commands/speckit.companion.tasks.md` embedding the canonical tasks body from T004.
- [X] T012 [P] [US2] Create `speckit-extension/commands/speckit.companion.implement.md` embedding the canonical implement body from T005.
- [X] T013 [US2] Declare all four commands in `speckit-extension/extension.yml` `provides.commands` per `contracts/namespaced-commands.md` (an undeclared command is skipped by the installer).
- [ ] T014 [US2] Verify independence: `specify extension add ./speckit-extension --dev`, then `specify preset disable sdd-lean`, run `/speckit.companion.specify` → no user-story section (FR-004); diff its section headings against the preset-path `spec.md` from T008 → identical (SC-003).
- [X] T015 [US2] Add a drift guard asserting each `speckit.companion.<stage>.md` body stays in sync with the preset's `commands/speckit.<stage>.md` body (a small check script under `speckit-extension/scripts/` or a Jest test) so the two never diverge (SC-003).

**Checkpoint**: Namespaced commands available, preset-independent, and shape-locked to the preset path.

---

## Phase 5: User Story 3 - Select, opt out, and compose the preset (Priority: P3)

**Goal**: Toggle the SDD-lean shape on/off and compose it deterministically with other presets; default-on for Companion-managed projects.

**Independent Test**: Set `speckit.features.sddLean` to `false` → next stock `/speckit.specify` returns the stock template with a user-story section (SC-004); `specify preset resolve` is deterministic under composition (SC-005).

- [X] T016 [P] [US3] Add `speckit.features.sddLean` (boolean, default `true`) to root `package.json` `contributes.configuration` per `contracts/config-and-setting.md`.
- [X] T017 [P] [US3] Implement read-merge-write of `.specify/sdd.config.yml` `features.sddLean` (preserve sibling/unknown keys) in `src/features/settings/` as the single source of truth (FR-010).
- [X] T018 [US3] Implement reconciliation in `src/features/settings/`: on setting change/activation, `true` → ensure `specify preset add` + `enable sdd-lean`; `false` → `specify preset remove sdd-lean` (Research R2 — remove, not disable); idempotent; writes through to `.specify/sdd.config.yml`.
- [X] T019 [P] [US3] Unit-test the reconciliation mapping (true→add/enable, false→remove, idempotent re-apply) in `tests/` with the CLI call + fs mocked (Jest, `tsconfig.test.json`).
- [X] T020 [US3] Document composition & precedence in `speckit-extension/presets/sdd-lean/README.md` + speckit-extension docs: priority numbers (lower = higher precedence), sits above the `companion` extension and above `lean`, `set-priority`/`resolve` usage (FR-009); confirm `specify preset resolve speckit.specify` is deterministic (SC-005).
- [X] T021 [US3] Wire the install-scaffolding default (FR-008): the Companion install path adds `sdd-lean` and writes `.specify/sdd.config.yml` `features.sddLean: true` for managed projects (update `speckit-extension/docs/install.md` and the install flow).

**Checkpoint**: On/off toggle works end-to-end, composition is deterministic, and managed projects default to the SDD-lean shape.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T022 [P] Update `speckit-extension/README.md` + `speckit-extension/CHANGELOG.md` for the `sdd-lean` preset and the four namespaced commands, and bump `speckit-extension/extension.yml` `extension.version` (NOT the root docs — dual-extension rule).
- [X] T023 [P] Update the root `README.md` "Configuration" section + root `CHANGELOG.md` for the `speckit.features.sddLean` VS Code setting (per the CLAUDE.md feature→README map).
- [X] T024 [P] Update `speckit-extension/docs/install.md` with the preset install + default-select steps (cross-link the quickstart).
- [ ] T025 Run `quickstart.md` end-to-end (all 5 steps + the Done-when checklist) and confirm SC-001…SC-005.
- [X] T026 Restore any fixtures/scratch dirs touched during verification (`git restore specs/_demo-*` if applicable; remove scratch feature dirs); leave the demo baseline clean.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: none — start immediately.
- **Foundational (T002–T005)**: depends on Setup. **BLOCKS US1 and US2.**
- **US1 (T006–T008)**: depends on Foundational.
- **US2 (T009–T015)**: depends on Foundational (commands embed the canonical bodies). Independent of US1 except T015 (compares to the preset bodies from T006/Phase 2).
- **US3 (T016–T021)**: depends on Foundational; T018/T020/T021 also need the preset to exist (T006).
- **Polish (T022–T026)**: after all targeted stories.

### Story Dependencies

- **US1 (P1)** — standalone MVP after Foundational.
- **US2 (P2)** — independently testable (preset disabled); only its drift guard (T015) references the preset bodies.
- **US3 (P3)** — independently testable; needs the preset installed to exercise the toggle/compose paths.

### Within Stories

- US1: T006 → T007 → T008.
- US2: T009–T012 → T013 → T014; T015 after T009–T012 (+ T006).
- US3: T016/T017 → T018 → T019; T020/T021 after T006.

### Parallel Opportunities

- Foundational: T002, T003, T004, T005 together (different files).
- US2: T009, T010, T011, T012 together.
- US3: T016, T017, T019 together.
- Polish: T022, T023, T024 together.

---

## Parallel Example: Foundational shape

```bash
# Author the four canonical SDD-lean bodies in parallel:
Task: "SDD-lean specify body in speckit-extension/presets/sdd-lean/commands/speckit.specify.md"
Task: "SDD-lean plan body in speckit-extension/presets/sdd-lean/commands/speckit.plan.md"
Task: "SDD-lean tasks body in speckit-extension/presets/sdd-lean/commands/speckit.tasks.md"
Task: "SDD-lean implement body in speckit-extension/presets/sdd-lean/commands/speckit.implement.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational (the four canonical bodies).
2. Phase 3 US1: write `preset.yml`, validate, prove stock `/speckit.specify` → no user stories.
3. **STOP and VALIDATE** (SC-001). This is a shippable MVP — the preset alone delivers the headline value.

### Incremental Delivery

1. Foundational ready → US1 (preset) → demo the reshaped stock pipeline.
2. US2 (namespaced commands) → demo the preset-independent opt-in path.
3. US3 (toggle + compose + default) → demo opt-out and composition.
4. Polish: dual-extension docs/version, root setting docs, quickstart run, fixture restore.

---

## Notes

- [P] = different files, no incomplete dependency.
- The single biggest correctness lever is keeping the namespaced bodies (US2) in lockstep with the preset bodies (Phase 2) — that's why T015 exists.
- Off = `preset remove`, never just `disable` (Research R2) — T018 must not regress this.
- Respect the dual-extension split: `speckit-extension/**` vs root `package.json`/`src`/README each carry their own version and changelog.
- Commit after each task or logical group; restore demo fixtures when done (T026).
