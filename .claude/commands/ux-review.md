---
allowed-tools: Bash(node:*), Bash(npm:*), Bash(git:*), Bash(ls:*), Bash(sips:*), Bash(mkdir:*), Bash(grep:*), Bash(python3:*), Agent, Read, Write, Edit, Skill, AskUserQuestion
description: Review one webview surface with Claude and Codex at once, weigh the two reviews against the code, and draw the result as a design canvas.
argument-hint: "<surface: pipeline-builder | spec-viewer | sidebar>  [--no-canvas]  [--quick]"
---

## What this does

Runs a full UX review of one webview surface without a second terminal and without step-by-step guidance. Two reviewers look at the same screenshots and the same source, an evaluator checks both against the code and merges them, and a design canvas draws what should change.

The output is four things: two reviews, one evaluation, one canvas link.

Codex runs here through its companion script, in a subagent, so there is nothing to drive by hand.

## Why the evaluation step is not optional

Reviewers state file and line numbers with confidence and get them wrong. On the first run of this flow the evaluator caught three bad citations in one review and, in the other, a screenshot that did not exist, a warning described as clipped that actually wraps, and two recommendations for things already built. A merged list nobody verified is a list that sends builders to the wrong lines.

## Inputs

`$ARGUMENTS`:
- A surface name. Resolve it through the map below. Unknown or empty → ask which surface, listing the map's keys.
- `--no-canvas` → stop after the evaluation.
- `--quick` → one reviewer (Claude), no Codex leg. For a small surface or a re-check.

## The surface map

| Surface | Components | Styles | Host | Stories | Guide | Captures |
|---|---|---|---|---|---|---|
| `pipeline-builder` | `webview/src/pipeline-builder/*.tsx` | `webview/styles/pipeline-builder.css` | `src/features/pipeline-builder/*.ts`, `src/protocol/pipeline.ts` | `webview/src/pipeline-builder/__stories__/` | `docs/pipeline-builder.md` | `docs/screenshots/generated/builder-*.png` |
| `spec-viewer` | `webview/src/spec-viewer/**/*.tsx` | `webview/styles/spec-viewer/` | `src/features/specs/*.ts` | `webview/src/spec-viewer/__stories__/` | `docs/viewer-states.md` | `docs/screenshots/generated/viewer-*.png` |
| `sidebar` | `src/features/sidebar/**` | — | `src/features/sidebar/` | — | `docs/sidebar.md` | `docs/screenshots/*.png` |

Add a row when a surface gains a guide. Everything else in this command is surface-agnostic.

---

## Procedure

> Run from the repo root, or from the worktree you are working in. Confirm with `git rev-parse --show-toplevel`.

### 1. Fresh pictures first — main loop

Both reviewers must look at the same pixels, and stale captures produce findings about bugs already fixed.

```bash
node scripts/capture-docs-images.mjs --only <capture prefix>
git status --short docs/screenshots/generated/    # note what moved; do NOT commit here
```

If the captures changed, say so in the final report: the reviews describe the new state, and the guide may now embed images that disagree with its prose.

Downsample copies for the canvas into the scratchpad (the canvas has a size budget, and full-resolution PNGs blow it):

```bash
sips -Z 1100 -s format jpeg -s formatOptions 62 <each png> --out <scratchpad>/before-<name>.jpg
```

### 2. Three agents at once — subagents

Send them in one message so they run in parallel. All three are read-only.

**Reviewer A, Claude.** `subagent_type: general-purpose`, `model: opus`. Brief it with: the file list from the map; the capture paths, told to Read them as images; `CLAUDE.md`, `.claude/review-checklist.md`, `docs/DESIGN.md`. Ask for a written review naming a file and a line for every technical claim, split into defects, first-time-user blockers, polish, vocabulary, accessibility, and the guide. Tell it to verify each claim against the code before writing it. Output to `docs/claude-feedback.md`.

**Reviewer B, Codex.** `subagent_type: general-purpose`, `model: sonnet` (the model here only forwards). Its whole job is one Bash call and returning the output verbatim:

```bash
CODEX=$(ls -d ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | tail -1)
node "$CODEX" task --effort xhigh "<the review prompt>"
```

No `--write`: this is a review. The prompt carries the same file list and capture paths as Reviewer A, and asks for the same shape, so the two are comparable. Write the returned text to `docs/codex-feedback.md`.

**Context agent.** Collects what both reviewers need and neither should have to find: the design tokens and which are below AA, the test files that assert on user-visible labels, the docs-sync obligations for this surface, and the story and capture commands. Its report goes to the evaluator, not to a file.

Skip Reviewer B under `--quick`.

### 3. Weigh them — subagent

One agent, `model: opus`, read-only apart from writing its report. Give it both reviews, the captures, the source and the context agent's report. It must:

- Verify every claim that names a file, a line, a rule or a count. List the ones that are wrong or overstated, by reviewer.
- Score each review 1–5 on accuracy, specificity, actionability, coverage and judgement, one line of justification each.
- Merge into one de-duplicated, numbered list: title, which review raised it, why, the concrete change, a priority (P0 visible bug, P1 blocks a first-time user, P2 polish, P3 later). Group by surface area.
- Name every disagreement and resolve it with a reason.
- Add anything real that neither review caught, at most five.

Output to `docs/feedback-evaluation.md`. Item numbers from this file are what every later brief and commit refers to.

### 4. Draw it — main loop

Unless `--no-canvas`: invoke the `design` skill with the merged list. One artboard per surface the review touches, "today" boards built from the downsampled captures beside the proposed ones, and a sticky note per board saying which review each change came from and how the disagreements were settled.

Match the panel's real values, not approximations: sample them from the captures or read them out of the stylesheet.

Before publishing, render each artboard in Chrome and Read the PNGs. A canvas nobody looked at ships with counts that do not add up.

After publishing, send one read-only agent over the artboard files to check counts, palette and copy against the source. Fix what it finds, republish to the same URL.

### 5. Report

Lead with the scorecard, then: what both reviews agreed on, what each caught alone, the claims found wrong, the P0 count, and the canvas link. Say plainly if the captures were stale, because that changes what the reviews were looking at.

---

## Rules

- **Never let a reviewer edit.** Both legs and the evaluator are read-only. This command produces documents, not commits.
- **Do not commit the feedback files** unless asked. They are working documents; the merged list is what survives into a plan.
- **Do not skip the capture step.** It is the difference between a review of the product and a review of a memory of it.
- **One evaluator, always.** Two reviews with no referee is worse than one review, because it reads as corroboration.
