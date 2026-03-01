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
- `specs/{NNN}-{slug}/state.json` — current step/task (if exists; note if resuming mid-implement)

Determine commit scope from the primary directory being modified (e.g., `toolbar`, `ui`, `core`). If unclear, omit scope.

Determine issue number from plan.md or spec.md if present.

If no tasks found, stop: "Run `/sdd.specify`, `/sdd.plan`, and `/sdd.tasks` first."

Update `specs/{NNN}-{slug}/state.json`:

```json
{ "step": "implement", "task": "T001", "updated": "{TODAY}" }
```

---

### Context Recovery (if resuming)

If `state.json` shows `step = "implement"` and `task = "T00N"`:

1. Check if worktree exists at `.claude/worktrees/{NNN}-{slug}/` — if so, `cd` into it
2. If no worktree exists, use `EnterWorktree` with `name: "{NNN}-{slug}"` to create one
3. Verify branch name: `git branch --show-current` — if it starts with `worktree-`, rename it: `git branch -m {NNN}-{slug}`
4. Read `spec.md` for feature context
5. Read `tasks.md` — `[x]` = done, `[ ]` = remaining
6. Resume from the first unchecked task
7. Do NOT re-run completed tasks — trust the checkmarks and existing commits

---

### 2. Create Worktree + Branch

Use Claude's built-in **`EnterWorktree`** tool with `name` set to `{NNN}-{slug}`.

This will:
- Create a worktree at `.claude/worktrees/{NNN}-{slug}/`
- Create a new branch based on HEAD
- **Switch the session's working directory** into the worktree

**Immediately after `EnterWorktree`, verify you are inside the worktree:**

```bash
pwd
```

The output **must** contain `.claude/worktrees/{NNN}-{slug}`. **If `pwd` does NOT show the worktree path, `cd` into `.claude/worktrees/{NNN}-{slug}/` before continuing.**

**Immediately rename the branch** (EnterWorktree adds a `worktree-` prefix):

```bash
git branch -m {NNN}-{slug}
```

Verify the rename succeeded:

```bash
git branch --show-current
```

It should print `{NNN}-{slug}` (no `worktree-` prefix). The branch name for Step 8 is `{NNN}-{slug}`.

Copy the spec artifacts into the worktree:

```bash
cp -r {REPO_ROOT}/specs/{NNN}-{slug}/ specs/{NNN}-{slug}/
```

Where `{REPO_ROOT}` is the main working tree root (the parent of `.claude/worktrees/`). This makes `spec.md`, `plan.md`, `tasks.md`, and `state.json` available inside the worktree.

**All subsequent steps run from the worktree.**

**If `EnterWorktree` fails** (worktree already exists from a previous run):

```bash
cd .claude/worktrees/{NNN}-{slug}
git branch --show-current
```

If the branch name starts with `worktree-`, rename it: `git branch -m {NNN}-{slug}`

---

### 3. Phase 1 — Sequential Core Implementation

Execute tasks T001 → T002 → ... through all Phase 1 tasks in order.

For each task:

1. Perform the work described in the **Do** field
2. Run the **Verify** check
3. Mark complete in `specs/{NNN}-{slug}/tasks.md`: `- [ ]` → `- [x]`
4. Update `specs/{NNN}-{slug}/state.json` — set `task` to the next task ID (or `null` after the last task)

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

Display exactly this format, then use the **AskUserQuestion** tool:

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
```

Call **AskUserQuestion** with these options:
- **Continue** — proceed to Phase 2 / commit
- **Fix** — user provides fix notes in the "Other" field; address the issue, update `tasks.md`, return to CP1

Start in background: `git fetch origin main`

---

### 6. Checkpoint 2 — Test Results

Only show this checkpoint if the user ran tests after CP1.

Display exactly this format, then use the **AskUserQuestion** tool:

```
--- CP2: Test Results ---
{Pass — all N tests passing}

  — or —

{Which tests failed and why (brief diagnosis)}
```

Call **AskUserQuestion** with these options:
- **Continue** — proceed to CP3
- **Fix** — user provides fix notes in the "Other" field; fix failing tests, return to CP2

---

### 7. Checkpoint 3 — Commit + PR

Display exactly this format, then use the **AskUserQuestion** tool:

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
```

Call **AskUserQuestion** with these options:
- **Approve** — proceed to commit and PR
- **Edit commit** — user provides notes in the "Other" field; apply changes to commit message, redisplay CP3
- **Edit PR** — user provides notes in the "Other" field; apply changes to PR body, redisplay CP3

---

### 8. Commit + PR

Stage the changed files explicitly (no `git add -A`). **Always include the spec artifacts** (`specs/{NNN}-{slug}/`) alongside implementation files:

```bash
git add path/to/file1 path/to/file2 ... specs/{NNN}-{slug}/
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

Push and open PR (use the branch name obtained from `git branch --show-current` in Step 2):

```bash
git push -u origin {branch-name}
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
Branch:  {branch-name}
```
