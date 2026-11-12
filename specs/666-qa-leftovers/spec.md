# Release QA leftovers

**Source**: #920

## User Scenarios & Testing

### User Story 1 - A code edit always marks a check out of date (Priority: P1)

A developer records a passing check, then edits code. The pull request's Receipts must say that check is out of date. Today an edit that keeps the file the same size, made within the same second as the last commit, is sometimes missed, so the receipt claims a fresh pass for code it never ran against.

**Why this priority**: a receipt that hides a stale check is a false claim in every pull request it touches.

**Independent Test**: record a check, rewrite a tracked file with same-size content in the same second, and read the receipt. Repeat many times; it must say out of date every time.

**Acceptance Scenarios**:

1. **Given** a check recorded right after a commit, **When** a tracked file is rewritten with same-size content within the same second, **Then** the receipt row reads out of date with the commit it ran at.
2. **Given** a check recorded and only spec files edited, **When** receipts are built, **Then** the row is not out of date.

### User Story 2 - The board shows no fake recent time (Priority: P2)

A person opens the Copilot spec board on a fresh checkout. A spec whose run record holds no activity shows no relative time, instead of "just now" taken from the checkout's file times.

**Why this priority**: a wrong "just now" misleads which spec is being worked on.

**Independent Test**: render a card for a spec with a record but no history and fresh file times; its time is empty.

**Acceptance Scenarios**:

1. **Given** a spec with a run record and no history, **When** the board renders its card, **Then** the card shows no relative time.
2. **Given** a spec without any run record, **When** the board renders, **Then** the card still falls back to the file time.
3. **Given** a spec with history, **When** the board renders, **Then** the card shows the last activity time.

### User Story 3 - Release QA tooling explains itself (Priority: P3)

A maintainer runs release QA. The site preview starts and serves the built pages. Staging from a worktree whose dependencies are a link to another checkout stops early and says to install real dependencies in that worktree. The release QA guide recommends running QA from its own worktree. A spec-kit extension test that fails because the local Companion install is stale says to reinstall it.

**Why this priority**: each one costs a QA run time but none breaks the product.

**Independent Test**: run the site preview and load the home page; run the stage script's dependency check in a linked worktree; read the inventory test's failure message.

**Acceptance Scenarios**:

1. **Given** a built site, **When** the maintainer runs the site's preview script, **Then** the home page answers with success.
2. **Given** a worktree whose dependency folder is a link, **When** the stage script runs, **Then** it stops before packaging with a message naming `npm ci`.
3. **Given** a stale local Companion install, **When** the real-repo inventory gate fails, **Then** its message names `/install-local`.

### Edge Cases

- The git index file is missing (a fresh repo with no commit): the snapshot still works as before.
- The site was never built: the preview fails plainly, as it does for any missing build.
- A worktree with a real dependency folder: the stage script continues unchanged.

## Requirements

### Functional Requirements

- **FR-001**: A recorded check MUST read out of date after any tracked code change, including a same-size rewrite within the same second as the last index write.
- **FR-002**: A board card MUST show no relative time for a spec whose run record has no activity.
- **FR-003**: A board card MUST still fall back to file time for a spec with no run record.
- **FR-004**: The site's preview script MUST serve the built site so its pages load.
- **FR-005**: The release QA stage script MUST stop before packaging when the repo's dependency folder is a link, with a message naming `npm ci`.
- **FR-006**: The release QA guide MUST recommend running QA from its own worktree with real dependencies.
- **FR-007**: The real-repo inventory gate's failure message MUST name `/install-local` as the fix for a stale local install.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The out-of-date receipt test passes 50 of 50 consecutive runs (it failed 3 of 25 before).
- **SC-002**: A record-less-activity spec card shows no time on a fresh checkout.
- **SC-003**: The site preview answers the home page within 10 seconds of starting.
- **SC-004**: Staging from a linked worktree fails in under a second, before any build.

## Assumptions

- The other #920 bullets are out of scope: the "File not found in project" window step and the Claude Code mod pane recheck need a real desktop run; the canvas dev loader importing from the main checkout is handled by the worktree advice.
- The preview serves static files only; Vercel redirects are not reproduced locally.

## Verbatim Constraints

- `npm ci`
- `/install-local`
