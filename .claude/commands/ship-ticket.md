---
allowed-tools: Bash(git:*), Bash(gh:*), Bash(npm:*), Bash(node:*), Bash(python3:*), Bash(code:*), Bash(sleep:*), Bash(jq:*), Agent, AskUserQuestion, Read, Write, Edit, Skill, TaskCreate, TaskUpdate
description: Ship an ALREADY-BUILT ticket — code review → PR → Copilot → merge → learnings → install-local. Skips the build (you built it in SpecKit Companion). The tail of /fix-tickets, no rebuild.
argument-hint: "<issue # e.g. 292>  (optional — defaults to the current branch's NNN-slug)  [--review-merge]"
---

## What this does

The **post-build tail** for a ticket you built yourself in SpecKit Companion (GUI / `/speckit.companion.*`). It does **not** rebuild — it takes the committed work on the current feature branch and ships it: review, PR, Copilot, merge, learnings, reinstall. It is `/fix-tickets` steps 3–9 with the build skipped.

Use `/fix-tickets` when you want the loop to build the fix too. Use **`/ship-ticket`** when the code already exists on a branch and you just want the review→merge tail.

## Locked defaults

- **Never rebuild.** The branch already has the work; this command only reviews/ships it.
- **Never merge red checks.** Leave the PR open and report.
- **Auto-merge on** unless `--review-merge` is passed (then pause for a thumbs-up before `gh pr merge`).
- **Copilot is best-effort** — poll ~10 min, then fall back to `/code-review` alone.
- **Heavy steps run in subagents** (review, addressing Copilot, distilling learnings); the main loop only does git/gh/decisions.

## Inputs

`$ARGUMENTS`:
- An issue number (`292`) — preferred.
- Empty → derive from the current branch name (`NNN-slug` → look up the issue), confirm before proceeding.
- `--review-merge` anywhere → pause before merge.

---

## Procedure

> Run from the repo root (`~/dev/GitHub/speckit-companion`). Confirm with `git rev-parse --show-toplevel`.

### 0. Preconditions — main loop
```bash
git rev-parse --show-toplevel                 # must be speckit-companion
git branch --show-current                     # must NOT be main; expect NNN-slug
git status --porcelain                        # work should be committed; a clean tree is ideal
```
- **Refuse if on `main`** — there's nothing to ship. Stop and report.
- Resolve the issue number from `$ARGUMENTS` or the branch's `NNN`. `gh issue view <N>` to capture title/body for the PR + verify it's still open. If you can't resolve an issue, ask (AskUserQuestion) — a PR still wants a `Closes #N`.
- If there are **uncommitted** changes that are the real work, commit them first (real change + `specs/<NNN>/` spec folder); do **not** commit `.specify/` regenerated artifacts (`git checkout origin/main -- .specify/<file>` for any swept in).

### 0b. Verify it actually builds — subagent
- `npm run compile && npm test`. If `speckit-extension/**` changed, also `python3 speckit-extension/scripts/check-shape-parity.py`. If capture/timing changed, run the capture eval.
- Confirm the spec is in a shippable state: `specs/<NNN>-<slug>/` committed, tasks checked, `.spec-context.json` `specName` real (not a `[FEATURE NAME]` placeholder).
- If anything is red, **stop and report** — don't ship a broken branch.

