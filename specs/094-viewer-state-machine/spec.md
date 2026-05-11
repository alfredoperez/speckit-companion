# Spec: Viewer State Machine — Stepper, Header, Footer, Timeline

**Slug**: 094-viewer-state-machine | **Date**: 2026-05-08

## Summary

The spec viewer's UI surfaces (stepper tabs, header badges, footer
actions, activity panel) all derive their visible state from
`.spec-context.json`. The rules are scattered across `footerActions.ts`,
`stateDerivation.ts`, and the webview components, and only partially
documented in `docs/viewer-states.md`. This spec captures the full state
machine as user-facing scenarios so the visible behavior at every
status × step combination is intentional, testable, and documented.

The immediate trigger was the footer-button noise during the
just-generated-spec window (issue surfaced from `ngx-dev-toolbar`):
`Archive`, `Mark Completed`, `Auto`, `Regenerate`, and `Approve` all
appeared simultaneously the moment `/sdd:specify` finished, even
though most of those actions were premature for a spec the user
hadn't reviewed yet. The footer cleanup is included here, but the
broader goal is a documented state machine across all four surfaces.

## Requirements

- **R001** (MUST): While a step has `startedAt` set but not yet
  `completedAt` and the spec hasn't moved past it
  (`isAwaitingApproval`), the footer MUST hide the lifecycle actions
  `Archive`, `Mark Completed`, and `Auto`.
- **R002** (MUST): The SDD `Auto` button MUST only appear on the
  Specify tab while `status === 'draft'` (true cold start) for
  `sdd`/`sdd-fast` workflows. Once specify has started
  (`status === 'specifying'`), Auto MUST be hidden.
- **R003** (MUST): The forward action button (formerly `Approve`)
  MUST display the next step's label from the active workflow
  (`Plan` → `Tasks` → `Implement`). On the final step it MUST read
  `Complete`. When workflow steps are unavailable it MUST fall back
  to `Approve`.
- **R004** (MUST): The footer MUST always serialize a `label` per
  action; the underlying action `id` (used by message handlers) MUST
  remain `'approve'` so behavior on click is unchanged.
- **R005** (SHOULD): Stepper tab visual state MUST be derivable from
  `.spec-context.json` alone — `not-started` (no `startedAt`),
  `in-progress` (`startedAt` set, not inferred-completed),
  `completed` (`completedAt` set OR step precedes `currentStep`).
- **R006** (SHOULD): The header status badge MUST reflect the
  canonical `status` field from `.spec-context.json` and MUST
  surface as the only visual signal of overall lifecycle state
  (`draft`, `specifying`, `specified`, … `completed`, `archived`).
- **R007** (SHOULD): The Activity / timeline panel MUST render
  step-level boundaries (extension-stamped `startedAt` /
  `completedAt`) with durations. Substep boundaries (AI-emitted)
  MUST be rendered without durations because the timestamps are
  not reliable.
- **R008** (MUST): All state transitions surfaced in the viewer MUST
  be testable via pure functions that take a `SpecContext` (no
  filesystem reads, no live VS Code APIs).

## Scenarios

### Footer — just-generated, awaiting first approval

**Given** a fresh spec where `/sdd:specify` has just written
`spec.md` and set `status='specifying'`, `stepHistory.specify.startedAt`,
`completedAt=null`
**When** the user opens the viewer on the Specify tab
**Then** the footer shows only `Edit Source`, `Regenerate`, and
`Plan` (the dynamic next-step button). `Archive`, `Mark Completed`,
and `Auto` are hidden until specify is approved.

### Footer — step approved, lifecycle returns

**When** the user clicks the forward button (`Plan`) and the
extension marks specify completed (`status='specified'`,
`stepHistory.specify.completedAt` set)
**Then** the next viewer refresh shows `Edit Source`, `Archive`,
`Mark Completed`, and `Start` (on the Plan tab) — the full
lifecycle bar is restored.

### Footer — pure draft (cold start)

**Given** a spec folder created with no AI generation yet
(`status='draft'`, `stepHistory={}`)
**When** the user opens the viewer on the Specify tab
**Then** the footer shows `Edit Source`, `Start`, `Auto`, `Archive`,
and `Mark Completed`. Auto is appropriate here because nothing has
started; the user can still abandon (Archive) or shortcut
(Mark Completed) a placeholder.

### Footer — terminal states

**Given** `status='completed'` or `'archived'`
**Then** the footer shows `Edit Source`, `Reactivate`, and (for
`completed`) `Archive`. All step-scoped actions (`Start`,
`Regenerate`, `Approve`) are suppressed regardless of `stepHistory`.

### Footer — dynamic next-step label

**Given** an in-progress step under the `sdd` workflow with steps
`specify → plan → tasks → implement`
**Then** the forward button label MUST be:
- `Plan` while on `specify`
- `Tasks` while on `plan`
- `Implement` while on `tasks`
- `Complete` while on `implement`

### Stepper — visual state per step

**Given** a `.spec-context.json` with `currentStep='plan'`,
`stepHistory.specify.completedAt` set, `stepHistory.plan.startedAt`
set
**Then** the stepper shows: `specify` as `completed` (green ✓),
`plan` as `in-progress` (pulsing accent), `tasks` and `implement`
as `not-started` (muted). The stepper renders identically whether
the user is viewing the Plan tab or has clicked back into Specify
to review (clicking a tab does NOT mutate `currentStep`).

### Stepper — viewed step indicator

**Given** the user is viewing a step earlier than `currentStep`
(reviewing a completed phase)
**Then** the active tab gets a dashed `.reviewing` outline so it's
clear the user is reviewing a prior phase rather than the live one.
The header badge continues to reflect the spec's true workflow
state (e.g. `Planning`), not the viewed tab.

### Header — status badge progression

**Given** the canonical status sequence `draft → specifying →
specified → planning → planned → tasking → ready-to-implement →
implementing → completed → archived`
**Then** the header status pill MUST update on every viewer
refresh to reflect the current status, with color tier (per
`docs/sidebar.md` "Header badge color tiers") matching the status
class (in-progress vs. ready vs. terminal).

### Header — branch and date metadata

**When** the spec context has `branch` and a `selectedAt` /
`createdAt`
**Then** the header surfaces a `[STATUS] [⌥ branch] · date`
cluster under the title. None of these fields advance state
themselves; they are read-only metadata.

### Activity / Timeline panel — step durations vs substeps

**Given** the user toggles the Activity panel
**Then** the *Phases* card shows each step's start → end with a
duration computed from `stepHistory[step].startedAt` /
`completedAt`. Substep entries (AI-emitted, e.g. `parsing`,
`writing-spec`) appear under each phase WITHOUT durations because
their timestamps are not extension-stamped and not reliable for
arithmetic.

### Activity / Timeline — visibility setting

**Given** `speckit.viewer.activityPanel === 'off'`
**Then** the Activity toggle does not appear in the navigation bar.
**Given** `'beta'` (default)
**Then** the toggle appears with a *beta* pill.
**Given** `'on'`
**Then** the toggle appears without a pill.

## Out of Scope

- The internal markdown rendering pipeline (preprocessors,
  scenario expansions) — covered elsewhere.
- Sidebar tree state (covered by `docs/sidebar.md`).
- Spec creation flow / `.spec-context.json` writer logic — those
  produce the state; this spec only describes how the viewer
  *renders* it.
- Tooltip copy refinements; this spec defines what shows, not the
  exact wording.
- A redesigned overflow `⋯` menu for excess footer buttons. Noted
  as future-proofing in `docs/viewer-states.md` but not built here.
