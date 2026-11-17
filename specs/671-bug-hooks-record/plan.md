# Implementation Plan: Record bug runs through the bug hooks

**Spec**: [spec.md](./spec.md)

## Summary

Companion registers the six hooks spec-kit's bundled bug extension fires (`before_bug_*` and `after_bug_*` for assess, fix and test). Each hook runs one line that calls the existing record writer with a new `--bug <slug>` flag, which points the write at `.specify/bugs/<slug>/.spec-context.json` and allows the three bug stages as steps. A finish reads the stage's outcome from the report the bug command just wrote. The Bugs pane turns that record into the same Run log the page already shows for engine runs, and uses it only when the bug has no engine run, so a stage is never shown twice.

## Project Structure

```
apps/speckit-extension/
  extension.yml                                  six hooks, two commands
  commands/speckit.companion.before-bug.md       new, one line
  commands/speckit.companion.after-bug.md        new, one line
  scripts/write-context.py                       --bug flag, outcome on finish
  tests/test_bug_hooks.py                        new
  CHANGELOG.md
apps/vscode/src/features/
  bugs/bugRecord.ts                              new: record -> EngineRun shape
  bugs/__tests__/bugRecord.test.ts               new
  reports/bugStory.ts                            record run when no engine run
  reports/reportPageModel.ts                     BugEngineView.source
apps/vscode/webview/src/spec-viewer/report-pages/
  BugStoryPage.tsx                               Run log caption by source
  __stories__ or sibling stories                 a recorded-run story
CHANGELOG.md
```

**Structure Decision**: no new writer and no new reader. The writer gains one flag; the pane maps the record onto the engine view it already renders.

## Calls

```
spec-kit bug command ── hooks.before_bug_fix ──▶ speckit.companion.before-bug
    └─ write-context.py --hook start --bug <slug> --step fix
         └─ .specify/bugs/<slug>/.spec-context.json  (history += start, by: ai)
spec-kit bug command ── hooks.after_bug_fix ──▶ speckit.companion.after-bug
    └─ write-context.py --hook finish --bug <slug> --step fix
         └─ reads fix.md "Status" ─▶ history += complete, did: <outcome>
Bugs pane ── readBugReport ── engine run? ──yes──▶ engineView (as today)
                                      └──no───▶ recordRun(.spec-context.json) ─▶ engineView(source: record)
```

## Constitution Check

| Principle | Assessment |
|---|---|
| One store, one writer (CLAUDE.md) | PASS: the existing writer and lock, a new target folder only |
| Host owns the filesystem | PASS: the extension host reads the record; the webview gets the view by message |
| Repository text reaches panels as text | PASS: the outcome renders through Preact text nodes |
| Extension isolation | PASS: hooks ship in `extension.yml`; nothing edits `.specify/**` by hand |
| No retired toggles | PASS |
