---
description: "Task list for Composable Command Nodes"
---

# Tasks: Composable Command Nodes

**Input**: Design documents from `/specs/172-composable-command-nodes/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/assembly-and-parity.md, quickstart.md

**Tests**: No new automated test suite is requested. The feature's "tests" are its own deliverables — the parity gate (`check-shape-parity.py`) and the existing capture regression (`test_context.py`, kept green). Those are listed as explicit tasks, not as a TDD layer.

**Organization**: Tasks are grouped by user story (P1 → P2 → P3), matching the plan's staging. Each story is an independently shippable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, US3 — maps to the spec's user stories
- Paths are relative to repo root `/Users/alfredoperez/dev/GitHub/speckit-companion/`

## Path Conventions

This change lives almost entirely in `speckit-extension/`. The only VS Code change is the FR-015 revert under `src/features/`. There is no `src/`-vs-`tests/` single-project split here — paths are given verbatim per task.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the directories the reshape needs before anything is captured or extracted.

- [x] **T001** [P] Create the shared-parts directory `speckit-extension/presets/_parts/` (will hold `sizing.md`, `routing.md`, `timing.md`, `self-advance.md`)
- [x] **T002** [P] Create the golden fixtures directory `speckit-extension/tests/golden/commands/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Freeze the proof-of-no-change reference. This MUST happen before any part is extracted (FR-001) — the golden is the baseline every later story is measured against.

**⚠️ CRITICAL**: No decomposition (US1/US2/US3) may begin until the golden capture exists.

- [x] **T003** Write the one-time golden-capture script `speckit-extension/scripts/capture-golden.py` per contracts/assembly-and-parity.md Contract 3 — snapshots every committed command body (the 7 `presets/companion-standard/commands/speckit.*.md` + the namespaced `commands/speckit.companion.*.md` pipeline + `mark-complete`) into `speckit-extension/tests/golden/commands/`
- [x] **T004** Run `python3 speckit-extension/scripts/capture-golden.py` once, before extracting any part, to freeze the current command set into `speckit-extension/tests/golden/commands/`; commit the snapshot (FR-001)

**Checkpoint**: Golden reference exists — decomposition is now safe and provable.

---

## Phase 3: User Story 1 - Reshape with a provable safety net (Priority: P1) 🎯 MVP

**Goal**: Stand up the parts/fence/build mechanism and prove a real extraction (the already-shared timing block) re-assembles byte-for-byte against the golden.

**Independent Test**: With the timing block extracted to `_parts/timing.md` and the bodies re-fenced, `build-commands.py` then `check-shape-parity.py` report zero drift vs the golden. Ships as a verified refactor even if US2/US3 never land.

- [x] **T005** [US1] Write the assembly script `speckit-extension/scripts/build-commands.py` per contracts Contract 1 — default mode replaces each `<!-- speckit-companion:part NAME -->…<!-- /speckit-companion:part NAME -->` region with `presets/_parts/NAME.md` and writes the body back; `--check` assembles in memory and exits 1 + diff on drift; deterministic, idempotent; missing part / unclosed fence / unknown part name is a hard error (exit 1)
- [x] **T006** [US1] Relocate `speckit-extension/presets/_shared/timing-partial.md` → `speckit-extension/presets/_parts/timing.md` (content byte-identical; remove the now-empty `_shared/` location reference)
- [x] **T007** [US1] Migrate the legacy `<!-- speckit-companion:timing -->…<!-- /speckit-companion:timing -->` fence to `<!-- speckit-companion:part timing -->…<!-- /speckit-companion:part timing -->` in all 11 bodies it appears in: `speckit-extension/presets/companion-standard/commands/speckit.{specify,clarify,plan,tasks,analyze,implement,constitution}.md` and `speckit-extension/commands/speckit.companion.{specify,plan,tasks,implement}.md`
- [x] **T008** [US1] Extend `speckit-extension/scripts/check-shape-parity.py` to the two-assertion gate per contracts Contract 2: replace the "body contains timing partial" check with (a) region-equality — each fenced region equals its `_parts/NAME.md` byte-for-byte (`part drift: <command>#<name>`), and (b) golden-equality — each unchanged command equals its `tests/golden/commands/` capture (`golden drift: <command>`); green message `[shape-parity] OK — N bodies match parts and golden`
- [x] **T009** [US1] Run `python3 speckit-extension/scripts/build-commands.py` to re-assemble all bodies from `_parts/timing.md`; confirm the only file content change is fence-marker text (no rule/wording change)
- [x] **T010** [US1] Run `python3 speckit-extension/scripts/check-shape-parity.py` and confirm green / zero drift vs the golden (SC-001, the gate that lets the rest ship)

**Checkpoint**: Mechanism proven on a real part; byte-for-byte parity holds. US1 is independently shippable.

---

## Phase 4: User Story 2 - One definition for shared logic (Priority: P2)

**Goal**: Collapse the sizing and routing duplication to one shared definition each (timing already done in US1), so "change the rule once" is literally true.

**Independent Test**: `grep -rn "5 files" speckit-extension/` (and the routing text) resolves to one `_parts/` file, not three command bodies; editing that one file and rebuilding propagates everywhere with no other file touched.

