# Feature Specification: Changelog link opens the right product's release

**Feature Branch**: `fix/585-changelog-link`
**Created**: 2026-08-20
**Status**: Draft
**Issue**: [#585](https://github.com/alfredoperez/speckit-companion/issues/585)

## User Scenarios & Testing

### User Story 1 - View Changelog shows the version I was just offered (Priority: P1)

A developer sees the notification telling them a new version of the extension is available, and clicks View Changelog to decide whether to update. They should land on the release notes for exactly the version the notification named.

**Why this priority**: It is the whole feature. Landing on a different product's notes gives the developer version numbers and changes that have nothing to do with the update they were offered, which is worse than no link at all.

**Independent Test**: Trigger the update notification with a known newer version, choose View Changelog, and assert the opened address points at that version's own release.

**Acceptance Scenarios**:

1. **Given** the notification offers a specific new version, **When** the developer clicks View Changelog, **Then** the address opened names that exact version.
2. **Given** the other product published its release more recently, **When** the developer clicks View Changelog, **Then** the address is unaffected by that.

## Edge Cases

- The developer chooses Skip instead: nothing is opened, and the skipped version is remembered as before.
- The developer dismisses the notification without choosing: nothing is opened.

## Requirements

### Functional Requirements

- **FR-001**: The changelog address the update notification opens MUST identify the offered version explicitly, and MUST NOT ask the release host to decide which release is newest.
- **FR-002**: No shipped code path may resolve a release through the shared "latest" lookup, since both products publish into one list and either can win it.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The address opened by View Changelog names the offered version in 100% of cases, regardless of which product published most recently.
- **SC-002**: A search of shipped source for the shared latest-release lookup returns 0 results.

## Assumptions

- The offered version is already known at the moment the link is built, so no extra lookup is needed to construct an exact address.

## Verbatim Constraints

- `src/speckit/updateChecker.ts` — the file holding the link.
- `releases/latest` — the shared lookup that must not appear in shipped source.
- `View Changelog` — the notification action this covers.

## Approach

- Build the changelog address from the version the notification already carries, so it resolves by tag instead of by "whichever is newest". One line in `src/speckit/updateChecker.ts`.
- Cover it in `src/speckit/updateChecker.test.ts`: assert the opened address for a known offered version, using the already-mocked `openExternal`.
- Add the user-facing entry to the root `CHANGELOG.md` under `## [Unreleased]`.

Dependencies: none. The version is already in scope at the link site, and the test harness already mocks both the notification and the browser open.
