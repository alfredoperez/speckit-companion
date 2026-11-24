# Workflow Builder lanes

## User Scenarios & Testing

### User Story 1 - Read the run as bounded lanes (Priority: P1)

Someone opens the Workflow Builder in a wide editor. Each step of the run is a clearly bounded panel with a header band that names the step, its place in the run and its counts. An arrow between the lane headers shows which step runs next. Inside a lane, phases are quiet labels above their nodes.

**Why this priority**: The lane is the frame every later redesign slice (the card, the hook modal) sits inside.

**Independent Test**: Open the builder at a wide width and see one bordered panel per step, a header band on each, and an arrow between each pair of lanes.

**Acceptance Scenarios**:

1. **Given** a run of four steps, **When** the builder is wide, **Then** four lanes sit side by side with three run-order arrows between their headers.
2. **Given** a lane, **When** it is read, **Then** its header shows the step number, the step name and the node count, and the phases inside read as small labels, not as ruled bands.
3. **Given** a run of one step, **When** the builder opens, **Then** no arrow is drawn.

### User Story 2 - Read the run stacked when narrow (Priority: P1)

Someone docks the builder in a side panel. The lanes stack top to bottom at the panel's full width, and between two lanes a down arrow reads "then <next step>".

**Why this priority**: The side panel is a common place to keep the builder, and a sideways scroll there hides most of the run.

**Independent Test**: Open the builder at 380px wide and see full-width lanes with "then plan", "then tasks" lines between them.

**Acceptance Scenarios**:

1. **Given** the builder under the narrow breakpoint, **When** it renders, **Then** each lane takes the full width and the header puts number, name and counts on one line.
2. **Given** two stacked lanes, **When** they are read, **Then** a down arrow and the words "then <next step>" sit between them.

### User Story 3 - Nothing the board did is lost (Priority: P1)

Every control the board had keeps working inside the new lanes: opening a step's instructions, the document-shape chip, the changed summary, adding a step between two lanes, the phase menu, renaming a phase, dragging nodes and hooks, decisions, and the tail with "Add step" and the steps outside the run.

**Why this priority**: The redesign must not take away a single action.

**Independent Test**: Run the existing builder tests; each still passes, and "Add a step after <step>" is still reachable from the join between two lanes.

**Acceptance Scenarios**:

1. **Given** the join between tasks and implement, **When** its add control is pressed, **Then** the new-step form opens to run after tasks.
2. **Given** a keyboard user, **When** they tab through the board, **Then** every control in a lane, and the add control at each join, shows a visible focus ring.

### Edge Cases

- A step with no phase still shows "Add the first phase" inside its lane.
- A long step name clips with an ellipsis inside the header band rather than widening the lane.
- A lane header stays in view while its nodes scroll past.
- Under reduced motion nothing on the lanes animates.
- Light, dark and high-contrast themes all draw the lane edge and header band from the user's theme.

## Requirements

### Functional Requirements

- **FR-001**: Each step in the run MUST render as a bordered panel with a header band separated from its body by a rule.
- **FR-002**: When the builder is wide, lanes MUST sit side by side with a run-order arrow between each pair of lane headers.
- **FR-003**: When the builder's own width is under the narrow breakpoint, lanes MUST stack at full width with a down arrow and the words "then <next step>" between each pair.
- **FR-004**: Phase names MUST read as quiet labels inside the lane, with no rule line, and keep rename and the phase menu.
- **FR-005**: The join between two lanes MUST keep the "Add a step after <step>" control, as a real button with an accessible name and a visible focus ring.
- **FR-006**: Every existing board action MUST keep working inside the lanes.
- **FR-007**: All lane colours MUST come from the host theme tokens; no fixed colour.

### Key Entities

- **Step** *(existing)*: one lane.
- **Phase** *(existing)*: a label inside a lane.

## Success Criteria

### Measurable Outcomes

- **SC-001**: At 1600px wide, a four-step run shows four bordered lanes and three arrows, with no horizontal page scroll beyond the board's own.
- **SC-002**: At 380px wide, the same run shows four full-width lanes and three "then <step>" lines.
- **SC-003**: Every existing builder unit test passes, updated only where it named the old seam markup.

## Non-goals

- The node card redesign, the node popover, and the hook-adding modal (later slices).
- The "+ Add to <step>" button in the design's lane header: no single action behind it exists today, so it waits for the adding slice.
- Any host or protocol change.

## Change-level rules

- No new dependency, no host change, no change to the message contract.
- Keep the existing class names that tests and the visual check rely on.

## Verification plan

1. `npx tsc --noEmit -p ./` and the builder's related jest tests pass.
2. `npm run test:visual` passes after the deliberate baseline update.
3. Open the Situations stories wide and narrow and check lanes, arrows and "then <step>".

## Assumptions

- The narrow breakpoint stays the builder's existing 640px container query, where two lanes no longer fit side by side.
- The design's 10px lane radius maps to the builder's own `--radius-lg` token, so the lane follows the host's shape.
- The header band tint is a small mix of the foreground into the editor background, so it follows every theme.

## Verbatim Constraints

- `then <step>` (narrow join copy, e.g. `then plan`)
- `Add a step after <step>` (join control title)

## Approach

- `apps/vscode/webview/src/pipeline-builder/Canvas.tsx`: the join between lanes becomes a `pb-lane-join` holding an arrow, a "then <step>" line and the existing `pb-lane-seam` add button; the phase rule element goes.
- `apps/vscode/webview/styles/pipeline-builder.css`: bounded lane panel, header band, join column, quiet phase label, stacked layout under `@container builder (max-width: 640px)`.
- Tests and stories: `__tests__/Board.test.tsx`, `__stories__/Interactions.stories.tsx`; pixel baselines in `__screenshots__/`.
- `CHANGELOG.md`: one `[Unreleased]` line.
