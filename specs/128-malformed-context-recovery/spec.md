# Spec: Malformed Spec-Context Recovery

**Slug**: 128-malformed-context-recovery | **Date**: 2026-06-05

## Summary

`.spec-context.json` drives the entire viewer UI (status badges, step tabs, lifecycle buttons, transition history). Today, when that file is syntactically broken (truncated write, hand edit, merge-conflict markers), the viewer silently falls back to an in-memory backfill and only logs to the output channel — the user sees a viewer that looks "reset" with no explanation, while the real broken file sits on disk. This feature surfaces the JSON parse error (message + file path) to the user when the viewer opens a spec with an unparseable context, and offers a one-click **Reset context** action that backs up the broken file and writes a fresh skeleton inferred from the current step.

## Requirements

- **R001** (MUST): When the viewer opens a spec whose `.spec-context.json` exists but fails `JSON.parse`, surface a user-visible error containing both the parse error message and the absolute file path, using the viewer's existing notification affordance (`vscode.window.showErrorMessage`).
- **R002** (MUST): The surfaced error MUST offer a **Reset context** action. Choosing it backs up the broken file to a sibling `.spec-context.json.bak-<timestamp>` and writes a fresh skeleton context, then reloads the viewer so it renders from the repaired file.
- **R003** (MUST): The reset MUST NOT delete or overwrite the broken file in place — the original bytes MUST survive in the `.bak-<timestamp>` copy so the user can recover lifecycle history manually.
- **R004** (MUST): The fresh skeleton MUST be derived from the same minimal-backfill path already used for missing context (`backfillMinimalContext`), recording only verifiable facts (workflow, specName, branch, `currentStep: "specify"`, `status: "draft"`, empty history) — never inferring step completion from file presence.
- **R005** (MUST): A spec whose context is simply missing (ENOENT) MUST keep its current behavior — silent backfill, no error toast. Only a parse failure on an existing file triggers the error surface.
- **R006** (SHOULD): When the viewer falls back to backfill because of a parse failure (e.g. user dismisses the toast without resetting), it MUST still render the spec read-only as it does today; the broken file is left untouched on disk.
- **R007** (SHOULD): The backup filename MUST be collision-safe — if a `.bak-<timestamp>` already exists for the chosen timestamp, the write MUST NOT clobber the prior backup.
- **R008** (MAY): The error message copy MAY include a short hint that a backup was/will be made, so the user understands resetting is non-destructive.

## Scenarios

### Opening a spec with a corrupt context file

**When** the user opens a spec in the viewer and its `.spec-context.json` contains invalid JSON (e.g. a merge-conflict marker)
**Then** the viewer shows an error notification stating the JSON is invalid, including the parse reason and the file path, with a **Reset context** button — and the viewer still renders the spec in a safe backfilled state rather than failing opaquely.

### Resetting a broken context

**When** the user clicks **Reset context** on that notification
**Then** the broken file is copied to `.spec-context.json.bak-<timestamp>`, a fresh skeleton `.spec-context.json` is written in its place, and the viewer reloads to reflect the repaired (draft / specify) state.

### Healthy or missing context is unaffected

**When** the user opens a spec whose context parses cleanly, or whose context file does not exist at all
**Then** no error notification appears and behavior is exactly as it is today (normal render, or silent minimal backfill for the missing case).

### Dismissing without resetting

**When** the user dismisses the parse-error notification without choosing **Reset context**
**Then** the broken file is left on disk untouched and the viewer continues to render the read-only backfill, so the user can still inspect the spec and fix the file by hand later.

## Non-Functional Requirements

- **NFR001** (MUST): Reliability — the reset MUST be atomic from the user's perspective: the backup copy is created before the skeleton is written, so a failure mid-reset never leaves the user with neither the original nor a valid skeleton.
- **NFR002** (SHOULD): Observability — both the detected parse failure and the reset action (with the backup path) MUST be written to the existing output channel for diagnostics.

## Out of Scope

- Auto-recovery beyond the explicit **Reset context** action (no automatic repair, no silent rewrite of malformed files).
- Semantic validation of context contents (unknown step IDs, missing transitions, schema-invalid-but-parseable files) — only JSON-syntactic parse failures are in scope.
- Surfacing parse failures from non-viewer code paths (the Explorer tree's `tryReadJsonSync` and the file watcher) — these may remain silent; this feature targets the viewer open path, which is the highest-pain surface.
- A bulk "scan all specs for corruption" command.