### 1. Code review — subagent (or `/code-review` inline)
Run `/code-review` on the branch diff vs `main` at **high** effort, apply findings (`--fix`). Tell the subagent to **read `.claude/review-checklist.md` first** (and honor the `CLAUDE.md` conventions it points to) and check the diff against those known bug classes. Commit fixes; re-run `npm test` if code changed. Record each finding (you'll distill in step 6).

### 2. Open the PR — main loop
Use `/create-pr` conventions (reads `.claude/pr-profile.md`): conventional-commit title `type(scope): summary`, body with `Closes #N`, summary, technical notes, how-to-verify.
```bash
git push -u origin "$(git branch --show-current)"
gh pr create --title "<title>" --body "<body>" --base main
```
Capture the PR number/URL.

### 3. Request Copilot review — main loop (best-effort)
Verified method — REST `requested_reviewers` with the bot login (`gh pr edit --add-reviewer Copilot` does NOT work):
```bash
gh api -X POST "repos/alfredoperez/speckit-companion/pulls/<PR>/requested_reviewers" \
  -f "reviewers[]=copilot-pull-request-reviewer[bot]" >/dev/null 2>&1 \
  && echo "[copilot] requested" \
  || echo "[copilot] unavailable — proceeding on /code-review only"
```
Confirm the PR's `requested_reviewers` includes the Copilot bot. Record whether it took.

### 4. Wait + address Copilot — main loop poll, then subagent
Only if Copilot was requested. Copilot takes ~4–5 min, so `sleep 300` first, then poll at 90s (~12 min total):
```bash
sleep 300
for i in $(seq 1 8); do
  gh pr view <PR> --json reviews,comments \
    --jq '[.reviews[],.comments[]] | map(select(.author.login|test("[Cc]opilot")))'
  sleep 90
done
```
- Actionable comments → subagent: fix, commit, push, re-run `npm test`. **Reply to + resolve each Copilot thread** after fixing it.
- ~10 min, nothing → log "Copilot timed out; relying on /code-review" and proceed.
- **Conditional 2nd pass:** if the fix changed real LOGIC (control flow, a migration, a data-shape writer, an availability/auth gate), capture the current Copilot inline-comment count as a baseline, re-request Copilot, poll for NEW comments; address, then merge. Docs/CSS/label-only fixes skip the 2nd pass.
- **Stopping rule (avoid the treadmill):** each logic fix can trigger another pass, so this can loop 3–4×. Keep going only while a new pass surfaces a **real bug your change introduced or sits on**. Stop and merge once new findings are **pre-existing edge cases the PR didn't touch, prose/docstring precision, or equivalent nitpicks** — reply with the rationale and resolve, don't keep re-requesting. Convergence ≠ zero findings; it's "no new finding worth a code change."

### 5. Merge + cleanup — main loop
```bash
gh pr checks <PR> --watch || true
```
**Review-gate:** if `--review-merge` was passed, do **not** merge — post the PR link + a one-line summary + manual-verification surfaces, record "merged: NO — awaiting your review," and stop. Otherwise:
```bash
gh pr merge <PR> --squash --delete-branch
```
If checks fail and can't be auto-addressed, leave the PR open, record "merged: NO — checks failing," report.

### 6. Capture learnings + tick the box — distill subagent + main loop
- **Distill — route by shape, don't dump.** A learning earns capture only if it's **checkable, recurring or high-cost, and phrased as a rule/scan**; prefer editing an existing line over adding a near-duplicate; **empty distill is the norm, not the exception.** Route each kept learning to where it fires:
  - a **codebase-specific review check** → `.claude/review-checklist.md`
  - a **universal authoring convention** → the matching `CLAUDE.md` section (Webview & rendering invariants / Code Comments / Design tokens)
  - a **loop-mechanics** improvement → this command file (or `fix-tickets.md`)
  - an **architecture / coverage gap** → a GitHub issue (surface in the report; don't auto-apply)
  - If it can become a test or hook, propose that instead of prose. (`.claude/lessons-learned.md` is retired — don't append to it.)
- **Tick the box:** flip this ticket's line in `~/dev/GitHub/obsidian-vault/Current.md` (and `Projects/speckit companion/composable-workflow/queue.md`) from `- [ ]` to `- [x]` with `→ [PR #NNN](url)`.

### 7. Reinstall + report — main loop
Run `/install-local` so the workspace ends current, then drop the throwaway bump:
```bash
git checkout main && git fetch origin && git pull --ff-only
# /install-local …
git restore package.json package-lock.json .specify/
```
**If the branch touched `speckit-extension/**`** — `/install-local` only refreshes the VS Code extension; the spec-kit extension also needs a `--dev` reinstall so the new `/speckit.companion.*` commands + workflow are resolvable in Claude Code. Check with `git diff --name-only origin/main...HEAD | grep -q '^speckit-extension/'`, and if so:
```bash
specify extension remove companion                # committed stub means a fresh add reports "already installed"
specify extension add ./speckit-extension --dev   # re-copies into .specify/extensions/companion/ + re-emits .claude/ command
specify extension list                            # confirm "companion" at the new state
git restore .specify/                             # gitignored dev-install copies — never commit these
```
The `.claude/` command emissions are **committed real files** (not gitignored like `.specify/`), and the merged PR should already carry the updated ones. If the reinstall leaves `.claude/` dirty (`git status`), that means the PR shipped without re-emitting — **surface it, don't silently restore or commit on main**; the emission belongs in the feature PR.
End with a tight summary: issue shipped, PR link, merged / in-review / blocked, new installed version, **whether the spec-kit extension was reinstalled**, lessons-captured count, and a **🖐️ manual-verification** list — the UI / sidebar / webview / settings surfaces a human should eyeball (vs what tests/CI already exercised).

## Guardrails

- **Never rebuild** — that's `/fix-tickets`' job. This ships what's already on the branch.
- **Never merge red checks.** Report instead.
- **Never commit version bumps or `.specify/` regenerated artifacts** into the feature PR (install-local's bump is throwaway — restore it).
- **Reinstall the spec-kit extension when the branch touched `speckit-extension/**`** — `/install-local` only covers the VS Code side; `specify extension remove companion && specify extension add ./speckit-extension --dev` is what makes the new `/speckit.companion.*` commands resolvable in Claude Code. Restore the gitignored `.specify/` copies; never commit them on main.
- Copilot is best-effort; its absence is not an error.
- Always reply to + resolve review threads (ours and Copilot's) after fixing.
