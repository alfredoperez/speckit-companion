# Feature Specification: Article Drafts and Review

## User Scenarios & Testing

### User Story 1 - Keep a new article as a draft (Priority: P1)

An author writes a new article and saves it. It is a draft: only the author can see it, and it appears nowhere public. The author can come back, edit it and save again.

**Why this priority**: Nothing else works without a status and a private first state. This alone stops half-finished articles from going public.

**Independent Test**: Create an article as one user, then check it as the author, as another user and as a guest.

**Acceptance Scenarios**:

1. **Given** a signed-in author, **When** they create an article, **Then** it is saved with status Draft.
2. **Given** a draft, **When** another user or a guest requests it or browses any article list, **Then** it is not shown and the direct link behaves as if the article does not exist.
3. **Given** a draft, **When** its author opens the editor, **Then** they see Save and Send for review.
4. **Given** a draft, **When** the author edits and saves, **Then** the changes persist and the status stays Draft.

### User Story 2 - Send a draft for review (Priority: P1)

The author sends a finished draft for review. While it is in review the author cannot change it, and a banner says so.

**Why this priority**: It is the first step of the review path and the first state with a different editor.

**Independent Test**: Send a draft for review and open the editor.

**Acceptance Scenarios**:

1. **Given** a draft, **When** the author chooses Send for review, **Then** the status becomes In review.
2. **Given** an article in review, **When** the author opens the editor, **Then** every field is read-only, a banner says it is in review, and Save and Send for review are not shown.
3. **Given** an article in review, **When** any user other than the author or a reviewer requests it, **Then** it is not shown.

### User Story 3 - Reviewer approves or asks for changes (Priority: P1)

A reviewer opens an article in review. They either approve it, or ask for changes with a written note.

**Why this priority**: Without a decision, nothing can be published.

**Independent Test**: As a reviewer, decide on an article in review each way.

**Acceptance Scenarios**:

1. **Given** an article in review, **When** a reviewer approves, **Then** the status becomes Approved.
2. **Given** an article in review, **When** a reviewer asks for changes and enters a note, **Then** the status becomes Changes requested and the note is stored.
3. **Given** a reviewer asks for changes, **When** the note is empty, **Then** the request is refused and the status is unchanged.
4. **Given** a user who is not a reviewer, or who is the article's author, **When** they open an article in review, **Then** no approve or request-changes controls are shown.

### User Story 4 - Rework after requested changes (Priority: P2)

The author sees the reviewer's note above the form, edits the article, and sends it for review again.

**Why this priority**: Closes the review loop; without it a rejected article is stuck.

**Independent Test**: Request changes on an article, then open the editor as its author.

**Acceptance Scenarios**:

1. **Given** an article with changes requested, **When** the author opens the editor, **Then** the reviewer's note shows above the form and the form is editable.
2. **Given** that editor, **When** the author sends it for review again, **Then** the status becomes In review and the old note is no longer shown as current.
3. **Given** that editor, **When** the author saves without sending, **Then** the status stays Changes requested.

### User Story 5 - Publish and unpublish (Priority: P2)

The author publishes an approved article and it becomes public. The editor of a published article shows Unpublish, which takes it back to draft.

**Why this priority**: This is the payoff, but it needs the review path first.

**Independent Test**: Publish an approved article, check it as a guest, then unpublish it.

**Acceptance Scenarios**:

1. **Given** an approved article, **When** its author publishes it, **Then** the status becomes Published and everyone can see it in lists and by link.
2. **Given** a published article, **When** its author opens the editor, **Then** Unpublish is shown.
3. **Given** a published article, **When** the author chooses Unpublish, **Then** the status becomes Draft and it disappears from public views.
4. **Given** an article that is not approved, **When** the author tries to publish it, **Then** it is refused.

### User Story 6 - Status label on my unpublished articles (Priority: P3)

In the article list, the author sees a small status label on their own articles that are not published. Others never see it.

**Why this priority**: A convenience for finding work in progress.

**Independent Test**: View the author's own article list with one article in each state.

**Acceptance Scenarios**:

1. **Given** the author's own list, **When** it contains Draft, In review, Changes requested and Approved articles, **Then** each shows its own status label.
2. **Given** the author's published articles, **Then** they show no label.
3. **Given** any list viewed by someone else, **Then** no labels appear.

## Edge Cases

- Existing articles with no status are treated as Published.
- Two people act at once (author edits while a reviewer decides): the action that no longer fits the current status is refused and the user sees the current state.
- A reviewer opens the link to an article in review: they can read it in full, though not edit it.
- An author who is also a reviewer cannot review their own article.
- A published article that is unpublished keeps its content, comments and favorites hidden with it and restored if published again.
- Reloading the editor shows the same state and the same note.
- A change requested note that is only whitespace counts as empty.

## Requirements

### Functional Requirements

- **FR-001**: Every article MUST have one status: Draft, In review, Changes requested, Approved or Published.
- **FR-002**: A newly created article MUST start as Draft.
- **FR-003**: Articles that are not Published MUST be visible only to their author, and to reviewers when In review.
- **FR-004**: Public lists and direct links MUST never expose an unpublished article to anyone else.
- **FR-005**: The author MUST be able to move a Draft or Changes requested article to In review.
- **FR-006**: A reviewer, who is not the author, MUST be able to approve an In review article, setting it to Approved.
- **FR-007**: A reviewer MUST be able to ask for changes on an In review article with a non-empty note, setting it to Changes requested.
- **FR-008**: The author MUST be able to publish an Approved article.
- **FR-009**: The author MUST be able to unpublish a Published article, returning it to Draft.
- **FR-010**: Any status change not listed above MUST be refused and leave the article unchanged.
- **FR-011**: The editor MUST show Save and Send for review for a Draft.
- **FR-012**: The editor MUST be read-only with an in-review banner for an In review article.
- **FR-013**: The editor MUST show the reviewer's note above an editable form for a Changes requested article.
- **FR-014**: The editor MUST show Unpublish for a Published article.
- **FR-015**: The editor for an Approved article MUST show a Publish action and a read-only form.
- **FR-016**: The article list MUST show a status label on the signed-in author's own articles that are not Published, and on no other article.
- **FR-017**: Editing and status actions MUST be allowed only to the roles named above; the permission rules MUST be the single source of that decision.
- **FR-018**: Existing articles without a status MUST be treated as Published.

### Key Entities

- **Article**: gains a status and, when changes were requested, a reviewer note.
- **Status**: Draft, In review, Changes requested, Approved, Published, with the allowed moves between them.
- **Reviewer**: a signed-in user allowed to decide on articles they did not write.
- **Review note**: the reviewer's written reason for requesting changes.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of newly created articles are invisible to every user except their author until published.
- **SC-002**: Each of the five states shows exactly the editor controls listed in FR-011 to FR-015, with no extra action.
- **SC-003**: An author can take an article from draft to published in under 2 minutes of their own time, given a reviewer decision.
- **SC-004**: A requested change always reaches the author with its note: 0 requests are accepted without one.
- **SC-005**: No status label appears on any article list viewed by someone other than the article's author.

## Assumptions

- Reviewer is a role a user has; how users get it is out of scope.
- Reviewers can read an In review article but not edit it.
- Approval does not publish: the author publishes in a separate step.
- Only the latest reviewer note is kept.
- Unpublish returns to Draft, not to Approved.
- Existing articles are Published so nothing disappears on release.

## Verbatim Constraints

- Editor action labels: `Save`, `Send for review`, `Unpublish`
