# A hook anchored to a name that means two things is drawn once

The pipeline board draws a project's hooks three times over: once at the step's own edges when the hook's anchor matches the command name, once on a phase whose name matches, and once on a node whose id matches. The three checks are independent and none of them knows another one fired, so a hook whose anchor name means two things at once appears twice on the board.

This needs no project configuration to reach. The shipped `auto` step has a phase and a node both called `orchestrate`, so any hook attached there is drawn twice today.

The run itself is not confused. The builder that splices hooks into a command body already resolves each hook to exactly one place and stops there, so the hook runs once. Only the picture disagrees with the run.

## User Scenarios & Testing

### User Story 1 - The board shows one hook where one hook runs (Priority: P1)

Someone attaches a hook to `orchestrate` on the `auto` step and opens the pipeline board. They see one hook chip, on the boundary where that hook will actually run. The header's tally counts one. Nothing about the picture suggests the hook fires twice.

**Why this priority** — this is the whole defect. A board that shows two of something that happens once is teaching the reader something false about their own pipeline, and the reader has no way to tell which of the two chips is real.

**Independent Test** — attach one hook to a name that is both a phase and a node in the same step, open the board, and count the chips for that hook. Exactly one.

**Acceptance Scenarios**

1. **Given** a hook attached to `orchestrate` on the `auto` step, **When** the board is drawn, **Then** exactly one chip appears for that hook.
2. **Given** that same hook, **When** the board is drawn, **Then** the chip sits on the boundary the built command body puts the hook at, not on a different one.
3. **Given** a hook whose anchor name matches exactly one thing, **When** the board is drawn, **Then** it appears exactly where it did before this change.

### User Story 2 - The count agrees with the picture (Priority: P1)

The header's hook tally is counted by walking the board, so a hook drawn twice was counted twice. With the hook drawn once, the number and the picture say the same thing without the tally needing its own rule for the ambiguous case.

**Why this priority** — same slice of work, and shipping the draw fix without it would leave a header that disagrees with what the reader is looking at.

**Independent Test** — attach one ambiguous hook, read the header count, count the chips. Both say one.

**Acceptance Scenarios**

1. **Given** a project with one hook anchored to an ambiguous name, **When** the board loads, **Then** the header reports one attached hook.
2. **Given** the pipeline is the shipped one so the project's hooks are parked, **When** the board loads, **Then** the parked hook is drawn once and the parked count reads one.

### User Story 3 - A hook that is written but not running follows the same rule (Priority: P2)

When a project runs the shipped pipeline, its own hooks are parked rather than fired, and the board shows them greyed. Parked hooks resolve to a boundary by the same rule as running ones, so a parked hook on an ambiguous name is also drawn once.

**Why this priority** — it is the same code path and costs nothing extra, but it only matters to projects that have bypassed their own configuration.

**Independent Test** — bypass the project pipeline, attach a parked hook to an ambiguous name, confirm one greyed chip.

**Acceptance Scenarios**

1. **Given** a parked hook anchored to a name that is both a phase and a node, **When** the board is drawn, **Then** it appears once, at the same boundary a running hook would.

## Edge Cases

- A hook anchored to a name that is simultaneously the step name, a phase name, and a node id — one chip, at the boundary that wins.
- A hook anchored to a name that matches nothing in the step's current shape — unchanged: it is warned about and skipped, exactly as today.
- Two different hooks attached to the same ambiguous name — each is drawn once, and their declared order is preserved.
- A recipe that drops the node half of an ambiguous pair, leaving only the phase — the hook falls through to the phase and is drawn there.
- Two phases sharing a name — already refused when the configuration is read; this change does not touch that.

## Requirements

### Functional Requirements

