# Calls card

A `calls <title>` fence in a plan is drawn as a card. The plan step writes this block once a project attaches the call-paths node. Until that node ships, nothing writes one, so a user cannot meet the card yet. This is step 2 of 6 in the fenced-block work.

## User Scenarios & Testing

### User Story 1 - See the shape of a change as a card (Priority: P1)

A reviewer opens a plan with a `calls` block and sees a card: a header with the title and counts, and one row per call, with its mark, tree guides, name and location.

**Why this priority**: it is the feature. Without it the block stays plain code.

**Independent Test**: render a plan holding one `calls` fence and check the card markup and counts.

**Acceptance Scenarios**:

1. **Given** a block with `+`, `~`, `-` and unchanged rows, **When** the plan renders, **Then** the header shows the title and `+N −N ~N · K entrypoint(s)` counted from the rows.
2. **Given** nested rows, **When** drawn, **Then** each row shows `├─`, `└─` or `│` guides computed from its depth and sibling order.
3. **Given** a `+` row, **When** drawn, **Then** its name is bold. **Given** `**new** @ path`, **Then** it shows a `new file` pill and the location is plain text.
4. **Given** `@ path:line` on an existing file, **When** drawn, **Then** the location is the same clickable file chip an inline file reference makes, and a click opens the file at that line.
5. **Given** a `note:` line straight after the closing fence, **When** drawn, **Then** it is the card's footer and is not printed again below.
6. **Given** two blocks in one plan, **Then** each is its own card with its own note.

### User Story 2 - Fall back to plain code when the block is malformed (Priority: P1)

A block that breaks the grammar shows as the plain code block it is today, never a half card.

**Why this priority**: a half card would mislead a reviewer.

**Independent Test**: render each malformed body and check for the plain code block.

**Acceptance Scenarios**:

1. **Given** no mark column, an odd indent, a tab, a second entry point, an unknown mark, an empty body or an unclosed fence, **When** rendered, **Then** the fence is the plain code block and nothing throws.
2. **Given** a `calls` fence inside an HTML comment or another fence, **Then** it is left untouched.

### User Story 3 - Comment on a row and strike it (Priority: P2)

A reviewer comments on one call, or presses `strike` to ask for its removal. The comment anchors to that row and survives a re-render.

**Why this priority**: it makes the card reviewable, but the card is useful without it.

**Independent Test**: check the row's `data-line`, the posted message, and the host's anchor for a line inside a fence.

**Acceptance Scenarios**:

1. **Given** a card, **When** a row is hovered, **Then** the existing `+` comment affordance appears, and its line is the row's real source line.
2. **Given** a marked row, **When** `strike` is pressed (or activated by keyboard), **Then** one `addComment` is posted with the text `Remove this call from the plan.`
3. **Given** a row that already has that comment, pending or applied, **Then** it is drawn struck, and a second press posts nothing.
4. **Given** a comment on a line inside a `calls` fence, **When** the host builds the review comment, **Then** the block is that single row, not the whole fence. Lines outside fences behave as before.

## Edge Cases

- A name, title or path holding `<`, quotes or `&` renders as text and never reaches an attribute.
- A path that fails the inline chip's validation renders as plain text.
- A fence body is someone else's text: only the validated chip path puts any of it in an attribute.
- Blank lines inside the body are skipped, as the check script does, but row source lines stay true.

## Requirements

### Functional Requirements

- **FR-001**: The viewer MUST draw a closed, valid `calls <title>` fence as a card and return the plain code block for any body that does not parse.
- **FR-002**: The parser MUST read the call-paths grammar exactly: entry point first at no indent, column 0 mark in `+ ~ - space`, column 1 a space, two spaces per level, no tabs, no skipped level, one entry point, `name @ path[:line]`, and `**new** @ path` only on `+` with no line.
- **FR-003**: The header MUST show a `calls` badge, the title, and counts `+N −N ~N · K entrypoint(s)` taken from the rows.
- **FR-004**: Each row MUST show its mark, tree guides, name (bold for `+`), a `new file` pill for `**new**`, and its location, tinted by mark.
- **FR-005**: An existing-file location MUST use the inline file chip's markup and validation so the existing click path opens it at the line. A `**new**` location MUST be plain text.
- **FR-006**: Everything printed MUST be escaped as element text.
- **FR-007**: A `note:` line straight after the closing fence MUST become the card footer and MUST NOT render again.
- **FR-008**: Each row MUST be a commentable line whose `data-line` is its line in the original markdown.
- **FR-009**: A `strike` button on each marked row MUST be keyboard reachable with an aria-label, and post `addComment` once with the text `Remove this call from the plan.`
- **FR-010**: A row with that comment MUST be drawn struck, and a repeat press MUST NOT post a duplicate.
- **FR-011**: On the host, a line inside a `calls` fence MUST anchor to that single line. Lines outside fences MUST keep today's behaviour.
- **FR-012**: Styles MUST use only existing design tokens, in a new partial imported after the code styles and before the line-action styles.
- **FR-013**: Storybook MUST show a plan with two cards (one with `**new**` and a note, one with a removed and a changed row) and one malformed fence.
- **FR-014**: The vendored Copilot board build MUST be rebuilt and committed.

## Success Criteria

- **SC-001**: Every grammar row and every error case in the call-paths doc has a passing test.
- **SC-002**: A malicious name, title or path produces no new element or attribute in the output.
- **SC-003**: `npx tsc -p ./ --noEmit`, `npm test` and `npm run canvas:build` pass with no diff left behind.

## Assumptions

- No changelog entry, website doc or version bump: no user can meet a `calls` block until the call-paths node ships.
- The 3-block, 12-line and one-note budgets are plan-time warnings in the check script, not render limits.
- `states` and `screen` fences stay unregistered here.

## Verbatim Constraints

- Fence: `calls <title>`; badge text `calls`; counts `+N −N ~N · K entrypoint(s)`
- Strike comment text: `Remove this call from the plan.`
- Pill text: `new file`; chip markup: class `file-ref`, `data-filename`, `data-line`
- Styles file: `apps/vscode/webview/styles/spec-viewer/_calls.css`
