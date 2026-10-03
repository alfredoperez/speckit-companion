# Feature Specification: SpecKit Companion mod for Claude Code

**Feature Branch**: `feat/820-claude-code-mod`
**Created**: 2026-10-03
**Status**: Draft
**Input**: Issue #820, "A Claude Code mod: the spec board beside the transcript". Version 1 shows and switches, and only reads.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See where the run stands without leaving the prompt (Priority: P1)

A developer runs `/speckit.*` commands in a Claude Code terminal session. A single line above the prompt tells them which spec they are on and where its run stands, such as "Plan done · Tasks 7/12 · Implement running". The line updates as the agent ticks tasks and closes steps, so they never open a file to check progress.

**Why this priority**: it is the smallest slice that gives value on every turn, and everything else builds on the same reading of the run record.

**Independent Test**: start a session in a project whose most recent spec is mid-implement, and read the band. Tick a task in its `tasks.md` and watch the count change.

**Acceptance Scenarios**:

1. **Given** a spec whose plan and tasks steps are done, whose implement step is in flight, and whose task list has 7 of 12 boxes checked, **When** the band draws, **Then** it reads the spec's name followed by "Plan done · Tasks 7/12 · Implement running".
2. **Given** a spec that is specified but not yet planned, **When** the band draws, **Then** it reads "Specify done · Plan next".
3. **Given** a completed spec, **When** the band draws, **Then** it reads "Completed", the task count, and the total active time when every step was measured.
4. **Given** a project with no spec folders, **When** the band draws, **Then** nothing is drawn.

### User Story 2 - Follow the run in a pane beside the transcript (Priority: P1)

The developer opens the SpecKit Companion pane. It shows the followed spec's title and status, the four pipeline steps with each finished step's measured time, the total active time, and the task list grouped by phase with the task in flight marked. The pane redraws as the agent works.

**Why this priority**: the band says where the run is; the pane says what is left, which is the reason to have a board at all.

**Independent Test**: open the pane on a spec fixture with a run record and compare its step times and task counts with what the VS Code viewer shows for the same spec.

**Acceptance Scenarios**:

1. **Given** a spec whose run record measures specify at 4m and plan at 9m, **When** the pane draws, **Then** those two steps show 4m and 9m, matching the VS Code viewer.
2. **Given** a step that was never closed by its own finish, **When** the pane draws, **Then** that step shows no time rather than a time stretched to the next step.
3. **Given** the agent checks a task box, **When** the pane next refreshes, **Then** the task shows as done and the phase count rises, without the developer doing anything.

### User Story 3 - Pick the spec the pane follows (Priority: P2)

The developer types `/spec` to see the list of specs, most recently active first, and picks one. `/spec 042` or `/spec export-csv` follows that spec directly, and `/spec auto` goes back to following whichever spec was touched last.

**Why this priority**: the default pick is right most of the time, so switching matters less than seeing.

**Independent Test**: in a project with three specs, run `/spec <number>` and confirm the band and pane switch to that spec; run `/spec auto` and confirm they return to the most recent one.

**Acceptance Scenarios**:

1. **Given** three specs, **When** the developer runs `/spec 2`, **Then** the band and pane follow the spec numbered 002.
2. **Given** no spec matches the query, **When** the developer runs `/spec nothing-like-this`, **Then** a short reply says nothing matched and the followed spec does not change.
3. **Given** the developer followed a spec by hand, **When** another spec becomes more recently active, **Then** the pane keeps the hand-picked spec until `/spec auto`.

### User Story 4 - Get a text answer where nothing is drawn (Priority: P2)

In the VS Code chat panel or a `claude -p` run, panes and bands are not drawn. There `/spec` replies with a few lines of text: the followed spec with its band line, then the most recent specs with their status.

**Why this priority**: without it the command looks broken outside the terminal.

**Independent Test**: run `claude -p "/spec"` with the plugin loaded in a folder with specs and read the reply.

**Acceptance Scenarios**:

1. **Given** a non-interactive run in a folder with specs, **When** `/spec` runs, **Then** the reply names the followed spec and its band line and lists the recent specs.
2. **Given** a non-interactive run, **When** `/spec 042` runs, **Then** the reply confirms the spec now followed with its band line.

### User Story 5 - Install it from this repo's marketplace (Priority: P3)

A developer adds this repository as a plugin marketplace and installs the plugin by name. A page on the site explains the two commands and what the mod shows.