- [x] **T011** [P] [US2] Create `speckit-extension/presets/_parts/sizing.md` by extracting the canonical small/large definition + the 5-files / 10-tasks thresholds verbatim from the golden's current sizing text (extraction, not rewrite — FR-002)
- [x] **T012** [P] [US2] Create `speckit-extension/presets/_parts/routing.md` by extracting the "which step runs next given size" text verbatim from the golden
- [x] **T013** [US2] Re-fence `speckit-extension/commands/speckit.companion.classify.md` to include the `sizing` part via the `<!-- speckit-companion:part sizing -->` fence (single threshold source)
- [x] **T014** [US2] Re-fence the sizing region in the specify body `speckit-extension/commands/speckit.companion.specify.md` (and its preset twin `speckit-extension/presets/companion-standard/commands/speckit.specify.md` if it carries the sizing text) to the `sizing` part
- [x] **T015** [US2] Update `speckit-extension/workflows/speckit-companion.workflow.yml` so the `switch`/route node references the same sizing thresholds as the `sizing` part (no re-derivation of 5/10 in the YAML)
- [x] **T016** [US2] Re-fence every routing-bearing body to the `routing` part via `<!-- speckit-companion:part routing -->`
- [x] **T017** [US2] Run `build-commands.py` then `check-shape-parity.py`; confirm region-equality holds for `sizing`/`routing` and no golden drift for unchanged commands (intentionally-changed sizing/routing commands are expected to differ from golden only inside their fences)
- [x] **T018** [US2] Verify single-definition: `grep -rn "5 files" speckit-extension/` resolves to exactly one `_parts/sizing.md` hit (SC-002); edit one line in `_parts/sizing.md`, rebuild, confirm it propagates to classify + specify + workflow with no other file edited (SC-003), then revert the probe edit

**Checkpoint**: Sizing, routing, and timing each authored in exactly one place. US2 is independently verifiable.

---

## Phase 5: User Story 3 - One node hands off to the next (Priority: P3)

**Goal**: Add the agentic-CLI self-advance handoff to each pipeline command, make `mark-complete` a first-class terminal node of the Companion workflow that lands the run at `completed`, and revert the panel-reads-workflow seams so the driving logic lives in the commands.

**Independent Test**: In an agentic CLI, run the first Companion step and confirm it continues through the pipeline, pauses at gates, runs the terminal `mark-complete` node after implement, and `.spec-context.json` lands at `status: completed`; in a plain/one-shot terminal it stays manual; stock SpecKit stops at `implemented`.

- [x] **T019** [P] [US3] Create `speckit-extension/presets/_parts/self-advance.md` — the agentic-CLI handoff text: continue to the next workflow-named step, pause at review gates, run the terminal node after implement, land at `completed`; stay manual where the environment runs one step then stops
- [x] **T020** [US3] Add the `<!-- speckit-companion:part self-advance -->` fence to `speckit-extension/commands/speckit.companion.specify.md`
- [x] **T021** [US3] Add the `self-advance` fence to `speckit-extension/commands/speckit.companion.plan.md`
- [x] **T022** [US3] Add the `self-advance` fence to `speckit-extension/commands/speckit.companion.tasks.md`
- [x] **T023** [US3] Add the `self-advance` fence to `speckit-extension/commands/speckit.companion.implement.md`
- [x] **T024** [US3] Express `speckit-extension/commands/speckit.companion.mark-complete.md` as a part composition (re-fence its shared regions); confirm its body calls only `write-context.py --mark-complete` (single completed-writer, FR-012) — do NOT add a second writer
- [x] **T025** [US3] Add `mark-complete` as the first-class terminal node in `speckit-extension/workflows/speckit-companion.workflow.yml` — runs after the `implement` step (and any commit step), dispatches `speckit.companion.mark-complete`; ensure stock SpecKit gains no terminal node (FR-007a/007b)
- [x] **T026** [US3] Confirm `speckit.companion.mark-complete` is registered under `provides.commands` in `speckit-extension/extension.yml` (installer skips unregistered commands); add it if missing
- [x] **T027** [US3] Revert `src/features/workflow-editor/workflow/specInfoParser.ts` — stop deriving pipeline steps from the workflow definition (FR-015)
- [x] **T028** [US3] Revert `src/features/spec-viewer/specViewerProvider.ts` — `resolveWorkflowSteps` returns the static canonical pipeline again
- [x] **T029** [US3] Revert `src/features/spec-viewer/messageHandlers.ts` — drop the workflow-def command lookup
- [x] **T030** [US3] Revert `src/features/workflows/workflowManager.ts` — drop the `getFeatureWorkflow` step-driving path
- [x] **T031** [US3] Run `build-commands.py` + `check-shape-parity.py` (parts green) and `npm run compile` (TS reverts compile cleanly)
- [x] **T032** [US3] End-to-end verification: on a self-advancing agentic CLI a Companion run advances through non-gated steps and lands at `status: completed` (SC-005); a one-shot run does not auto-advance and stays resumable/manually completable (SC-006); a stock SpecKit run stops at `implemented` (FR-007b)

