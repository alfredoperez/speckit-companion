# Quickstart: Status + Resume

How to exercise the feature end-to-end on a stock spec-kit project with Companion installed.

## Prerequisites

- A workspace with the Companion extension installed and `speckit-extension/` commands available.
- `python3` on PATH (status/resume degrade gracefully without it, but the read/derive script needs it).

## 1. See where a spec stands

```
/speckit.companion.status
```

Expected: prints `Step`, `Status`, recorded `Decisions`, and the `Next` action + command for the active spec. On a fresh spec (only `spec.md` present) the next action is `Plan the feature → /speckit.plan`.

**Missing-state check**: delete the spec's `.spec-context.json`, re-run `status`. It should print the same step/next-action with `source: derived`.

## 2. Resume mid-pipeline

Carry a spec to `planned`, then:

```
/speckit.companion.resume
```

Expected: `Resuming … from plan (planned)`, decisions echoed in scope, and `/speckit.tasks` dispatched automatically.

**Tasks-step check**: stop partway through `/speckit.implement`, leave some tasks unchecked, run `resume`. It should report `Continue implementation at <first unchecked task>` and dispatch `/speckit.implement`.

**Terminal check**: on a spec at `implemented`/`completed`/`archived`, `resume` prints `Pipeline complete — nothing to resume.` and dispatches nothing.

## 3. Sidebar surfacing

- Open the SpecKit sidebar. Each active spec shows its current step, status badge, and a one-line **last transition** (e.g. "planned · 2h ago").
- An inline **Resume** action appears on active specs (not on completed/archived).
- Click **Resume** → the resume command dispatches; when the dispatched step's capture hook writes state, the sidebar updates the step/status/last-transition **without a manual refresh**.

## 4. Authoring-parity check

Author one spec's state through the terminal pipeline and another through the GUI. `status` and `resume` should reach the same step/next-action conclusion for both (FR-012 / SC-005).

## Validation checklist

- [ ] `status` matches actual on-disk step for state, derived, and start-of-pipeline cases
- [ ] `resume` advances to the correct next step with decisions in scope
- [ ] tasks-step resume continues at the next unchecked task
- [ ] terminal-state resume reports complete, dispatches nothing
- [ ] sidebar shows step + badge + last transition and updates live after Resume
- [ ] no `python3` → both commands warn and no-op without failing the host
