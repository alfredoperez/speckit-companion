---
allowed-tools: Bash(git:*), Bash(gh:*), Bash(npm:*), Bash(node:*), Bash(python3:*), Bash(code:*), Bash(specify:*), Bash(date:*), Bash(sleep:*), Bash(jq:*), Agent, AskUserQuestion, Read, Write, Edit, Skill, TaskCreate, TaskUpdate
description: Autonomously fix one or more speckit-companion GitHub issues with /speckit-companion-auto — fresh main, auto (fix + reviews + PR), merge, learnings — then one install-local and a manual-verification report. Self-hosting build loop.
argument-hint: "<issue numbers e.g. '237 238 241'> | 'open' (all open issues) | <path to backlog .md> | --light [free-text tasks]"
---

## What this does

A **self-hosting build loop** for `speckit-companion`. For each ticket, in strict sequence:

> **Two modes.** The default (below) is the full loop: one issue per ticket, fixed by running `/speckit-companion-auto` on itself. **`--light`** ([Light mode](#light-mode---light)) drops the issue, the spec pipeline, and the sequencing for small mechanical changes, and fans out parallel worktree agents instead. It keeps the code review, tests, and CI. Light mode trades away the dogfooding signal — pick it deliberately, not by default.

1. **Fresh `main`** — pull, and if the pull changed `speckit-extension/`, refresh the installed companion commands so this ticket runs on the previous ticket's merge.
2. **Auto** — confirm the bug still reproduces, then run `/speckit-companion-auto`. Its project hooks (`.specify/companion.yml`, after implement's `handoff`) do the self-review, `/code-review` + `/codex:review` in parallel (max two rounds), the commit, and the PR.
3. **Merge** — squash-merge once CI is green.
4. **Learnings** — log the review findings to the Review Ledger, route each kept lesson to where it fires, tick the ticket in `Current.md`.
5. **Next ticket.**

After all tickets: one closing `/install-local`, then one **run report** (markdown, via the vault `obsidian` skill, into `Projects/speckit companion/reports/`) of everything fixed, in plain language, **flagging UI / manual-test items**, what the pipeline already exercised (don't re-test), the **new lessons** captured, and any **architecture/skill flags** worth promoting. Use `/html-page` only to *export* it if it needs to leave the vault — HTML in the vault is unsearchable.

## Locked defaults

- **Merge:** auto-merge, no per-ticket stop. You review via the final report + manual verification.
- **Auto runs in the main loop, not a subagent.** Its review hook dispatches `/code-review` and `/codex:review` as two subagents; inside a subagent that nesting fails and the hook falls back to `/code-review` alone, silently dropping Codex. Keep the main context lean another way: after each ticket, re-derive state from `git`/`gh` and the ticket's result line, not from the transcript.
- **The auto hooks are the review gate.** Don't add a second `/code-review` pass on top — that's what the old loop did, and it reviewed every ticket twice.
- **Sequential only.** Never parallelize — each ticket must run on the previous ticket's merged commands. (`--light` lifts this. See [Light mode](#light-mode---light).)
- **The loop compounds.** Every ticket reads `.claude/review-checklist.md` (+ the `CLAUDE.md` conventions it points to) before fixing, and routes any new high-signal learning to where it fires (review check → checklist; authoring convention → `CLAUDE.md`; loop-mechanics → this file; gap → an issue). Convention/architecture promotions are *proposed* in the report, never auto-applied.
- **Queue gating honored.** `🔒 Gated` tickets are skipped; `⏸️ Review-gated` tickets pause before merge.

## Inputs

`$ARGUMENTS` is one of:
- A space-separated list of issue numbers: `237 238 241`
- `open` — process all currently-open issues (`gh issue list`), confirm the list first via AskUserQuestion before starting.
- A path to a backlog markdown file or folder — treat each item as a ticket (still requires a GitHub issue; create one with `/create-github-issue` if missing, confirm first).
- `--light` — run **light mode** (below). Takes issue numbers *or* free-text task descriptions, since light mode files no issues.

If `$ARGUMENTS` is empty, list open issues and ask which to run.

---

# Light mode (`--light`)

For changes that are **small and already understood** — a wrong regex, a stale doc, a missing emission, a manifest tweak. It drops the ceremony, not the safety: the code review, the tests, and CI all stay, because those are what actually catch bugs. What it drops is the paperwork.

## What light mode changes

| Step | Full loop | Light |
|---|---|---|
| GitHub issue | required (`Closes #N`) | **none** — the PR body carries the why |
| Fix | `/speckit-companion-auto`, writes `specs/NNN-*/` | **direct fix**, no spec folder |
| Execution | strictly sequential | **parallel worktree subagents** |
| `install-local` | **once, at the end** (commands refreshed per ticket) | **once, at the end** |
| Code review | auto's hooks: `/code-review` + `/codex:review` in parallel, max two rounds, findings logged to the Review Ledger | `/code-review` high + `/codex:review` per branch (L2) |
| Learnings | distill per ticket | **one distill** for the batch |
| Report | markdown run report in the vault | **chat summary** |

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

> A user-visible **bug** can still be light — but give it the full `/code-review` treatment (including the re-review pass on logic-changing fixes) even while skipping the spec ceremony. Skipping paperwork is not the same as skipping scrutiny.

## Parallel worktrees — the four collisions

Light mode runs one subagent per task, **each with `isolation: "worktree"`**. This is mandatory, not an optimization: background agents otherwise share one working tree and branch, and they *will* clobber each other's git state.

Four things collide if you're not careful. Note that the first two are precisely why parallelism is safe **only** in light mode:

1. **Spec numbering race.** Specify picks the next `NNN-` by scanning `specs/`. Two agents starting together both choose the same number. — *Cannot happen in light mode: no spec pipeline.*
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
`/code-review` at **high** effort on each branch's diff vs `main`, with `/codex:review --base main --scope branch` in parallel, apply findings, commit, re-run tests, log each finding to the Review Ledger. Max two rounds, like the full loop; this step is not lightened.

### L3. PR — main loop
Open a PR per branch (`/create-pr` conventions). Since there's no issue, **the PR body must carry the why** — what was broken, how you know, how to verify. No `Closes #N`. (The review already happened in L2; if an L2 fix changed real logic, re-run `/code-review` on it before opening the PR.)

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
- Read `gh issue view <N>` for each to confirm scope and capture the title/body.
- **Honor the queue groups in `Current.md`** (`### Live queue (GitHub)`): tickets under `🔒 Gated / not ready` are **skipped**; tickets under `⏸️ Review-gated` are run but **paused before merge** (step 3). The `--review-merge` arg forces review-gate for the whole batch.
- Confirm the queue with the user **once** (AskUserQuestion) only when the queue was derived (`open` / backlog), not when explicit numbers were passed.

### For each ticket `N` (sequential):

#### 1. Fresh `main` — main loop
```bash
git rev-parse --show-toplevel              # must be the speckit-companion repo
git status --porcelain                     # MUST be empty — if not, STOP and report
git checkout main && git fetch origin
BEFORE=$(git rev-parse HEAD) && git pull --ff-only
git diff --quiet "$BEFORE" HEAD -- speckit-extension/ || specify extension add ./speckit-extension --dev --force
git restore .specify/ && git status --porcelain   # MUST be empty again
```
If the tree is dirty, **do not** stash or discard. Stop the whole loop and report — a dirty tree means an earlier ticket left work uncommitted.

The installed companion commands (`.specify/extensions/companion/`, `.claude/skills/speckit-companion-*`) are **gitignored copies**, so `git pull` alone leaves them stale. The `specify extension add` refresh is what makes this ticket run on the commands the previous ticket just merged — the dogfooding crux. The `.vsix` is not needed per ticket: the pipeline runs in the CLI, not the VS Code extension.

#### 2. Reproduce, then auto — main loop
- **Read `.claude/review-checklist.md` first** (and the `CLAUDE.md` conventions it points to).
- **Verify the bug reproduces on current `main`.** Backlog tickets go stale — they're frequently already fixed, duplicates, or already-correct paths (~3 of 8 in one batch). If it's already fixed, STOP this ticket, close the issue as resolved/dup with the evidence, and move on. Deliver only the genuinely-missing part.
- Run `/speckit-companion-auto` with the issue as the feature description. Include `Issue #N: <title>` and the body, and say the PR body must carry `Closes #N`.
- Auto runs specify → plan → tasks → implement unattended and ends at `completed`. Implement's hooks in `.specify/companion.yml` then self-review, run `/code-review` + `/codex:review` in parallel (max two rounds; anything still open goes into the PR body as a gap), commit, and open the PR via `/create-pr`. It does not merge.
- **Keep the review findings.** As auto's reviews return, note each finding: what it was, who found it (`code-review` / `codex` / `both`), severity, and whether it changed code. Steps 4a and 4b need them; the transcript won't be re-read.
- **Check what auto left behind before merging:**
  - `specs/<NNN>-<slug>/` is `completed`, all tasks checked, `specName` is the real name (not `[FEATURE NAME]`). **NEVER revert a Companion-built spec from `completed` back to `implemented`.**
  - The PR does not carry regenerated `.specify/` artifacts (`feature.json`, registry files). **One exception:** if the PR adds or renames a command in `extension.yml`, `.specify/extensions/.registry` MUST stay in the diff — CI's `check-command-emissions.py` gate requires it.
  - `npm run compile && npm test` is green. If `speckit-extension/**` changed, also `python3 speckit-extension/scripts/check-shape-parity.py`. If capture/timing changed, run the capture eval.
  - Note any UI / webview / sidebar / settings surface a human should eyeball, for the report.
  - Push any fixes to the PR branch.
- **Log the subagents — observe, never force.** Run `python3 .claude/scripts/subagent-tally.py specs/<NNN>-<slug>`. It reads this session's transcript and prints, per step, the subagents auto actually dispatched next to what that step's rule expects (plan: one reader per recorded `area:`, at most 4, plus 2 design-doc writers, nothing on a simple run; implement: one per story phase with 5+ files, up to 4 per Foundational wave of 4+ tasks, plus 2 reviewers per round). Copy the output into the ticket's result line as is. Do not re-run a step to get the expected number, and do not dispatch workers auto skipped: a gap between expected and actual is a finding for the report, not something to fix mid-ticket.
- If auto can't produce a passing fix, or ends without a PR, record the ticket as "needs attention," get back to a clean `main`, and continue.

Then write one result line for the ticket (PR, spec dir, summary, manual surfaces, findings, subagent tally) and work from that, not the transcript, for the rest of the run.

#### 3. Merge + cleanup — main loop
```bash
gh pr checks <PR> --watch || true     # let CI finish
```
**Review-gate check.** If this ticket is **review-gated** (the `⏸️ Review-gated` group, or `--review-merge`), do **not** merge. Post the PR link, a one-line summary, and the manual-verification surfaces, record it as "merged: NO — awaiting your review," and move to the next ticket.

Otherwise:
```bash
gh pr merge <PR> --squash --delete-branch
```
If checks fail and can't be fixed on the branch, leave the PR open, record "merged: NO — checks failing," continue.

#### 4. Learnings + tick the box — main loop
**a) Review Ledger.** Append one row per finding to `~/dev/GitHub/obsidian-vault/Projects/speckit companion/Review Ledger.md`: date, PR, the finding in a line, found by `code-review` / `codex` / `both`, severity, changed code or not. Write it on every run, including when Codex found nothing — it's the only record of whether the second reviewer earns its place.

**b) Distill — route by shape, don't dump.** A learning earns capture only if it's **checkable, recurring or high-cost, and phrased as a rule/scan**; prefer editing an existing line over a near-duplicate; **an empty distill is the norm.** Route each kept learning:
- a **codebase-specific review check** → `.claude/review-checklist.md`
- a **universal authoring convention** → the matching `CLAUDE.md` section — *proposed* in the report, not auto-applied
- a **loop-mechanics** improvement → this command file
- an **architecture / coverage gap** → a GitHub issue candidate (accumulate across the run, surface in the report)
- If it can become a test or hook, propose that instead of prose.

**c) Tick the box in `Current.md`.** In `~/dev/GitHub/obsidian-vault/Current.md`, under `## SpecKit Companion → ### Live queue (GitHub)`, flip the ticket's line from `- [ ]` to `- [x]` and append `→ [PR #NNN](url)`, matching the existing format. If the ticket isn't listed, add it under the right group as `- [x]`.

Mark the ticket task `completed` and loop to the next ticket.

---

### Closing install-local — after the last ticket

```bash
git checkout main && git fetch origin && git pull --ff-only
```
Run `/install-local`, then `git restore package.json package-lock.json .specify/` to drop the throwaway bump + regenerated registry artifacts. Living-spec capabilities are safe from this: they live in `living-specs.yml` at the repo root. Optionally `code --command workbench.action.reloadWindow`. Record the installed version for the report.

### Final report

Write **one markdown run report** (via the vault `obsidian` skill) to `~/dev/GitHub/obsidian-vault/Projects/speckit companion/reports/YYYY-MM-DD-fix-tickets-run.md`. **Never overwrite a prior report.** Concise and plain-language:

- **Per ticket:** issue # + title, one-sentence "what was fixed," PR link, merged / in-review / skipped / needs attention.
- **🖐️ Manual verification needed** — the UI / sidebar / webview / settings surfaces from each ticket. For each: what changed and how to eyeball it.
- **🤖 Subagents** — one row per ticket and step from the tally: dispatched vs expected. Call out every gap in plain words (e.g. "plan expected 3 area workers, ran 0"), and any step that never dispatches in an auto run at all. This is how we know users actually get the fan-out the commands promise.
- **Already exercised by the pipeline** — what auto + tests + CI proved, so the user doesn't re-test those.
- **🧠 Lessons captured this run** — review checks added to `.claude/review-checklist.md` and loop tweaks to this file, with where each landed.
- **🏗️ Architecture / skill flags** — the promotion candidates from step 4b, each with a one-line "promote to `CLAUDE.md` / ADR / which skill?" suggestion.
- **Needs attention** — skipped tickets and why, PRs left in review, CI gaps.
- The final installed version.

End the chat response with a tight summary: tickets processed, merged vs in-review vs skipped, subagents dispatched vs expected, the installed version, lessons-captured count, and a pointer to the report.

## Guardrails

- **Never start a ticket on a dirty tree.** Stop and report instead.
- **Never parallelize tickets in the full loop** — each ticket must run on the previous one's merged commands. (`--light` parallelizes *because* it has no such gate; it must still use `isolation: "worktree"` and the disjoint-file check.)
- **Never force-merge red checks.** Leave the PR open and report it.
- **Auto-merge is on by default** (per this loop's design). If the user passed `--review-merge` in `$ARGUMENTS`, pause for a thumbs-up before each `gh pr merge` instead.
- **Never run auto in a subagent** — its review hook can't nest subagents and silently drops Codex.
- **Two review rounds is the ceiling** (auto's hook enforces it); anything still open goes into the PR body or a follow-up issue.
- **Light mode never silently absorbs a big change.** If a `--light` task needs a design decision, or touches derived state / lifecycle / capture, the subagent returns `escalate` and it goes through the full loop instead. A widening *file set* alone is not an escalation — one coherent root cause may legitimately span more files than you named (see [What light mode COSTS](#what-light-mode-costs--read-before-choosing-it)); report the widened set and re-check disjointness. Skipping paperwork is not skipping scrutiny.
- **Never trust a test run in a fresh worktree until `npm ci` has run there.** Module-resolution failures masquerade as regressions.
- **Never run `install-local` inside a worktree.** It installs a global VS Code extension and regenerates `.specify/` — it belongs to the main loop, once, at the end.
