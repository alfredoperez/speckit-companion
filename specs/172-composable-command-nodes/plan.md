# Implementation Plan: Composable Command Nodes

**Branch**: `172-composable-command-nodes` | **Date**: 2026-06-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/172-composable-command-nodes/spec.md`

## Summary

Reshape the `/speckit.companion.*` command files so each cross-cutting rule (sizing, routing, timing) is authored exactly once as a shared "part" and assembled into whole, self-contained command bodies. The committed/shipped files stay whole so a plain terminal still reads a complete command; a byte-for-byte parity gate proves the reshape changes no behavior. The work is staged: **P1** lands a provable byte-for-byte refactor, **P2** collapses the duplicated definitions to one each, **P3** adds the agentic-CLI self-advance handoff and makes **mark-complete** a first-class terminal node of the Companion workflow that lands the run at `completed`. Stock SpecKit keeps stopping at `implemented`.

## Technical Context

**Language/Version**: Python 3 (build + parity + capture scripts, `write-context.py`); TypeScript 5.3+ / ES2022 strict (the VS Code `src/` revert); Markdown (command bodies, parts) and YAML (workflow definition)
**Primary Dependencies**: spec-kit CLI (`specify`, workflow engine, preset/extension install); existing `speckit-extension/scripts/{write-context,derive-from-files,check-shape-parity}.py`; VS Code Extension API for the `src/` revert
**Storage**: File-based — command `.md` bodies, `_parts/*.md`, `speckit-companion.workflow.yml`, golden snapshot fixtures, `.spec-context.json` per spec
**Testing**: `pytest` (`speckit-extension/tests/test_context.py`); the extended `check-shape-parity.py` as the parity gate; `eval-speckit-extension` for end-to-end capture; manual agentic-CLI vs plain-terminal verification for US3
**Target Platform**: Developer tooling — spec-kit CLI + VS Code extension (macOS/Linux/Windows shells)
**Project Type**: Single repo, two extensions; this change is almost entirely in `speckit-extension/` plus a small revert in the VS Code `src/`
**Performance Goals**: N/A (authoring/build-time tooling; assembly is a fast deterministic file pass)
**Constraints**: Byte-for-byte parity vs golden (SC-001); shipped command files must be whole/self-contained (SC-004); capture output unchanged (SC-007); single completed-writer — reuse `write-context.py` mark-complete, add no second writer
**Scale/Scope**: ~11 command bodies, 4 shared parts, 1 workflow definition, 3 small Python scripts (build/parity/capture), 1 focused `src/` revert

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Extensibility and Configuration** — PASS. Adding a pipeline step becomes a single-place edit (SC-003); shared rules live once. No provider or setting surface changes.
- **II. Spec-Driven Workflow** — PASS. The Specify→Plan→Tasks→Implement pipeline is preserved byte-for-byte (P1). The terminal mark-complete node advances the Companion lifecycle to `completed` via an explicit node run (engine on the self-advancing path, or a manual/panel action otherwise) — it remains an explicit transition, not a heuristic inference. Stock keeps stopping at `implemented`.
- **III. Visual and Interactive** — PASS (with noted exception). This is deliberately developer-facing tooling, not a UI feature; Principle III is a SHOULD. The change reduces, not adds, panel logic (FR-015 revert moves driving logic out of the panel into the commands).
- **IV. Modular Architecture** — PASS. Decomposition increases modularity: one definition per shared rule, command bodies composed from parts.

No violations require justification. Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/172-composable-command-nodes/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions (composition, parity, parts, revert)
├── data-model.md        # Phase 1 — parts/body/assembly/golden/node entities
├── quickstart.md        # Phase 1 — maintainer workflow + per-story verification
├── contracts/
│   └── assembly-and-parity.md   # build/parity/capture CLI + terminal-node contracts
└── tasks.md             # Phase 2 — created by /speckit.tasks (not here)
```

### Source Code (repository root)

```text
speckit-extension/
├── presets/
│   ├── _parts/                         # NEW — single-source shared blocks
│   │   ├── sizing.md                   #   small/large + 5-files/10-tasks thresholds
│   │   ├── routing.md                  #   which step runs next given size
│   │   ├── timing.md                   #   relocated from _shared/timing-partial.md
│   │   └── self-advance.md             #   agentic-CLI handoff text (US3)
│   ├── _shared/timing-partial.md       # REMOVED/relocated into _parts/timing.md
│   └── companion-standard/commands/    # bodies re-fenced to include parts
├── commands/
│   ├── speckit.companion.specify.md    # sizing fence (was inline duplication)
│   ├── speckit.companion.plan.md       # self-advance + timing fences
│   ├── speckit.companion.tasks.md      # self-advance + timing fences
│   ├── speckit.companion.implement.md  # self-advance + timing fences
│   ├── speckit.companion.classify.md   # sizing fence (single threshold source)
│   └── speckit.companion.mark-complete.md   # terminal node command (in scope)
├── workflows/
│   └── speckit-companion.workflow.yml   # mark-complete as terminal node; switch refs sizing
├── scripts/
│   ├── build-commands.py               # NEW — assemble parts → whole bodies
│   ├── capture-golden.py               # NEW — one-time frozen reference
│   ├── check-shape-parity.py           # EXTENDED — region-equality + golden-equality gate
│   └── write-context.py                # UNCHANGED — sole completed-writer (mark_complete)
└── tests/
    ├── golden/commands/                # NEW — frozen reference snapshot
    └── test_context.py                 # UNCHANGED — capture regression net (SC-007)

src/features/
├── workflow-editor/workflow/specInfoParser.ts   # REVERT — stop deriving steps from workflow def
├── spec-viewer/specViewerProvider.ts            # REVERT — resolveWorkflowSteps → static pipeline
├── spec-viewer/messageHandlers.ts               # REVERT — drop workflow-def command lookup
└── workflows/workflowManager.ts                 # REVERT — getFeatureWorkflow step-driving path
```

**Structure Decision**: The reshape is contained almost entirely in `speckit-extension/` (parts, command bodies, three small Python scripts, the workflow definition). The only VS Code `src/` change is the FR-015 revert that moves pipeline-driving logic out of the spec-viewer panel and back to the static canonical pipeline + `.spec-context.json` status. No new module boundaries are introduced beyond `_parts/` and the build/capture scripts.

## Implementation Staging

- **P1 — provable byte-for-byte refactor (US1, FR-001/002/003):** capture the golden, introduce `_parts/` + the marker-fence convention, write `build-commands.py`, extend `check-shape-parity.py` into the golden+region gate. Re-assemble with no rule changes; the gate must be green before anything else.
- **P2 — one definition per rule (US2, FR-004/005/006/009):** extract sizing, routing, and timing into `_parts/`; re-fence the three sizing locations (`classify`, specify preset body, workflow `switch`) to the single `sizing` source; prove a one-place edit propagates.
- **P3 — self-advance + terminal node (US3, FR-007a/007b/010–015):** add the `self-advance` part to each pipeline command; make `mark-complete` a first-class terminal node in the workflow that runs after implement (+ optional commit) and writes `completed` through the existing `write-context.py` mark-complete writer; revert the panel-reads-workflow seams (FR-015). Verify the self-advancing Companion run lands at `completed` while stock stays at `implemented`, and a one-shot run stays manual.

## Complexity Tracking

> No constitution violations; section intentionally empty.
