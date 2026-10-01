---
allowed-tools: Bash(git:*), Bash(gh:*), Bash(npm:*), Bash(node:*), Bash(python3:*), Bash(cp:*), Bash(mkdir:*), Bash(date:*), Bash(open:*), Agent, AskUserQuestion, Read, Write, Edit, Skill, TaskCreate, TaskUpdate
description: Run the whole SpecKit Companion release loop — pick a batch, fix it, QA it, ask every decision in one round, recheck, write the release report, and publish after approval. Sequences /fix-tickets, /ship-ticket, /release-qa and /publish.
argument-hint: "[issue numbers e.g. '237 238' | 'open']"
---

# Release loop

The loop stops twice and nowhere else: at step 4, to ask every open decision in one round, and at step 7, for the user to approve the release report. Everything else runs unattended. The agreed design is the canvas at `~/dev/GitHub/obsidian-vault/Projects/speckit companion/Release Loop.canvas`.

This command only sequences. Each step's rules live in the command it calls. Create one task per step (TaskCreate) so progress shows.

## 1. Pick

Triage the open issues (`gh issue list`), or take the numbers in `$ARGUMENTS`. Verify each still reproduces on `main` and close the ones that don't, with the evidence. Form the batch and mark each ticket full or light: full (`/speckit-companion-auto`) by default, light only for a mechanical fix such as a regex, a doc or a manifest.

## 2. Fix

Run `/fix-tickets` with the batch's issue numbers, so it does not stop to confirm the queue. Full tickets run the full loop sequentially, one at a time; light tickets go in a separate `--light` run. Anything already built by hand goes through `/ship-ticket`. Merge a PR only after every CI check has finished and passed, never with a check still pending. Nothing is desktop-tested per ticket.

## 3. QA

Once the batch is merged, run `/release-qa` on the fresh `main`: the automated gates, the terminal run, the headless canvas checks, then `qa-stage.sh` until it prints READY. Hand the user the click-only Claude Desktop handoff path to paste, and turn Desktop's reply into the QA report. A FAIL with an obvious fix goes back to step 2; one that needs a call becomes a step 4 question.

## 4. Decide (stop)

Collect every decision the fixes and QA raised and ask them all in one round with AskUserQuestion, your recommendation as the first option of each. Never ask whether to release here; that question belongs to step 7.

## 5. Fix follow-ups

Answers that change code go back through step 2 under the same rules. Answers that need no code go straight into the report.

## 6. Final check

Run `/release-qa recheck` on the final `main`: the gates again, and the desktop checks only if UI changed since step 3. Every check ends PASS, or as a named exception the report carries.

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

Only after approval: `/publish`, or `/publish-both` when `apps/speckit-extension/` changed since its last `speckit-ext-v*` tag. Their QA gate reads the step 6 report. Then run the follow-ups the user chose: the catalog update (`/submit-catalog-update`, minor or major spec-kit releases only) and the Awesome Copilot listing (`apps/copilot-canvas/README.md` says how).
