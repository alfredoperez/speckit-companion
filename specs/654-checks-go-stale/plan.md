# Implementation Plan: A check says what code it ran on, and when that code moved

**Spec**: [spec.md](./spec.md) · **Source**: #963 (r2)

## Summary

`run_verification` records, after the command finishes, the short commit (`git rev-parse --short HEAD`) and a snapshot tree of the working files: the real index is copied to a temp file, `git add -A` runs against the copy and `git write-tree` names the tree, so the user's index is never touched. Any git failure leaves both fields out. On the host, the viewer passes `commit` and `tree` through `pickVerified` for run checks only, and a new enrichment beside `markMissingTests` asks git, per distinct tree, how many files changed since: changed tracked files from `git diff --name-only <tree>` plus untracked files that the tree does not hold, excluding `specs/` and `.specify/`. The Overview shows "at <commit>" on each run check and marks the stale ones OUT OF DATE with the count.

## Project Structure

```
apps/speckit-extension/scripts/capture.py          run_verification(feature_dir=), _code_at()
apps/speckit-extension/tests/test_verify_run.py    commit and tree in a git sandbox; none outside git
apps/vscode/src/core/types/specContext.ts          ViewerVerification commit, tree, changedSince
apps/vscode/src/features/spec-viewer/stateDerivation.ts      pickVerified passes commit/tree; markStaleChecks()
apps/vscode/src/features/spec-viewer/checkFreshness.ts       new: filesChangedSince(root, tree, git)
apps/vscode/src/features/spec-viewer/specViewerProvider.ts   enrichment beside markMissingTests
apps/vscode/src/features/living-specs/livingSpecsModel.ts    export GitRunner, makeDefaultGitRunner
apps/vscode/src/features/spec-viewer/__tests__/checkFreshness.test.ts   new
apps/vscode/src/features/spec-viewer/__tests__/verifiedProvenance.test.ts
apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx       commit line, OUT OF DATE, tone
apps/vscode/webview/styles/spec-viewer/_overview-dossier.css
apps/vscode/webview/src/spec-viewer/components/ActivityPanel.stories.tsx
apps/vscode/webview/src/spec-viewer/components/__tests__/OverviewDossier.test.tsx
```

**Structure Decision**: the writer records, the host compares, the webview only renders the count. The pure `markStaleChecks(verified, counts)` takes a resolved map so it is tested without git; `checkFreshness.ts` owns the git calls with an injected runner.

## Call paths

```calls record the code a check ran on
  append_verification_runs() @ apps/speckit-extension/scripts/capture.py:324
~   run_verification() @ apps/speckit-extension/scripts/capture.py:284
```

```calls mark stale checks
  readViewerState() @ apps/vscode/src/features/spec-viewer/specViewerProvider.ts:1532
+   filesChangedSince() **new** @ apps/vscode/src/features/spec-viewer/checkFreshness.ts
+   markStaleChecks() @ apps/vscode/src/features/spec-viewer/stateDerivation.ts:203
```
note: one git round per distinct tree per refresh, 1.5 s timeout, `GIT_OPTIONAL_LOCKS=0`; a failure leaves `changedSince` undefined.

## Screens

```screen verified Verified section
title: What was checked, and what happened
chip: 3 checked (changed) (1)
row:
  text: Unit tests
  text: at 4f2c9a1 (new)
row:
  text: End-to-end filters
  chip: OUT OF DATE (new) (2)
  text: at 1b07e3c, 2 files changed since (new)
```
1: **Amber when any check is out of date.** A green header over a stale row contradicts the row.
2: **Text, not colour alone.** The pill reads OUT OF DATE; the row is tinted amber and the line is amber.

## Constitution Check

| Principle | Assessment |
|---|---|
| The host owns the filesystem | PASS. Git runs on the host; the webview gets a number. |
| Writers keep the record's guarantees | PASS. Two more keys on a verified entry, written by the same appender; never-fail. |
| Repository text reaches a panel as text | PASS. `commit` and `tree` are hex-checked before git and render as text. |
| A user-writable value never becomes a git argument unchecked | PASS. `tree` must match `^[0-9a-f]{7,64}$`. |