**Why this priority**: distribution is needed to reach users but adds no behaviour.

**Independent Test**: validate the marketplace file and the plugin with the Claude Code validator in strict mode.

**Acceptance Scenarios**:

1. **Given** the repository, **When** the validator runs on the plugin in strict mode, **Then** it passes and lists the hooks and calls the mod makes.

## Edge Cases

- A spec folder has no `.spec-context.json`: steps are read off which files exist, as the Copilot board does.
- `.spec-context.json` is malformed or half written: the spec reads as having no record, and the next refresh picks up the fixed file.
- The followed spec folder is deleted: the mod falls back to the most recent spec.
- `tasks.md` holds checkbox lines inside code fences: they are not counted, same as the VS Code extension.
- A project keeps specs outside `specs/`: the `speckit.specDirectories` workspace setting is honoured, as the Copilot board does.
- The mod reloads mid-session: the hand-picked spec survives because it is stored per project.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The mod MUST draw a band above the prompt naming the followed spec and its run state in the form "<last done step> done · Tasks <checked>/<total> · <step in flight> running", with "<next step> next" when no step is in flight.
- **FR-002**: The mod MUST open a pane that shows the followed spec's title, status, the four pipeline steps with their state, each step's measured time, the total active time, and the task list by phase with the task in flight marked.
- **FR-003**: Step times and the total MUST come from the same derivation the VS Code viewer and the Copilot board use: a step ends at its own finish, waits between steps are billed to no step, and the total is the sum of measured active time.
- **FR-004**: Step states, status labels and task counts MUST come from the same rules the Copilot board uses, shared as one module rather than copied by hand.
- **FR-005**: The band and pane MUST refresh while the agent works, after tool calls and on a short timer, without the developer acting.
- **FR-006**: The mod MUST register a `/spec` command: bare, it shows the spec list; with a number, folder name or partial name, it follows that spec; with `auto`, it follows the most recently active spec.
- **FR-007**: The hand-picked spec MUST persist per project across reloads and sessions until the developer runs `/spec auto`.
- **FR-008**: Where nothing is drawn (no terminal or desktop surface), `/spec` MUST reply with a short text answer carrying the same information.
- **FR-009**: The mod MUST never submit a prompt, start a turn, or write any spec file or run record.
- **FR-010**: The plugin MUST live at `apps/claude-mod/`, be listed in a repository-root marketplace file, and pass the Claude Code validator in strict mode.
- **FR-011**: The plugin MUST ship automated tests for the band text, `/spec` switching, the text fallback, and reading a real run record from the demo fixtures.
- **FR-012**: The shared rules bundled into the plugin MUST be regenerated by a build step and checked for staleness in CI, like the Copilot board's vendor bundles.
- **FR-013**: The site MUST carry a short page on installing the mod and what it shows, and the root changelog, doc map and repo map MUST name the new app.

### Key Entities

- **Followed spec**: the spec the band and pane show. Either hand-picked per project or the most recently active one.
- **Run record**: a spec's `.spec-context.json`, read only. Its history gives step states and times.
- **Spec row**: one spec's summary as the Copilot board builds it: name, number, title, status, step states, task counts, last activity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every demo fixture, the step states, task counts and step times the mod shows equal what the Copilot board computes for the same folder.
- **SC-002**: A checked task shows in the band within 5 seconds, with no developer action.
- **SC-003**: Switching the followed spec takes one command.
- **SC-004**: The validator passes in strict mode and every plugin test passes.

## Assumptions

- Tested on Claude Code 2.1.287, the first version with mods on by default.
- The mod UI has no icon slot (a pane has only a title), so no mascot is shown.
- The default followed spec is the most recently active unfinished spec, falling back to the most recent one overall.
- The pane lists at most the 15 most recent specs in its picker; `/spec <query>` reaches any spec.
- A spec folder without a run record sorts by its folder's modified time.

## Verbatim Constraints

- Plugin name `speckit-companion`, display name `SpecKit Companion`, version `0.1.0`, homepage `https://speckit-companion.dev`.
- Plugin directory `apps/claude-mod/`; marketplace file `.claude-plugin/marketplace.json` at the repository root with source `./apps/claude-mod`.
- Command `/spec`.
- Band example: `Plan done · Tasks 7/12 · Implement running`.
- Install: `claude plugin marketplace add alfredoperez/speckit-companion`, then `claude plugin install speckit-companion@<marketplace-name>`.
