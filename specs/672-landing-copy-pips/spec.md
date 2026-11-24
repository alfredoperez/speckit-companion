# Landing copy pass and still hero tab buttons

**Source**: #1027

## User Scenarios & Testing

### User Story 1 - Copy that reads like a person wrote it (Priority: P1)

A visitor reads the landing page and meets plain sentences: no run of four fragments, no em dash, no headings built on an "X, not Y" contrast. Those patterns read as machine-written and cost the page trust.

**Why this priority**: the copy is the first thing every visitor reads.

**Independent Test**: open the landing page and read the ownership line, the Understand tab, the Customize tab and the Review tab.

**Acceptance Scenarios**:

1. **Given** the hero, **When** a visitor reads the line under the lead paragraph, **Then** it is one sentence saying their specs, pipeline and run record stay as files in their own repo.
2. **Given** the Understand tab, **When** a visitor reads its body, **Then** it holds no em dash and still names the coverage table.
3. **Given** the Customize and Review tabs, **When** a visitor reads their headings, **Then** neither uses an "X, not Y" frame and each keeps its meaning.

### User Story 2 - Tab buttons that hold still (Priority: P1)

A visitor aims at one of the three hero tab buttons and it stays where it is. The decorative motes and spores keep drifting.

**Why this priority**: a moving click target is a usability problem, not only a style one.

**Independent Test**: load the page with motion allowed and watch the three tab buttons while the motes move.

**Acceptance Scenarios**:

1. **Given** motion is allowed, **When** the hero is on screen, **Then** the tab buttons do not move or fade, and their hover and focus styles still work.
2. **Given** motion is allowed, **When** the hero is on screen, **Then** the motes and spores still drift.

### Edge Cases

- Reduced motion: the buttons were already still there and stay still.
- The H1, the lead paragraph, the "Ceremony sized to the change" line, the CTA heading and the three deliberate tab phrasings named in the page's comment stay as they are.

## Requirements

### Functional Requirements

- **FR-001**: The ownership line MUST be one plain sentence that says specs, pipeline and run record stay as files in the visitor's own repo.
- **FR-002**: The Understand tab body MUST contain no em dash and MUST still mention the coverage table that puts untraced requirements first.
- **FR-003**: The Customize and Review tab headings MUST NOT use an "X, not Y" frame and MUST keep their meaning.
- **FR-004**: The hero tab buttons MUST NOT animate; the motes and spores MUST keep their drift.
- **FR-005**: The H1 and the copy the owner named as out of scope MUST stay unchanged.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Zero em dashes in the landing page's visible copy.
- **SC-002**: Zero landing page headings built on an "X, not Y" frame.
- **SC-003**: The site builds with no new errors.

## Assumptions

- The owner settled the scope in the issue thread: the H1 stays, and the pips get no replacement animation.
- Site changes get no changelog line.

## Approach

- `apps/website/src/pages/index.astro` only: the `tabs` array (Understand body, Customize and Review headings), the `.ownership` paragraph, the `.hero-pip` motion rule, and the comment above `.hero-pips`.
- Verify with the site build.
