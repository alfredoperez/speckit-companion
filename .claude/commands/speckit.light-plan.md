---
description: Lightweight planning - quick implementation outline
---

## User Input

```text
$ARGUMENTS
```

## Instructions

Create a lightweight implementation plan. This is a streamlined version for rapid development.

1. **Read the spec** from the current feature's `spec.md`

2. **Create minimal plan** at `specs/{feature}/plan.md`:

```markdown
# Implementation Plan

## Approach

[2-3 paragraphs describing the high-level approach]

## Files to Change

| File | Change |
|------|--------|
| path/to/file | Description of change |

## Implementation Steps

1. [Step 1]
2. [Step 2]
3. [Step 3]

## Testing

- [ ] [Test case 1]
- [ ] [Test case 2]
```

3. **Skip**:
   - Research phase
   - Data model design
   - Quickstart guide
   - Constitution checks
   - Detailed architecture

4. Report completion with plan path.

This lightweight plan is meant for small features or when you already know the approach. Use `/speckit.plan` for comprehensive planning.
