# Feature Specification: Drift stops claiming "in sync" when it could not check

**Feature Branch**: `402-drift-shallow-clone`
**Created**: 2026-07-19
**Status**: Draft
**Issue**: #464

## User Scenarios & Testing

### User Story 1 - A CI run that could not check says so (Priority: P1)

A team adds the living-spec drift check to their CI pipeline. Their checkout only pulls the most recent slice of git history, which is the default for most CI providers. Today the check prints a clean, healthy-looking result even though it had no history to compare against, and the team reads that as "nothing drifted." They need the report to tell them plainly that the check could not run, and what to change so it can.

**Why this priority**: This is the whole bug. A green result that actually means "I could not check" is worse than no check at all, because people trust it.

**Independent Test**: Run the drift check inside a repository cloned with only the latest commit of history. It must not report anything as in sync, and it must name limited history as the reason.

**Acceptance Scenarios**:

1. **Given** a repository cloned with only the most recent commit, **When** the drift check runs, **Then** every capability is reported as not checked, with a reason naming the shallow clone, and nothing is reported as in sync.
2. **Given** a repository cloned with a few commits of history where a capability's spec was last changed further back than that, **When** the drift check runs, **Then** that capability is reported as not checked rather than being compared against the oldest commit available.
3. **Given** a report that skipped work because of limited history, **When** a reader looks at the output, **Then** it tells them to fetch the full history and gives a concrete example of how.
4. **Given** any of the above, **When** the command finishes, **Then** it exits successfully — the check is advisory and never fails a build.

### User Story 2 - The success line only claims what was actually checked (Priority: P1)

A repository has nine capabilities. Two of them could be checked; seven could not. Today the report leads with a checkmark and the words "All 2 checked capabilities in sync," with the seven skipped ones noted underneath. Readers see the checkmark and stop. The headline needs to carry both numbers.

**Why this priority**: Without this, the honest skip from Story 1 still gets buried under a line that reads as a clean bill of health.

**Independent Test**: Run the check on a repository where some capabilities can be checked and others cannot, and read the first line of output.

**Acceptance Scenarios**:

1. **Given** a run where two of nine capabilities were checked and both are clean, **When** the report renders, **Then** the summary states how many were in sync out of the total and how many were not checked, with the shared reason.
2. **Given** a run where every capability could be checked, **When** the report renders, **Then** the existing all-clear wording is unchanged.
3. **Given** a run where no capability could be checked, **When** the report renders, **Then** the output makes no success claim at all, exactly as it does today.

### User Story 3 - A repository whose history cannot be read says the truth about why (Priority: P2)

When the drift check cannot read a repository's history at all, it currently reports every capability as "spec.md not yet committed." That statement is simply false, and it sends the reader looking for a missing file instead of a broken repository.

**Why this priority**: Smaller blast radius than the shallow-clone case, but the same class of dishonest reporting, and it is a two-line fix in the same place.

**Independent Test**: Run the check against a repository whose history cannot be read and confirm the reason names an unreadable history, not an uncommitted file.

**Acceptance Scenarios**:

1. **Given** a repository whose history cannot be read, **When** the drift check runs, **Then** the skip reason says the history could not be read.
2. **Given** a repository where a capability's spec genuinely has never been committed, **When** the check runs, **Then** the reason still says the spec is not yet committed.

## Edge Cases

- A capability whose spec was committed inside the available slice of history is still fully checkable and must behave exactly as before.
- A repository with the full history present must be completely unaffected — no new skips, no changed wording.
- A run where the skipped capabilities have different reasons must not attribute one reason to all of them.
- The fix-it hint must appear only when limited history was actually the cause, not on every run with skips.

## Requirements

### Functional Requirements

- **FR-001**: The drift check MUST detect that a repository's history is incomplete before it tries to establish a comparison baseline for a capability.
- **FR-002**: The drift check MUST skip any capability whose spec baseline falls outside the available history, rather than comparing against the oldest commit it happens to have.
- **FR-003**: The skip reason for that case MUST be distinct from every other skip reason and MUST name the shallow clone.
- **FR-004**: When any capability was skipped for limited history, the report MUST tell the reader to fetch the full history and give a concrete example of how.
- **FR-005**: When some capabilities were checked and others were skipped, the summary line MUST state both the in-sync count against the total and the not-checked count with its reason, instead of a global-sounding success claim.
- **FR-006**: When no capability was skipped, the existing all-clear wording MUST be unchanged.
- **FR-007**: When no capability was checked, the report MUST continue to make no success claim.
- **FR-008**: The drift check MUST exit successfully in every one of these cases.
- **FR-009**: The skip reason for a repository whose history cannot be read MUST be distinct from the reason for a spec that was never committed.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In a repository cloned with only the latest commit, zero capabilities are reported in sync and 100% are reported as not checked.
- **SC-002**: In a repository cloned with a few commits of history where the spec baseline is older, the affected capability is reported as not checked and produces zero drifted-file entries.
- **SC-003**: In a repository with full history, the report is byte-identical to the report produced before this change.
- **SC-004**: The command exits with code 0 in all of the above.
- **SC-005**: Every one of the above is covered by a test built on a real clone, and each test fails when the change is reverted.

## Assumptions

- The "how to fix" example names the common CI checkout step and its full-history option, since that is where this will be hit.
- Reporting a capability as not checked is always preferable to reporting it against a baseline that may be wrong, even in the rare case where the baseline would have been right.

## Verbatim Constraints

- Skip reason: `spec history unreachable (shallow clone)`
- Summary shape: `✓ 2 of 9 capabilities in sync; 7 not checked — <reason>` (the reason is carried verbatim rather than abbreviated, so one string serves both the per-capability note and the summary)
- Fix-it hint must reference `actions/checkout` with `fetch-depth: 0`

## Approach

- `speckit-extension/scripts/drift.py` — read the repository's shallow-boundary commits once per run; when a capability's resolved baseline is one of them, skip with the shallow reason instead of checking. Split the baseline lookup's two failure modes so "never committed" and "history unreadable" get different reasons. Rework the clean-run summary so a mixed run reports both counts, and append the fetch-full-history hint when a shallow skip occurred.
- `speckit-extension/tests/test_living_specs.py` — add real depth-1 and depth-3 clone fixtures plus the rendering cases.
- `speckit-extension/CHANGELOG.md` — `[Unreleased]` entry.
- `speckit-extension/README.md` — note the shallow-clone skip in the drift command's description.

Dependencies: none beyond git itself, which the drift check already requires.
