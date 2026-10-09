# Tasks: Scripted desktop QA

**Input**: [plan.md](./plan.md), [scripted-desktop-qa.spec.md](./scripted-desktop-qa.spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

Three stories, three disjoint file sets. The script is one file, so its work is sequenced in waves inside User Story 1; the other two stories never touch it.

## Phase 1: Setup

No setup: the script, the skill and the docs already exist.

## Phase 2: Foundational

No shared file blocks a story. Each story owns its files outright, so implement can hand each story to its own worker.

## Phase 3: User Story 1 - The release gate runs the desktop checks itself (Priority: P1)

**Goal**: every check that needs neither a real assistant nor the real Copilot app is a step in the scripted real-window check, passing in light and dark.

**Independent Test**: `npm run check:desktop` and `npm run check:desktop -- --theme dark` on the fixture project: every step in [contracts/desktop-check-steps.md](./contracts/desktop-check-steps.md) is in `results.<theme>.json` with `ok: true`, and `--only first-open-trusted` opens one trust-on window and nothing else.

Files: `tooling/scripts/desktop-check.mjs`

### Implementation

**Wave 1 — the script's foundations (same file, in this order):**

- [x] **T001** [US1] `launch()` takes `{ trust, workspace }`: `trust: true` drops `--disable-workspace-trust` and sets `security.workspace.trust.enabled` on with no startup prompt; `workspace` opens a `.code-workspace` path in place of the project folder · tooling/scripts/desktop-check.mjs
- [x] **T002** [US1] `buildProject()` takes `{ companion }`: `companion: false` removes `.specify/extensions/companion` and `.specify/presets/companion-standard` after the fixtures are laid down, and the project copies the four repo demo specs and derives `_04_demo-related-docs`, `_05_demo-archived`, `_06_empty-record` and `_07_links-demo` the way the vscode-qa recipe does (research, data-model, checklist; status archived; record emptied; a Links section naming Approach, Tasks, Far heading, Other spec, Source file, Web link) · tooling/scripts/desktop-check.mjs
- [x] **T003** [US1] One `inWindow(options, body)` helper that builds the project, launches, runs the body, then closes the app and removes the root; the provider-picker block is rewritten on it, loses its `SHOTS` gate and its `shots: true`, keeps its capture under `--shots`, and the main window launches only when a main-window step is selected · tooling/scripts/desktop-check.mjs
- [x] **T004** [US1] The start-up wipe removes only the current theme's files (`*.<theme>.png`, `results.<theme>.json`) so light and dark results sit side by side; the usage comment names the new behaviour · tooling/scripts/desktop-check.mjs

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — the own-window steps (same file, in contract order):**

- [x] **T005** [US1] Dropped: the owner chose one window per run, so first open with trust on stays on the handoff as part A · .claude/skills/release-qa/desktop-handoff.md
- [x] **T006** [US1] Dropped: the stock workspace stays on the handoff as part B · .claude/skills/release-qa/desktop-handoff.md
- [x] **T007** [US1] Dropped: two roots stays on the handoff as part B · .claude/skills/release-qa/desktop-handoff.md

**⟶ Wait for Wave 2 to finish, then:**

**Wave 3 — the main-window steps, after `first-spec` and before the `doc-*` loop (same file, in contract order):**

- [x] **T008** [US1] `narrow-panel-spec` and `narrow-panel-tasks`: Split Editor Right twice, then on Specification and Tasks of `_02_demo-tasked` the header, the rail and the footer have no horizontal overflow and the page does not scroll sideways; the second step restores one editor group · tooling/scripts/desktop-check.mjs
- [x] **T009** [US1] `builder-phase-menu`, `builder-add-step`, `builder-narrow` and `builder-move-to-phase`: the Workflow Builder's phase menu opens and closes, Add step grows the board by one and is undone, at about 330px the steps stack in one column with pinned heads, and Move to phase… moves a free node with the status line naming the move; nothing is saved or built · tooling/scripts/desktop-check.mjs
- [x] **T010** [US1] `nav-links` and `nav-empty-record`: the Links section's Approach, Tasks, Far heading, Other spec and Source file land where the contract says, the Web link's href is read not clicked, and the empty record's tab title names its document · tooling/scripts/desktop-check.mjs
- [x] **T011** [US1] `nav-n1` to `nav-n8`: groups, each spec name, same-tab document switching, related docs under their step, two tabs for two specs, rapid switching lands on `_04`, rail clicks leave status and footer unchanged, the locked Plan entry · tooling/scripts/desktop-check.mjs
- [x] **T012** [US1] `nav-n9` to `nav-n15`: append re-renders in place, a copied tasks.md appears in rail and sidebar, a deleted research.md says it is gone, a renamed folder closes or marks the old tab and opens from the new row, Mark Completed moves `_04` to Completed, a closed tab reopens on the clicked document, filter and sort then click opens the spec · tooling/scripts/desktop-check.mjs
- [x] **T013** [US1] `provider-dispatch` and `popup-provider-changed`, last in the main window: Next: Plan on `_00_demo-specified` reaches the stand-in terminal with a plan command; writing another provider into the profile's settings raises "AI provider changed. Reload window to apply changes." once with Reload Now, dismissed and restored · tooling/scripts/desktop-check.mjs

**⟶ Wait for Wave 3 to finish, then:**

- [x] **T014** [US1] Run `npm run check:desktop` and `npm run check:desktop -- --theme dark`; every step in the contract passes in both results files; fix what fails until both runs are green · tooling/scripts/desktop-check.mjs

**Checkpoint**: the script alone decides the nine moved checks in both themes.

## Phase 4: User Story 2 - Release QA reads the scripted results instead of waiting on the handoff (Priority: P2)

**Goal**: the surface map names the step ids, a grader turns the results files into PASS, FAIL or BLOCKED, and Step 2 runs both before anything is staged.

**Independent Test**: `python3 .claude/skills/release-qa/grade-scripted.py --map .claude/skills/release-qa/surface-map.yml --results .desktop-check` prints one line per scripted check; its unit tests prove a missing file, an absent step, a skipped step and a failed step each grade as the contract says.

Files: `.claude/skills/release-qa/surface-map.yml`, `.claude/skills/release-qa/grade-scripted.py`, `.claude/skills/release-qa/test_grade_scripted.py`, `.claude/skills/release-qa/SKILL.md`

### Tests

- [x] **T015** [P] [US2] `test_grade_scripted.py`: one case per outcome, written to fail first: PASS with every step ok, FAIL naming the first failed step and its note, BLOCKED for a missing results file, for an absent step id, and for a `skipped: true` step, `themes: both` reading both files and failing on a dark-only failure, and exit code 1 on any non-PASS · .claude/skills/release-qa/test_grade_scripted.py

### Implementation

**Wave 1 — independent (different files):**

- [x] **T016** [P] [US2] `surface-map.yml`: the ten moved checks become `kind: scripted` with `run`, `steps` and (for themes) `themes: both` exactly as [contracts/surface-map-scripted.md](./contracts/surface-map-scripted.md) lists them, `board-stock-run` is added as `kind: desktop`, the desktop comment names the four handoff checks, and a `QA harness` surface maps `tooling/scripts/desktop-check.mjs` to every scripted check · .claude/skills/release-qa/surface-map.yml
- [x] **T017** [P] [US2] `grade-scripted.py`: reads `checks:` of kind `scripted` from the map with the constrained YAML shapes the file uses (inline flow mappings and lists), reads `results.<theme>.json` for light and, under `themes: both`, dark, prints `<id> PASS|FAIL|BLOCKED: <note>` per check in map order with the precedence the contract fixes (missing file, then absent or skipped step, then `ok: false`), exits 1 on any non-PASS · .claude/skills/release-qa/grade-scripted.py

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T018** [US2] `SKILL.md`: Step 2 gains the scripted run between the headless canvas checks and staging (light, then dark, each in the background, then the grader, each line copied into `checks.md`; a script that does not start grades every scripted row BLOCKED), the handoff is staged only after the grade; `recheck` reruns a scripted check with `--only <its steps>` and regrades, copying only that line; the moved checks' recipe sections become one sentence each pointing at their step ids; the tools table and the description say what is scripted and what still needs eyes · .claude/skills/release-qa/SKILL.md

**Checkpoint**: a checklist built after a UI change lists every scripted check with a PASS, FAIL or BLOCKED line from the grader and never a desktop BLOCKED.

## Phase 5: User Story 3 - The desktop handoff fits one sitting (Priority: P2)

**Goal**: Claude Desktop gets three parts, no typing, and reports terminal questions instead of failing on them.

**Independent Test**: read `desktop-handoff.md` and the `READY` output of `qa-stage.sh`: three parts, every step a click or a look, the stock sandbox staged for part C, no two-roots window.

Files: `.claude/skills/release-qa/desktop-handoff.md`, `.claude/skills/release-qa/qa-stage.sh`, `.claude/commands/release-loop.md`, `.claude/commands/release-qa.md`

### Implementation

**Wave 1 — independent (different files):**

- [x] **T019** [P] [US3] `desktop-handoff.md`: four parts (A first open, B stock and two roots, C the timed run, D the GitHub Copilot app); the viewer and builder parts go, since the script decides them; a terminal question is written as `C<n> QUESTION:` and the pass moves on because Claude Code answers it · .claude/skills/release-qa/desktop-handoff.md
- [x] **T020** [P] [US3] `qa-stage.sh` is unchanged: the four parts still need the sandbox, the stock workspace and the two-roots window · .claude/skills/release-qa/qa-stage.sh
- [x] **T021** [P] [US3] `release-loop.md` and `release-qa.md`: the sentences describing the desktop flow say the scripted checks run first and the handoff holds three parts · .claude/commands/release-loop.md, .claude/commands/release-qa.md

**Checkpoint**: a staged run prints READY with a handoff of three parts and no step that asks Claude Desktop to type.

## Phase 6: Polish

**Wave 1 — independent (different files):**

- [x] **T022** [P] Update the real-window check section of `docs/visual-assets.md`: the surfaces it covers, the trust-on, stock and two-roots windows, the per-theme results, and the step convention that a step may launch its own window · docs/visual-assets.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T023** Validate against the Success Criteria: `npm run compile`, `npm test`, `python3 -m unittest .claude/skills/release-qa/test_grade_scripted.py`, then the grader over the two results files from T014 prints PASS for all ten scripted checks (SC-001, SC-002, SC-003), and the handoff reads three parts with no typing step (SC-004) · tooling/scripts/desktop-check.mjs, .claude/skills/release-qa/grade-scripted.py, .claude/skills/release-qa/desktop-handoff.md

## Dependencies & Execution Order

- Setup and Foundational are empty; the three stories start together and each owns disjoint files.
- US1 (T001 to T014) is one file in four waves: foundations, own-window steps, main-window steps, then the two full runs.
- US2 (T015 to T018): the test and the two files in one wave, then SKILL.md, which names the grader and the kinds they define.
- US3 (T019 to T021): one wave of three files.
- Polish: the docs line, then the validation run, which needs US1's results files and US2's grader.
