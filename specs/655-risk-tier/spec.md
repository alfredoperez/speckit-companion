# Feature Specification: Review depth follows a risk tier the code computes

**Source**: #963

## User Scenarios & Testing

### User Story 1 - The run computes a risk tier from what changed (Priority: P1)

Before the work is reviewed, the run computes a risk tier, low, normal or high, from the files the change touches, and records it with the reasons. A database migration, SQL, authentication code or a CI workflow makes it high; so does a change spanning many files. Docs and tests alone make it low. A project can add its own high-risk and low-risk paths.

**Why this priority**: Today the agent decides how hard to review its own work. A tier computed from the change cannot talk itself down.

**Independent Test**: In a git sandbox, change a migration file and run the writer's risk computation.

**Acceptance Scenarios**:

1. **Given** a change touching a migration, **When** the tier is computed, **Then** it is high and the reasons name the migration.
2. **Given** a change touching only Markdown and test files, **When** the tier is computed, **Then** it is low.
3. **Given** an ordinary code change, **When** the tier is computed, **Then** it is normal.
4. **Given** a project that lists `src/billing/**` as high risk, **When** a billing file changes, **Then** the tier is high.
5. **Given** no git repository, **When** the tier is computed, **Then** it is normal with a reason saying the change could not be read, and the call succeeds.

### User Story 2 - The agent may raise the tier, never lower it (Priority: P1)

The agent can raise the tier when it knows something the file list does not show, and must say why. A raise to a lower or equal tier is refused. The record keeps who raised it and the reason, and a later computation never drops a raise.

**Why this priority**: Judgment should add caution, never remove it.

**Independent Test**: Compute normal, raise to high with a reason, try to lower to low, recompute.

**Acceptance Scenarios**:

1. **Given** a computed normal tier, **When** the agent raises it to high with a reason, **Then** the tier is high and the record names the agent and the reason.
2. **Given** a high tier, **When** the agent asks for low, **Then** it is refused and the tier stays high.
3. **Given** a raise to high, **When** the tier is computed again as normal, **Then** it stays high.
4. **Given** a raise without a reason, **When** it is recorded, **Then** it is refused.

### User Story 3 - Review depth follows the tier, and the Overview shows it (Priority: P2)

Implement prints the tier and tells the agent how deep the review goes: low is its own careful read, normal is one independent review, high is two independent reviewers. The Overview shows "Review depth: <tier>", and when the agent raised it, who raised it and why.

**Why this priority**: The tier only matters if it changes the review and a reader can see it.

**Independent Test**: Open the Overview of a spec with a computed and a raised tier.

**Acceptance Scenarios**:

1. **Given** a computed high tier, **When** the Overview opens, **Then** Verified shows "Review depth: high" with the reasons.
2. **Given** a tier the agent raised, **When** the Overview opens, **Then** it reads "Review depth: high · raised by the agent: "<reason>"".
3. **Given** an older record without a tier, **When** the Overview opens, **Then** nothing is added.

### Edge Cases

- Changes to the spec's own folder and `.specify/` do not count toward the tier.
- A change already committed on the feature branch counts, as do uncommitted and new files.
- An unknown tier name in a raise is refused.

## Requirements

### Functional Requirements

- **FR-001**: The writer MUST compute a tier (`low`, `normal`, `high`) from the files the change touches, outside the spec folders, and record it with its reasons.
- **FR-002**: High-risk defaults MUST cover migrations, SQL, authentication paths, CI workflows and changes over 20 files; low MUST mean only docs and tests changed.
- **FR-003**: A project MUST be able to add high-risk and low-risk paths in `.specify/companion.yml`.
- **FR-004**: The agent MUST be able to raise the tier with a reason; a lower, equal or reasonless raise MUST be refused, and recomputing MUST keep a raise.
- **FR-005**: Implement MUST compute the tier before the work is reviewed and set the review depth from it.
- **FR-006**: The Overview MUST show the review depth and, for a raise, who raised it and why; older records render as today.
- **FR-007**: Computing or raising MUST never fail the host command.

### Key Entities

- **Risk**: the tier in force, the computed tier, the reasons, and an optional raise with its tier, reason, who and when.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A migration change computes high; a docs-only change computes low.
- **SC-002**: No sequence of raises and recomputes lowers the tier below the highest raise.
- **SC-003**: Every existing Overview fixture and capture renders unchanged.

## Assumptions

- The change is measured from the merge base with the default branch (origin's, else `main`), plus uncommitted and new files.
- The PR receipts (r1) are a later slice and read the same record.

## Verbatim Constraints

- Flags: `--risk` (compute) and `--risk-raise <tier> "<reason>"`
- Config: `risk: { high: [...], low: [...] }` in `.specify/companion.yml`
- Overview: `Review depth: <tier>` and `Review depth: <tier> · raised by the agent: "<reason>"`
