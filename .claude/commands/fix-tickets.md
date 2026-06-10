---
allowed-tools: Bash(git:*), Bash(gh:*), Bash(npm:*), Bash(node:*), Bash(python3:*), Bash(code:*), Bash(specify:*), Bash(date:*), Bash(sleep:*), Bash(jq:*), Agent, AskUserQuestion, Read, Write, Edit, Skill, TaskCreate, TaskUpdate
description: Autonomously fix one or more speckit-companion GitHub issues with the turbo pipeline — clean branch, fix, review, PR, Copilot review, merge, reinstall — then write a manual-verification report. Self-hosting build loop.
argument-hint: "<issue numbers e.g. '237 238 241'> | 'open' (all open issues) | <path to backlog .md>"
---

## What this does

A **self-hosting build loop** for `speckit-companion`. For each ticket, in strict sequence:

1. **Clean slate + install-local FIRST** — on `main`, `git fetch && git pull --ff-only`, then run `/install-local` so this ticket is fixed by the freshest build **and the latest `/speckit.companion.*` turbo commands** (the previous ticket's merge lands here). Discard the throwaway version bump, assert a clean tree. Refuse to start dirty.
2. **Fix (turbo)** — drive the SpecKit Companion turbo pipeline to fix the ticket.
3. **Code review** — run `/code-review`, apply findings.
4. **PR** — open a PR with `/create-pr` conventions.
5. **Copilot review** — request it, poll ~10 min.
6. **Address** — fix any Copilot comments and push; if Copilot never responds, fall back to our `/code-review` and proceed.
7. **Merge** — squash-merge, delete branch.
8. **Capture learnings + tick the box** — distill this ticket's review + Copilot findings into `.claude/lessons-learned.md` (so the *next* ticket's fix avoids the same bug class), and check the ticket off in the vault's `Current.md` queue with its PR link.
9. **Next ticket** — its step 1 `/install-local` installs *this* ticket's merge. After the last ticket, a closing `/install-local` installs the final merge. This is the point of the loop: prove the companion keeps working on itself as it improves.

