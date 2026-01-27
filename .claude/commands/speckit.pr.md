---
description: Create a pull request for the current feature
---

## User Input

```text
$ARGUMENTS
```

## Instructions

Create a pull request for the current feature branch.

1. **Gather context**:
   - Current branch name
   - Read `specs/{feature}/spec.md` for feature description
   - Read `specs/{feature}/plan.md` for implementation approach
   - Get commit history: `git log main..HEAD --oneline`

2. **Ensure branch is pushed**:
   ```bash
   git push -u origin HEAD
   ```

3. **Generate PR content**:

   **Title**: `feat(<scope>): <description>` (from branch/spec)

   **Body**:
   ```markdown
   ## Summary

   [Brief description from spec]

   ## Changes

   - [Key change 1]
   - [Key change 2]

   ## Testing

   - [ ] [Test performed]

   ## Related

   - Spec: `specs/{feature}/spec.md`
   - Plan: `specs/{feature}/plan.md`
   ```

4. **Create PR**:
   ```bash
   gh pr create --title "<title>" --body "<body>" --base main
   ```

5. **Options** (from $ARGUMENTS):
   - `--draft` - Create as draft PR
   - `--reviewer <user>` - Add reviewer
   - `--label <label>` - Add label

Report the PR URL when complete.
