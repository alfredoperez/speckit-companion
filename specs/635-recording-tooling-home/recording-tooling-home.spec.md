# Feature Specification: Keep the recording tooling here, send the films elsewhere

**Feature Directory**: `specs/635-recording-tooling-home`
**Created**: 2026-10-11
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - Every recording the films need comes from one command on main (Priority: P1)

The promo films are now built in another repository. They read footage that only this repository can make, because the footage is the real product on screen. Today part of the recording code sits on a side branch and in two uncommitted edits. After this change all of it is on `main`, so anyone with a checkout can film the board and the terminal mod again.

**Why this priority**: footage that can only be made from one person's side folder is lost the day that folder is cleaned up.

**Independent Test**: on a clean checkout, run the board recording command. It finishes and writes frames for the run walkthrough and for the spec journey.

**Acceptance Scenarios**:

1. **Given** a clean checkout, **When** the board recording command runs, **Then** it writes a recording of a run moving through its steps and a recording of one spec going from Specify to Implement.
2. **Given** the terminal check script, **When** its recorded steps are listed, **Then** they include a session start filmed from launch and a task-ticking film on the same spec the board walkthrough uses.
3. **Given** the repository after this change, **When** someone looks for the film projects or their helper scripts, **Then** none are here.

### User Story 2 - A skill can make one still or one recording by reading one page (Priority: P2)

The author's image and video skills run from another repository. They need to know which command makes which picture, how to ask for only one, where it lands and what the machine must have. That is written in one place.

**Why this priority**: without it each skill re-learns the commands by reading scripts, and gets it wrong.

**Independent Test**: read the stills section and the recordings section of the visual assets guide. Each command, the single-item flag, the output folder and the machine needs are all named.

**Acceptance Scenarios**:

1. **Given** the visual assets guide, **When** a reader wants one named crop, **Then** the guide names the command, the flag that limits it to one step, and the folder it lands in.
2. **Given** the same guide, **When** a reader wants footage, **Then** it names the three commands, the output folder, where the frame rate and scroll speed are set, and each recording by name.
3. **Given** the same guide, **When** a reader checks what the machine needs, **Then** it lists the editor, the terminal multiplexer, the logged-in assistant command line, the browser and the sandboxes checkout.

### User Story 3 - One file says what the product looks like in marketing (Priority: P2)

Anything made to promote the product should use the same colours, type, mascot and motifs as the site. One file at the top of the repository states them, with the real values.

**Why this priority**: the look is otherwise spread across a stylesheet and people's memory.

**Independent Test**: open the look file and compare each colour with the site's token file. They match.

**Acceptance Scenarios**:

1. **Given** the look file, **When** its colours are compared with the site's tokens, **Then** every value matches.
2. **Given** the look file, **When** a reader looks for the mascot and the mark, **Then** each has a path that exists in the repository.
3. **Given** the packaged editor extension, **When** its contents are listed, **Then** the look file is not in it.

## Edge Cases

- The side branch is older than `main`. Only the one recording commit comes over, so newer work on `main` is not undone.
- The two edits to the terminal check script touch different parts of the file and both stay.
- A recorded step that finds nothing on screen must fail, not pass quietly.
- Recording the editor and the terminal mod needs a real window and a real session. Those are not run for this change.

## Requirements

### Functional Requirements

- **FR-001**: The board recording command MUST film a run moving through its steps on the board.
- **FR-002**: The board recording command MUST film one spec going from Specify through Plan, Tasks and Implement, sent from the board's own buttons.
- **FR-003**: The terminal check script MUST carry a recorded step that films a session from launch until the pane opens and three tasks tick.
- **FR-004**: The terminal check script's task-ticking film MUST run on the same spec the board walkthrough uses.
- **FR-005**: The repository MUST NOT contain the film projects or their helper scripts.
- **FR-006**: The visual assets guide MUST name, for stills, each command, how to run one named step, where output lands and what the machine needs.
- **FR-007**: The visual assets guide MUST name, for recordings, the commands, the output folder, where frame rate and scroll speed are set, every recording by name, and how the other repository uses the frames.
- **FR-008**: A look file at the repository root MUST state the site palette with the values the site's token file holds, the type by role, the mascot and mark with existing paths, and the site's motifs.
- **FR-009**: The project instructions MUST point at the look file.
- **FR-010**: The look file MUST NOT ship in the packaged editor extension.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The board recording command finishes with exit code 0 and writes at least two more recordings than before.
- **SC-002**: Every script this change touches parses without error.
- **SC-003**: Every colour in the look file matches the site's token file, 100%.
- **SC-004**: A search of the repository for the film projects' folder returns nothing.

## Assumptions

- Both uncommitted edits in the side folder are kept. They are recording code the moved films read.
- The editor recording and the terminal recording are confirmed in release QA, not here.
- The side folder and its branch are left in place. Removing them waits on the other repository committing the moved films and on a copy of the rendered films.
- Pointing the image skill at the look file happens in the skills repository.

## Verbatim Constraints

- `THEME.md`
- `npm run record`, `npm run record:terminal`, `npm run record:board`
- `npm run shots`, `shots:board`, `check:terminal`, `shots:place`
- `--only`
- `.record/`
- `tooling/scripts/lib/recording.mjs`
- `tooling/scripts/shots.json`
- `Closes #903`
