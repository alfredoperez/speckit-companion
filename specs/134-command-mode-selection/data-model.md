# Phase 1 Data Model: Command Mode Selection

**Feature**: `134-command-mode-selection` · **Date**: 2026-06-09

This feature is a behavior reframe, not a schema change. No new persisted fields are introduced; the two entities the spec names map onto storage that already exists. The change is in *which* of those values drives behavior and *how* it is set.

## Entity: Pipeline shape (mode)

One of two command shapes a spec can run. Both shapes are always installed; the mode only selects which one a spec uses.

| Attribute | Value |
|---|---|
| Domain | `standard` \| `lean` (with `off` as an upstream escape hatch, outside the standard↔lean guarantee) |
| Standard delivery | Stock `/speckit.specify \| plan \| tasks \| implement` (carried by the always-present `companion-standard` preset; emitted by `specify init`) |
| Lean delivery | Namespaced `/speckit.companion.specify \| plan \| tasks \| implement` (from the companion extension's `provides.commands`; always present) |
| Selector | The mode option (below); resolved per dispatch by `resolveProfileCommand()` |

**Invariant**: both deliveries are present on disk at all times (FR-001). No mode transition removes either (FR-002). The mode never changes which files exist — only which family a given spec dispatches.

## Entity: Mode option

The single SpecKit Companion control that records the developer's standard-vs-lean choice and drives which shape a spec runs. Realized at two granularities that already exist in storage:

| Level | Storage | Meaning |
|---|---|---|
| Project default | `speckit.companion.templateProfile` setting (window scope), mirrored to `.specify/companion.yml` | The default shape new specs inherit. Repurposed: drives dispatch routing, not a preset swap. |
| Per-spec pin | `profile?: 'standard' \| 'lean'` in `<spec>/.spec-context.json` | The shape pinned to one spec, seeded from the project default at the specify step. Absent → fall back to project default → stock (standard). |

**Resolution rule** (consumed by `resolveProfileCommand(command, specDir)`):

1. Read `<specDir>/.spec-context.json` `profile`.
2. If `profile === 'lean'` and `command` has a `/speckit.companion.*` twin → dispatch the twin.
3. Otherwise → dispatch `command` unchanged (the standard shape). A missing/unreadable context or absent `profile` resolves to standard (FR-008).

**Seeding rule** (specify step): a new spec's `profile` is set from the project default at creation, pinning the shape so a later change to the project default does not reshape an in-flight spec (Edge Case: in-flight safety).

## State & transitions

The mode option is effectively a small state machine with no destructive edges:

```text
            set project default                set project default
   standard ───────────────────► lean   lean ───────────────────► standard
      │                                                                │
      │  (new spec created)                          (new spec created)│
      ▼                                                                ▼
  spec.profile = standard                              spec.profile = lean
   → dispatches /speckit.*                  → dispatches /speckit.companion.*
```

- Every transition is non-destructive: no preset add/remove, no command-file deletion (FR-002).
- A transition affects only specs created after it (per-spec pin); existing specs keep their pinned shape (in-flight safety).
- "Unavailable option" (no setting, no pin) is a valid resting state that resolves to standard (FR-008).

## Validation rules

- `profile` accepts only `standard` | `lean`; any other value is treated as absent → standard (defensive, mirrors existing `resolveProfileCommand` fallback).
- Reading a corrupt/unreadable `.spec-context.json` must not throw on the dispatch path — it falls back to the stock command (existing behavior, preserved).
- The activation "ensure standard family present" operation is add-only and idempotent: it never removes a command set, so it cannot transition a project into a stranded state.

## What is removed (no longer drives state)

- The mutually-exclusive `companion-standard` ↔ `companion-lean` **swap** (remove-before-add) as the effect of the mode option.
- The right-click "Template Profile → Standard / Lean" submenu as a setter of per-spec `profile` (the field stays; the manual UI surface is retired — FR-007).
