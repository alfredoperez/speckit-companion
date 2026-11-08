# Implementation Plan: Review depth follows a risk tier the code computes

**Spec**: [spec.md](./spec.md) · **Source**: #963 (r7)

## Summary

A new `risk_tier` writer in `capture.py` lists the files the change touches (the merge base with `origin/main`, `main`, `origin/master` or `master`, against the working tree, plus untracked files, outside `specs/` and `.specify/`), matches them against default and project globs with the resolver's `**` matcher, and stores `risk = {tier, computed, reasons, raised?}`. `--risk` computes; `--risk-raise TIER REASON` only raises, and recomputing keeps the higher of the computed tier and the raise. Implement's record node runs `--risk` after validation and sets the review depth from the tier; this repo's review hook reads it. The viewer picks `risk` like `classification`, and Verified shows a "Review depth" pill.

## Project Structure

```
apps/speckit-extension/scripts/capture.py            compute_risk, set_risk, raise_risk
apps/speckit-extension/scripts/write-context.py      --risk, --risk-raise TIER REASON
apps/speckit-extension/nodes/implement/record-verified.md   one paragraph: compute, raise, depth
apps/speckit-extension/commands/speckit.companion.implement.md   rebuilt
apps/speckit-extension/tests/test_risk_tier.py       new
.specify/companion.yml                               this repo's review hook follows the tier; risk.high adds its three places
apps/vscode/src/core/types/specContext.ts            RiskEntry on SpecContext and ViewerState
apps/vscode/src/core/types/spec-context.schema.json
apps/vscode/src/features/spec-viewer/stateDerivation.ts   pickRisk
apps/vscode/webview/src/spec-viewer/types.ts         re-export RiskEntry, ViewerState.risk
apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx   SectionHead aside, depth pill
apps/vscode/webview/styles/spec-viewer/_overview-dossier.css
```

**Structure Decision**: one writer computes and owns `risk`; the raise is a separate call that can only add caution; the viewer reads the stored object and computes nothing.

## Call paths

```calls compute and raise
  main() @ apps/speckit-extension/scripts/write-context.py:1398
+   set_risk() @ apps/speckit-extension/scripts/capture.py:695
+   raise_risk() @ apps/speckit-extension/scripts/capture.py:695
```
note: both write through `read_ctx` / `atomic_write`; a git failure yields `normal` with a reason, never an error.

```calls show it
  deriveViewerState() @ apps/vscode/src/features/spec-viewer/stateDerivation.ts:410
+   pickRisk() @ apps/vscode/src/features/spec-viewer/stateDerivation.ts:232
```

## Screens

```screen verified Verified section head
title: What was checked, and what happened
row:
  chip: Review depth: high · raised by the agent: "touches the orders query" (new) (1)
  chip: 3 checked
```
1: **Amber for high, plain otherwise.** It wraps under the title on narrow panes.

## Constitution Check

| Principle | Assessment |
|---|---|
| Writers keep the record's guarantees | PASS. One lock; a raise only adds; never-fail. |
| The host owns the filesystem | PASS. Git runs in the writer; the viewer reads the stored tier. |
| Repository text reaches a panel as text | PASS. Reasons render as text. |

## Key Decisions

- **Tier order low < normal < high; the tier in force is the max of computed and raised.** Recomputing can never lower a raise.
- **Unreadable change → normal**, with the reason; an empty change → low.
- **Project globs extend the defaults** under `risk.high` and `risk.low` in `.specify/companion.yml`.
