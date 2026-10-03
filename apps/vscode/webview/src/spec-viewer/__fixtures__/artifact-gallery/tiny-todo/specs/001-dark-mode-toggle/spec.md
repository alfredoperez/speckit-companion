# Feature Specification: Dark Mode Toggle

**Feature Branch**: N/A (project has no git repository)

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "Add a dark mode toggle to the todo app. Do not create a git branch; this project has no git repository. Leave one or two genuinely ambiguous points in the spec so clarify has something to ask."

## Clarifications

### Session 2026-10-03

- Q: What appearance should the app open in when the user has never chosen one? → A: Match the device's system light/dark setting
- Q: Should the toggle be a simple light/dark switch, or a three-way choice of light, dark and "match system"? → A: Simple two-state light/dark switch

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch between light and dark appearance (Priority: P1)

A person using the todo app finds the bright screen uncomfortable, for example at night. They activate a visible toggle and the whole app switches to a dark appearance. Activating it again returns to the light appearance.

**Why this priority**: This is the feature. Without a working switch, nothing else matters.

**Independent Test**: Open the app, activate the toggle, and confirm the header, the add form, and every todo item change to dark colors. Activate it again and confirm everything returns to light.

**Acceptance Scenarios**:

1. **Given** the app is showing the light appearance, **When** the user activates the toggle, **Then** the whole app displays the dark appearance immediately, without a page reload.
2. **Given** the app is showing the dark appearance, **When** the user activates the toggle, **Then** the whole app displays the light appearance immediately.
3. **Given** the list contains both active and completed todos, **When** the appearance changes, **Then** both kinds of todo remain clearly distinguishable from each other and readable.

---

### User Story 2 - Remember the chosen appearance (Priority: P2)

A person who picked dark mode closes the app and opens it again later on the same device. The app opens in the appearance they last chose, with no flash of the other appearance on load.

**Why this priority**: A toggle that resets on every visit is an annoyance. It is not needed for a first demo, so it ranks below the switch itself.

**Independent Test**: Choose dark, close and reopen the app, and confirm it opens dark. Choose light, reopen, and confirm it opens light.

**Acceptance Scenarios**:

1. **Given** the user chose the dark appearance, **When** they reopen the app on the same device, **Then** it opens in the dark appearance.
2. **Given** the user chose the light appearance, **When** they reopen the app on the same device, **Then** it opens in the light appearance.
3. **Given** the user reopens the app, **When** the page first appears, **Then** the user never sees the wrong appearance flash before the saved one is applied.

---

### User Story 3 - Operate the toggle without a mouse (Priority: P2)

A keyboard or screen reader user can find the toggle, change the appearance, and know which appearance is currently active.

**Why this priority**: The project requires every UI change to meet accessibility standards, so this is part of done, but it builds on the working toggle.

**Independent Test**: Using only the keyboard, tab to the toggle, activate it, and confirm the appearance changes. With a screen reader, confirm the toggle announces its purpose and its current state.

**Acceptance Scenarios**:

1. **Given** focus is on the page, **When** the user tabs through the controls, **Then** the toggle receives a visible focus indicator and can be reached in the normal order.
2. **Given** the toggle has focus, **When** the user presses the standard activation key, **Then** the appearance changes.
3. **Given** a screen reader is in use, **When** the toggle receives focus, **Then** it announces what it does and whether dark mode is currently on.

---

### Edge Cases

- What happens when the user has never chosen an appearance and opens the app for the first time? The app opens in the appearance matching the device's system light/dark setting (FR-005).
- What happens when the saved preference cannot be read or is corrupted? The app falls back to the first-visit default and does not show an error.
- What happens when the browser blocks saving data? The toggle still works for the current visit; the choice is simply not remembered.
- What happens when the user toggles rapidly many times? The final state matches the last activation and no intermediate state sticks.
- How does the app behave with a very large todo list? Switching appearance applies to all items at once without visible delay.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST show a visible toggle control that lets the user switch between a light and a dark appearance.
- **FR-002**: Activating the toggle MUST change the appearance of the entire app (header, add form, todo list, and all states of a todo) immediately, without reloading.
- **FR-003**: The app MUST remember the user's chosen appearance on the device and apply it the next time the app opens.
- **FR-004**: The saved appearance MUST be applied before the page is first shown, so the user does not see a flash of the wrong appearance.
- **FR-005**: When the user has no saved choice, the app MUST open in the appearance matching the device's system light/dark setting.
- **FR-006**: The toggle MUST be a two-state light/dark switch. A "match system" choice is not offered; once the user activates the toggle, their explicit choice is saved and replaces the system-based first-visit default.
- **FR-007**: Both appearances MUST keep text and interactive controls readable, with text contrast of at least 4.5:1, and MUST keep a visible focus indicator.
- **FR-008**: The toggle MUST be fully operable by keyboard and MUST expose its purpose and current state to assistive technology.
- **FR-009**: The toggle MUST NOT change, reorder, or remove any todo data.
- **FR-010**: The chosen appearance MUST be stored only on the user's device, with no network request and no account needed.

### Key Entities *(include if feature involves data)*

- **Appearance preference**: The user's chosen appearance (light or dark). Absent until the user first activates the toggle; while absent, the device's system setting applies. Belongs to a device, not to an account. Exists independently of todo items.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can find and use the toggle to switch appearance in under 5 seconds on first try, with no instructions.
- **SC-002**: The appearance change is visible in under 100 milliseconds after activation, for a list of up to 500 todos.
- **SC-003**: 100% of reopened sessions show the previously chosen appearance, with zero visible flashes of the other appearance.
- **SC-004**: Every piece of text and every control in both appearances meets a 4.5:1 contrast ratio.
- **SC-005**: A keyboard-only user can complete the full switch-and-switch-back flow without touching a mouse.

## Assumptions

- The app is a single page for one user on one device, so the preference is per device and is never synced across devices.
- The toggle appears in the page header, where it is visible without scrolling.
- Light remains the current look and stays unchanged; dark is the new addition.
- Only the two appearances, light and dark, exist as visual themes. Custom colors or accent choices are out of scope.
- Todo data, adding, completing, and deleting todos are unchanged by this feature.
- Printing and other non-screen output are out of scope.
