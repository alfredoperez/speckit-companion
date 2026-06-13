# Feature Specification: Implement Lifecycle Reliability

**Branch**: `157-implement-lifecycle` | **Status**: implemented

## Summary

Make a finished implementation reliably show as done across both extensions: the capture writer settles the spec whose `tasks.md` it was handed (not whichever spec is "active"), the open viewer refreshes on its own when any step completes regardless of where specs are stored, and the in-flight indicator is consolidated onto the step tab with the redundant "Generating…" footer removed. Epic #277; also addresses the spec-discovery gap behind #270.

## Context (verification-first)

Several adjacent fixes already shipped. This spec delivers ONLY the genuinely-missing parts:

- **Child 1 (reliable settle) — ALREADY DONE by #244.** The always-on `tasks.md` watcher (`setupTasksWatcher`) calls `shouldCloseImplement` then `completeStep(specDir, 'implement', 'extension')`, which routes through `setStepCompleted` → `deriveCompletedStatus('implement')` = `implemented`. So a missed `after_implement` hook is already backstopped by the extension, writing both the implement self-close AND `status=implemented` off the file-watched path. No new work. Removing the GeneratingFooter's manual "Mark step complete" override (Child 4) is therefore safe.
- **Child 4 spinner settle on terminal status — ALREADY DONE by #255.** `StepTab` stops spinning the moment `status` settles. The sync glyph itself shipped in #229. The residual is: the glyph is suppressed during the implement-percent state, and the redundant footer still exists.

## Requirements

### Child 2 — Capture writer settles the spec named by `--tasks-file`

- **FR-201**: When `--tasks-file` is supplied and `--feature-dir` is NOT, the writer derives the feature directory from the tasks file's parent directory, overriding the active-feature pointer precedence (`SPECIFY_FEATURE_DIRECTORY` / `SPECIFY_FEATURE` / `.specify/feature.json` / git branch). The spec whose task list is passed is the spec that gets updated.
- **FR-202**: When BOTH `--feature-dir` and `--tasks-file` are supplied and they resolve to different directories, the writer errors (does not silently write to either) so a mismatch is surfaced, never absorbed.
- **FR-203**: The `--tasks-file` parent only constrains resolution in task-sync mode (`--tasks-file` present). Step-mode and `--task` finish-mode resolution are unchanged.
- **FR-204**: A Python regression test asserts the `--tasks-file`-derived feature dir wins over a conflicting active-feature pointer, and that a `--feature-dir`/`--tasks-file` mismatch raises.

### Child 3 — Viewer refreshes on step completion over configured spec dirs

- **FR-301**: A file-system watcher observes `.spec-context.json` writes under every configured spec directory pattern (`**/${pattern}/**/.spec-context.json` from `getFileWatcherPatterns`), wired to the same `handleSpecContextChange` → `refreshContextIfDisplaying` path the `.claude` watcher uses.
- **FR-302**: The existing `**/.claude/**/*` watcher is retained for back-compat (legacy `.claude/specs/` layouts).
- **FR-303**: Completing any step (specify / plan / tasks / implement) updates the open viewer within a debounce window with no manual interaction and without depending on a co-written markdown file changing.

### #270 — Newly-created specs appear (discovery + refresh)

- **FR-270a**: Specs created under `.specify/specs/<name>/` are discovered, so the welcome screen clears and the spec is listed. The default `specDirectories` includes `.specify/specs` alongside `specs`.
- **FR-270b**: A newly-created spec's `.spec-context.json` / `spec.md` write triggers a sidebar tree refresh so the spec appears without reloading the window. (The spec-context watcher from FR-301, applied over the `.specify/specs` pattern, plus a tree refresh on create, covers this.)

### Child 4 — Consolidate in-flight spinner onto the step tab

- **FR-401**: The "Generating…" footer pill is removed. `FooterActions` no longer renders a `GeneratingFooter`; the `GeneratingFooter` component and its file are deleted.
- **FR-402**: While the current step is in flight (`specifying` / `planning` / `tasking` / `implementing`), the footer does not surface the next-step lifecycle button.
- **FR-403**: During the implement step, `StepTab` shows BOTH the percent label and the spinning sync glyph (previously the percent label suppressed the glyph), so the implement tab has motion.
- **FR-404**: The recovery-timeout net in `FooterActions` (`RECOVERY_TIMEOUT_MS`, `timedOut`, `forceTick`) is removed — `StepTab` already stops on settled status (#255), so the strand-guard is obsolete.
- **FR-405**: Reduced-motion users get a non-animated equivalent of the in-flight glyph.

## Non-Goals

- No change to the `after_implement` hook contract or the turbo implement command's self-close prohibition (Child 1 backstop already covers it).
- No reordering of any dogfood `.spec-context.json` history (would fabricate timestamps).
- No root `package.json` version bump (rides `/ship`).
