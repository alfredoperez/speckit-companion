# Spec: Immediate Status Update

**Slug**: 072-immediate-status-update | **Date**: 2026-04-22

## Summary

When the user clicks the Approve/Regenerate buttons to advance into `tasks` or `implement`, the viewer currently writes `.spec-context.json` but does not repaint, so the status badge stays stale until the AI eventually updates the file. This spec makes the viewer reload immediately after the context write, and tightens the AI prompt to explicitly emit a "Done creating tasks" / "Done implementing" completion marker.

## Requirements

- **R001** (MUST): After `handleApprove` writes to `.spec-context.json` via `completeStep`/`startStep`, the same viewer must refresh its content so the status badge and step tabs reflect the new state without needing AI output.
- **R002** (MUST): After `handleRegenerate` writes to `.spec-context.json` via `startStep`, the same viewer must refresh.
- **R003** (MUST): The single-step preamble injected by `buildPrompt` must make step-completion a hard requirement — before ending the command the AI must (a) set `stepHistory.{step}.completedAt`, (b) flip `status` from the in-progress form (`planning`, `tasking`, `implementing`) to the matching completed form (`planned`, `ready-to-implement`, `completed`), and (c) print a visible `Done {step}` line (e.g., `Done planning`, `Done creating tasks`, `Done implementing`). Today the preamble *mentions* this but AIs routinely skip it, leaving the badge stuck on `planning` — the new wording must be prescriptive and terminal.
- **R004** (MUST): Context-JSON writes must happen before the terminal dispatch (preserve current order) so the badge flips in-progress before any AI output arrives.

## Scenarios

### Approve from plan → tasks

**When** the user is viewing `plan.md` and clicks **Approve**
**Then** `plan` is marked completed, `tasks` is marked started in `.spec-context.json`, and the viewer repaints immediately showing the tasks tab as active and the badge as `CREATING TASKS...` — before the AI terminal produces any output.

### Approve from tasks → implement

**When** the user is viewing `tasks.md` and clicks **Approve**
**Then** `tasks` is marked completed, `implement` is marked started, and the viewer repaints immediately showing `IMPLEMENTING...`.

### Regenerate on the current step

**When** the user clicks **Regenerate** on any lifecycle step
**Then** that step is re-marked as started in `.spec-context.json` and the viewer repaints immediately.

### AI completion marker

**When** the AI finishes executing a `/sdd:plan`, `/sdd:tasks`, or `/sdd:implement` command
**Then** the prompt preamble has forced it to (a) set `stepHistory.{step}.completedAt`, (b) flip `status` from `planning` → `planned` (or `tasking` → `ready-to-implement`, or `implementing` → `completed`), and (c) print an explicit `Done {step}` line — so the badge lands on the completed form instead of hanging on the in-progress form.

## Out of Scope

- Changes to `handleLifecycleAction` — already refreshes the viewer.
- Changes to non-lifecycle steppers or sidebar navigation.
- Webview-side polling or watcher changes — the extension-side `updateContent` call is sufficient.
