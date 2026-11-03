# Feature Specification: Offline Favorites

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Favorite or unfavorite while offline (Priority: P1)

A reader favorites or unfavorites an article while the network is unreachable. The change stays visible on screen instead of snapping back, and the app remembers it so it can be sent later.

**Why this priority**: This is the core value. Without it, an offline reader loses every action.

**Independent Test**: Cut the network, favorite an article, and confirm the article stays favorited with its count raised by one.

**Acceptance Scenarios**:

1. **Given** the network is unreachable, **When** the reader favorites an article, **Then** the article shows as favorited and the count rises by one, and the change is stored as waiting.
2. **Given** the network is unreachable, **When** the reader unfavorites an article, **Then** the article shows as not favorited and the count drops by one, and the change is stored as waiting.
3. **Given** the server answers with a rejection or a validation error, **When** the reader favorites or unfavorites, **Then** the change is undone on screen and nothing is stored, exactly as today.

---

### User Story 2 - See how many changes are waiting (Priority: P1)

The header shows how many changes are waiting to be sent. With none waiting it shows nothing.

**Why this priority**: The reader needs to know the app is holding changes for them.

**Independent Test**: Make two offline changes on different articles and read the header count. Then clear them and confirm the count disappears.

**Acceptance Scenarios**:

1. **Given** no changes are waiting, **When** the reader looks at the header, **Then** no count is shown.
2. **Given** three changes on three articles are waiting, **When** the reader looks at the header, **Then** it shows 3.

---

### User Story 3 - Catch up when the connection returns (Priority: P1)

When the browser reports the connection is back, the waiting changes are sent in the order they were made, and the count returns to zero.

**Why this priority**: Without catching up, stored changes never reach the server.

**Independent Test**: Queue changes offline, restore the network, and confirm the requests go out in order and the header count clears.

**Acceptance Scenarios**:

1. **Given** changes on articles A then B are waiting, **When** the browser reports the connection is back, **Then** A is sent first, then B, and the count returns to zero.
2. **Given** a waiting change is sent and the server rejects it, **When** catch-up continues, **Then** that change is dropped, the remaining changes are still sent, and the article shows the server's state.
3. **Given** the network drops again during catch-up, **When** a send fails as unreachable, **Then** the unsent changes stay waiting.

---

### User Story 4 - Opposite changes cancel out (Priority: P2)

Favoriting and then unfavoriting the same article while offline leaves nothing to send for that article, and the reverse as well.

**Why this priority**: It avoids pointless requests and wrong counts, but the feature works without it.

**Independent Test**: Offline, favorite then unfavorite one article. The header shows nothing and no request is sent on reconnect.

**Acceptance Scenarios**:

1. **Given** a waiting favorite for article A, **When** the reader unfavorites A offline, **Then** nothing is waiting for A and the count drops by one.
2. **Given** a waiting favorite for A and a waiting favorite for B, **When** the reader unfavorites A, **Then** only B is waiting.

---

### User Story 5 - Waiting changes survive a reload (Priority: P2)

The reader reloads or closes and reopens the app while offline. The waiting changes and the header count are still there.

**Why this priority**: Changes that vanish on reload break the promise of remembering them.

**Independent Test**: Queue a change offline, reload the page, and confirm the count is unchanged and the change is sent on reconnect.

**Acceptance Scenarios**:

1. **Given** two changes are waiting, **When** the page reloads, **Then** the header still shows 2.
2. **Given** changes are waiting after a reload and the connection is already back, **When** the app starts, **Then** the waiting changes are sent in order.

### Edge Cases

- A rejected request for an article is never queued, so the on-screen undo stays as today.
- The same change made twice offline on one article is stored once.
- A queued article was deleted on the server: the send is rejected, the change is dropped, and catch-up continues.
- The reader logs out with changes waiting: the waiting changes are discarded, so they never go out under another account.
- The browser reports back online while nothing is waiting: nothing is sent.
- After catch-up, article data is refreshed so counts match the server.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When favoriting or unfavoriting fails because no response was received from the server, the app MUST keep the optimistic change on screen.
- **FR-002**: The app MUST store each such change as waiting, keyed by article, with the order it was made.
- **FR-003**: When the server answers with an error response (rejection or validation), the app MUST undo the on-screen change and store nothing, as today.
- **FR-004**: The header MUST show the number of waiting changes, and MUST show nothing when the number is zero.
- **FR-005**: When the browser reports the connection is back, the app MUST send the waiting changes in the order they were made.
- **FR-006**: A change MUST leave the waiting list once the server accepts it, so the header count returns to zero when all are sent.
- **FR-007**: A new change on an article MUST cancel the opposite waiting change for that same article, so neither is sent.
- **FR-008**: Waiting changes MUST persist across a reload.
- **FR-009**: If the server rejects a waiting change during catch-up, the app MUST drop it and continue with the rest.
- **FR-010**: If a send during catch-up fails as unreachable, the app MUST keep that change and the unsent ones waiting.
- **FR-011**: The app MUST start catch-up on launch when it is online and changes are waiting.
- **FR-012**: Logging out MUST clear the waiting changes.
- **FR-013**: After catch-up, the app MUST refresh article data from the server.

### Key Entities

- **Waiting change**: one favorite or unfavorite the reader made offline. Holds the article it applies to, the direction (favorite or unfavorite), and its position in the order made.
- **Waiting list**: the ordered set of waiting changes, at most one per article, stored across reloads.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of favorite and unfavorite actions made offline stay visible on screen.
- **SC-002**: The header count equals the number of articles with an unsent net change, in every case tested.
- **SC-003**: After the connection returns, all waiting changes are sent and the count reaches zero with no reader action.
- **SC-004**: A favorite followed by an unfavorite on the same article sends 0 requests.
- **SC-005**: 100% of server-answered errors still undo the change on screen.
- **SC-006**: The waiting count is identical before and after a reload.

## Assumptions

- A network failure means the request got no response from the server. Any response with an error status is a server answer.
- Connection return is detected from the browser's online report.
- Only favorite and unfavorite are covered. Other offline actions are out of scope.
- The count is a plain number in the header, shown only for a signed-in reader.
- Waiting changes belong to the signed-in reader and are cleared on logout.
- A change that the server rejects during catch-up is dropped without telling the reader.
