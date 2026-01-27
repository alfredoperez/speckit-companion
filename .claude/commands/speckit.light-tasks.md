---
description: Lightweight task generation - simple flat task list without phases
---

## User Input

```text
$ARGUMENTS
```

## Instructions

Generate a simple task list for the feature. This is a streamlined version without formal phases or dependency analysis.

1. **Read context**:
   - `specs/{feature}/spec.md` - user stories and acceptance criteria
   - `specs/{feature}/plan.md` - implementation approach and files to change

2. **Generate flat task list** at `specs/{feature}/tasks.md`:

```markdown
# Tasks: [Feature Name]

## Task List

- [ ] T001 [Description with file path]
- [ ] T002 [Description with file path]
- [ ] T003 [Description with file path]
...

## Notes

[Any important sequencing or dependencies to be aware of]
```

3. **Task format rules**:
   - Start each with `- [ ] TXXX`
   - Include specific file paths
   - Keep descriptions actionable (start with verb)
   - Order logically (setup first, then core, then polish)

4. **Skip**:
   - Phase organization
   - User story labeling ([US1], [US2])
   - Parallel markers ([P])
   - Dependency graphs
   - Parallel execution analysis
   - Detailed validation

5. **Report completion** with task count and file path.

This lightweight task list is for small features where formal phase tracking adds overhead. Use `/speckit.tasks` for larger features requiring structured phases and dependency analysis.