After all tickets: generate one **themed HTML brief** (via the vault `/html-brief` skill) of everything fixed, in plain language, **flagging UI / manual-test items** so you know exactly what to verify by hand, what was already exercised by turbo (don't re-test), the **new lessons** captured, and any **architecture/skill flags** worth promoting.

## Locked defaults

- **Merge:** auto-merge, no per-ticket stop. You review via the final report + manual verification.
- **Copilot wait:** poll ~10 min, then fall back to our `/code-review` alone.
- **Sequential only.** Never parallelize — each `install-local` must land before the next ticket starts.
- **Heavy steps run in subagents** (the turbo fix, the code review, addressing Copilot comments, distilling learnings) so the main orchestration context stays lean. The main loop only does git/gh/decisions and accumulates the report.
- **The loop compounds.** Every ticket reads + appends to `.claude/lessons-learned.md`, so review/Copilot findings strengthen the *next* fix. Code lessons land automatically; promotions into the curated `CLAUDE.md` are *proposed* in the report, never auto-applied.
- **Queue gating honored.** `🔒 Gated` tickets are skipped; `⏸️ Review-gated` tickets pause before merge.

## Inputs

`$ARGUMENTS` is one of:
- A space-separated list of issue numbers: `237 238 241`
- `open` — process all currently-open issues (`gh issue list`), confirm the list first via AskUserQuestion before starting.
- A path to a backlog markdown file or folder — treat each item as a ticket (still requires a GitHub issue; create one with `/create-issue` if missing, confirm first).

If `$ARGUMENTS` is empty, list open issues and ask which to run.

---

## Procedure

> Run from the repo root: `~/dev/GitHub/speckit-companion`. Confirm with `git rev-parse --show-toplevel`.

### 0. Setup

- Resolve the ticket queue from `$ARGUMENTS` (see Inputs). Create a task list (`TaskCreate`) with one task per ticket so progress is visible.
- Read `gh issue view <N>` for each to confirm scope and capture the title/body for the fix subagent.
- **Honor the queue groups in `Current.md`** (`### Live queue (GitHub)`): tickets under `🔒 Gated / not ready` are **skipped** (never auto-run — they're release/blocked); tickets under `⏸️ Review-gated` are run but **paused before merge** (step 7). The `--review-merge` arg forces review-gate for the whole batch.
- Confirm the queue with the user **once** (AskUserQuestion) only when the queue was derived (`open` / backlog), not when explicit numbers were passed.

### For each ticket `N` (sequential):

#### 1. Clean slate + install-local FIRST — main loop
```bash
git rev-parse --show-toplevel              # must be the speckit-companion repo
git status --porcelain                     # MUST be empty — if not, STOP and report
git checkout main && git fetch origin && git pull --ff-only
```
If the tree is dirty, **do not** stash or discard. Stop the whole loop and report — a dirty tree means an earlier ticket left work uncommitted.

Then **install-local before fixing**, so this ticket runs on the freshest build and the latest turbo commands (this installs the *previous* ticket's just-merged work):
```bash
# Run the repo's /install-local command — it reinstalls BOTH the VS Code .vsix
# AND the spec-kit extension (re-emits the /speckit.companion.* turbo commands).
```
Invoke the `/install-local` command (Skill). It bumps `package.json` patch to make a fresh `.vsix` **and** regenerates spec-kit registry artifacts; all of it is throwaway and must not ride the feature PR — discard it to restore a clean tree:
```bash
# install-local drifts package.json + package-lock.json AND regenerates spec-kit
# registry files (.specify/extensions.yml, .specify/extensions/.registry, feature.json).
# All throwaway — restore the lot. (Restoring only the package files leaves the tree dirty.)
git restore package.json package-lock.json .specify/
git status --porcelain                        # MUST be empty again before fixing
```
Rationale: install-local is the **first** step of every ticket so each fix uses the updated companion. The `specify extension add --dev --force` inside it is what makes the *next* ticket actually use the turbo commands you just changed — the dogfooding crux.

#### 2. Fix with the turbo pipeline — **subagent**
Dispatch a `general-purpose` subagent. Its job: fix issue `N` end-to-end using the **turbo** command family, leave everything committed on a feature branch, return a concise structured result.

Subagent prompt must include:
- The issue number, title, and body.
- **Read `.claude/lessons-learned.md` first** (the "Code conventions" section) and honor it — those are bug classes prior tickets' reviews already caught.
- Instruction to ensure turbo profile is active for this run: `.specify/companion.yml` `templateProfile: turbo` (the companion skills are the `/speckit-companion-*` turbo family).
- The ordered chain (there is **no** one-shot): run, in order, the skills
  `/speckit-companion-specify` → `/speckit-companion-plan` → `/speckit-companion-tasks` → `/speckit-companion-implement`,
  passing the issue as the feature description. The `before_specify` git hook creates the `NNN-<shortname>` feature branch automatically; do not create one manually. Spec artifacts land in `specs/<NNN>-<slug>/`.
- After implement: ensure `specs/<NNN>-<slug>/` status is `completed`, all tasks checked. Commit only the real change + spec folder — **do NOT commit `.specify/` regenerated artifacts** (`feature.json`, registry files get swept by `git add -A`); `git checkout origin/main -- .specify/<file>` for any that show modified, then commit `src/`/`webview/`/`package.json` + `specs/<NNN>/`.
- **Verify before returning:** `npm run compile && npm test`. If `speckit-extension/**` changed, also `python3 speckit-extension/scripts/check-shape-parity.py`. If capture/timing changed, run the capture eval. Fix failures; do not return green if red.
- Return: `{ branch, specDir, filesChanged[], testsPassed, summary, uiOrManualSurfaces[] }` where `uiOrManualSurfaces` lists anything touching the VS Code UI / webview / sidebar / settings that a human should eyeball.

Capture this result. If the subagent reports it could not produce a passing fix, **skip merge** for this ticket, record it as "needs attention," and continue to the next ticket.

#### 3. Code review — **subagent (or `/code-review` inline)**
Run `/code-review` on the branch diff vs `main` at **high** effort, and apply the findings (`--fix`). Keep it in a subagent so the review reasoning doesn't fill the main context. Tell the subagent to **read `.claude/lessons-learned.md` first** and check the diff against those known bug classes too. Record what each finding was (you'll distill them in step 8). Commit and re-run `npm test` if code changed.

#### 4. Open the PR — main loop
Use the repo's `/create-pr` conventions (reads `.claude/pr-profile.md`): conventional-commit title `type(scope): summary`, body with `Closes #N`, summary, technical notes, and how-to-verify. Then:
```bash
git push -u origin <branch>
gh pr create --title "<title>" --body "<body>" --base main
```
Capture the PR number/URL.

#### 5. Request Copilot review — main loop (best-effort)
Add the GitHub Copilot reviewer. **Verified working method** (from the #218 dry run): the REST `requested_reviewers` call with the bot login — `gh pr edit --add-reviewer Copilot` does NOT work (fails with "Could not resolve user with login 'copilot'"). Try and gracefully fall back:
```bash
# Verified: REST requested_reviewers with the Copilot bot login.
gh api -X POST "repos/alfredoperez/speckit-companion/pulls/<PR>/requested_reviewers" \
  -f "reviewers[]=copilot-pull-request-reviewer[bot]" >/dev/null 2>&1 \
  && echo "[copilot] requested" \
  || echo "[copilot] unavailable — proceeding on our /code-review only"
```
Confirm it took by checking the PR's `requested_reviewers` includes the `Copilot` bot. Record whether Copilot was successfully requested.

#### 6. Wait for + address Copilot — main loop poll, then **subagent**
Only if Copilot was requested. Poll **gently** — Copilot takes ~4 min, so a tight interval just adds noise (it is NOT a rate-limit risk; GitHub allows 5k req/hr). Use **90s** intervals, ~12 min total, and run it as a background poll that exits on first hit:
```bash
for i in $(seq 1 8); do
  gh pr view <PR> --json reviews,comments \
    --jq '[.reviews[],.comments[]] | map(select(.author.login|test("[Cc]opilot")))'
  # break when a Copilot review/comment with actionable content appears
  sleep 90
done
```
- If Copilot returns actionable comments → dispatch a subagent to address them: fix, commit, push. Re-run `npm test`.
- If 10 min elapse with nothing → log "Copilot review timed out; relying on /code-review" and proceed. (This is the agreed fallback — our review covers it.)

#### 7. Merge + cleanup — main loop
Confirm CI/checks are green (`gh pr checks <PR>`):
```bash
gh pr checks <PR> --watch || true     # let CI finish
```
**Review-gate check.** If this ticket is marked **review-gated** (see Setup — e.g. it came from the `⏸️ Review-gated` group, or the user passed `--review-merge`), do **not** merge. Post the PR link, a one-line summary, and the manual-verification surfaces, then STOP this ticket here and move to the next — record it as "merged: NO — awaiting your review." Do the closing learnings/Current.md note as "in review," not "shipped."

Otherwise squash-merge:
```bash
gh pr merge <PR> --squash --delete-branch
```
If checks fail and can't be auto-addressed, leave the PR open, record as "merged: NO — checks failing," continue.

#### 8. Capture learnings + tick the box — **distill subagent** (cheap) + main loop
Two things, so the loop compounds and your tracker stays current:

**a) Distill learnings.** Dispatch a small subagent with the code-review findings (step 3) and Copilot comments (step 6) for THIS ticket. It appends to `~/dev/GitHub/speckit-companion/.claude/lessons-learned.md`, following that file's own rules:
- **Code conventions** — only a real bug class a reviewer caught, phrased as a do/don't, deduped against what's there. (Skip style nits.)
- **Loop operations** — anything that would make `/fix-tickets` itself run smoother next time.
- **Architecture / skill flags** — candidates to promote to `CLAUDE.md` / an ADR / a skill. These are NOT auto-applied; they get surfaced in the final report for your approval. Accumulate them across the run.
- If a ticket produced nothing high-signal, append nothing. An empty distill is fine.

**b) Tick the box in `Current.md`.** In the vault file `~/dev/GitHub/obsidian-vault/Current.md`, under `## SpecKit Companion → ### Live queue (GitHub)`, flip this ticket's line from `- [ ]` to `- [x]` and append `→ [PR #NNN](url)`, matching the existing shipped-line format. (Tickets are tracked there by `#NNN`; if a ticket isn't listed, add it under the right group as `- [x]`.)

