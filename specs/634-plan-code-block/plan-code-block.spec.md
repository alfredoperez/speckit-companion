# Plan code block

A code fence in a plan or task list that names a file is drawn as a card with line numbers, highlighted lines and notes pinned under the lines they explain. An attachable part teaches the plan step to write one, and a check holds it to the code it cites. This is step 3 of 6 in the fenced-block work.

## User Scenarios & Testing

### User Story 1 - Read a pinned piece of code as a card (Priority: P1)

A reviewer opens a plan holding a code fence marked as a sketch or a citation. They see a card: a header naming the file, numbered lines, a light tint on the highlighted lines, and each note sitting under the line it explains.

**Why this priority**: it is the feature. Without it the fence stays plain code and the notes are loose lines under it.

**Independent Test**: render a plan holding one sketch and one citation and check the card markup.

**Acceptance Scenarios**:

1. **Given** a fence `ts sketch src/new.ts`, **When** the plan renders, **Then** the header shows the path as plain text with a quiet `sketch` note, and lines are numbered from 1.
2. **Given** a fence `ts src/old.ts:40-44`, **When** rendered, **Then** the header shows the path as a link that opens the file at line 40, a quiet `lines 40-44` note, and lines numbered from 40.
3. **Given** `hl=3,6-7`, **Then** the lines numbered 3, 6 and 7 carry the tint and no other line does.
4. **Given** `pin 3: why this line` straight after the fence, **Then** a note row sits under line 3 in the body font at regular weight with a coloured edge, line 3 is filled, and the pin line is not printed again below the card.
5. **Given** two pins on one line, **Then** both notes sit under it in the order written.

### User Story 2 - Leave everything else alone (Priority: P1)

A fence that breaks the grammar shows as the plain code block it is today. A code fence with no sketch or citation is not touched at all.

**Why this priority**: every plan already holds code fences. None of them may change.

**Independent Test**: render each malformed fence and a plain fence and compare with today's output.

**Acceptance Scenarios**:

1. **Given** a plain `ts` fence, or one with only a title, **When** rendered, **Then** the output is byte-identical to today's.
2. **Given** a sketch with no file, an unknown word after the file, a path outside the repo, a bad `hl` value, a highlight or pin outside the numbered lines, a pin with no text, or a citation whose body is not as long as its range, **Then** the fence is the plain code block, its pin lines stay as text, and nothing throws.
3. **Given** code, a path or a pin holding HTML, **Then** it is shown as text.

### User Story 3 - Comment on a line of code (Priority: P2)

A reviewer comments on one code line or one pin. The comment anchors to that line of the plan.

**Why this priority**: review is why the block is in the plan. The card is still useful without it.

**Independent Test**: render a card and check that every code line and every pin is a commentable line carrying its own plan line number.

**Acceptance Scenarios**:

1. **Given** a card, **Then** each code row and each pin row carries the comment button and the number of the plan line it came from.

### User Story 4 - Have the plan step write one, checked (Priority: P2)

A project attaches the code-pins part to its plan step. The plan then pins a note under a line only where one line needs it, and a check reads every block against the code.

**Why this priority**: the card has nothing to draw until something writes the block, and a citation is only worth reading while its lines are real.

**Independent Test**: run the check on a plan with a good citation, a bad one and an oversized sketch.

**Acceptance Scenarios**:

1. **Given** a citation of a file that does not exist, or a range past its end, or a body that is not as long as its range, **When** the check runs, **Then** it reports an error naming the plan line.
2. **Given** a citation whose text no longer matches the file's lines, **Then** it reports a warning.
3. **Given** a sketch of more than 12 lines or a block with more than 3 pins, **Then** it reports a warning.
4. **Given** a block the viewer would not draw, **Then** the check reports the same fault as an error.
5. **Given** a plan with neither calls nor code blocks, **Then** the check prints nothing and exits 0.
6. **Given** the part is not attached, **Then** no command changes.

## Edge Cases

- A blank line between the fence and the first pin is allowed. The first line that is not a pin ends the pins.
- A `note:` line after a code fence is ordinary text. Only calls blocks own it.
- A language the viewer already draws its own way (a diagram, a calls block) keeps that drawing.
- A fence with no language is never a card.
- The same card appears on the Copilot board, which shares the renderer.

## Requirements

### Functional Requirements

- **FR-001**: The viewer MUST draw a fence whose info line is `<lang> sketch <file>` or `<lang> <file>:<from>-<to>` as a card with a header, numbered lines and pin rows.
- **FR-002**: Lines MUST be numbered from 1 for a sketch and from `<from>` for a citation, and `hl` and `pin` MUST name lines by those shown numbers.
- **FR-003**: The file path MUST be a link opening at `<from>` only for a citation of a file type the viewer opens, and plain text otherwise.
- **FR-004**: `hl=` MUST tint the listed lines and ranges, and a pinned line MUST be marked by fill alone.
- **FR-005**: Each `pin N: text` line straight after the fence MUST be drawn as a note row under line N and not printed again.
- **FR-006**: A fence that breaks the grammar MUST render as today's plain code block with its pin lines left as text.
- **FR-007**: A code fence with no sketch or citation MUST render exactly as it does today.
- **FR-008**: Every string from the plan MUST be shown as text, never as markup.
- **FR-009**: Each code row and pin row MUST be a commentable line anchored to its plan line.
- **FR-010**: An attachable part `code-pins` MUST ship off by default, attach after `plan-doc`, be usable from tasks, and be mirrored into this repo's node folder.
- **FR-011**: The plan check MUST report an error for a citation naming a missing file, a range outside the file, a body not as long as its range, or a block that breaks the grammar.
- **FR-012**: The plan check MUST report a warning for a sketch over 12 lines, a block over 3 pins, and a citation whose text differs from the file.
- **FR-013**: The part MUST record the check's result on the spec with `write-context.py --verify-run`.
- **FR-014**: The change MUST ship a docs page, Storybook stories in light and dark, a rebuilt Copilot board copy, and a changelog entry in each changelog.

## Success Criteria

- **SC-001**: Every existing viewer test passes unchanged.
- **SC-002**: A reviewer can tell a sketch from a citation from the header alone.
- **SC-003**: Every malformed form listed above renders as the plain code block.
- **SC-004**: The check catches a citation of a line that does not exist every time.

## Assumptions

- `hl` and `pin` use the numbers the card shows, so a citation of lines 40-44 pins with `pin 42:`. What a reader sees is what the plan wrote.
- A citation needs a range. A single line is written `:40-40`.
- A citation's body must be exactly as long as its range, or the numbers would lie. The viewer falls back and the check reports it.
- The pin budget of 3 holds for a citation too. The 12 line budget is for a sketch only.
- Budgets are warnings and the check still always exits 0, as it does for call paths.
- A sketch may name a file that already exists, since new code can land in an old file.
- The check also reads `tasks.md`, because the part is usable from tasks.
- The pin edge and the highlight use the accent colour. Green, amber, red and purple keep their meanings from the design notes.
- The stock branch hook was skipped: the request names the branch to commit on.

## Verbatim Constraints

- Info line: `<lang> sketch <file>` or `<lang> <file>:<from>-<to>`, with optional `hl=3,6-7`
- Pin line: `pin N: text`
- Part: `presets/_parts/code-pins.md`, mirrored to `.specify/companion/nodes/`
- Check recorded with `write-context.py --verify-run`
- Budget: 12 lines and 3 pins for a sketch
