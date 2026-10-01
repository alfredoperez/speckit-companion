---
allowed-tools: Bash(git:*), Bash(npm:*), Bash(node:*), Bash(python3:*), Bash(code:*), Bash(specify:*), Bash(claude:*), Bash(awk:*), Bash(cp:*), Bash(mkdir:*), Bash(ls:*), Bash(date:*), Bash(open:*), Read, Write, Edit, Skill, TaskCreate, TaskUpdate
description: Release-scoped QA of SpecKit Companion, run once after a batch of fixes. Scopes itself from the diff since the last v* tag, runs automated gates first, spends desktop time on what needs eyes, and writes one vault report with a ship / fix-first verdict. Gates /publish.
argument-hint: "[recheck]"
---

## What this does

QA for a release, once, at the end of a batch. It is issue-agnostic: it reads what is being released (the diff since the last `v*` tag and the `## [Unreleased]` sections of both changelogs), not a ticket list. It is step 3 of `/release-loop` (and `recheck` is step 6); `/publish`, `/publish-both` and `/publish-speckit-ext` refuse to tag without its report.

## Run

Load the `release-qa` skill and follow it in order: Step 0 scope, Step 1 automated gates, Step 2 desktop checks, Step 3 report. The skill owns the flow, `.claude/skills/release-qa/surface-map.yml` owns which paths need which checks, and the helper scripts next to it do the mechanical work.

`$ARGUMENTS`:
- empty: the full run, baseline included.
- `recheck`: after fixes. Repeats the automated gates and only the checks that ended FAIL or BLOCKED in the latest report, and writes a new report against the new HEAD.

The result is one note, `Projects/speckit companion/QA Report <YYYY-MM-DD>.md` in the vault. Raw evidence stays in `~/dev/projects/companion-sandboxes/e2e-results/<date>/`.

## Release gate

The publish commands run this before they tag. The gate passes only when all three hold:

1. The newest `Projects/speckit companion/QA Report*.md` in `~/dev/GitHub/obsidian-vault` exists.
2. Its `head` frontmatter equals `git rev-parse --short HEAD`, or every commit in `git log <head>..HEAD --format=%s` is a release commit (`chore: bump version to …` or `chore(speckit-ext): release …`). Anything else means the report is for other code.
3. It says `verdict: ship` and `fails: 0`.

When it does not pass, stop and say why in one line: no report, a report for another sha (name both), or the open FAIL checks. The fix is `/release-qa` (or `/release-qa recheck` after fixes).

Only an explicit instruction in the conversation to skip QA for this release overrides the gate. Say `QA gate overridden` in the release report.

## Guardrails

- QA never edits the repo, files issues, or fixes anything. Every FAIL is a fix candidate in the report, and the next batch picks it up.
- Never run it per ticket, and never on a dirty tree.
- Nothing is repeated: a check runs once however many surfaces ask for it, and a screenshot is shot once and reused as evidence and as a docs candidate.
- A changed path with no surface in the map is reported as `no QA mapping`, never given a guessed check.
