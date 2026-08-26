# Tasks: Pipeline Doctor — Run Tracing, Debug Mode, and a Health Check

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Issue**: [#599](https://github.com/alfredoperez/speckit-companion/issues/599)
**Size**: `oversized` — full phased list.

All Python is stdlib-only, matching every sibling script. Tests join the existing `speckit-extension/tests/` unittest suite (CI runs `python3 -m unittest discover -s speckit-extension/tests -p "test_*.py"`).

---

## Phase 1: Setup

**Wave 1 — independent (different files):**

- [x] **T001** [P] Add `specs/*/.trace.jsonl` to the repository ignore rules, beside the existing `.spec-context.events.jsonl` rule · `.gitignore`
- [x] **T002** [P] Create the doctor fixture directory with a README naming each fixture's shape (broken record, false claim, flattened tasks, stuck completion, unwritable context) · `speckit-extension/tests/fixtures/doctor/README.md`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T003** Build the four doctor fixtures as committed spec directories the tests read — a dangling-start record, a checked-task-without-journal record, a burst-journaled record, and an attribution-anomaly record · `speckit-extension/tests/fixtures/doctor/`

---

## Phase 2: Foundational (blocks every story)

The report shapes and the honesty ledger are shared by every check, so nothing story-specific starts until they exist.

**Wave 1 — independent (different files):**

- [x] **T004** [P] Implement `Finding` and `CheckStatus` per `data-model.md` — construction, severity ordering, and the rule that a skipped check carries a reason and is never rendered as clean · `speckit-extension/scripts/doctor.py`
- [x] **T005** [P] Implement the trace line shape (`TraceEvent`) — field set, ISO-8601 stamping, and JSON serialization per `contracts/trace-file.md` · `speckit-extension/scripts/trace.py`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T006** Implement the doctor CLI surface — `--feature-dir`, `--chat`, `--json`, `--all`, feature-dir resolution reusing `spec_context.resolve_feature_dir`, always-exit-0, and per-check exception isolation (a crashing check becomes a skip with its message as the reason) · `speckit-extension/scripts/doctor.py`
- [x] **T007** Implement the human and `--json` renderers exactly as `contracts/doctor-cli.md` specifies, with the summary computed from the check ledger rather than the findings list · `speckit-extension/scripts/doctor.py`

---

## Phase 3: User Story 1 — Diagnose an existing spec's run record (P1)

**Goal**: A read-only verdict on any spec directory, derived from the run record and on-disk files alone, so it works retroactively.
**Independent Test**: Run the doctor against a spec created before this feature existed; it produces concrete findings (or a clean bill of health) and modifies nothing.

### Tests

- [x] **T008** Write the failing record-audit tests against the Phase 1 fixtures — dangling start, checked-task-without-journal, burst clustering, attribution anomaly, and the empty/earliest-state case that must NOT be a finding · `speckit-extension/tests/test_doctor.py`
- [x] **T009** Write the failing triage tests — a records-disagree fixture and a records-consistent fixture, each asserting the exact verdict wording · `speckit-extension/tests/test_doctor.py`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T010** [P] [US1] Implement the dangling-step check — a step-level start in `history[]` with no matching complete, excluding a step that is genuinely in flight · `speckit-extension/scripts/doctor_checks.py`
- [x] **T011** [P] [US1] Implement the unjournaled-task check — `- [x]` markers in `tasks.md` with no matching per-task complete in the record, reusing `task_sync`'s marker parsing so no marker format is missed · `speckit-extension/scripts/doctor_checks.py`
- [x] **T012** [P] [US1] Implement the burst-clustering check — task finishes packed inside a short window reported as batched journaling rather than as measured durations · `speckit-extension/scripts/doctor_checks.py`
- [x] **T013** [P] [US1] Implement the attribution-anomaly check — a step closed by an author the pipeline reserves for the other side (an `ai` complete on specify/plan/tasks/implement, or an `extension` complete on clarify/analyze) · `speckit-extension/scripts/doctor_checks.py`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T014** [US1] Implement the status-versus-display triage — run the record-driven reading (`status-context.py`) against the file-driven reading (`derive-from-files.py`) plus a Python re-derivation of the viewer's step badges from `history[]`, and emit "records disagree" or "records are consistent" · `speckit-extension/scripts/doctor_checks.py`
- [x] **T015** [US1] Wire the record checks and the triage into the doctor's check ledger, with a corrupt or absent record reported as a named skip rather than a crash · `speckit-extension/scripts/doctor.py`

**Checkpoint**: The doctor runs against any existing spec directory and returns an actionable verdict. US1 is independently functional and testable.

---

## Phase 4: User Story 2 — Every capture call leaves a trace (P1)

**Goal**: Every handled call, successful or failed, records itself for free; the doctor grows its trace-derived sections.
**Independent Test**: Point a capture call at an unwritable spec directory, then run the doctor — the failure appears with its reason.

### Tests

- [x] **T016** Write the failing tracer tests — one line per call, the reason captured verbatim on a declined call, the size cap and its `truncated` marker, self-ignore idempotence, and the guarantee that a tracer failure never propagates · `speckit-extension/tests/test_trace.py`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T017** [P] [US2] Implement the tracer writer — lazy create, single append, byte cap with newest-preserved rewrite plus the `truncated` marker, and a total swallow of every internal failure · `speckit-extension/scripts/trace.py`
- [x] **T018** [P] [US2] Implement the self-ignore — write `specs/NNN/.gitignore` containing `.trace.jsonl` on first trace write, idempotent and skipped when an existing rule already covers it · `speckit-extension/scripts/trace.py`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T019** [US2] Implement the tracer reader — parse lines, count and report unparseable ones, and surface a `truncated` marker as "at least N" rather than an exact total · `speckit-extension/scripts/trace.py`

**⟶ Wait for T019, then:**

**Wave 3 — independent (different files):**

- [x] **T020** [P] [US2] Wrap `main()` so every invocation traces at exit — including each early return (unresolvable feature dir, refused lifecycle key, `--feature-dir`/`--tasks-file` mismatch), classifying the op and reusing the stderr message verbatim as the reason · `speckit-extension/scripts/write-context.py`
- [x] **T021** [P] [US2] Trace each `compute_drift` call — its inputs, its per-capability verdict, and its skips — so repeated verdicts can be compared over time · `speckit-extension/scripts/drift.py`

**⟶ Wait for Wave 3 to finish, then:**

- [x] **T022** [US2] Implement the trace-derived doctor section — call counts, failure counts with reasons, payload and loaded-context sizes, and per-file rewrite counts; a missing trace is a named skip, not a clean verdict · `speckit-extension/scripts/doctor_checks.py`
- [x] **T023** [US2] Add `--batch` per `contracts/capture-cli-additions.md` — one JSON document through the existing additive-capture writers in a single read-modify-write, exit 2 on a malformed payload · `speckit-extension/scripts/capture.py`
- [x] **T024** [US2] Add `--close-task` per `contracts/capture-cli-additions.md` — append plus fold in one main-agent-only call, leaving `--append` and `--materialize` unchanged, with the worker restriction stated in the help text · `speckit-extension/scripts/task_sync.py`

**Checkpoint**: A failed capture call is visible in the doctor's report with its reason, and the two quick wins are provably recording what the multi-call forms recorded. US2 is independently functional and testable.

---

## Phase 5: User Story 3 — Judge a drift warning instead of guessing (P2)

**Goal**: The doctor recomputes drift itself and shows its work, classifying every flag.
**Independent Test**: Open a spec that currently shows a drift warning, run the doctor, and confirm it names the exact capability, files, and commits.

### Tests

- [x] **T025** Write the failing drift-audit tests — a real-drift case, a self-inflicted case, a suspect-baseline case, an unknown-baseline case, and a false-claim case where a recorded drift-clean claim contradicts recomputation · `speckit-extension/tests/test_doctor_drift.py`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T026** [P] [US3] Invoke `drift.py --json` as ground truth and normalize its result into `DriftFlag` records, carrying every skip through as `unknown` with its reason · `speckit-extension/scripts/doctor_drift.py`
- [x] **T027** [P] [US3] Implement the commit-attribution walk — for each flagged file, the commits since the capability's baseline that touched it, with sha and subject · `speckit-extension/scripts/doctor_drift.py`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T028** [US3] Implement the three classifiers in order — self-inflicted (every changed file is a companion bookkeeping artifact or the capability's own living-spec documents), suspect-baseline (baseline not an ancestor of `HEAD`, or a git-followable rename), real otherwise · `speckit-extension/scripts/doctor_drift.py`
- [x] **T029** [US3] Implement false-claim detection — compare the recomputed verdict against `verified[]` claims and against trace-recorded drift verdicts, reporting a contradiction with both sides and their timestamps · `speckit-extension/scripts/doctor_drift.py`
- [x] **T030** [US3] Wire the drift audit into the doctor's ledger, reporting "not applicable" where living specs are not enabled · `speckit-extension/scripts/doctor.py`