- **FR-001**: The pipeline board MUST draw each attached hook exactly once, no matter how many of the step's boundaries its anchor name matches.
- **FR-002**: The boundary a hook is drawn at MUST be the boundary the built command body actually places that hook at, so the board never points at a place the hook does not run.
- **FR-003**: The precedence that resolves an ambiguous anchor MUST be defined in one place and used by both the board and the builder, so the two cannot drift apart.
- **FR-004**: The header's hook tally MUST agree with the number of hook chips on the board, for running and parked hooks alike.
- **FR-005**: A hook whose anchor matches exactly one boundary MUST be drawn where it is drawn today.
- **FR-006**: An anchor that matches no boundary in the step MUST keep its current behaviour — a warning, and the hook skipped.
- **FR-007**: Parked hooks MUST resolve to a boundary by the same rule as running hooks.
- **FR-008**: A phase and a node sharing a name MUST remain legal configuration, since the shipped `auto` step already does it.

## Key Entities

- **Hook** — one piece of work a project attaches to a step. Carries when it runs (`before` or `after`), the anchor name it is attached to, its declared order, and what it does.
- **Anchor** — the name a hook is attached to. May match the step's own name, a phase name, or a node id, and today may match more than one of them at once.
- **Boundary** — the concrete place a hook is drawn and run: a step edge, a phase edge, or a node edge.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A hook attached to `orchestrate` on the `auto` step produces exactly 1 chip on the board, down from 2.
- **SC-002**: For every hook in a project's configuration, the number of chips on the board equals the number of places the built command body puts that hook — always 1.
- **SC-003**: The header's attached-hook count equals the chip count on the board in 100% of configurations, including ones with ambiguous anchors.
- **SC-004**: No project configuration that builds successfully today fails to build after the change.

## Assumptions

- **The winning boundary is whichever one the builder already picks, not the "most specific" one the issue proposes.** The issue suggests node beats phase beats step. The builder resolves the step's own name first, then node, then phase. Those agree except when a node shares the step's name, and there the board must follow the builder, because a chip that points somewhere the hook does not run is the same defect in a new place. Sharing one precedence definition between the two is what FR-003 is for.
- **Refusing the ambiguity at write time is out of scope.** The issue offers it as a second option. It cannot be taken as written: the shipped `auto` step already has a phase and a node both named `orchestrate`, so refusing ambiguous anchors would refuse a hook on a name Companion itself ships. Drawing it once is the whole fix.
- The board's drawing code needs no change — deduplicating where the graph is emitted means each hook reaches the canvas in exactly one list.

## Verbatim Constraints

- `orchestrate` — the phase and node name on the `auto` step that reproduces this without any project configuration.
- `speckit-extension/scripts/pipeline-graph.py` — the three independent anchor checks.
- `webview/src/pipeline-builder/counts.ts` — the tally counted off the board.

## Approach

- Resolve each hook to one boundary where the graph is built, rather than letting three filters each claim it.
- Put the precedence in `speckit-extension/scripts/hook_render.py`, beside the splice logic that already implements it, and have `pipeline-graph.py` call it. One definition, two readers.
- In `pipeline-graph.py`, resolve every hook for a step to its winning boundary once, then have the step, phase, and node hook lists read from that resolution instead of re-testing the anchor name.
- `webview/src/pipeline-builder/Canvas.tsx` and `counts.ts` need no change: they read what the graph emits.
- Cover it in `speckit-extension/tests/test_pipeline_graph.py` with the `auto` + `orchestrate` case.

## ADDED Requirements
<!-- capability: capture-runtime -->

### A hook's anchor resolves to exactly one boundary, by one shared definition

An anchor name MAY match the step's own name, a phase name, and a node id at once, so something SHALL pick one: the step's name first, then a node, then a phase. That precedence SHALL live in one place, and both the body assembly and the structure a panel draws from SHALL read it, so the place a hook is drawn is always the place it runs. A name that matches nothing SHALL keep being warned about and skipped, and a phase and a node MAY continue to share a name.

#### Scenario: a hook is attached to a name that is both a phase and a node
- **WHEN** the pipeline structure is built
- **THEN** the hook is emitted once, on the boundary the assembled body places it at
