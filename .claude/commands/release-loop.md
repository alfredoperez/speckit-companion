---
allowed-tools: Bash(git:*), Bash(gh:*), Bash(npm:*), Bash(node:*), Bash(python3:*), Bash(cp:*), Bash(mkdir:*), Bash(date:*), Bash(open:*), Agent, AskUserQuestion, Read, Write, Edit, Skill, TaskCreate, TaskUpdate
description: Run the whole SpecKit Companion release loop — pick a batch, fix it, QA it, ask every decision in one round, recheck, write the release report, and publish after approval. Sequences /fix-tickets, /ship-ticket, /release-qa and /publish-all.
argument-hint: "[issue numbers e.g. '237 238' | 'open']"
---

# Release loop

The loop stops twice and nowhere else: at step 4, to ask every open decision in one round, and at step 7, for the user to approve the release report. Everything else runs unattended. The agreed design is the canvas at `~/dev/GitHub/obsidian-vault/Projects/speckit companion/Release Loop.canvas`.

This command only sequences. Each step's rules live in the command it calls. Create one task per step (TaskCreate) so progress shows.

## 1. Pick

Triage the open issues (`gh issue list`), or take the numbers in `$ARGUMENTS`. Verify each still reproduces on `main` and close the ones that don't, with the evidence. Form the batch and mark each ticket full or light: full (`/speckit-companion-auto`) by default, light only for a mechanical fix such as a regex, a doc or a manifest.

## 2. Fix

Run `/fix-tickets` with the batch's issue numbers, so it does not stop to confirm the queue. Full tickets run the full loop sequentially, one at a time; light tickets go in a separate `--light` run. Anything already built by hand goes through `/ship-ticket`. Merge a PR only after every CI check has finished and passed, never with a check still pending. Nothing is desktop-tested per ticket. Every merged change a user will meet has an entry under `## [Unreleased]`; write a missing one with `/changelog-entry`.

**Before QA, answer the readiness questions** and carry each answer into the step 7 report. Anything that needs the user becomes a step 4 question.

- **Tickets.** Which open items must ship in this release, and which wait? Release-time items (a version floor, a catalog refresh) are named, not built.
- **Screenshots.** Does every big feature have a 16:9 shot cropped tight enough to read on a phone? The site's changelog takes the clean image plus a `highlight` box in `content/media/changelog.json` and draws the highlight itself; social posts and articles take a copy with a yellow marker label. Check one at 360px wide before calling it done.
- **Copilot canvas and Claude Code mod.** Did their vendored code change (`npm run canvas:build`, `npm run mod:build`), and do they show the new record fields? A changed canvas needs `/publish-canvas`; fields they cannot show are named in the report.
- **Shared code.** Did this release copy logic between the VS Code viewer, the canvas and the mod that should live once? Name it; do not refactor here.
- **Docs and landing page.** Does each new feature have its page on the site, and does the landing page say what this release is about?
- **Article.** Does a big feature deserve a post? Add it to `apps/web/data/blog/_queue.json` in the alfredo-perez.dev repo.

## 3. QA

Once the batch is merged, run `/release-qa` on the fresh `main`: the automated gates, the terminal run, the scripted real-window checks (viewer, navigation, builder, themes, graded by `grade-scripted.py`), the headless canvas checks, then `qa-stage.sh` until it prints READY. Hand the user the short click-only Claude Desktop handoff path to paste (first open, stock and two roots, the timed run, the GitHub Copilot app), and turn Desktop's reply into the QA report. A FAIL with an obvious fix goes back to step 2; one that needs a call becomes a step 4 question.

## 4. Decide (stop)

Collect every decision the fixes and QA raised and ask them all in one round with AskUserQuestion, your recommendation as the first option of each. Never ask whether to release here; that question belongs to step 7.

## 5. Fix follow-ups

Answers that change code go back through step 2 under the same rules. Answers that need no code go straight into the report.

## 6. Final check

Run `/release-qa recheck` on the final `main`: the gates again, the scripted checks again, and the desktop handoff only if UI changed since step 3. Every check ends PASS, or as a named exception the report carries.

## 7. Report (stop)

Write one note with the `obsidian` skill (report profile) and `writing`: `Projects/speckit companion/Release Report <version> <date>.md` in the vault, where `<version>` is the version this release will carry. In this order:

- A verdict line.
- At a glance: fixes, features, bugs QA caught, tests.
- What changed, by area: one card per item with what the user will notice, how it was checked, and a screenshot when one exists (real-app recorder frames from the QA results `shots/`, or generated docs stills from `docs/screenshots/generated/`), copied next to the note.
- What QA caught.
- Still open, each with its issue.
- Decisions made.
- Appendix: the PR list, the checks table, the timing table and the evidence paths.

Open it in Obsidian, then stop and ask the user to approve it. Nothing is published before they do.

## 8. Release

Only after approval: `/publish-all`. It finds which of the four deliverables changed since their last release, asks every version in one question, and runs the spec-kit extension, the VS Code extension, the Claude Code mod and the Copilot canvas in that order. Its QA gate reads the step 6 report. The canvas pull request and the Anthropic directory submission still wait on the user: the first for an explicit go, the second for them to send it. Then run the follow-up the user chose: the catalog update (`/submit-catalog-update`, minor or major spec-kit releases only).