**Checkpoint**: Every drift warning the extension shows can be judged in under a minute from the doctor's output. US3 is independently functional and testable.

---

## Phase 6: User Story 4 — Find out why a spec never landed as completed (P2)

**Goal**: A stated reason for every completion failure instead of a silent stall.
**Independent Test**: Reproduce a completion failure with a broken fixture and confirm the doctor names the cause.

### Tests

- [x] **T031** Write the failing completion tests — never-arrived, refused-with-reason, display-disagrees, and not-attempted, each asserting the four outcomes stay distinct · `speckit-extension/tests/test_doctor.py`

### Implementation

- [x] **T032** [US4] Implement the completion check — read completion attempts from `history[]` and the trace, then resolve to exactly one of `completed`, `never-arrived`, `refused`, `display-disagrees`, or `not-attempted`, carrying the writer's refusal message as the reason · `speckit-extension/scripts/doctor_checks.py`

**⟶ Wait for T032, then:**

- [x] **T033** [US4] Build the stuck-completion fixtures — a spec directory with no `.specify/feature.json` and one with an unwritable context file — and assert the doctor states the cause for each · `speckit-extension/tests/fixtures/doctor/`

**Checkpoint**: Every completion failure the fixtures reproduce yields a stated reason. US4 is independently functional and testable.