**Checkpoint**: All three stories complete — composable parts, single-source rules, self-advance + terminal completion, panel reverted.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Docs, regression nets, and the install/release surface that span all stories.

- [x] **T033** [P] Update `docs/template-profiles.md` — the parts/commands-vs-templates mechanism, the `_parts/` source-of-truth, and the routing-node reference
- [x] **T034** [P] Update `docs/capture-and-timing.md` — the timing partial's relocation from `_shared/timing-partial.md` to `_parts/timing.md` and the unchanged capture path (FR-016)
- [x] **T035** [P] Update `speckit-extension/README.md` + `speckit-extension/CHANGELOG.md` (user-facing voice, no internal symbol names) + bump `speckit-extension/extension.yml` `extension.version`
- [x] **T036** Run `python3 -m pytest speckit-extension/tests/test_context.py` and confirm the `.spec-context.json` history/timing output is unchanged before/after the reshape (SC-007)
- [x] **T037** Run the `eval-speckit-extension` end-to-end check against a real spec to confirm hooks fire and capture is intact after the reshape
- [x] **T038** Walk the quickstart.md loop (edit one `_parts/` file → `build-commands.py` → `check-shape-parity.py`) and confirm it matches documented output

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. **BLOCKS all user stories** — the golden must be frozen before any extraction (FR-001).
- **US1 (Phase 3)**: Depends on Foundational. The mechanism (build + parity gate) other stories rely on.
- **US2 (Phase 4)**: Depends on US1 (needs the build script + golden+region gate in place).
- **US3 (Phase 5)**: Depends on US1 (build mechanism). Independent of US2's specific rule extractions, but sequenced after it per the plan's P1→P2→P3 staging.
- **Polish (Phase 6)**: Depends on all desired stories being complete.

### Critical path

T001/T002 → T003 → T004 (golden frozen) → T005–T010 (US1 mechanism + parity green) → US2 / US3 → Polish.

### Within each story

- US1: build script (T005) and golden-aware parity (T008) before re-assembly/verify (T009–T010); the timing relocation (T006) before its fence migration (T007).
- US2: create parts (T011/T012) before re-fencing the bodies that include them (T013–T016) before rebuild/verify (T017–T018).
- US3: create the self-advance part (T019) before adding its fences (T020–T023); workflow node (T025) before end-to-end verify (T032); TS reverts (T027–T030) before recompile (T031).

### Parallel Opportunities

- **Setup**: T001, T002 in parallel (different directories).
- **US2**: T011 (sizing part) and T012 (routing part) in parallel — different new files.
- **US3**: T019 (self-advance part) is [P]; the four fence additions T020–T023 touch four different command files and can run in parallel; the four TS reverts T027–T030 touch four different `src/` files and can run in parallel.
- **Polish**: T033, T034, T035 in parallel (different docs/manifests).

---

## Parallel Example: User Story 3

```bash
# The four self-advance fence additions touch four different files:
Task: "Add self-advance fence to speckit.companion.specify.md"  (T020)
Task: "Add self-advance fence to speckit.companion.plan.md"     (T021)
Task: "Add self-advance fence to speckit.companion.tasks.md"    (T022)
Task: "Add self-advance fence to speckit.companion.implement.md"(T023)

# The four panel-revert edits touch four different src/ files:
Task: "Revert specInfoParser.ts step derivation"        (T027)
Task: "Revert specViewerProvider.ts resolveWorkflowSteps"(T028)
Task: "Revert messageHandlers.ts workflow-def lookup"   (T029)
Task: "Revert workflowManager.ts step-driving path"     (T030)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup directories.
2. Phase 2: Capture the golden (CRITICAL — freezes the baseline).
3. Phase 3: Build the parts/fence/build mechanism, extract timing, prove byte-for-byte parity.
4. **STOP and VALIDATE**: `check-shape-parity.py` green. This ships on its own as a verified refactor.

### Incremental Delivery

1. Setup + Foundational → golden frozen.
2. US1 → parity-green refactor (MVP).
3. US2 → single-source sizing + routing → grep proof + propagation proof.
4. US3 → self-advance + terminal `mark-complete` + panel revert → end-to-end completion proof.
5. Polish → docs, capture regression, eval, quickstart walk.

Each story leaves the parity gate green; nothing a user sees changes until US3, by design.

---

## Notes

- [P] = different files, no dependencies. Re-fencing the same command body in different stories (e.g. specify gets `sizing` in US2 and `self-advance` in US3) is sequential by phase, so no same-file conflict.
- The golden capture (T004) is a one-time, pre-decomposition action. Re-blessing it after an *intentional* command change is explicit and reviewed — never silent inside the build (Contract 3).
- Keep the single completed-writer invariant: `mark-complete` calls only `write-context.py --mark-complete` (FR-012). No second completed-writer, no VS Code file-watcher completion logic.
- Run `git restore specs/_00_demo-specified specs/_01_demo-planned specs/_02_demo-tasked` if exercising the viewer mutates the demo fixtures.
</content>
</invoke>
