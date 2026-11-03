# Feature Specification: Feed always matches the selected tag

## User Scenarios & Testing

### User Story 1 - The list matches the tag I picked (Priority: P1)

A reader clicks one tag, then quickly clicks another. The articles shown must be the ones for the last tag clicked, even when the first tag's response is slower and arrives later.

**Why this priority**: today the reader can see articles for the wrong tag. That is the bug.

**Independent Test**: select tag A, then tag B before A's response returns. Let A's response arrive after B's. The list shows B's articles.

**Acceptance Scenarios**:

1. **Given** a request for tag A is still pending, **When** the reader selects tag B and B's response arrives first and A's arrives later, **Then** the list shows B's articles and stays on them.
2. **Given** the reader switches tags three times in quick succession, **When** the responses arrive in any order, **Then** the list shows only the articles for the third tag.
3. **Given** a request for tag A is pending, **When** the reader selects tag B, **Then** the request for A is cancelled where the client allows it.
4. **Given** a cancelled request, **When** it ends, **Then** the reader sees no error message and no change to the list.

### User Story 2 - Other feed switches stay correct (Priority: P2)

The same guarantee holds when the reader switches between Your Feed, Global Feed and a tag, and when they change page.

**Why this priority**: it is the same race through the same query, so it should not need a second fix.

**Independent Test**: switch from a tag to Global Feed before the tag's response returns. The list shows Global Feed articles.

**Acceptance Scenarios**:

1. **Given** a tag request is pending, **When** the reader opens Global Feed and the tag response arrives last, **Then** the list shows Global Feed articles.
2. **Given** a page request is pending, **When** the reader moves to another page, **Then** the earlier page's response never replaces the list.

## Edge Cases

- A response that arrives after the reader left the home page changes nothing.
- A request that fails after it was superseded shows no error.
- A request for the tag that is still selected, and that fails, still shows its error as today.
- Selecting the same tag again does not cancel its own in-flight request.
- A superseded response that was already cached must not be shown for the new tag.

## Requirements

### Functional Requirements

- **FR-001**: The article list MUST show only articles that belong to the currently selected tag, source and page.
- **FR-002**: A response for a tag, source or page that is no longer selected MUST NOT change the list.
- **FR-003**: When the selection changes, the request for the previous selection MUST be cancelled where the client allows it.
- **FR-004**: A cancelled or superseded request MUST NOT show an error to the reader.
- **FR-005**: A failed request for the current selection MUST show its error as it does today.
- **FR-006**: The cancellation MUST work for every call that fetches articles, not only the tag filter.
- **FR-007**: The reader MUST see no new screen, control, message or state. Only the list's correctness changes.

## Key Entities

- **Selection**: the tag, source (Your Feed or Global Feed) and page the reader has chosen. The newest selection is the only one whose result may be shown.
- **Article list**: the articles shown for the current selection.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In a test where the earlier tag's response arrives after the later tag's, the list shows the later tag's articles in 100% of runs.
- **SC-002**: After a rapid switch across three tags, every article shown belongs to the last tag.
- **SC-003**: A superseded request ends with zero error messages shown.
- **SC-004**: The existing test suite passes unchanged.

## Assumptions

- "Where the client allows" means every article request the app makes can be cancelled. A request the server has already processed still runs there, but its result is dropped.
- A superseded result is dropped even when it would have been cached for later use. Showing it for the wrong selection is the bug.
- The same rule applies to source and page switches (Story 2), because they share the cause.
- No change to what the API returns or to the URL format.
