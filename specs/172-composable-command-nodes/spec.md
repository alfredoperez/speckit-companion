# Feature Specification: Composable Command Nodes

**Feature Branch**: `172-composable-command-nodes`
**Created**: 2026-06-14
**Status**: Draft
**Input**: GitHub issue [#308](https://github.com/alfredoperez/speckit-companion/issues/308) — "Break each Companion command into composable nodes that drive the next step"

## Overview

The Companion pipeline is driven by its `/speckit.companion.*` commands. Today each of those commands is a single hand-maintained file, and several of them repeat the same logic — how to size a change as small or large, how to route to the next step based on that size, and how to record timing. The size logic alone lives in three places at once, so a change to it means editing three files and hoping they stay in agreement.

This feature reshapes the commands so each repeated piece of logic exists exactly **once** and is shared, and so the pieces snap together like building blocks. A maintainer who wants to change "how a change gets sized" edits one block instead of hunting through several files. A person running a single command in a plain terminal still gets a complete, self-contained command — the building blocks are joined back into whole commands when the extension is installed, so nothing depends on the visual companion panel being open.

The work is deliberately staged so that nothing a user sees changes first: the reshaped commands must produce **identical** output to today's commands before any new behavior is added.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reshape with a provable safety net (Priority: P1)

A maintainer breaks the large command files into smaller shared blocks. Before trusting the change, they need proof that the reshaped commands behave exactly as the old ones did — no wording drift, no dropped instruction, no behavior change for anyone running the pipeline.

**Why this priority**: This is the foundation. Decomposition that silently changes command behavior would corrupt every downstream spec the pipeline touches. A byte-for-byte safety net is what makes the rest of the work safe to ship, so it must land first and on its own.

**Independent Test**: Capture today's installed commands as a frozen reference, perform the decomposition, re-join the blocks into whole commands, and confirm the result matches the reference exactly. Delivers value as a verified refactor even if no later story ships.

**Acceptance Scenarios**:

1. **Given** the current command files are captured as a reference set, **When** the commands are decomposed into blocks and re-joined, **Then** every assembled command matches its reference byte-for-byte.
2. **Given** the reshaped commands, **When** a maintainer runs the existing parity check, **Then** it reports no differences.
3. **Given** a person running any `/speckit.companion.*` command after the reshape, **When** the command executes, **Then** they observe the same behavior, prompts, and output they saw before the reshape.

---

### User Story 2 - One definition for shared logic (Priority: P2)

A maintainer needs to change how a change is sized (small vs. large), how the pipeline routes after sizing, or how timing is recorded. Today that means finding and editing the same logic in several files. After this change, each of those lives in exactly one shared block that every command points at.

**Why this priority**: This is the payoff that motivates the reshape — collapsing duplication so "change the rule once" is true. It depends on the P1 safety net being in place, but it is the reason the feature exists.

**Independent Test**: Locate the sizing logic, the routing logic, and the timing logic; confirm there is a single shared definition of each; change one and confirm every command that uses it reflects the change without further edits.

**Acceptance Scenarios**:

1. **Given** the reshaped command set, **When** a maintainer searches for the sizing rule, **Then** they find exactly one shared definition that the specify command, the standalone size step, and the workflow definition all reference.
2. **Given** the single shared sizing block, **When** a maintainer edits it, **Then** every command that relies on sizing reflects the edit after re-joining, with no other file touched.
3. **Given** the routing logic and the timing logic, **When** a maintainer inspects the command set, **Then** each exists as exactly one shared block rather than being repeated per command.

---

### User Story 3 - One node hands off to the next (Priority: P3)

A developer working in an agentic CLI runs one Companion step. When that step finishes, the assistant reads the workflow definition to learn what comes next and continues into that step on its own, pausing only where the workflow marks a review gate. After the implementation step (and any commit step) the workflow's final node is a terminal **mark-complete** node; the engine runs it and the Companion run lands in the final "completed" state. In a plain or one-shot environment, the steps stay manual and the developer (or the companion panel) advances them, and completion stays a manual action.

**Why this priority**: This is the new capability the reshape unlocks, but it sits on top of the first two stories and degrades gracefully where the environment can't carry it. It is valuable but not required for the refactor itself to ship.

**Independent Test**: In an agentic CLI, run the first step of a Companion pipeline and confirm it continues through subsequent steps per the workflow definition, stopping at gates and ending at "completed"; in a plain terminal, confirm the steps remain one-at-a-time.

**Acceptance Scenarios**:

1. **Given** an agentic CLI that keeps acting after a step, **When** a developer runs the first Companion step, **Then** each finished step continues into the next step named by the workflow definition.
2. **Given** a workflow gate, **When** a step that precedes the gate finishes, **Then** the run pauses at the gate for review rather than continuing past it.
3. **Given** a Companion run on the self-advancing path, **When** the implementation step finishes, **Then** the engine runs the terminal mark-complete node and the run lands in the "completed" state.
4. **Given** a plain or one-shot environment that stops after a step, **When** a step finishes, **Then** the run does not auto-advance and the next step is triggered manually.
5. **Given** the everyday flow, **When** a developer drives the pipeline, **Then** they are never required to invoke a separate headless run command.

### Edge Cases

- What happens when a command is run in a plain terminal with no extension and no companion panel installed? It must still read as a complete, self-contained command.
- What happens when the assembled output would differ from the reference even slightly? The parity check must fail loudly and block the change.
- What happens to the earlier work that taught the companion panel to read the workflow definition directly? That approach is the wrong layer and must be removed so this change lands cleanly in the commands.
- What happens at the final step of a Companion run that did not auto-advance? The terminal "completed" state is still reachable by the normal manual/click path.
- What happens when an assistant can only run one step and then stops? The handoff simply doesn't fire; the run stays valid and resumable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST capture the current set of assembled Companion commands as a frozen reference before any decomposition, so the reshape can be verified against it.
- **FR-002**: After decomposition, re-joining the blocks into whole commands MUST reproduce the reference command set byte-for-byte.
- **FR-003**: The existing parity check MUST be used as the gate that confirms the assembled output matches the reference, and it MUST fail when any difference exists.
- **FR-004**: The sizing logic (small vs. large change) MUST exist as exactly one shared definition, referenced by the specify command, the standalone size step, and the workflow definition.
- **FR-005**: The routing logic (which step runs next based on size) MUST exist as exactly one shared definition rather than being repeated across files.
- **FR-006**: The timing logic MUST exist as exactly one shared definition rather than being repeated across files.
- **FR-007**: The specify, plan, tasks, implement, and mark-complete commands MUST each be expressible as a composition of node/part blocks.
- **FR-007a**: The Companion workflow MUST define **mark-complete** as a first-class terminal node that runs after the implementation step (and any commit step). This feature owns that terminal node; it is no longer deferred to a separate effort.
- **FR-007b**: Stock SpecKit MUST NOT gain a terminal mark-complete node. The stock pipeline stops at the "implemented" state and completion remains a manual action; only the Companion workflow carries the terminal node.
- **FR-008**: At install time, the blocks MUST be joined into complete command files so that a plain terminal reads whole, self-contained commands with no dependency on the extension or companion panel.
- **FR-009**: Adding a new step to the pipeline MUST be achievable as a small, single-place edit rather than a change spread across multiple duplicated files.
- **FR-010**: On an environment whose assistant keeps acting after a step, each finished step MUST be able to continue into the next step named by the workflow definition.
- **FR-011**: Self-advance MUST pause at any review gate defined in the workflow rather than running past it.
- **FR-012**: A Companion run on the self-advancing path MUST reach the terminal "completed" state by the engine running the terminal mark-complete node after the implementation step. That node MUST write the completed state through the existing `write-context.py` mark-complete writer, which refuses to promote unless the spec is already in the "implemented" state. No second completed-writer may be introduced.
- **FR-013**: On an environment that stops after a single step, the pipeline MUST remain valid and advance manually (via a user action or the companion panel) with no auto-advance.
- **FR-014**: The everyday flow MUST NOT require invoking a separate headless/deterministic run command; that path stays available but optional for headless or CI use.
- **FR-015**: The earlier change that taught the companion panel to read the workflow definition directly MUST be reverted or shelved, so the driving logic lives in the commands rather than the panel.
- **FR-016**: Capture of spec progress MUST be unchanged by this work — the same progress and timing recording that happens today continues to happen after the reshape.

### Key Entities

- **Command node/part**: A reusable block of command instructions that can be composed with other blocks to form a whole command.
- **Assembled command**: The complete, self-contained command file produced by joining its blocks at install time; this is what a plain terminal reads.
- **Shared logic block**: A single definition of a cross-cutting rule (sizing, routing, timing) that multiple commands reference.
- **Workflow definition**: The ordered list of steps, gates, and routing that tells a finished step what comes next.
- **Reference (golden) command set**: The frozen snapshot of today's assembled commands used to prove the reshape changed no behavior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of assembled Companion commands match the frozen reference byte-for-byte after the reshape (parity check green) before any new behavior is introduced.
- **SC-002**: The sizing rule, the routing rule, and the timing rule each appear as exactly one shared definition (count of duplicate definitions drops to zero).
- **SC-003**: Adding a new pipeline step requires editing a single place, demonstrated by a one-line/one-block change rather than edits across three or more files.
- **SC-004**: A person running any Companion command in a plain terminal with no extension installed receives a complete, runnable command in 100% of cases.
- **SC-005**: On an agentic CLI, finishing the first step of a Companion run advances through every subsequent non-gated step automatically and ends at the "completed" state without manual step invocation.
- **SC-006**: On a one-shot environment, no step auto-advances, and the run remains resumable and completable by the normal manual path.
- **SC-007**: Spec progress and timing capture produce the same recorded results before and after the reshape (no regression in what gets captured).

## Assumptions

- The "users" of this feature are the maintainers of the Companion pipeline and the developers running its commands; this is developer-facing tooling, not an end-user UI change.
- "Byte-for-byte" parity is measured against the commands as they are assembled and installed today, using the existing parity checker as the comparison tool.
- Self-advance is the assistant following the workflow definition's "what's next" instructions, not a hard-coded loop; the deterministic headless run path remains available but is never required in the everyday flow.
- The terminal "completed" state is owned by this feature: the Companion workflow's terminal mark-complete node writes it through the existing `write-context.py` mark-complete writer. No file-watcher or VS Code-side completion logic is added — that layer is out of scope.
- Reverting the earlier panel-reads-workflow change does not remove any user-visible capability that this feature does not otherwise preserve.

## Dependencies

- **#306** — now scoped only to the sidebar "Completed" filter (show completed specs only); it no longer supplies the terminal step, which this feature owns.
- **#309** (auto-mode) — builds directly on this work; out of scope here.
- The sibling "template parts" ticket (Axis B) shares the same block/parts mechanism; coordinated but separate.
