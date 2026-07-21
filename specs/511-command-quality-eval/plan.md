# Implementation Plan: Command-Quality Eval

**Branch**: `511-command-quality-eval` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

## Summary

Add `check_quality.py` next to `check_capture.py` in the eval skill directory: a stdlib-only checker that scores a completed spec directory on verbosity (per-artifact line/char budgets with WARN/FAIL bands) and time-waste (untrusted step spans, out-of-band durations, the pre-#509 one-second task-finish burst), plus a static prompting pass over the shipped command-body sources (never-halts roster contains no user-prompt instruction, clarify must ask, negation- and fence-aware). It mirrors `check_capture.py`'s report/CLI shape (`--json`, `--strict`), gains unittest coverage in `speckit-extension/tests/`, and runs strict in the CI capture-suite job over the two committed fixture specs and the command sources.

## Project Structure

```
.claude/skills/eval-speckit-extension/
├── SKILL.md                    # gains the quality-eval step + assumption block
├── check_capture.py            # untouched (capture correctness)
└── check_quality.py            # NEW — the three-dimension quality checker

speckit-extension/
├── tests/test_check_quality.py # NEW — stdlib unittest, imports the checker via path insert
└── CHANGELOG.md                # [Unreleased] entry

.github/workflows/ci.yml        # capture-suite job: 3 strict eval steps
docs/capture-and-timing.md      # "The eval" section: note the quality sibling
```

**Structure Decision**: the checker lives with its sibling evals in the tracked skill dir (dev tooling, shipped in neither package — no packing-list impact); its tests live with the repo's only Python suite so CI's existing `unittest discover` picks them up with zero wiring.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS — thresholds and rosters are single-place constants in the checker; no user-facing settings introduced (an eval, not a feature toggle). |
| II. Spec-Driven Workflow | PASS — guards the pipeline's own command quality; touches no lifecycle logic or status writers. |
| III. Visual and Interactive | PASS (n/a) — dev/CI tooling; no UI surface. |
| IV. Modular Architecture | PASS — one focused script + one test module, mirroring the existing eval layout. |

No violations; Complexity Tracking omitted.

## Phase 0 — Research

See [research.md](./research.md).

## Phase 1 — Design

- [data-model.md](./data-model.md) — report rows, budget table, prompting roster.
- [contracts/cli.md](./contracts/cli.md) — the CLI contract (flags, modes, exit codes, JSON shape).
