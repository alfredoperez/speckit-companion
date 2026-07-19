# Implementation Plan: Drift and fold-back summaries report outcome, not intent

## Summary

Two reporting surfaces in the spec-kit extension announce what they set out to do rather than what they actually did. The drift command prints a green all-clear whenever no drift was *found*, which is trivially true when every capability was skipped and nothing was examined. The living-spec fold prints the delta counts it *parsed* out of a feature spec, even when those changes matched no heading and were dropped. The fix is the same shape in both places: carry the outcome alongside the result and render from the outcome. Drift's result object gains a checked count and keeps its existing skipped list, and its summary line branches on whether anything was actually checked; the fold's delta application returns what it applied so the log line counts applied changes instead of parsed ones. No new dependency, no new file — this is the project's existing Python stack under `speckit-extension/`.

## Project Structure

```
speckit-extension/
├── scripts/
│   ├── drift.py                  # compute_drift() result shape + render_human() summary
│   └── write-context.py          # apply_deltas() returns applied counts; fold_living_spec() logs them
├── tests/
│   └── test_living_specs.py      # DriftTests + the fold/apply_deltas tests both live here
├── README.md                     # "Spotting drift" paragraph documents the summary behavior
└── CHANGELOG.md                  # [Unreleased] entry
```

**Structure Decision**: Both scripts and both test suites already exist and are the natural homes — `test_living_specs.py` holds `DriftTests` and the `apply_deltas`/fold tests side by side, so every new regression test lands in one file with the existing sandbox helpers (`_bake_drift_repo`, `_write`, `_commit_all`). No new module is warranted; a shared "outcome reporter" abstraction across two scripts with different result shapes would be more indirection than the two call sites justify.

## Constitution Check

No `.specify/memory/constitution.md` is present in this project, so there are no formal principles to table. The governing conventions are `CLAUDE.md` and `.claude/review-checklist.md`; the plan is assessed against the ones this change can plausibly violate.

| Principle (from CLAUDE.md / review-checklist) | Assessment |
|---|---|
| Extension isolation — no runtime dependency on `.claude/**` or `.specify/**` | PASS — changes are confined to `speckit-extension/scripts/`, which ships in the extension archive. |
| Two extensions, two sets of docs | PASS — `speckit-extension/README.md` + `speckit-extension/CHANGELOG.md` only; root docs untouched, no VS Code extension code changed. |
| Feature branch must not bump `extension.yml` version or date a CHANGELOG section | PASS — the entry goes under `[Unreleased]`; the version, README badge, and `publishing.md` are left alone. |
| Code comments — default to none, one line max, no spec/PR ids | PASS — no narrative comments; the docstrings that change are the ones whose stated contract changes. |
| A new gate/checker needs a test proving it FAILS, one per drift direction | PASS — this is the driving test requirement; see Phase 1. Each new test is drift-proofed by reverting the production change and confirming a red. |
| Markdown formatting — no hard-wrapped paragraphs | PASS — every prose paragraph in this plan and the docs edits is one logical line. |
| Changelog voice — user-facing, no internal file/symbol names | PASS — the entry describes the output a user sees, not `render_human` or `apply_deltas`. |

No violations, so no Complexity Tracking table.

## Key design constraints carried from the spec

The disabled path must stay byte-identical: with living specs off, `render_human` returns the empty string and the command prints nothing. That is the documented opt-in contract and the fix must not turn a switched-off feature into a chatty one. Similarly, the fully-clean run must keep a recognizable success line — the goal is to narrow the claim, not delete it. And the exit code stays 0 in every case; the distinguishing signal a caller needs is carried in the result data, not in the process status.

## Phases

**Phase 0 — Research.** Settle the three genuine design choices: what the all-skipped line says, where the checked count lives in the result, and how the fold surfaces a dropped change. Recorded in `research.md`.

**Phase 1 — Design & contracts.** The drift result object is the one interface a consumer codes against (`--json` is documented in the README as feeding tooling and CI), so its shape is pinned in `contracts/`. The reshaped result and the applied-count structure are described in `data-model.md`.

**Phase 2 — Implementation** (handled by the tasks step). Drift first, since it is the filed ticket and its result shape is the wider change; the fold second, as an independent contained edit; tests alongside each; docs last.