Mark the ticket task `completed`.

#### 9. Next ticket — main loop
**Do not** run install-local here — the next ticket's **step 1** pulls this merge and installs it first thing. Loop to the next ticket.

---

### Closing install-local — after the last ticket merges

The loop installs each ticket's merge at the *start* of the next ticket, so the **final** ticket's merge is not yet installed. Install it now so the workspace ends current:
```bash
git checkout main && git fetch origin && git pull --ff-only
```
Run `/install-local`, then `git restore package.json package-lock.json .specify/` to drop the throwaway bump + regenerated registry artifacts. Optionally `code --command workbench.action.reloadWindow`. Record the final installed version for the report.

### Final report — after the queue is drained

Generate **one themed HTML brief via the vault `/html-brief` skill** (house dark-mode style — let the skill own the structure). Archive it under the vault's SDD briefs with a **unique dated name** `~/dev/GitHub/obsidian-vault/Projects/sdd/briefs/YYYY-MM-DD-fix-tickets-run.html` and **never overwrite a prior brief** — each run gets its own file. It must be **concise and plain-language**, covering:

- **Per ticket:** issue # + title, one-sentence "what was fixed," PR link, merged / in-review / skipped, new extension version after its `install-local`.
- **🖐️ Manual verification needed** — a clearly separated section listing the UI / sidebar / webview / settings surfaces from each ticket's `uiOrManualSurfaces[]`. This is the part the user spends their time on. For each: what changed and how to eyeball it.
- **Already exercised by turbo** — what the re-run of the companion pipeline + tests + CI proved (so the user knows NOT to re-test those).
- **🧠 Lessons captured this run** — the new entries added to `.claude/lessons-learned.md` (code conventions + loop ops).
- **🏗️ Architecture / skill flags** — the promotion candidates accumulated in step 8, each with a one-line "promote to `CLAUDE.md` / ADR / which skill?" suggestion for the user to approve.
- **Needs attention** — any ticket skipped (and why), PR left in review, or Copilot/CI gap.

End your chat response with a tight summary: tickets processed, merged vs in-review vs skipped, the final installed version, lessons-captured count, and a one-line pointer to the report — focused on *what happened*, not *how*.

## Guardrails

- **Never start a ticket on a dirty tree.** Stop and report instead.
- **Never parallelize tickets** — the `install-local` gate is the whole point.
- **Never force-merge red checks.** Leave the PR open and report it.
- **Auto-merge is on by default** (per this loop's design). If the user passed `--review-merge` in `$ARGUMENTS`, pause for a thumbs-up before each `gh pr merge` instead.
- Copilot is best-effort; its absence is not an error.
