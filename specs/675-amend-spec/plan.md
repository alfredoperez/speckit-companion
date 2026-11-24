# Plan: Amend a spec after work has started

> **Scale note**: about 20 files in three areas: the run-record writer (Python), the viewer package and its VS Code copy (TypeScript), and a new command with its registrations and docs. Watch the writer: `amendments` is the first capture field that appends without de-dupe, and both write paths must treat a lone `--amend` as a capture call.

## Summary

A new flat command, `speckit.companion.amend`, edits the current `spec.md` in place and records the change as one entry in a new `amendments` list on `.spec-context.json`, written by `write-context.py --amend` or `--batch`. When requirements were added or removed it dispatches plan and then converge, which appends tasks without moving status backward; a wording change dispatches neither, and a removed requirement ends with a keep-or-remove decision. The viewer reads `amendments` and the Overview's intent block shows one "Amended" row after Replaces.

## Project Structure

```text
apps/speckit-extension/
├── scripts/capture.py              # append_amendments; BATCH_KEYS; _parsed_batch; apply_batch
├── scripts/write-context.py        # --amend; capture_mode; writer list; _CAPTURE_FLAGS; --batch help
├── tests/test_capture_fields.py    # append-only, batch, malformed batch
├── tests/test_cli_parity.py        # amend in the matrix; no lifecycle history
├── commands/speckit.companion.amend.md   # new flat body, copied from resume
├── extension.yml, README.md, docs/commands.md, CHANGELOG.md
.specify/extensions/.registry       # tracked; registered_commands.claude
apps/vscode/src/core/types/
├── spec-context.schema.json        # amendments property
└── specContext.ts                  # ViewerState copy
packages/viewer/src/
├── contract/specContext.ts, schemas.ts, viewerState.ts
├── core/stateDerivation.ts, overviewAvailability.ts
└── view/components/OverviewDossier.tsx
tests: stateDerivation.test.ts, OverviewDossier.test.tsx, overviewAvailability.test.ts, packages/viewer/tests/schemas.test.ts
story: apps/vscode/webview/src/spec-viewer/components/ActivityPanel.stories.tsx
.changeset/<name>.md
apps/website/src/content/docs/docs/{reference/commands.mdx, steps/index.mdx, results/the-overview.mdx}
CHANGELOG.md
```

**Structure Decision**: an additive list field, not a history kind, because every history reader treats an unknown kind as a start. A flat command body, so amend stays out of the Workflow Builder like resume and status.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: a new command; nothing configurable changes. |
| II. Spec-Driven Workflow | PASS: the spec stays the source of truth after work starts, with the change on the record. |
| III. Visual and Interactive | PASS: one Overview row, from existing row styles. |
| IV. Modular Architecture | PASS: the view reads the record through the contract; the host still owns the file. |

Re-checked after design: unchanged.
