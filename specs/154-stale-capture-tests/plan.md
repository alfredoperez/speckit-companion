# Implementation Plan: Green-Baseline Stale Capture Tests + CI Gate

**Branch**: `154-stale-capture-tests` | **Spec**: [spec.md](./spec.md)

## Technical Context

- **Language/stack**: Python 3 stdlib `unittest` (no pip deps) for the capture tests; GitHub Actions YAML for CI; existing TS build untouched.
- **Files in play**:
  - `speckit-extension/tests/test_context.py` — the 6 stale tests.
  - `speckit-extension/scripts/write-context.py` / `derive-from-files.py` — source of truth for the current contract (read-only here).
  - `.github/workflows/ci.yml` — extend with the Python gate.
- **Source of truth**: production capture scripts, NOT the old tests.

## Current contract (re-derived from production code)

| Old (pre-#138) expectation | Current contract |
|---|---|
| history entry has `from: {step, substep}` | entry is `{step, substep, kind, by, at}`; no `from` |
| per-task entry mirrors id into `substep` (`substep == task`) | id lives in `task`; `substep` is None |
| step-level complete = `substep is None` | step-level complete = `substep is None AND task is None` (per-task completes also have `substep None`) |
| derive writes paired `start`+`complete` per task | derive is finish-only: one `complete` per task |

## Constitution Check

No constitution gates apply (test + CI hardening, no new product surface). PASS.

## Approach

1. Update the 6 stale tests in place, one per failing assertion, keeping each assertion's intent strong (still genuinely verifies append-only / per-task-distinct / step-complete-exclusivity / finish-only). No tautologies, no deletions.
2. Verify the full suite is green and that each change still fails on a simulated regression (reason about it; the assertions key on the exact current shape).
3. Add a `python-capture` step/job to `ci.yml`: set up Python, run the unittest discovery + `check-shape-parity.py`, on the same push/PR-to-main triggers. Match existing style (ubuntu-latest, single workflow, named steps).
4. Confirm no real production bug is hiding behind any of the 6 (all 6 are stale expectations — verified against the script behavior).

## Risk / no-regression

- TS untouched → `npm run compile && npm test` stay green.
- `check-shape-parity.py` untouched and run in CI.
- Only the 6 tests + `ci.yml` change; the other 37 tests and all production scripts are read-only.

## Phase artifacts

Lean profile: no separate research.md / data-model.md / contracts/ — the contract table above IS the design. tasks.md follows.
