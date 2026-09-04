---
name: EARS requirements
section: User Scenarios & Testing
for: specify
summary: Numbered requirements with WHEN/THEN/SHALL acceptance criteria — stable IDs tasks can cite.
---

<!--
  EARS notation: every acceptance criterion is one sentence naming the trigger,
  the system, and the behaviour it must exhibit. The point is the IDs — a
  criterion is addressable as `<requirement>.<criterion>` (2.3), so a task, a
  test, or a review finding can cite the exact line it satisfies.

  Number requirements in the order they matter. Never renumber: a citation
  elsewhere would silently start pointing at something else.

  Forms:
    WHEN <trigger> THEN the system SHALL <response>
    IF <precondition> THEN the system SHALL <response>
    WHEN <trigger> AND <condition> THEN the system SHALL <response>
-->

### Requirement 1: [short title]

**User Story:** As a [role], I want [capability], so that [benefit].

#### Acceptance Criteria

1. WHEN [trigger] THEN the system SHALL [observable response]
2. IF [precondition] THEN the system SHALL [observable response]

### Requirement 2: [short title]

**User Story:** As a [role], I want [capability], so that [benefit].

#### Acceptance Criteria

1. WHEN [trigger] AND [condition] THEN the system SHALL [observable response]

### Edge cases

- [What happens at the boundary — and which requirement covers it]
