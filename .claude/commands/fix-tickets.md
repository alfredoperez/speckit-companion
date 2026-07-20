---
allowed-tools: Bash(git:*), Bash(gh:*), Bash(npm:*), Bash(node:*), Bash(python3:*), Bash(code:*), Bash(specify:*), Bash(date:*), Bash(sleep:*), Bash(jq:*), Agent, AskUserQuestion, Read, Write, Edit, Skill, TaskCreate, TaskUpdate
description: Autonomously fix one or more speckit-companion GitHub issues with the SpecKit Companion pipeline — clean branch, fix, review, PR, Copilot review, merge, reinstall — then write a manual-verification report. Self-hosting build loop.
argument-hint: "<issue numbers e.g. '237 238 241'> | 'open' (all open issues) | <path to backlog .md> | --light [free-text tasks]"
---

## What this does

A **self-hosting build loop** for `speckit-companion`. For each ticket, in strict sequence:

> **Two modes.** The default (below) is the full loop: one issue per ticket, fixed by driving the SpecKit Companion pipeline on itself. **`--light`** ([Light mode](#light-mode---light)) drops the issue, the spec pipeline, and the sequencing for small mechanical changes, and fans out parallel worktree agents instead. It keeps the code review, tests, and CI. Light mode trades away the dogfooding signal — pick it deliberately, not by default.

1. **Clean slate + install-local FIRST** — on `main`, `git fetch && git pull --ff-only`, then run `/install-local` so this ticket is fixed by the freshest build **and the latest `/speckit.companion.*` commands** (the previous ticket's merge lands here). Discard the throwaway version bump, assert a clean tree. Refuse to start dirty.
2. **Fix** — drive the SpecKit Companion pipeline to fix the ticket.
3. **Code review** — run `/code-review`, apply findings.
4. **PR** — open a PR with `/create-pr` conventions.
5. **Copilot review** — request it, poll ~10 min.
6. **Address** — fix any Copilot comments and push; if Copilot never responds, fall back to our `/code-review` and proceed.
7. **Merge** — squash-merge, delete branch.
8. **Capture learnings + tick the box** — distill this ticket's review + Copilot findings and route each to where it fires (review check → `.claude/review-checklist.md`; authoring convention → a *proposed* `CLAUDE.md` edit; loop mechanics → this file; gap → an issue candidate), so the *next* ticket's fix avoids the same bug class. Then check the ticket off in the vault's `Current.md` queue with its PR link.
9. **Next ticket** — its step 1 `/install-local` installs *this* ticket's merge. After the last ticket, a closing `/install-local` installs the final merge. This is the point of the loop: prove the companion keeps working on itself as it improves.

After all tickets: write one **run report** (markdown, via the vault `obsidian` skill, into `Projects/speckit companion/reports/`) of everything fixed, in plain language, **flagging UI / manual-test items** so you know exactly what to verify by hand, what was already exercised by the pipeline (don't re-test), the **new lessons** captured, and any **architecture/skill flags** worth promoting. Use `/html-page` only to *export* it if it needs to leave the vault — HTML in the vault is unsearchable.

## Locked defaults

- **Merge:** auto-merge, no per-ticket stop. You review via the final report + manual verification.
- **Copilot wait:** poll ~10 min, then fall back to our `/code-review` alone.
- **Sequential only.** Never parallelize — each `install-local` must land before the next ticket starts. (`--light` lifts this; it has no per-ticket install to gate on. See [Light mode](#light-mode---light).)
- **Heavy steps run in subagents** (the fix, the code review, addressing Copilot comments, distilling learnings) so the main orchestration context stays lean. The main loop only does git/gh/decisions and accumulates the report.
- **The loop compounds.** Every ticket reads `.claude/review-checklist.md` (+ the `CLAUDE.md` conventions it points to) before fixing, and routes any new high-signal learning to where it fires (review check → checklist; authoring convention → `CLAUDE.md`; loop-mechanics → this file; gap → an issue). So review/Copilot findings strengthen the *next* fix. Convention/architecture promotions are *proposed* in the report, never auto-applied.
- **Queue gating honored.** `🔒 Gated` tickets are skipped; `⏸️ Review-gated` tickets pause before merge.

## Inputs

`$ARGUMENTS` is one of:
- A space-separated list of issue numbers: `237 238 241`
- `open` — process all currently-open issues (`gh issue list`), confirm the list first via AskUserQuestion before starting.
- A path to a backlog markdown file or folder — treat each item as a ticket (still requires a GitHub issue; create one with `/create-issue` if missing, confirm first).
- `--light` — run **light mode** (below). Takes issue numbers *or* free-text task descriptions, since light mode files no issues.

If `$ARGUMENTS` is empty, list open issues and ask which to run.

---

# Light mode (`--light`)

For changes that are **small and already understood** — a wrong regex, a stale doc, a missing emission, a manifest tweak. It drops the ceremony, not the safety: the code review, the tests, and CI all stay, because those are what actually catch bugs. What it drops is the paperwork.

## What light mode changes

| Step | Full loop | Light |
|---|---|---|
| GitHub issue | required (`Closes #N`) | **none** — the PR body carries the why |
| Fix | SpecKit Companion pipeline (`specify → plan → tasks → implement`), writes `specs/NNN-*/` | **direct fix**, no spec folder |
| Execution | strictly sequential | **parallel worktree subagents** |
| `install-local` | before every ticket | **once, at the end** |
| Code review | `/code-review` high, applied | **unchanged** |
| Copilot | loop until a pass is clean | **one pass** on logic changes; **skipped** for docs/manifest-only |
| Learnings | distill per ticket | **one distill** for the batch |
| Report | themed HTML brief | **chat summary** |

## What light mode COSTS — read before choosing it

**The spec pipeline is the dogfooding.** Running the Companion workflow on itself is the entire reason this loop exists — it's how the broken `adopt` command, the no-op reconciler, and the packaging gap were found. Light mode trades that signal away.

So light mode is a **named exception for small changes, never the default.** If a task turns out to be bigger than it looked — it needs a design decision, or it touches derived state / lifecycle / capture — **stop and escalate it to the full loop**. Don't push a large change through light mode because it was already started there.

**Growing past your named file set is NOT by itself an escalation trigger.** Chasing one root cause into more files is the job: #442 started as "a wrong path constant" and ended up also fixing the skills list the sidebar renders — because it was one bug (the registry lied, and a consumer ignored it anyway), and stopping at the named files would have shipped half of it. The test is *"is this still one coherent defect?"*, not *"is this still three files?"* Escalate when the **decision** grows (a new design call, a behavior the user has to choose), not when the **blast radius** does. If the file set widens, say so in the PR body and re-check disjointness against the other in-flight branches.

## Choosing light vs full

**Light is fine when** the fix is mechanical and the *what* is settled: a parsing bug with a known cause, a doc that contradicts the code, a missing file emission, a manifest/menu change, deleting dead code.

**Use the full loop when** any of these is true:
- The fix needs a design decision (the issue asks "should we…?").
- It touches **derived state**, lifecycle/status writing, or capture (`.spec-context.json`) — this repo's worst bug class lives there.
- It's user-facing UI/UX with a visual judgment to make.
- You can't name the files it will touch before starting.

> A user-visible **bug** can still be light — but give it the full review + Copilot treatment even while skipping the spec ceremony. Skipping paperwork is not the same as skipping scrutiny.

## Parallel worktrees — the four collisions

Light mode runs one subagent per task, **each with `isolation: "worktree"`**. This is mandatory, not an optimization: background agents otherwise share one working tree and branch, and they *will* clobber each other's git state.

Four things collide if you're not careful. Note that the first two are precisely why parallelism is safe **only** in light mode:

1. **Spec numbering race.** `before_specify` picks the next `NNN-` by scanning `specs/`. Two agents starting together both choose the same number. — *Cannot happen in light mode: no spec pipeline.*
2. **A fresh worktree has no companion commands.** `.specify/extensions/companion/` is **gitignored** (it's the `--dev` install), so a new worktree checks out tracked files only and `/speckit.companion.*` does not exist there. An agent running the pipeline in a worktree fails — or silently falls back, which is worse. — *Cannot happen in light mode: no pipeline. If you ever need it, the worktree must run `specify extension add ./speckit-extension --dev --force` first.*
3. **`install-local` is a global singleton.** One VS Code extension host, one `~/.vscode/extensions`. It cannot be parallelized — run it **once, after all merges**.
4. **A fresh worktree has no `node_modules` — run `npm ci` FIRST or every test run lies.** `node_modules/` is gitignored, so a new worktree checks out source only. Worse than an obvious "command not found": jest's `moduleNameMapper` is pinned to `rootDir`, so ~10 suites fail on *module resolution* and read like real regressions. Two of four agents hit this on the first light run and one nearly reported it as a broken build. **`npm ci` in the worktree before you trust any `npm test` / `npm run compile` output** — and if a test suite fails on `Cannot find module`, that is this, not your change.

**Disjointness gate.** Before fanning out, name the files each task will touch. **If two tasks touch the same file, do not run them in parallel** — run those two sequentially (or fold them into one PR). Parallel PRs on the same file just move the conflict to merge time.

## Light procedure

### L0. Setup — main loop
- Assert a clean tree on `main`, `git fetch && git pull --ff-only`. **Refuse to start dirty.**
- Resolve the task list from `$ARGUMENTS` (issue numbers and/or free-text). `TaskCreate` one task each.
- **Name the file set for each task** and check disjointness (above). Group any overlapping tasks to run sequentially.
- **Do NOT run `install-local` here** — light mode installs once at the end.

### L1. Fan out — parallel subagents, one per task, `isolation: "worktree"`
Dispatch all disjoint tasks **in a single message** so they run concurrently. Each subagent:
- Reads `.claude/review-checklist.md` (+ the `CLAUDE.md` conventions it points to) **first**.
- **Runs `npm ci` in the worktree before anything else** (collision 4 above) — otherwise its test run is meaningless.
- **Verifies the defect still reproduces on current `main`** before building. Stale tasks are common; if it's already fixed, STOP and report that with evidence instead of inventing a change.
- Fixes it **directly** — no `/speckit-companion-*` chain, no `specs/NNN-*/` folder.
- Updates the docs the change requires (`CLAUDE.md`'s doc-map is not optional in light mode).
- Runs `npm run compile && npm test` (+ `npm run package` if the manifest/webview changed). **Does not return green if red.**
- Commits on a branch named `light/<slug>` and **pushes**.
- Returns `{ branch, filesChanged[], testsPassed, summary, uiOrManualSurfaces[], escalate? }`.

If a subagent returns `escalate` — the task was bigger than it looked — **do not merge it**. Leave the branch, report it, and re-run it through the full loop.

### L2. Review — one subagent per branch
`/code-review` at **high** effort on each branch's diff vs `main`, apply findings, commit, re-run tests. Same as the full loop; this step is not lightened.

### L3. PR + Copilot — main loop
Open a PR per branch (`/create-pr` conventions). Since there's no issue, **the PR body must carry the why** — what was broken, how you know, how to verify. No `Closes #N`.

Copilot, by change kind:
- **Logic** (parsers, derived state, dispatch, data writers) → request Copilot, **one pass**, address findings. If that fix itself changes logic, loop until a pass is clean (the full-loop rule still applies to the riskiest code).
- **Docs / manifest / dead-code removal only** → **skip Copilot.** Our review + CI is the bar. A poll loop here buys nothing but 10 minutes.

### L4. Merge — main loop, sequential
Merge **one at a time**, confirming CI green on each (`gh pr checks`). After each merge, the next PR is behind `main` — if GitHub reports a conflict or the branch is stale, rebase it before merging. (This is the tax for parallel branches; it's cheap when the file sets are disjoint, which is why L0 gates on that.)

### L5. Close out — main loop
- **One** `install-local`, then `git restore package.json package-lock.json .specify/`. Your living-spec capabilities are safe from this: they live in `living-specs.yml` at the repo root, outside the folder that gets restored.
- **One** learnings distill for the whole batch (same routing rules as the full loop: checklist / `CLAUDE.md` proposal / this file / issue candidate). An empty distill is the norm.
- **Chat summary**, not an HTML brief: what shipped, what needs manual eyeballing, anything escalated.

---

# Full loop (default)

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

Then **install-local before fixing**, so this ticket runs on the freshest build and the latest commands (this installs the *previous* ticket's just-merged work):
```bash
# Run the repo's /install-local command — it reinstalls BOTH the VS Code .vsix
# AND the spec-kit extension (re-emits the /speckit.companion.* commands).
```
Invoke the `/install-local` command (Skill). It bumps `package.json` patch to make a fresh `.vsix` **and** regenerates spec-kit registry artifacts; all of it is throwaway and must not ride the feature PR — discard it to restore a clean tree:
```bash
# install-local drifts package.json + package-lock.json AND regenerates spec-kit
# registry files (.specify/extensions.yml, .specify/extensions/.registry, feature.json).
# All throwaway — restore the lot. (Restoring only the package files leaves the tree dirty.)
git restore package.json package-lock.json .specify/
git status --porcelain                        # MUST be empty again before fixing
```
Rationale: install-local is the **first** step of every ticket so each fix uses the updated companion. The `specify extension add --dev --force` inside it is what makes the *next* ticket actually use the commands you just changed — the dogfooding crux.

#### 2. Fix with the SpecKit Companion pipeline — **subagent**
Dispatch a `general-purpose` subagent. Its job: fix issue `N` end-to-end using the **SpecKit Companion** command family, leave everything committed on a feature branch, return a concise structured result.

Subagent prompt must include:
- The issue number, title, and body.
- **Read `.claude/review-checklist.md` first** (and the `CLAUDE.md` conventions it points to) and honor it — those are bug classes prior tickets' reviews already caught.
- **VERIFY THE BUG REPRODUCES on current `main` before building.** Backlog tickets go stale — they're frequently already fixed by a later PR, a duplicate, or an already-correct path (this happened to ~3 of 8 tickets in one batch). Have the subagent confirm the defect exists in the current code first; if it's already fixed, STOP and report that with evidence (so the orchestrator closes it as resolved/dup) instead of inventing a change. Deliver only the genuinely-missing part.
- No profile to set — SpecKit Companion is the single workflow (the old `templateProfile: turbo` preset was removed). The companion skills are the `/speckit-companion-*` family.
- The ordered chain (there is **no** one-shot): run, in order, the skills
  `/speckit-companion-specify` → `/speckit-companion-plan` → `/speckit-companion-tasks` → `/speckit-companion-implement`,
  passing the issue as the feature description. The `before_specify` git hook creates the `NNN-<shortname>` feature branch automatically; do not create one manually. Spec artifacts land in `specs/<NNN>-<slug>/`.
- After implement: **complete the spec.** The SpecKit Companion flow completes a spec at its last node (mark-complete is its terminal node) — that's its advantage over stock, so ensure `specs/<NNN>-<slug>/` status is `completed` (run `python3 speckit-extension/scripts/write-context.py --feature-dir specs/<NNN>-<slug> --mark-complete --by ai` if the flow didn't already). **NEVER revert a Companion-built spec from `completed` back to `implemented`.** Confirm all tasks checked and the `.spec-context.json` `specName` is the real name (not a `[FEATURE NAME]` placeholder). Commit only the real change + spec folder — **do NOT commit `.specify/` regenerated artifacts** (`feature.json`, registry files get swept by `git add -A`); `git checkout origin/main -- .specify/<file>` for any that show modified, then commit `src/`/`webview/`/`package.json` + `specs/<NNN>/`.
- **Verify before returning:** `npm run compile && npm test`. If `speckit-extension/**` changed, also `python3 speckit-extension/scripts/check-shape-parity.py`. If capture/timing changed, run the capture eval. Fix failures; do not return green if red.
- Return: `{ branch, specDir, filesChanged[], testsPassed, summary, uiOrManualSurfaces[] }` where `uiOrManualSurfaces` lists anything touching the VS Code UI / webview / sidebar / settings that a human should eyeball.

Capture this result. If the subagent reports it could not produce a passing fix, **skip merge** for this ticket, record it as "needs attention," and continue to the next ticket.

#### 3. Code review — **subagent (or `/code-review` inline)**
Run `/code-review` on the branch diff vs `main` at **high** effort, and apply the findings (`--fix`). Keep it in a subagent so the review reasoning doesn't fill the main context. Tell the subagent to **read `.claude/review-checklist.md` first** (and the `CLAUDE.md` conventions it points to) and check the diff against those known bug classes too. Record what each finding was (you'll distill them in step 8). Commit and re-run `npm test` if code changed.

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
Only if Copilot was requested. Poll **gently** — Copilot takes **~4–5 min**, so **wait an initial `sleep 300` before the first check**, then poll at **90s** intervals (~12 min total). It is NOT a rate-limit risk (GitHub allows 5k req/hr); the delay just avoids no-op early checks. Run it as a background poll that exits on first hit:
```bash
sleep 300   # Copilot's SLA — don't poll before this
for i in $(seq 1 8); do
  gh pr view <PR> --json reviews,comments \
    --jq '[.reviews[],.comments[]] | map(select(.author.login|test("[Cc]opilot")))'
  # break when a Copilot review/comment with actionable content appears
  sleep 90
done
```
- If Copilot returns actionable comments → dispatch a subagent to address them: fix, commit, push. Re-run `npm test`.
- If 10 min elapse with nothing → log "Copilot review timed out; relying on /code-review" and proceed. (This is the agreed fallback — our review covers it.)

**Re-request Copilot after EVERY logic-changing fix — loop until a pass comes back clean.** A fix commit is the least-reviewed code in the PR: it was seen by neither Copilot nor `/code-review`, and it lands under time pressure. So:
- **If the fix changed real LOGIC** (control flow, a migration, a data-shape writer, an auth/availability gate, a DOM/lifecycle refactor, etc.) → **capture the current Copilot inline-comment count as a baseline, re-request Copilot, and poll for NEW comments** (count > baseline). Address any new findings, then **repeat** — the fix you just wrote is now itself the unreviewed commit. Merge only on a pass that returns nothing new (~12 min quiet = all-clear).
- **If the fix was only docs / CSS / labels / a comment** → skip the extra pass; merge after CI. A second loop there just adds ~5–12 min for no signal.
- **Don't budget for exactly one extra pass.** #433 needed **four**, and each found something real — pass 3's top finding was a regression *introduced by pass 2's fix* (a cycle-breaking refactor left `closeInlineEditor()` unable to find its target). The trigger condition ("did the fix change logic?") is right; the count is not bounded.
- **A finding two independent reviewers raise is a fix order, not a note.** `/code-review` flagged a circular import and declined to fix it ("resolves fine today"); Copilot re-raised it independently. When the second reviewer lands on something ours consciously waived, do it — breaking that cycle surfaced a *second*, pre-existing cycle of the same class that neither reviewer had seen.
- **Settle a framework-semantics dispute with a test, not an argument.** On #433 both `/code-review` and Copilot reasoned confidently about Preact's input handling and **both were wrong** — Copilot's stated bug ("controlled, can't type") didn't exist, and the real one (Preact forces the DOM back to the vnode's `value`, so an open editor silently reverted and Save wrote the *old* text) was found only by writing the test. When a review thread turns on "how does the framework behave here," stop arguing and write the assertion.

Re-request + baseline pattern:
```bash
BASE=$(gh api "repos/alfredoperez/speckit-companion/pulls/<PR>/comments" --jq '[.[]|select(.user.login|test("[Cc]opilot"))]|length')
gh api -X POST "repos/alfredoperez/speckit-companion/pulls/<PR>/requested_reviewers" -f "reviewers[]=copilot-pull-request-reviewer[bot]" >/dev/null 2>&1
# then sleep 300 and poll for the inline-comment count to exceed $BASE (new findings); if none in ~12 min, merge.
# Re-run this whole block after each logic-changing fix — the baseline resets each round.
```
This caught real logic bugs across the touchups batch, and on #433 it kept finding them through four rounds — including a regression a fix commit had just introduced.

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

**a) Distill learnings — route by shape, don't dump.** Dispatch a small subagent with the code-review findings (step 3) and Copilot comments (step 6) for THIS ticket. A learning earns capture only if it's **checkable, recurring or high-cost, and phrased as a rule/scan**; prefer editing an existing line over a near-duplicate; **an empty distill is the norm.** Route each kept learning to where it fires:
- a **codebase-specific review check** → `.claude/review-checklist.md`
- a **universal authoring convention** → the matching `CLAUDE.md` section (Webview & rendering invariants / Code Comments / Design tokens) — *proposed* in the report, not auto-applied
- a **loop-mechanics** improvement → this command file
- an **architecture / coverage gap** → a GitHub issue (accumulate across the run, surface in the report)
- If it can become a test or hook, propose that instead of prose. (`.claude/lessons-learned.md` is retired — don't append to it.)

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
Run `/install-local`, then `git restore package.json package-lock.json .specify/` to drop the throwaway bump + regenerated registry artifacts. Your living-spec capabilities are safe from this: they live in `living-specs.yml` at the repo root, outside the folder that gets restored. Optionally `code --command workbench.action.reloadWindow`. Record the final installed version for the report.

### Final report — after the queue is drained

Write **one markdown run report** (via the vault `obsidian` skill) to `~/dev/GitHub/obsidian-vault/Projects/speckit companion/reports/YYYY-MM-DD-fix-tickets-run.md`. **Never overwrite a prior report** — each run gets its own dated file. Markdown, not HTML: the vault's reports are markdown so they stay searchable and linkable; reach for `/html-page` only to *export* one that has to leave the vault. It must be **concise and plain-language**, covering:

- **Per ticket:** issue # + title, one-sentence "what was fixed," PR link, merged / in-review / skipped, new extension version after its `install-local`.
- **🖐️ Manual verification needed** — a clearly separated section listing the UI / sidebar / webview / settings surfaces from each ticket's `uiOrManualSurfaces[]`. This is the part the user spends their time on. For each: what changed and how to eyeball it.
- **Already exercised by the pipeline** — what the re-run of the companion pipeline + tests + CI proved (so the user knows NOT to re-test those).
- **🧠 Lessons captured this run** — new review checks added to `.claude/review-checklist.md` and loop-mechanics tweaks to this command file (with where each landed).
- **🏗️ Architecture / skill flags** — the promotion candidates accumulated in step 8, each with a one-line "promote to `CLAUDE.md` / ADR / which skill?" suggestion for the user to approve.
- **Needs attention** — any ticket skipped (and why), PR left in review, or Copilot/CI gap.

End your chat response with a tight summary: tickets processed, merged vs in-review vs skipped, the final installed version, lessons-captured count, and a one-line pointer to the report — focused on *what happened*, not *how*.

## Guardrails

- **Never start a ticket on a dirty tree.** Stop and report instead.
- **Never parallelize tickets in the full loop** — the `install-local` gate is the whole point. (`--light` parallelizes *because* it has no such gate; it must still use `isolation: "worktree"` and the disjoint-file check.)
- **Never force-merge red checks.** Leave the PR open and report it.
- **Auto-merge is on by default** (per this loop's design). If the user passed `--review-merge` in `$ARGUMENTS`, pause for a thumbs-up before each `gh pr merge` instead.
- Copilot is best-effort; its absence is not an error.
- **Light mode never silently absorbs a big change.** If a `--light` task needs a design decision, or touches derived state / lifecycle / capture, the subagent returns `escalate` and it goes through the full loop instead. A widening *file set* alone is not an escalation — one coherent root cause may legitimately span more files than you named (see [What light mode COSTS](#what-light-mode-costs--read-before-choosing-it)); report the widened set and re-check disjointness. Skipping paperwork is not skipping scrutiny.
- **Never trust a test run in a fresh worktree until `npm ci` has run there.** Module-resolution failures masquerade as regressions.
- **Never run `install-local` inside a worktree.** It installs a global VS Code extension and regenerates `.specify/` — it belongs to the main loop, once, at the end.