---

## Phase 7: User Story 5 — Catch a task file restructured mid-run (P2)

**Goal**: The generated task-list shape is verified to have survived implement.
**Independent Test**: Flatten a generated task file's user-story phases into top-level wave headings and confirm the doctor flags it.

### Tests

- [x] **T034** Write the failing template-fidelity tests — an intact file, a flattened file, a file with its join lines stripped, a single-user-story file that must NOT be flagged, and a spec with no task file at all · `speckit-extension/tests/test_doctor.py`

### Implementation

- [x] **T035** [US5] Implement the template-fidelity check against the generated shape in `speckit-extension/nodes/tasks/tasks-doc.md` — user-story phases containing waves, `⟶ Wait` join lines and checkpoints intact — naming the offending headings on a violation and reporting "not applicable" when there is no task file · `speckit-extension/scripts/doctor_checks.py`

**Checkpoint**: A restructured task file is flagged with its offending headings named. US5 is independently functional and testable.

---

## Phase 8: User Story 6 — Turn on deep timing only while investigating (P3)

**Goal**: A project-level debug flag that adds timing instrumentation to the rendered bodies and removes it entirely when off.
**Independent Test**: Render with the flag on and confirm the instrumentation is present; render with it off and confirm the body carries no instrumentation text.

### Tests

- [ ] **T036** Write the failing debug tests — off renders byte-identical to the frozen golden, on renders carry the part, a non-boolean or malformed config reads as off, and the flag is consumed at render time only · `speckit-extension/tests/test_config.py`, `speckit-extension/tests/test_nodes.py`

### Implementation

**Wave 1 — independent (different files):**

- [ ] **T037** [P] [US6] Read the top-level `debug` flag through the existing loader, inheriting its failure table (absent → false silently, malformed → false with one warning) · `speckit-extension/scripts/companion_config.py`
- [ ] **T038** [P] [US6] Write the instrumentation part text — per-step timing instructions, authored once and shared by every pipeline command · `speckit-extension/presets/_parts/debug-timing.md`

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [ ] **T039** [P] [US6] Append the `debug-timing` part conditionally in node assembly, reusing the orchestrator part's existing conditional-append seam · `speckit-extension/scripts/assemble-nodes.py`
- [ ] **T040** [P] [US6] Apply the same conditional for the non-node command bodies · `speckit-extension/scripts/build-commands.py`

