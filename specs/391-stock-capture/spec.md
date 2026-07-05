# Feature Specification: Stock-mode capture — bundled writer + Activity-panel-complete prompts

**Feature**: 391-stock-capture
**Source**: [#408](https://github.com/alfredoperez/speckit-companion/issues/408)

## Overview

When the GUI dispatches a *stock* SpecKit command, it prepends instructions telling the AI how to record progress into the spec's context file. Those instructions point at a helper script that only exists when the companion spec-kit extension is installed — so in a genuinely stock workspace the recording silently fails and specs stick at "specifying" forever. And even where the script exists, stock runs record only lifecycle timing, while the Activity panel now presents a much richer story: the goal and its fences, decisions, checks, and requirement coverage. This change ships the writer inside the VS Code extension itself, points the prepended instructions at that always-present copy, and teaches stock runs to capture the same reasoning trail the companion pipeline records — verified end-to-end by a sandbox run that forces the exact prompts a GUI dispatch would send.

## User Scenarios & Testing

### User Story 1 - Stock specs stop sticking (Priority: P1)

A user on plain spec-kit (no companion extension) creates a spec from the GUI. The prepended instructions now reference a writer that actually exists, so when the AI finishes the step the spec's status advances and the next-step button appears — no more specs frozen at "specifying".

**Why this priority**: It's a shipped silent failure; every stock-workspace GUI user hits it today.

**Independent Test**: In a stock sandbox, dispatch specify with the forced preamble and confirm the context file's status advances when the AI self-closes.

**Acceptance Scenarios**:
1. **Given** a workspace with no companion extension, **When** the GUI prepends stock-mode instructions, **Then** every writer reference resolves to a file that exists on disk.
2. **Given** the AI follows the instructions, **When** the step ends, **Then** the spec's status advances past its in-progress state.
3. **Given** python3 is unavailable, **Then** the instructions degrade best-effort (skip silently) and the command itself still runs.

### User Story 2 - Stock runs fill the Activity panel (Priority: P1)

The same stock run also records what the Activity panel renders: the one-line intent, out-of-scope fence, working context, requirement titles at specify; the approach, decisions, and a step summary at plan; checks, per-requirement test coverage, and per-task journaling at implement.

**Why this priority**: This is the enhancement half — without it, stock users open the redesigned panel to an empty brief.

**Independent Test**: Run the sandbox pipeline and assert the resulting context file carries intent, expectations, context entries, titled requirements, at least one decision and one check, and journaled tasks.

**Acceptance Scenarios**:
1. **Given** a stock specify with the enriched preamble, **When** it completes, **Then** the context records intent, expectations, context entries, and every requirement with its one-line title.
2. **Given** a stock plan, **Then** approach, at least the genuine decisions, and a step summary are recorded.
3. **Given** a stock implement, **Then** each task's finish is journaled with a summary, checks are recorded as verified entries, and requirement coverage carries tests.
4. **Given** the companion extension IS installed and a companion command dispatches, **Then** the slim companion preamble is unchanged (the command bodies keep owning capture).

### User Story 3 - Proven by a forced-preamble sandbox run (Priority: P2)

A repeatable eval exercises the real thing: a stock spec-kit sandbox (no companion extension), the exact preamble text a GUI dispatch would prepend, the stock commands run with it, and assertions over the produced context file.

**Why this priority**: The bug shipped precisely because this path had no test; inspection is not proof.

**Independent Test**: The eval run itself.

**Acceptance Scenarios**:
1. **Given** the sandbox, **When** the forced-preamble pipeline runs, **Then** assertions pass: status advanced, ICE fields present, requirements titled, tasks journaled, checks recorded.
2. **Given** the preamble text changes in a future PR, **Then** the eval can be re-run against the new text without rebuilding the harness.

## Edge Cases

- Extension install path contains spaces → the prepended command must quote the script path.
- Workspace has the companion extension: stock dispatches may still occur (stock workflow chosen) — the bundled writer must behave identically to the workspace copy on the same context file.
- The bundled copy must never drift from the source script — single source of truth, copied at package time, never hand-edited.
- `speckit.aiContextInstructions` off → no preamble at all, unchanged.
- Older specs / missing context file → the writer already creates it; no new failure modes.
- Windows paths → the prepended path must be shell-safe on PowerShell as well as POSIX shells.

## Requirements

### Functional Requirements

- **FR-001**: The VS Code extension MUST ship the context writer inside its package, sourced at build time from the spec-kit extension's script (single source of truth, no second copy in git).
- **FR-002**: Stock-mode prepended instructions MUST reference the bundled writer by the extension's absolute install path (quoted), never the workspace-relative companion path.
- **FR-003**: The self-contradictory stock-mode prose MUST be corrected to match the new mechanism.
- **FR-004**: Stock-mode specify instructions MUST direct capture of intent, expectations, context entries, and per-requirement titles.
- **FR-005**: Stock-mode plan instructions MUST direct capture of approach, genuine decisions, and a step summary; stock-mode implement instructions MUST direct per-task finish journaling, verified checks, and per-requirement test coverage.
- **FR-006**: All new capture instructions MUST be best-effort — skip silently without python3 — and MUST NOT change companion-mode (slim) preambles.
- **FR-007**: The preamble builders MUST be unit-tested for: bundled-path reference (no workspace companion path in stock mode), quoting, and presence of the ICE-capture instructions per step.
- **FR-008**: A sandbox eval MUST exist that runs the stock pipeline with the forced GUI preamble in a companion-free workspace and asserts the context outcomes (status advanced, ICE present, titled requirements, journaled tasks, recorded checks).
- **FR-009**: Documentation MUST be updated in the same change: the capture model doc's stock-mode section and a root changelog entry.

## Key Entities

- **Bundled writer**: the packaged copy of the context-writer script; identity = byte-identical to the spec-kit extension source at package time.
- **Stock preamble**: the per-step instruction block prepended to stock dispatches; now parameterized by the extension install path.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Zero references to the workspace companion script path remain in stock-mode preamble output (asserted by unit test).
- **SC-002**: The sandbox eval passes: a companion-free stock run ends with status advanced and the context carrying intent, expectations, ≥1 context entry, all requirements titled, ≥1 decision, ≥1 verified check, and every task journaled.
- **SC-003**: The packaged extension contains the writer and it is byte-identical to the source script.
- **SC-004**: All jest suites and both tsc configs pass; companion-mode preamble output is byte-identical to before.

## Assumptions

- python3 remains the assumed runtime for capture, as everywhere else — best-effort, never blocking.
- The eval is a committed, re-runnable script under the repo's eval/bench area driven manually or by a skill; it is not wired into jest (it shells out to real CLIs).
- The Activity panel needs no changes — it already renders these fields.

## Verbatim Constraints

- Source of truth: `speckit-extension/scripts/write-context.py`.
- Stock preamble path form: the extension's absolute install path to the bundled copy, quoted.
