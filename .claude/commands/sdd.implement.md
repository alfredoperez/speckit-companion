---
description: 'SDD — Spec-Driven Development: execute tasks, run checkpoints, commit and open PR.'
---

## Steps

### 1. Load

Find the most recently modified directory under `specs/` that contains `tasks.md`.

Read in parallel:

- `specs/{NNN}-{slug}/tasks.md` — all Phase 1 and Phase 2 tasks
- `specs/{NNN}-{slug}/spec.md` — feature name, requirements, scenarios (for CP1 verification)
- `specs/{NNN}-{slug}/plan.md` — approach, files, issue number if present

Determine commit scope from the primary directory being modified (e.g., `toolbar`, `ui`, `core`). If unclear, omit scope.

Determine issue number from plan.md or spec.md if present.

If no tasks found, stop: "Run `/sdd.specify`, `/sdd.plan`, and `/sdd.tasks` first."

---

### 2. Create Worktree + Branch

Using {NNN}-{slug} from the spec dir found in Step 1:

```bash
git worktree add ../{NNN}-{slug} -b {NNN}-{slug}
```

If branch already exists (re-run):

```bash
git worktree add ../{NNN}-{slug} {NNN}-{slug}
```

All subsequent steps run from the `../{NNN}-{slug}` worktree.

---

### 3. Phase 1 — Sequential Core Implementation

Execute tasks T001 → T002 → ... through all Phase 1 tasks in order.

For each task:

1. Perform the work described in the **Do** field
2. Run the **Verify** check
3. Mark complete in `specs/{NNN}-{slug}/tasks.md`: `- [ ]` → `- [x]`

**Deviation rules:**

| Situation                              | Action                                            |
| -------------------------------------- | ------------------------------------------------- |
| Bug, import error, or type mismatch    | Fix silently — note for CP1                       |
| Missing dependency                     | Fix silently — note for CP1                       |
| Architectural approach needs to change | **STOP. Explain to user and ask how to proceed.** |
| Task is impossible as written          | **STOP. Explain why and ask how to proceed.**     |

After the last Phase 1 task, start in background:

```bash
nx build ngx-dev-toolbar
```

---

### 4. Phase 2 — Parallel Agents (normal mode only)

Skip if spec.md shows mode is `"minimal"`.

Launch all `[P][A]` tasks in a **single message** as parallel subagents:

**test-expert subagent** (T005 — always in normal mode):

> Write Jest unit tests for the changed files. Follow AAA pattern (Arrange / Act / Assert). Use Angular TestBed for component tests. Test signals using `computed` and `effect` where relevant. Place spec files adjacent to source files.
>
> Files to test: `{list from T005}`
> Reference existing spec files for patterns: `{existing .spec.ts from project}`
>
> Mark T005 complete in `specs/{NNN}-{slug}/tasks.md` when done.

**docs-expert subagent** (T006 — only if plan.md flagged docs work):

> {If Astro docs page needed}: Create or update the docs page at `apps/docs/src/content/docs/...` following the structure of existing pages. Feature: `{name}`. Public API from spec: `{from spec.md requirements}`.
>
> {If README update needed}: Add the new tool/feature to the tools list and usage section in README.md. Follow existing entry format. Only update for new public-facing tools or major API changes.
>
> Mark T006 complete in `specs/{NNN}-{slug}/tasks.md` when done.

Wait for both subagents to complete before proceeding to CP1.

---

### 5. Checkpoint 1 — Code Review

Display exactly this format and **wait for user response**:

```
--- CP1: Implementation ---
Phase 1: T001–T00N complete
Phase 2: tests written, docs updated  (or "N/A — minimal mode")

Changes:
- path/to/file: [one line description]
- path/to/file: [one line description]

Silent fixes: [list any, or "none"]

Verification:
- [ ] {scenario from spec}  →  expected result
- [ ] {edge case from spec}  →  expected result

Run tests: nx test ngx-dev-toolbar

Continue / Fix: <describe what to fix>
```

Start in background: `git fetch origin main`

If user says **fix**: address the issue, update tasks.md, then return to CP1.

---

### 6. Checkpoint 2 — Test Results

Only show this checkpoint if the user ran tests after CP1.

Display exactly this format and **wait for user response**:

```
--- CP2: Test Results ---
{Pass — all N tests passing}

  — or —

{Which tests failed and why (brief diagnosis)}

Continue / Fix: <describe what to fix>
```

If user says **fix**: address failing tests, then return to CP2.

---

### 7. Checkpoint 3 — Commit + PR

Display exactly this format and **wait for user response**:

```
--- CP3: Commit & PR ---
Commit: {type}({scope}): {short description}
        Closes #{N}  (omit if no issue)

PR title:  {type}({scope}): {short description}
PR body:
  ## What
  - [bullet from spec What Changes / Summary]
  - [bullet from spec What Changes / Summary]

  ## Why
  [one sentence from spec Why / Summary]

  ## Testing
  - [verify step from tasks]
  - [verify step from tasks]

  Closes #{N}  (omit if no issue)

Approve / Edit commit / Edit PR
```

On **Approve**, proceed to commit and PR. On **Edit commit** or **Edit PR**, apply the user's changes and redisplay CP3.

---

### 8. Commit + PR

Stage the changed files explicitly (no `git add -A`):

```bash
git add path/to/file1 path/to/file2 ...
```

Commit using conventional commit format:

```bash
git commit -m "{type}({scope}): {short description}" -m "Closes #{N}"
```

Rules:

- `type`: `feat`, `fix`, `refactor`, `docs`, or `chore`
- `scope`: lowercase, from primary directory modified (e.g., `toolbar`). Omit if unclear.
- Short description: imperative, lowercase, no period, max 72 chars
- `Closes #N` line: only if issue number exists
- **No Co-Authored-By or attribution lines**

Push and open PR:

```bash
git push -u origin {NNN}-{slug}
gh pr create \
  --title "{type}({scope}): {short description}" \
  --body "$(cat <<'EOF'
## What

- [bullet from spec]
- [bullet from spec]

## Why

[one sentence from spec]

## Testing

- [verify step from tasks]
- [verify step from tasks]

Closes #{N}
EOF
)"
```

Rules:

- PR title matches commit message exactly
- `Closes #N` only if issue exists — omit otherwise
- No "Generated with Claude Code" or any AI attribution

---

### 9. Summary

Display exactly this format:

```
--- Done ---
Feature: {Feature Name}
Commit:  {type}({scope}): {description}
PR:      {PR URL}
Branch:  {NNN}-{slug}
```