**Checkpoint**: Turning debug on and re-rendering yields per-step timing; turning it off leaves zero instrumentation text. US6 is independently functional and testable.

---

## Phase 9: User Story 7 — Explain what happened from the session transcript (P3)

**Goal**: An optional deep audit that explains causes and measures waste, degrading to one line where no transcript exists.
**Independent Test**: Run `--chat` on a Claude run and confirm causes and waste are reported; run it without a transcript and confirm a clean one-line exit.

### Tests

- [ ] **T041** Write the failing chat-audit tests against a committed synthetic transcript — cause classification, a claim contradicting recomputed reality, a waste figure, a missing transcript directory, and an unparseable transcript · `speckit-extension/tests/test_doctor_chat.py`

### Implementation

**Wave 1 — independent (different files):**

- [ ] **T042** [P] [US7] Implement transcript discovery — match files under `~/.claude/projects/` by project path and intersect with the step's recorded time window from `history[]`, with an explicit path override · `speckit-extension/scripts/doctor_chat.py`
- [ ] **T043** [P] [US7] Implement defensive parsing that degrades to a single "not available" line and exit 0 on a missing directory or a format it cannot read · `speckit-extension/scripts/doctor_chat.py`

**⟶ Wait for Wave 1 to finish, then:**

- [ ] **T044** [US7] Implement cause classification — tried-and-failed versus retried versus never-attempted — and surface recorded claims that contradict the recomputed reality, showing both sides · `speckit-extension/scripts/doctor_chat.py`
- [ ] **T045** [US7] Implement the waste measure — extra summaries, narration, and repeated rewrites of the same file — and wire the audit behind `--chat` in the doctor's ledger · `speckit-extension/scripts/doctor_chat.py`, `speckit-extension/scripts/doctor.py`

**Checkpoint**: The deep audit explains causes and waste on a transcript-keeping provider and exits gracefully elsewhere. US7 is independently functional and testable.

---

## Phase 10: User Story 8 — Prove failures get recorded, not just happy paths (P3)

**Goal**: The bench runs the tracer, scores the doctor's verdict, and reproduces both batched journaling and a recorded capture failure.
**Independent Test**: Run the harness over the oversized variant and confirm scoring reflects the doctor's verdict, including a batched-journaling finding when journaling was batched.

**Wave 1 — independent (different files):**

- [ ] **T046** [P] [US8] Add the oversized variant — 15+ files and 25+ tasks with real wait-lines, alongside the existing easy/medium/hard sizes · `examples/todo-claude/bench/lib.mjs`
- [ ] **T047** [P] [US8] Add the failure-injection fixture — a run with `.specify/feature.json` removed and one with an unwritable context file · `examples/todo-claude/bench/fixtures/`

**⟶ Wait for Wave 1 to finish, then:**

- [ ] **T048** [US8] Fold the doctor's `--json` verdict into bench scoring, so a batched-journaling or recorded-failure finding moves the score · `examples/todo-claude/bench/lib.mjs`, `examples/todo-claude/bench/cap.mjs`
- [ ] **T049** [US8] Document the oversized variant and the failure fixture in the bench guide · `examples/todo-claude/bench/README.md`

**Checkpoint**: The bench proves failures get recorded, not just that happy paths trace. US8 is independently functional and testable.

---

## Phase 10b: User Story 9 — Catch a step doing the next step's work (P2)

**Goal**: Report where one pipeline step did another's work, from the artifacts and the run's own timing.
**Independent Test**: Take a spec whose plan document carries a task checklist, run the health check, and confirm it reports plan as having done tasks' work with the evidence named.

### Tests

