# Feature Specification: Capture plain SpecKit runs with hooks only

**Feature Directory**: `specs/634-stock-hooks-only`
**Created**: 2026-10-10
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - Plain SpecKit commands are spec-kit's own text (Priority: P1)

A developer who picks the plain SpecKit workflow runs spec-kit's own commands. Today Companion wraps its own lines around seven of them. After this change those commands hold only what spec-kit ships, and the developer still sees how long each step took.

**Why this priority**: it is the whole point. Nothing of ours sits inside spec-kit's commands, so a spec-kit upgrade can never leave a stale mix behind.

**Independent Test**: install the extension in a fresh project, run the four plain SpecKit steps, and compare each command file with what spec-kit installs on its own. They match, and the run record has a start and a finish for every step.

**Acceptance Scenarios**:

1. **Given** a fresh project with the Companion extension installed, **When** the developer opens the stock plan command, **Then** it contains no Companion text.
2. **Given** that project, **When** the developer runs specify, plan and tasks from a terminal, **Then** each step is recorded with a start and a finish.
3. **Given** that project, **When** the developer runs implement and every task box ends up ticked, **Then** implement is recorded with a start and a finish.
4. **Given** implement ends with one task still unticked, **When** the run stops, **Then** implement stays open and shows its start.

### User Story 2 - An existing project is cleaned up without the developer doing anything (Priority: P1)

A developer whose project already carries the old wrapped commands opens it in VS Code after updating. The wrapper is removed once, the stock commands come back, and it is never installed again.

**Why this priority**: without it every existing user keeps the old wrapped commands forever, and a second start of the editor would reinstall them.

**Independent Test**: take a project with the old preset installed, start the editor, and check that one removal ran and that a second start runs nothing.

**Acceptance Scenarios**:

1. **Given** a project with the old preset installed, **When** the editor starts, **Then** the preset is removed once.
2. **Given** a project without the preset, **When** the editor starts, **Then** no preset command runs and none is installed.
3. **Given** the `specify` tool is missing, **When** the editor starts, **Then** activation still completes and the failure is logged.

### User Story 3 - A step sent from VS Code no longer points at instructions that are gone (Priority: P2)

When the developer clicks a plain SpecKit step in VS Code, the editor adds a short note to the prompt. Today that note says the command itself carries the timing instructions. That is no longer true for plain SpecKit commands, so the note says what is true: the start is already recorded and the hooks record the finish.

**Why this priority**: a note that points at nothing costs the agent time and can make it invent a step. It does not block the run, which is why it is P2.

**Independent Test**: build the note for a plain SpecKit step with the extension installed and read it. It names no command-body protocol. Build it for a Companion step and it reads as before.

**Acceptance Scenarios**:

1. **Given** the Companion extension is installed, **When** a plain SpecKit step is dispatched, **Then** the added note does not say the command body carries the capture protocol.
2. **Given** the same, **When** a Companion step is dispatched, **Then** the added note is unchanged.
3. **Given** either, **When** a step is dispatched, **Then** the note still tells the agent not to record the next step's start.

### User Story 4 - The docs say what is true (Priority: P3)

A developer reading the install guide, the command list or the changelog learns that plain SpecKit commands are untouched, that step times still show, and that the task list no longer fills on plain SpecKit runs.

**Why this priority**: wrong docs mislead, but nothing breaks.

**Independent Test**: search the docs for the old preset's name and for claims that timing is baked into stock commands. Every hit is either gone or describes the removal.

**Acceptance Scenarios**:

1. **Given** the shipped docs, **When** a reader looks up the hook commands, **Then** the new start hook is listed beside the existing ones.
2. **Given** both changelogs, **When** a reader checks the unreleased section, **Then** each says what changed for them in plain words.

## Edge Cases

- The start hook fires in a project where VS Code already recorded the start: the second start adds nothing and the first time stands.
- The start hook fires for specify before the spec folder exists: nothing is written to the previous spec.
- The specify finish hook runs when no start time was read: the finish is still recorded and the step shows no duration.
- A Companion workflow command runs in a project with the new hooks: it does not run them a second time.
- Removing the old preset fails halfway: the next start tries again, and nothing re-adds it.

## Requirements

### Functional Requirements

- **FR-001**: The spec-kit extension MUST NOT ship or install the `companion-standard` preset.
- **FR-002**: A plain SpecKit step run with only the extension installed MUST record its start through a lifecycle hook.
- **FR-003**: The specify start hook MUST NOT write to any spec that existed before the step began.
- **FR-004**: The specify finish hook MUST record a finish, and a start when a start time was read.
- **FR-005**: The VS Code extension MUST remove an installed `companion-standard` preset once on activation and MUST NOT add it.
- **FR-006**: Activation MUST complete when the `specify` tool is missing or a preset command fails.
- **FR-007**: The note prepended to a plain SpecKit step MUST NOT claim the command body carries the capture protocol when the Companion extension is installed.
- **FR-008**: The note prepended to a Companion step MUST be unchanged.
- **FR-009**: The extension's build and checks MUST pass with no preset carriers present.
- **FR-010**: The new start hook command MUST appear wherever the existing hook commands are listed for users or read by checks.
- **FR-011**: Docs and both changelogs MUST describe plain SpecKit commands as untouched and MUST state that the task list no longer fills on plain SpecKit runs.
- **FR-012**: Companion workflow commands MUST NOT run the new start hooks a second time.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In a fresh project, all seven formerly wrapped commands are byte-identical to spec-kit's own.
- **SC-002**: A plain SpecKit run from a terminal records a start and a finish for specify, plan and tasks, 3 of 3.
- **SC-003**: A project with the old preset is clean after one editor start, and a second start runs zero preset commands.
- **SC-004**: Zero shipped docs claim that timing is added inside spec-kit's commands.

## Assumptions

- An empty task list on plain SpecKit runs is accepted.
- The "keep it small" writing advice stays only in the Companion workflow.
- The bench harness in the sibling repo still names the preset. That is a follow-up there.
- Old spec-kit versions that ignore unknown hook events simply record no start. They are not made worse.

## Verbatim Constraints

- `companion-standard`
- `speckit.companion.before-step`
- `before_specify`, `before_plan`, `before_tasks`, `before_implement`
