# Feature Specification: The ground all four stand on

**Feature Branch**: `feat/plan-blocks-ground`
**Created**: 2026-10-08
**Status**: Draft
**Input**: Issue #896, step 1 of 6. Ground-laying for four future viewer blocks (calls, code, states, screen). No block is drawn in this step. The PR says "Refs #896".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A file link opens the file it names (Priority: P1)

A spec says `apps/vscode/src/protocol/viewer.ts:613` or `src/a/util.ts:10-20`. The reader clicks the chip and lands on that file at that line, inside the project. A path with folders opens that exact file, never a same-named file elsewhere.

**Why this priority**: the only change a user can see and the only one that fixes a wrong result today.

**Independent Test**: render a spec with path chips, click one, and check which file opens and where the cursor lands.

**Acceptance Scenarios**:

1. **Given** a spec names `src/a/util.ts` and another `util.ts` exists in `src/b/`, **When** the reader clicks the chip, **Then** `src/a/util.ts` opens.
2. **Given** a chip reads `util.ts:42`, **When** clicked, **Then** the file opens with line 42 revealed and the cursor on it.
3. **Given** a chip reads `util.ts:10-20`, **When** clicked, **Then** the file opens at line 10.
4. **Given** a chip names `../outside.ts` or an absolute path outside the project, **When** clicked, **Then** nothing opens and the reader is told the file is not in the project.
5. **Given** a chip names a bare `util.ts`, **When** clicked, **Then** it opens as it does today.
6. **Given** a chip names `..config.yml` inside the project, **When** clicked, **Then** it is not mistaken for a parent folder.

### User Story 2 - Fence bodies are left alone (Priority: P2)

Text inside a code fence shows exactly as written. A `**Note:**`, an `## Phase 1` or a `### User Story 1 - X (Priority: P1)` inside a fence is not turned into a callout, a phase header or a story card. Text outside a fence renders as before, and line numbers and comment anchors do not move.

**Why this priority**: the block fences in later steps carry arbitrary text, so the preprocessors must stop rewriting it first.

**Independent Test**: render a document with those lines inside and outside a fence and compare.

**Acceptance Scenarios**:

1. **Given** a fenced block containing `**Note:** x`, **When** rendered, **Then** the code block shows that text unchanged and no callout appears.
2. **Given** the same line outside a fence, **When** rendered, **Then** the callout appears as before.
3. **Given** a document with no fences, **When** rendered, **Then** the output is identical to before.
4. **Given** a fence between two commented lines, **When** rendered, **Then** each line keeps its source line number.

### User Story 3 - The fence line is kept and block names are registered (Priority: P3)

The whole info string of a fence is read: language, a title, and options (`key=value` or bare). One registry names the block fences (`calls`, `states`, `screen`). No renderer is registered yet, so a block fence renders as the plain code block it does today. When a renderer is registered later and throws or returns nothing, the plain code block still shows.

**Why this priority**: invisible in this step; it is the seam the next five steps plug into.

**Independent Test**: render a fence named `calls` and a fence with a title and options, and check the output is the plain code block with safe attributes.

**Acceptance Scenarios**:

1. **Given** a fence ```` ```ts title="a.ts" focus ````, **When** parsed, **Then** language is `ts`, title is `a.ts`, options include `focus`.
2. **Given** an info string with quotes, angle brackets or an event handler, **When** rendered, **Then** none of it reaches any attribute and the language attribute is empty or the plain language.
3. **Given** a fence named `calls` with no renderer, **When** rendered, **Then** the output equals today's plain code block.
4. **Given** a registered renderer that throws or returns an empty string, **When** rendered, **Then** the plain code block shows.
5. **Given** a registered name whose body looks like a tree, **When** rendered, **Then** the registry decides first, not the tree check.

### Edge Cases

- A fence opened but never closed: everything after it counts as fenced, as the renderer already treats it.
- An indented fence inside a list item counts as a fence, as the renderer already treats it.
- A tilde fence is not a fence for the renderer, so it is not skipped by the preprocessors either.
- `path:0`, `path:abc`, and `path:99999999999` carry no line.
- A line range whose end is before its start uses the start.
- A path with a line suffix whose extension is unknown stays plain code.
- Windows separators and a trailing colon do not break the chip.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST parse a fence info string into a language, an optional title and a set of options, where options are `key=value` pairs or bare words.
- **FR-002**: The language attribute MUST keep today's strict name check, and no other part of the info string MUST reach an HTML attribute through string building.
- **FR-003**: One registry module MUST name the block fences `calls`, `states` and `screen`, hold an optional renderer for each, and have none registered in this step.
- **FR-004**: A registered block name MUST be handled before the tree-structure check.
- **FR-005**: A registered name with no renderer, or a renderer that throws or returns nothing, MUST render today's plain code block.
- **FR-006**: The callout, HTML-comment, phase and user-story preprocessors MUST leave fenced regions untouched.
- **FR-007**: Fence detection in the preprocessors MUST agree with the renderer's own loop: a line whose trimmed text starts with three backticks, and nothing wider.
- **FR-008**: For input the preprocessors changed before, line count and source-line mapping MUST be unchanged.
- **FR-009**: A file chip MUST accept `path:line` and `path:from-to` and carry the first line as a validated whole number.
- **FR-010**: The open-file message MUST carry an optional line.
- **FR-011**: A path with folders MUST resolve against the project root and the spec folder, not by file name alone.
- **FR-012**: A path outside the project, meaning `..`, `..` plus a separator, or an absolute path out of the root, MUST be refused, and a name like `..config.yml` MUST NOT be refused.
- **FR-013**: A bare file name MUST keep today's name lookup.
- **FR-014**: When a line is given, the opened file MUST reveal it and place the cursor on it.
- **FR-015**: The Copilot board's vendored renderer and styles MUST be rebuilt in the same change.
- **FR-016**: The root changelog MUST gain one Fixed line under Unreleased in the house voice, with no version bump.

### Key Entities

- **Fence info**: language, title, options parsed from the text after the opening fence.
- **Block registry**: the fixed list of block fence names and the renderer (if any) for each.
- **File reference**: a path, an optional line, and where it opens.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every existing viewer test still passes with no output change for documents that have no block fence and no fenced callout, phase or story text.
- **SC-002**: A click on a folder path opens the named file in 100% of tested cases, including when a same-named file exists elsewhere.
- **SC-003**: 0 tested path inputs outside the project open a file.
- **SC-004**: Every tested hostile info string produces no extra attribute and no markup.

## Assumptions

- The renderer recognises only triple-backtick fences, so that is the only fence the preprocessors skip.
- The spec folder is searched after the project root for a relative path.
- A line range opens at its first line.
- The mandatory git-branch hook is skipped: the work already sits on its issue branch in a worktree.

## Verbatim Constraints

- Block names: `calls`, `states`, `screen` (not `code`).
- Message: `{type: 'openFile', filename, line?}`; chip attribute `data-line`.
- Changelog tag: `<!-- area: spec-viewer -->` under `### Fixed` in `## [Unreleased]`.
