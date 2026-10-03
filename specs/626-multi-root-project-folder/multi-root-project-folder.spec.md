# Feature Specification: Find the Spec Kit project in a multi-root workspace

**Feature Branch**: `626-multi-root-project-folder`
**Created**: 2026-10-03
**Status**: Draft
**Input**: Issue #780, "How to handle multi workspace vscode?"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Companion finds the Spec Kit folder wherever it sits (Priority: P1)

A developer opens a VS Code workspace with several folders: one for specs, one for source, one for dependencies. The Spec Kit files live in one of them, not necessarily the first. Companion finds that folder and uses it as the project for everything it does: the sidebar lists its specs, steps run in it, steering and living specs read from it.

**Why this priority**: Today a workspace whose Spec Kit folder is second shows an empty sidebar and runs commands in the wrong place. This is the whole reported problem.

**Independent Test**: Open a workspace of two folders where only the second holds Spec Kit files. The sidebar lists that folder's specs and a step dispatched from it runs with that folder as its working directory.

**Acceptance Scenarios**:

1. **Given** a workspace of three folders where only the second holds Spec Kit files, **When** Companion starts, **Then** the Specs sidebar lists the specs in the second folder.
2. **Given** the same workspace, **When** the developer runs a step on a spec, **Then** the assistant starts in the second folder and receives the spec's path relative to it.
3. **Given** the same workspace with a file from the third folder focused in the editor, **When** the developer runs a step or a living-specs command, **Then** it still runs against the second folder.
4. **Given** a workspace with one folder, **When** Companion starts, **Then** everything behaves as it did before this change.
5. **Given** a workspace where no folder holds Spec Kit files, **When** Companion starts, **Then** it treats the first folder as the project, as it did before, so the welcome and init flows still work.

---

### User Story 2 - Pick the project folder by hand (Priority: P2)

When more than one folder holds Spec Kit files, or Companion picked the wrong one, the developer names the folder in a setting and Companion uses it.

**Why this priority**: Detection covers the common layout. The setting is the way out for the rest, and it is what makes the choice visible and stable for a team.

**Independent Test**: Open a workspace where two folders both hold Spec Kit files, set the setting to the second, and see the sidebar switch to the second folder's specs without a reload.

**Acceptance Scenarios**:

1. **Given** two folders that both hold Spec Kit files and no setting, **When** Companion starts, **Then** it uses the first of them in workspace order and writes which folder it picked, and that others qualified, to its output channel.
2. **Given** the same workspace, **When** the developer sets the project folder setting to the second folder's name, **Then** the sidebar and every later command use the second folder, without reloading the window.
3. **Given** a setting that names a folder not in the workspace, **When** Companion resolves the project, **Then** it falls back to detection and says in the output channel that the named folder was not found.
4. **Given** a setting that names a folder holding no Spec Kit files, **When** Companion resolves the project, **Then** it uses that folder anyway, so a developer can initialize Spec Kit in a chosen folder.

---

### User Story 3 - Follow the workspace as folders come and go (Priority: P3)

The developer adds or removes a workspace folder while VS Code is open. Companion works out the project again and refreshes what it shows.

**Why this priority**: Without it the fix needs a window reload after every workspace edit. It is a smaller annoyance than the first two.

**Independent Test**: With a workspace whose only Spec Kit folder is second, remove that folder, then add it back. The sidebar empties, then lists the specs again.

**Acceptance Scenarios**:

1. **Given** a workspace with no Spec Kit folder, **When** the developer adds a folder that holds Spec Kit files, **Then** the sidebar lists its specs without a reload.
2. **Given** a workspace whose project folder is removed, **When** another folder qualifies, **Then** Companion switches to it; otherwise it falls back to the first folder.

### Edge Cases

- A folder holds a specs directory but no Spec Kit configuration folder: the configuration folder is what marks a project; a bare specs directory qualifies only when no folder has the configuration folder.
- Two workspace folders have the same name: the setting also accepts the folder's path.
- The setting is set at folder level in one of the folders: Companion reads the workspace-level value, because the choice is about the whole window.
- A viewer panel is open on a spec when the project folder changes: the panel stays open on its file; new actions use the new project.
- A terminal opened before the change keeps its own working directory.
- No folder is open at all: Companion behaves as it does today with no workspace.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Companion MUST resolve one project folder for the window and every surface MUST use it: the Specs sidebar, the viewer, step dispatch and the terminal working directory, steering, living specs, Spec Kit detection and install, the file watchers, and the Pipeline Builder.
- **FR-002**: With no setting, the project folder MUST be the first workspace folder, in workspace order, that holds a Spec Kit configuration folder; failing that, the first that holds a specs directory; failing that, the first workspace folder.
- **FR-003**: A workspace with one folder MUST behave exactly as before.
- **FR-004**: A setting MUST let the developer name the project folder by workspace folder name or by path, and a valid setting MUST win over detection.
- **FR-005**: A setting that names a folder not in the workspace MUST fall back to detection and report the miss in the output channel.
- **FR-006**: When more than one folder qualifies and no setting decides, Companion MUST report in the output channel which folder it picked and that others qualified.
- **FR-007**: Changing the setting, or adding or removing a workspace folder, MUST re-resolve the project folder and refresh the sidebar views and file watchers without a window reload.
- **FR-008**: Paths Companion hands to an assistant MUST be relative to the project folder, and the assistant's terminal MUST start in the project folder.
- **FR-009**: The focused editor's folder MUST NOT change which project a command runs against.
- **FR-010**: The docs MUST state the setting, how detection chooses, and what is not covered: living specs colocated in another workspace folder, and running several Spec Kit projects in one window.

### Key Entities

- **Project folder**: the one workspace folder Companion treats as the Spec Kit project for the window. Chosen by the setting or by detection, and re-chosen when either changes.
- **Project folder setting**: the developer's explicit choice, a workspace folder name or a path. Empty by default.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a three-folder workspace whose Spec Kit files are in the second folder, the sidebar lists that folder's specs on first open, with no configuration.
- **SC-002**: A step dispatched in that workspace starts in the Spec Kit folder in 100% of dispatch paths.
- **SC-003**: Switching the project folder through the setting takes effect in under 5 seconds with no reload.
- **SC-004**: Every existing single-folder behaviour check still passes unchanged.
- **SC-005**: No surface reads the first workspace folder directly any more; all go through the one resolver.

## Assumptions

- One project per window. A workspace with several Spec Kit projects shows one at a time, chosen by the setting.
- Living specs that sit in another workspace folder next to the code stay out of scope: the registry and its paths are still read relative to the one project folder.
- The reporter's layout (Spec Kit in the first folder, source in the second) already resolves to the right folder; what this change gives them is that a command no longer depends on which folder is first or focused. Which command failed for them is still unknown, and the issue reply asks.
- Detection reads the disk once per resolve and is cached until the setting or the workspace folders change.

## Verbatim Constraints

- Setting key: `speckit.projectFolder`
