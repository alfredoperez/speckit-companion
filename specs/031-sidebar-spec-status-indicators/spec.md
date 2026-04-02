# Spec: Sidebar Spec Status Indicators

**Slug**: 031-sidebar-spec-status-indicators | **Date**: 2026-04-01

## Summary

Replace the mtime-based Active/Earlier sidebar grouping with status-based groups (Active, Completed, Archived) driven by a new `.spec-context.json` file that the extension owns and writes. Add color-coded icons to spec and step items: green for completed, blue for current step. The extension tracks workflow progress via explicit `stepHistory` entries with `startedAt`/`completedAt`. External frameworks like SDD can enrich the same file with additional data.

## Context File: `.spec-context.json`

Located inside each spec directory (e.g., `specs/029-fix/.spec-context.json`). Single file replacing both `.speckit.json` and `state.json`. Both the extension and external frameworks (SDD) read-then-merge before writing — never overwrite the whole file.

```jsonc
{
  // --- Extension-managed fields ---
  "workflow": "default",
  "selectedAt": "2026-04-01T10:00:00Z",
  "currentStep": "plan",
  "status": "active",                    // "active" | "completed" | "archived"
  "stepHistory": {
    "specify": { "startedAt": "2026-04-01T10:00:00Z", "completedAt": "2026-04-01T10:14:00Z" },
    "plan":    { "startedAt": "2026-04-01T10:15:00Z", "completedAt": null }
  },
  "checkpointStatus": { ... },

  // --- SDD-enriched fields (optional, extension ignores if absent) ---
  "step": "plan",
  "substep": "code-review",
  "task": null,
  "next": "tasks",
  "updated": "2026-04-01",
  "approach": "...",
  "last_action": "...",
  "task_summaries": { ... },
  "step_summaries": { ... },
  "files_modified": [ ... ]
}
```

**When the extension writes:**

| Trigger | Fields written |
|---|---|
| User clicks a step command (specify/plan/etc.) | `currentStep` = step, `stepHistory[step].startedAt`, previous step gets `completedAt` |
| User selects workflow | `workflow`, `selectedAt` |
| Checkpoints run | `checkpointStatus` |
| User marks spec done (context menu) | `status` = `"completed"` |
| User archives spec (context menu) | `status` = `"archived"` |

## Requirements

- **R001** (MUST): Rename `.speckit.json` to `.spec-context.json` — update the `FEATURE_CONTEXT_FILE` constant and all references
- **R002** (MUST): Extension writes `currentStep` and `stepHistory` to `.spec-context.json` when user clicks a step command
- **R003** (MUST): When user clicks step N+1, set `completedAt` on step N's `stepHistory` entry
- **R004** (MUST): Replace mtime-based Active/Earlier grouping with status-based groups: Active (default), Completed, Archived
- **R005** (MUST): Specs with no `.spec-context.json` default to `status: "active"` (backwards compatible)
- **R006** (MUST): Spec items show green icon when `status === "completed"`
- **R007** (MUST): Spec items show blue icon when `status === "active"` and `currentStep` exists
- **R008** (MUST): Step document items show green check if `stepHistory[step].completedAt` is set
- **R009** (MUST): Step document items show blue indicator if step matches `currentStep` and `completedAt` is null
- **R010** (SHOULD): Add "Mark as Completed" and "Archive" context menu actions for spec items
- **R011** (SHOULD): The `sync~spin` icon is only used when a spec is the currently-viewed active spec AND a step command is running
- **R012** (SHOULD): Completed group collapsed by default, Archived group collapsed by default
- **R013** (MAY): SDD-enriched fields (`substep`, `task_summaries`) shown in tooltips when present

## Scenarios

### User clicks Plan after Specify

**When** user clicks the Plan step command on a spec
**Then** `.spec-context.json` is updated: `currentStep` = `"plan"`, `stepHistory.specify.completedAt` is set, `stepHistory.plan.startedAt` is set
**And** sidebar refreshes: Specify shows green check, Plan shows blue

### User marks spec as completed

**When** user right-clicks a spec and selects "Mark as Completed"
**Then** `status` is set to `"completed"` in `.spec-context.json`
**And** spec moves from Active group to Completed group with green icon

### Spec with no context file

**When** a spec directory has no `.spec-context.json`
**Then** it appears in the Active group with the default beaker icon
**And** step items use file-existence heuristic (`getDocumentStatus`) for icons

### User skips a step

**When** user clicks Implement without ever clicking Tasks
**Then** `stepHistory` has no entry for Tasks — it shows as default (not green, not blue)
**And** only steps with explicit `completedAt` show green

### SDD-enriched spec

**When** `.spec-context.json` has `task_summaries` written by SDD
**Then** tooltips on the spec item show richer info (e.g., "3/5 tasks done")
**And** status colors still driven by `stepHistory`/`status` fields

## Non-Functional Requirements

- **NFR001** (MUST): Reading `.spec-context.json` for each spec must not noticeably slow tree rendering
- **NFR002** (SHOULD): Color choices use VS Code ThemeColor API (e.g., `testing.iconPassed` for green, `debugIcon.startForeground` for blue) to respect user themes

## Out of Scope

- Automatic completion detection (e.g., watching terminal exit codes)
- Progress percentages or task counts in the tree (beyond tooltips)
- Migration tool for existing `.speckit.json` or `state.json` files (manual or one-time script is fine)
- Updating the SDD framework to write `.spec-context.json` instead of `state.json` (tracked separately in the SDD repo)
