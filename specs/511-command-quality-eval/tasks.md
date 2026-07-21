# Tasks: Command-Quality Eval

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/cli.md](./contracts/cli.md)

## Phase 1: Setup

*(none — the eval slots into existing directories and CI; no scaffolding needed)*

## Phase 2: Foundational

**Wave 1 — single task:**

- [x] **T001** Create `check_quality.py` skeleton: `Report` class with PASS/WARN/FAIL/INFO rows and `failed`/`warned` counts, `_parse_at`, argparse CLI (`--feature-dir`, `--commands-dir`, `--json`, `--strict`, neither-dir usage error), exit-code model · `.claude/skills/eval-speckit-extension/check_quality.py`

## Phase 3: User Story 1 — Score a finished spec's runtime quality (P1)

### Implementation

**⟶ Wait for T001, then:**

**Wave 2 — independent (same new file, ordered edits):**

- [x] **T002** [US1] Verbosity dimension: single `BUDGETS` table (lines primary, chars secondary; WARN/FAIL bands per research D3), one row per artifact, missing/small artifacts never flagged · `.claude/skills/eval-speckit-extension/check_quality.py`
- [x] **T003** [US1] Timing dimension: `trusted-boundaries` (ordered deterministic start→complete per reached step, WARN when untrusted), `burst-journaling` (≥3 by:ai finishes within 1.0s → FAIL), `step-duration-outlier` (>8× median of other trusted spans and >300s → WARN) · `.claude/skills/eval-speckit-extension/check_quality.py`

**Checkpoint**: `python3 .claude/skills/eval-speckit-extension/check_quality.py --feature-dir specs/509-timing-capture` prints a verbosity+timing report with zero FAIL rows.

## Phase 4: User Story 2 — Catch a command body that prompts wrongly (P1)

### Implementation

**⟶ Wait for T001 (independent of Wave 2), then:**

**Wave 3 — single task:**

- [x] **T004** [US2] Prompting dimension: enumerated `NEVER_PROMPT`/`MUST_ASK` rosters, word-bounded phrase patterns, fenced-block skipping, 40-char negation window, loud FAIL on a missing roster file, `MUST_ASK` carrier resolved as sibling `presets/companion-standard/commands/` · `.claude/skills/eval-speckit-extension/check_quality.py`

**Checkpoint**: `--commands-dir speckit-extension/commands` passes on main; planting "ask the user before continuing" in a hook-body copy FAILs it.

## Phase 5: User Story 3 — Regressions surface in CI (P2)

### Tests

**⟶ Wait for Waves 2+3, then:**

**Wave 4 — single task:**

- [x] **T005** [US3] Stdlib unittest suite: healthy-fixture pass (synthesized healthy spec dir), one failing-direction test per dimension (bloated artifact → verbosity FAIL, 1s burst history → burst FAIL, planted prompt → prompting FAIL, missing roster file → FAIL, negated mention → no flag, clarify without ask → FAIL), strict exit-code semantics (FAIL→1, WARN-only→0), JSON shape · `speckit-extension/tests/test_check_quality.py`

### Implementation

**⟶ Wait for Wave 4, then:**

**Wave 5 — single task:**

- [x] **T006** [US3] CI wiring: add one "Command-quality eval" step to the capture-suite job running the checker `--strict` over `specs/509-timing-capture`, `specs/510-living-sync`, and `--commands-dir speckit-extension/commands` · `.github/workflows/ci.yml`

**Checkpoint**: CI job runs the eval on every PR; a FAIL band breach fails the job, WARN alone stays green.

## Phase 6: Polish

**⟶ Wait for Wave 5, then:**

**Wave 6 — independent (different files):**

- [x] **T007** [P] Docs: SKILL.md gains the quality-eval step + assumption block; `docs/capture-and-timing.md` "The eval" section notes the quality sibling and its timing assertions · `.claude/skills/eval-speckit-extension/SKILL.md`, `docs/capture-and-timing.md`
- [x] **T008** [P] `speckit-extension/CHANGELOG.md` `[Unreleased]` entry (user-voice, no internal symbol names; no version bump) · `speckit-extension/CHANGELOG.md`

**⟶ Wait for Wave 6, then:**

**Wave 7 — single task:**

- [x] **T009** Validate: run the eval against `specs/509-timing-capture` and `specs/510-living-sync` (SC-001: zero FAIL), full python suite, `npm run compile && npm test`, `check-shape-parity.py`, `package-manifest.py --check`, `check-command-emissions.py` · repo-wide

## Dependencies & Execution Order

- Phase 2 (T001) blocks everything; Waves 2 (T002–T003) and 3 (T004) both depend only on T001 and are independent of each other; tests (T005) need all three dimensions; CI (T006) needs the tests green; docs (T007, T008) can go in parallel after T006; validation (T009) is last.