- [x] **T056** Write the failing bleed tests — a spec carrying a task checklist, a plan carrying one, a task list carrying implementation code, an identifier duplicated across artifacts, source committed before implement, a clean run, and a fast-tracked small change that must stay clean · `speckit-extension/tests/test_doctor_bleed.py`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T057** [P] [US9] Implement the artifact-shape signals — planning or tasking content in `spec.md`, a task checklist in `plan.md`, substantial implementation code in `tasks.md` — with the fast-path shape explicitly exempt · `speckit-extension/scripts/doctor_bleed.py`
- [x] **T058** [P] [US9] Build the bleed fixtures — spec-does-plan, plan-does-tasks, tasks-does-code, duplicated identifiers, a clean run, and a fast-tracked small change · `speckit-extension/tests/fixtures/doctor/`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T059** [US9] Implement the cross-artifact duplication signal and the early-source-commit signal, the latter from the commits inside each pre-implement step's recorded window · `speckit-extension/scripts/doctor_bleed.py`
- [x] **T060** [US9] Implement the step time-share signal as a note, and wire the whole check into the doctor's ledger and its `--json` output · `speckit-extension/scripts/doctor_bleed.py`, `speckit-extension/scripts/doctor.py`

**Checkpoint**: A run where one step did another's work is reported with named evidence. US9 is independently functional and testable.

---

## Phase 11: Polish

**Wave 1 — independent (different files):**

- [ ] **T050** [P] Declare the doctor command in the manifest and author its body with the standard part fences, matching how `living-drift` is shipped · `speckit-extension/extension.yml`, `speckit-extension/commands/speckit.companion.doctor.md`
- [ ] **T051** [P] Document the doctor command and the `debug` flag, including that debug affects the next dispatched command and not one in flight · `speckit-extension/README.md`
- [ ] **T052** [P] Add the `[Unreleased]` changelog entry in user-facing release-note voice · `speckit-extension/CHANGELOG.md`

**⟶ Wait for Wave 1 to finish, then:**

- [ ] **T053** Update the command inventory surfaces the manifest gates — install records and documentation tables — so `check-command-emissions.py` passes in both directions · `speckit-extension/docs/`, install records
- [ ] **T054** Register every script the doctor command calls in the packaging manifest, so `package-manifest.py --check` passes · `speckit-extension/scripts/package-manifest.py`
- [ ] **T055** Validate against the spec's Success Criteria — run `python3 -m unittest discover -s speckit-extension/tests -p "test_*.py"`, `npm test`, and every CI gate (`check-shape-parity.py`, `assemble-nodes.py --check`, `package-manifest.py --check`, `check-command-emissions.py`, the command-quality eval) · repo-wide

---

## Dependencies & Execution Order

**Phase order**: Setup → Foundational → US1 → US2 → US3 → US4 → US5 → US6 → US7 → US8 → US9 → Polish. Phases 5 through 9 (US3–US7) depend only on Foundational and US1, so they are independent of each other; the listed order is priority, not a hard chain.

| Phase | Waves |
|---|---|
| 1 Setup | W1 (T001, T002) → T003 |
| 2 Foundational | W1 (T004, T005) → W2 (T006, T007) |
| 3 US1 | tests (T008, T009) → W1 (T010–T013) → W2 (T014, T015) |
| 4 US2 | test (T016) → W1 (T017, T018) → T019 → W3 (T020, T021) → W4 (T022, T023, T024) |
| 5 US3 | test (T025) → W1 (T026, T027) → W2 (T028, T029, T030) |
| 6 US4 | test (T031) → T032 → T033 |
| 7 US5 | test (T034) → T035 |
| 8 US6 | test (T036) → W1 (T037, T038) → W2 (T039, T040) |
| 9 US7 | test (T041) → W1 (T042, T043) → W2 (T044, T045) |
| 10 US8 | W1 (T046, T047) → W2 (T048, T049) |
| 10b US9 | test (T056) → W1 (T057, T058) → W2 (T059, T060) |
| 11 Polish | W1 (T050, T051, T052) → W2 (T053, T054) → T055 |

**Hard blocks**: T022 needs the tracer reader (T019) and both instrumentation points (T020, T021). T028 and T029 need the normalized flags and the commit walk (T026, T027). T048 needs the doctor's `--json` output to be stable, so all of Phases 3–9 land first. T059 and T060 need the artifact signals and fixtures from T057 and T058. T055 runs last, after every other task.
