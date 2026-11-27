# Workflow Builder: the build bar

## User Scenarios & Testing

### User Story 1 - The bar appears when there is something to build (Priority: P1)

A person changes the pipeline in the Workflow Builder. The header no longer carries Build. Instead a bar rises at the bottom of the panel saying how many steps changed and that the assistant still reads the old commands, with Review and Build. Pressing Build builds; the bar turns into a short confirmation and leaves.

**Why this priority**: Build is the one forward action, and it must be in front of the person exactly when it is needed and nowhere else.

**Independent Test**: Open the builder on a project whose build is stale; the bar shows; press Build; the build message is sent; a successful report turns the bar into "Built" and it goes away.

**Acceptance Scenarios**:

1. **Given** the build is stale or never built, **When** the panel draws, **Then** a bar at the bottom says what is not built and offers Review (outlined) and Build (filled).
2. **Given** the build is current and nothing ran, **When** the panel draws, **Then** no bar shows and the header says "Built, up to date".
3. **Given** a build succeeded, **When** the report arrives, **Then** the bar says "Built" with how many command files were written, and leaves on its own.
4. **Given** a build failed, **When** the report arrives, **Then** the bar stays open in a warning state saying it did not build and nothing was written, with a way to the log and to try again.
5. **Given** a build is running, **When** the bar draws, **Then** Build says "Building…" and cannot be pressed twice.

### User Story 2 - Review the changes before building (Priority: P1)

The person presses Review and the bar opens upward into the list of what is waiting: the last change with Undo when it can be taken back, each hook that will do nothing with its reason and a fix, what the build warned about, each step that differs from shipped with a way to it, and which commands the build will rewrite.

**Why this priority**: Building blind is the reason people do not trust the button.

**Independent Test**: Give the panel a stale graph with one hook whose skill is missing and a preview report; press Review; the problem row, its Remove and Edit fixes, the changed steps and the commands that would change are listed.

**Acceptance Scenarios**:

1. **Given** the bar is closed, **When** Review is pressed, **Then** the list opens above the bar, Review becomes Hide, and the list has a heading the keyboard can reach.
2. **Given** a hook carries a problem, **When** the review is open, **Then** its row shows the reason and offers Edit hook and Remove hook.
3. **Given** the last write can be undone, **When** the review is open, **Then** that row offers Undo, and pressing it sends the undo for that token.
4. **Given** no preview has run since the last change, **When** the review opens, **Then** the panel asks for a preview so the commands that would change can be named.
5. **Given** a step differs from shipped, **When** its Show is pressed, **Then** the board goes to that step.

### User Story 3 - The header is just the name and the workflow (Priority: P2)

The header keeps the title, the workflow switcher and one overflow menu holding Add step, Open companion.yml (when there is one), Preview build and Spec Kit presets, plus the counts. The notices for running as shipped, the first run and graph warnings stay.

**Why this priority**: The header was crowded; every action must stay reachable.

**Independent Test**: Open the overflow menu; each entry fires its action.

**Acceptance Scenarios**:

1. **Given** the header, **When** the overflow menu opens, **Then** it lists Add step, Open companion.yml (only when configured or on shipped), Preview build and Spec Kit presets.
2. **Given** a modal or a bottom sheet is open, **When** the panel draws, **Then** the bar is hidden.

### Edge Cases

- A write status that is not about building (a refusal) still shows on the foot status line when no bar is up.
- The same hook drawn in both a phase and a node is listed once.
- A build warning already said by a hook's problem is not listed twice.
- A redraw clears the last report, so a confirmation never outlives the pipeline it described.
- Reduced motion: the bar appears and leaves without animation.

## Requirements

### Functional Requirements

- **FR-001**: The header MUST NOT carry Build; it MUST carry the title, the workflow switcher and one overflow menu with Add step, Open companion.yml (when there is a file), Preview build and Spec Kit presets.
- **FR-002**: The header MUST show one quiet line "Built, up to date" when the build is current and nothing waits.
- **FR-003**: When the build is stale or never built, a bar MUST appear at the bottom of the panel with a headline, the line "The assistant still reads the old commands", Review (outlined) and Build (the one filled button).
- **FR-004**: Review MUST expand the bar upward into the list of changes, and Hide MUST collapse it.
- **FR-005**: The review MUST list the last write with Undo when the host holds an undo for it.
- **FR-006**: The review MUST list every hook with a problem, once, with its reason and Edit hook and Remove hook.
- **FR-007**: The review MUST list build warnings not already said by a hook problem.
- **FR-008**: The review MUST list each step that differs from shipped with Show, and the commands a preview says would change.
- **FR-009**: After a successful build the bar MUST show a short confirmation and leave on its own.
- **FR-010**: After a failed build the bar MUST stay open in a warning state saying nothing was written, with the log one click away and Build offered again.
- **FR-011**: The bar MUST be hidden while a modal or a bottom sheet is open.
- **FR-012**: A write status MUST show inside the bar when the bar is up, and on the foot status line otherwise.
- **FR-013**: Every control MUST be a real button with a visible focus and an accessible name; the bar MUST be safe under reduced motion.

### Key Entities

- **Build report** *(existing)*: what a build or preview did, its changed commands and warnings.
- **Write status** *(existing)*: what the last write did, with an optional undo token.
- **Pipeline hook** *(existing)*: carries an optional problem.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every builder action reachable before the change is reachable after it (each webview message still sent from some control).
- **SC-002**: With nothing to build, the panel shows no bar and says "Built, up to date".
- **SC-003**: A review lists each problem hook exactly once.
- **SC-004**: The bar fits a 380px panel with no horizontal scroll.

## Non-goals

- Installing a missing skill from the bar: the host has no such action.
- Undo on any change but the last write: the host holds one undo at a time.
- Blocking Build when a hook has a problem: the build only warns.
- The stock board's own status line.

## Change-level rules

- Host tokens only; accent fill only on Build; no side-stripe accents.
- No new webview message types.

## Verification plan

1. Unit tests on the bar: appears on stale, hidden on current, Review opens the list, problem rows with fixes, Undo sends the token, failed build stays.
2. Header tests: overflow menu lists and fires every action, quiet line on current.
3. Stories for the bar's states.

## Assumptions

- The headline counts changed steps ("2 changed steps not built"), the measure the panel already used; when none differ it says "companion.yml changed since the last build".
- A preview is requested when the review opens without a fresh one.
- The confirmation leaves after about four seconds.
- "Modal or bottom sheet" means the hook modal, and at narrow widths the node popover or a side panel.
