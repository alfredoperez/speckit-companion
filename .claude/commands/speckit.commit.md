---
description: Generate a commit for the current feature work
---

## User Input

```text
$ARGUMENTS
```

## Instructions

Create a well-structured commit for the current feature work.

1. **Analyze changes**:
   ```bash
   git status
   git diff --staged
   git diff
   ```

2. **Determine commit scope**:
   - If `$ARGUMENTS` specifies files/scope, use that
   - Otherwise, stage all feature-related changes

3. **Generate commit message** following conventional commits:
   ```
   <type>(<scope>): <description>

   <body>

   <footer>
   ```

   Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

4. **Stage and commit**:
   ```bash
   git add <files>
   git commit -m "<message>"
   ```

5. **Options** (from $ARGUMENTS):
   - `--no-coauthor` - Skip Co-Authored-By line
   - `--amend` - Amend previous commit
   - `--wip` - Use "wip: " prefix for work-in-progress

6. **Default behavior**:
   - Include `Co-Authored-By: Claude <noreply@anthropic.com>` unless `--no-coauthor`
   - Use feature branch name to determine scope

Report the commit hash and message when complete.
