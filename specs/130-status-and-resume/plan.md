# Implementation Plan: Status + Resume (v1 boundary)

**Branch**: `130-status-and-resume` | **Date**: 2026-06-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/130-status-and-resume/spec.md`

## Summary

Ship the two surfaces that make captured spec state actionable. `/speckit.companion.status` reads the canonical `.spec-context.json` (falling back to `derive-from-files.py` when it is absent) and prints current step, status, recorded decisions, and the next action. `/speckit.companion.resume` resolves the next pipeline step from that same state — carrying `decisions[]` into scope — and dispatches the corresponding `/speckit.*` command, continuing at the next unchecked task when inside the tasks step. The Companion sidebar surfaces the same canonical data (current step, status badge, last transition) and adds an inline **Resume** action that dispatches resume through the existing AI-provider path; the sidebar updates live via the existing `.spec-context.json` watchers. This is the v1 ship point: a stock spec-kit user installs Companion and gets tracking plus resume on their existing flow, with zero template changes.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict) for the extension; Python 3 for the companion command scripts (matches existing `write-context.py` / `derive-from-files.py`)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`); existing AI-provider dispatch (`dispatchSlashCommandViaTempFile`); existing spec-context reader (`specContextReader.ts`) and in-memory history derivation (`stepHistoryDerivation.ts`)
**Storage**: File-based — `.spec-context.json` per spec directory under workspace `.claude/specs/` (canonical `history[]`, plus passthrough `decisions[]`); no new storage
**Testing**: Jest (`ts-jest`, `tsconfig.test.json`) for extension code; Python `unittest` (`speckit-extension/tests/test_context.py`) for the new read/resolve script
**Target Platform**: VS Code 1.84+ on macOS / Linux / Windows
**Project Type**: single (VS Code extension + its installable `speckit-extension/` command package)
**Performance Goals**: status/resume resolution is effectively instant (single small JSON read + parse); sidebar refresh uses the existing debounced watcher
**Constraints**: Extension isolation — the two commands and the read/resolve script are Companion-owned and ship in the `speckit-extension/` package (same install path as the existing capture commands); they MUST NOT depend on `.claude/**` or `.specify/**` user files at runtime. Scripts MUST gracefully degrade when `python3` is unavailable (warn, exit 0, never fail the host command). Resume's pipeline-dispatch must tolerate the spec-kit workflow-engine version gap (see Constraints note in research).
**Scale/Scope**: Two new command markdown files, one new Python script (+ tests), and additive sidebar wiring (one inline action, tree-item description/tooltip enrichment, one derivation helper). No new webview.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Extensibility and Configuration** — PASS. Both commands are additive and config-free; they read existing canonical state. No provider coupling introduced; the Resume dispatch reuses the provider-agnostic dispatch path, so it works across every AI provider.
- **II. Spec-Driven Workflow** — PASS. The feature directly enhances the non-negotiable Specify → Plan → Tasks → Implement pipeline (status reports position; resume advances it). It respects the Active → Completed → Archived lifecycle: resume reports "complete" rather than re-running when the spec is at a terminal state, and the sidebar Resume action is gated to active specs. Each dispatched step still produces/consumes its markdown artifact.
- **III. Visual and Interactive** — PASS. The two commands are paired with GUI surfacing (status badge, last-transition display, inline Resume button) so the capability is visual and interactive, not CLI-only.
- **IV. Modular Architecture for Complex Features** — PASS. Changes are modest, additive edits to the existing `specExplorerProvider.ts` plus one small derivation helper and one Python script. No feature crosses the 3–4 file / new-webview threshold that would require a new modular split.

No violations. Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/130-status-and-resume/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── status-command.md
│   └── resume-command.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
speckit-extension/                         # Companion-owned, installable command package
├── commands/
│   ├── speckit.companion.status.md         # NEW — read state, print step/status/decisions/next action
│   └── speckit.companion.resume.md         # NEW — resolve next step, carry decisions, dispatch next command
├── scripts/
│   ├── status-context.py                   # NEW — read-or-derive state, emit summary + next-step resolution (JSON + human)
│   ├── write-context.py                    # EXISTING — unchanged
│   └── derive-from-files.py                # EXISTING — reused as the fallback resolver
└── tests/
    └── test_context.py                     # EXTEND — cases for status-context.py (read, derive fallback, next-step, terminal)

src/features/specs/
├── specExplorerProvider.ts                 # EDIT — tree-item description/tooltip: current step + last transition; inline Resume on active specs
├── specCommands.ts                         # EDIT — register `speckit.specs.resume` command → dispatch /speckit.companion.resume via provider
└── lastTransition.ts                       # NEW — derive "last transition" label from ctx.history[] (in-memory, no persistence)

package.json                                # EDIT — contributes.commands (speckit.specs.resume) + view/item/context inline entry gated to active lifecycle

src/ai-providers/                           # REUSED — dispatchSlashCommandViaTempFile for the Resume action; no new code expected
```

**Structure Decision**: Single-project VS Code extension. New runtime behavior splits along the established seam: the two user-invokable commands and their read/resolve logic live in the Companion-owned `speckit-extension/` package (the same place the capture hooks already live and install from), while the GUI surfacing is additive wiring inside the existing `src/features/specs/` sidebar provider plus one new in-memory derivation helper. No new modules cross the constitution's modularity threshold.

## Complexity Tracking

> No constitution violations — section intentionally empty.
