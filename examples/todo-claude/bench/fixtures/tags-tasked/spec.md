# Feature Specification: Tags

**Feature**: Tags for todos — label todos and filter by label
**Status**: specifying

## User Scenarios & Testing

### User Story 1 - Create and manage tags (Priority: P1)

A person wants a small vocabulary of labels they can reuse across their todos. They open a dedicated Tags area, type a name, and create a tag. The new tag joins a visible list of all tags they have made. When a label is no longer useful, they remove it from the list.

**Why this priority**: Without a way to create tags, none of the labelling or filtering behaviour is reachable. This is the minimum slice that delivers standalone value — a managed list of labels — and everything else builds on it.

**Independent Test**: Visit the Tags area, create two tags, confirm both appear in the list by their exact names, remove one, and confirm only the remaining tag is shown. No todo interaction required.

**Acceptance Scenarios**:

1. **Given** the Tags area with no tags yet, **When** the person types a name and submits it, **Then** a tag with that exact name appears in the list of tags.
2. **Given** an existing tag, **When** the person removes it, **Then** it disappears from the list of tags.
3. **Given** a created tag named in plain text, **When** it is shown in the list, **Then** its label reads exactly the text that was entered (no decoration or reformatting).

### User Story 2 - Assign tags to todos (Priority: P2)

A person looking at their todo list wants to mark which labels apply to each todo. For every todo, they can turn each existing tag on or off independently, so a single todo may carry no tags, one tag, or several. Turning a tag on assigns it to that todo; turning it off removes the assignment.

**Why this priority**: Assignment is what connects tags to real work. It depends on tags existing (Story 1) but delivers the core value of the feature — categorised todos — even before filtering exists.

**Independent Test**: With at least one tag created, open the todo list, toggle a tag on for one todo and confirm it reads as assigned, then toggle it off and confirm it reads as unassigned. Repeat across two tags on the same todo to confirm independence.

**Acceptance Scenarios**:

1. **Given** a todo and an existing tag that is not assigned to it, **When** the person toggles that tag on for the todo, **Then** the tag becomes assigned to that todo.
2. **Given** a todo with an assigned tag, **When** the person toggles that tag off, **Then** the tag is no longer assigned to that todo.
3. **Given** a todo and two existing tags, **When** the person toggles both on, **Then** both tags are assigned to that todo independently of each other.
4. **Given** several todos, **When** a tag is toggled on for one todo, **Then** the assignment applies only to that todo and not to the others.

### User Story 3 - Filter todos by tag (Priority: P3)

A person with many todos wants to focus on just those carrying a particular label. The todo list offers a row of filter controls — one for each tag, plus an "All" control. Choosing a tag narrows the list to only todos that carry it; choosing "All" returns to the full list.

**Why this priority**: Filtering is the payoff that makes large todo lists manageable, but it depends on both tags (Story 1) and assignments (Story 2) already working. It is valuable but last in the dependency chain.

**Independent Test**: With two tags created and assigned to different todos, select one tag's filter and confirm only todos carrying it are shown, then select "All" and confirm every todo is shown again.

**Acceptance Scenarios**:

1. **Given** todos with mixed tag assignments, **When** the person selects a specific tag filter, **Then** only todos assigned that tag are shown.
2. **Given** a tag filter is active, **When** the person selects the "All" control, **Then** every todo is shown regardless of its tags.
3. **Given** a selected tag filter, **When** a todo not carrying that tag exists, **Then** that todo is hidden from the list while the filter is active.

### Edge Cases

- Creating a tag with an empty or whitespace-only name should not produce a blank tag.
- Removing a tag that is currently assigned to todos: the assignment must not linger as a dangling reference, and any active filter on that tag must fall back to showing all todos.
- Filtering by a tag that no todo carries yields an empty list (not an error).
- Reloading the page, or the app being torn down and re-mounted, must restore both the tags and every todo's assignments exactly as they were.
- Toggling the same tag on a todo twice returns the todo to its original assignment state.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST provide a dedicated Tags area, reachable from a navigation link labelled "Tags" in the application header.
- **FR-002**: The Tags area MUST let a person enter a name and create a tag from it.
- **FR-003**: A created tag MUST appear in a list of all existing tags, displayed by the exact text that was entered.
- **FR-004**: The Tags area MUST let a person remove any existing tag, after which it no longer appears in the list.
- **FR-005**: The system MUST NOT create a tag from an empty or whitespace-only name.
- **FR-006**: On the todo list, each todo MUST offer an independent on/off control for every existing tag, allowing assignment of zero or more tags to that todo.
- **FR-007**: Turning a tag's control on for a todo MUST assign that tag to the todo; turning it off MUST remove the assignment — affecting only that todo.
- **FR-008**: The todo list MUST present a row of filter controls containing one control per existing tag plus an "All" control.
- **FR-009**: Selecting a specific tag filter MUST show only todos assigned that tag; selecting "All" MUST show every todo.
- **FR-010**: Removing a tag MUST also remove that tag's assignment from every todo, leaving no dangling assignment; if that tag's filter was active, the view MUST revert to showing all todos.
- **FR-011**: Tags and every todo's tag assignments MUST persist locally and be restored on reload, surviving an app re-mount.

### Key Entities

- **Tag**: A reusable label a person creates. Key attributes: a unique identity and a display name (the exact text entered). Tags are independent of any single todo and form the shared vocabulary used for assignment and filtering.
- **Todo (assignment relationship)**: An existing todo gains a set of assigned tags. Each todo references zero or more tags; the relationship is many-to-many (a tag may apply to many todos, a todo may carry many tags) and is owned per-todo.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A person can create a tag and see it in the tag list in under 5 seconds, with the label matching the entered text exactly (100% of created tags).
- **SC-002**: A todo can be assigned and unassigned any existing tag, with the assignment state of other todos unchanged in 100% of cases.
- **SC-003**: Selecting a tag filter shows exactly the set of todos carrying that tag — no false inclusions and no omissions — and "All" restores the complete list every time.
- **SC-004**: After a page reload or app re-mount, 100% of tags and todo-tag assignments are restored to their prior state.
- **SC-005**: Removing a tag leaves zero dangling assignments and never produces an error state for any todo previously carrying it.

## Assumptions

- Tag names are treated as free text; the request does not require uniqueness, so duplicate names are permitted (each created tag is its own entry). Empty/whitespace names are rejected per FR-005.
- The existing add/complete/remove todo behaviour is unchanged; tags are additive and attach to the current todo model.
- "Assigned" state is surfaced through the per-tag toggle control on each todo row; no separate verbatim label text was pinned for it.
- The "All" filter is the default view when no tag filter is selected.

## Verbatim Constraints

- Route: `/tags`
- Header navigation link text: `Tags`
- Filter control label: `All`
- Persistence mechanism: `localStorage`
- A tag created with name `<name>` appears in the list as the text `<name>` (label matches entered text verbatim).
