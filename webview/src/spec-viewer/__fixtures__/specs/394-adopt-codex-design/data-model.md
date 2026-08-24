# Data Model: Adopt the Codex Redesign in the Spec Viewer

**Feature**: 394-adopt-codex-design · **Date**: 2026-07-13

This feature introduces no persisted data and no schema changes — `.spec-context.json`, `NavState`, `ViewerState`, and the message protocol are frozen inputs. What it introduces are **webview-side view-model shapes**: small derived structures the shell renders from. They are computed per render from the existing signals and never stored.

## ShellView

The viewer's top-level mode, replacing the boolean Activity toggle.

| Field | Type | Rules |
|---|---|---|
| `view` | `'overview' \| 'document'` | Default `'overview'` when the derived state has recorded activity (`hasAnyData(viewerState)`), else `'document'`. Living-specs mode forces `'document'`. User switching is free; the choice is per-panel session state. |

Transitions: `overview ↔ document` via the header view switch or by selecting any rail document (selecting a document implies `document`).

## RailItem

One entry in the document rail — the "where am I" model.

| Field | Type | Source |
|---|---|---|
| `id` | string | `NavState.coreDocs[].type` / `relatedDocs[].type` |
| `label` | string | document label (workflow-defined labels pass through) |
| `group` | `'pipeline' \| 'artifacts' \| 'workflow'` | core docs → pipeline; related docs → artifacts (grouped under `parentStep`); custom workflows render their full step list as a workflow map |
| `kind` | `'doc' \| 'action'` | workflow step kind; action-only steps render in the map but are not openable documents |
| `completion` | `'complete' \| 'current' \| 'pending'` | from `ViewerState.steps` / `NavState.workflowPhase` — rendered as the **rail mark**, visually separate from selection |
| `active` | boolean | equals current selection (`NavState.currentDoc`) — rendered as the button's selected state |

Invariant: `completion` and `active` are independent axes (the design's core navigation fix); neither may derive from the other.

## RunFacts

The contextual aside — "how far along is the run" at a glance.

| Field | Type | Source |
|---|---|---|
| `status` | string | `ViewerState.status` (badge text via existing formatting) |
| `phase` | string | `ViewerState.activeStep` |
| `currentTask` | string? | `NavState.currentTask` |
| `progressPercent` | number? | `NavState.taskCompletionPercent` (implement phase only) |
| `checks` | number? | count of `ViewerState.verified` |
| `openConcerns` | number? | count of `ViewerState.concerns` |

Rendering rule: the aside renders only fields that exist (no placeholder rows); the whole column yields below the ~980px breakpoint.

## OverviewModel

The Overview view arranges **existing** `ViewerState` data; no new fields. Sections in order: progress hero (task counts + status badge + progress track), metrics row (requirements covered / verification checks / open concerns), intent + context + boundaries (existing ICE data), decisions, evaluation/verified, coverage, latest-activity feed (derived from `history`), with the long `approach` text behind progressive disclosure.

## RefinementQueueModel

Presentation over the existing comment state — no new persistence.

| Field | Type | Source |
|---|---|---|
| `pending` | Refinement[] | `pendingRefinements` signal (existing) |
| `persisted` | ReviewComment[] | `ViewerState.reviewComments` (existing path) |
| `count` | number | `pending.length` — shown on the queue affordance |

Anchoring, composer, submission, and persistence flows are unchanged.
