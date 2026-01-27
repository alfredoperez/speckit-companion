---
description: Lightweight spec generation - minimal structure, fast iteration
---

## User Input

```text
$ARGUMENTS
```

## Instructions

Create a lightweight feature specification for rapid prototyping. This is a streamlined version focused on speed over completeness.

1. **Generate branch name** using pattern `NNN-short-name` (check existing branches/specs for next number)

2. **Create minimal spec** at `specs/{branch-name}/spec.md`:

```markdown
# Feature: [Feature Name]

**Branch**: {branch-name}
**Created**: {date}

## Summary

[2-3 sentences describing what the feature does and why]

## User Stories

- As a [user], I want to [action] so that [benefit]

## Acceptance Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Notes

[Any important context or constraints]
```

3. **Skip**:
   - Detailed scenarios
   - Edge cases analysis
   - Formal requirements (FR-XXX)
   - Quality checklists
   - Clarification rounds

4. Report completion with branch name and spec path.

This lightweight spec is meant for small features, spikes, or rapid iteration. Use `/speckit.specify` for full specifications.
