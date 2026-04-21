# Implementation Plan: Reveal Spec Folder in OS File Browser

**Branch**: `069-reveal-spec-folder` | **Date**: 2026-04-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/069-reveal-spec-folder/spec.md`

## Summary

Add a right-click action on spec tree items that opens the spec's folder in the OS
file browser (Finder / File Explorer / default Linux file manager). The tree already
tracks each spec's workspace-relative path (`SpecTreeItem.specPath`), so the command
just resolves it to an absolute path and delegates to VS Code's built-in
`revealFileInOS` command. Gated to `viewItem == spec` so it does not appear on
steering docs, workflow entries, or sub-document rows.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`)
**Storage**: N/A (filesystem reveal only; no persisted state)
**Testing**: Jest + `ts-jest` via `tests/__mocks__/vscode.ts` extension mock
**Target Platform**: VS Code desktop on macOS, Windows, Linux
**Project Type**: Single-project VS Code extension
**Performance Goals**: Reveal action completes within 1s of click (SC-004)
**Constraints**: Must ship inside the packaged `.vsix`; no `.claude/**` or
`.specify/**` edits (extension isolation rule in CLAUDE.md)
**Scale/Scope**: One new command, one new context-menu entry, one handler
(~20 LOC + tests)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Extensibility and Configuration**: PASS — feature is a built-in action on
  the existing specs tree, reuses `SpecTreeItem.specPath`, and requires no new
  provider abstraction or setting.
- **II. Spec-Driven Workflow**: PASS — the action surfaces existing filesystem
  artifacts (spec.md / plan.md / tasks.md / `.spec-context.json`) without
  altering the Specify → Plan → Tasks → Implement pipeline or lifecycle states.
- **III. Visual and Interactive**: PASS — the action is exposed via the
  right-click context menu (GUI-first, not a bare command).
- **IV. Modular Architecture**: PASS — the feature is one handler in the
  existing `src/features/specs/specCommands.ts`; no new module split needed
  (well under the 3–4-file threshold).

No violations → no Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/069-reveal-spec-folder/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (produced by /speckit.tasks)
```

No `contracts/` directory: the feature exposes no external API, CLI schema, or
network interface — it is a VS Code-internal command invoked from a context
menu. Per the plan template: "Skip if project is purely internal."

### Source Code (repository root)

```text
src/
├── features/
│   └── specs/
│       ├── specCommands.ts          # ADD: speckit.specs.reveal handler (~20 LOC)
│       └── specCommands.test.ts     # ADD: reveal-command tests
└── core/
    └── constants.ts                 # (inspect) — add command id if Commands enum is used

package.json                         # ADD: command contribution + view/item/context entry
```

**Structure Decision**: Single-project VS Code extension layout (existing).
All changes live inside `src/features/specs/` and `package.json`. No webview,
no new module, no new directory — matches the "Option 1: Single project" branch
of the template.

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| —         | —          | —                                   |
