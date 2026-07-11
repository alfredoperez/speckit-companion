# Todo App — GSD × Superpowers Sandbox

## What This Is

A small React + TypeScript todo list app (Vite + Vitest, React Context/useReducer state, localStorage persistence) used as a sandbox to exercise Eric Tech's mixed workflow: GSD plans each phase, Superpowers executes it with TDD subagents, GSD verifies the result.

## Core Value

Every new feature ships through the plan → TDD-execute → verify loop without breaking the existing add/toggle/delete/clear-completed todo flow.

## Requirements

### Validated

- ✓ User can add a todo via text input — existing
- ✓ User can toggle a todo's completed state — existing
- ✓ User can delete a todo — existing
- ✓ User can clear all completed todos — existing
- ✓ Todos persist to localStorage across reloads — existing
- ✓ Client-side routing between Todos and About pages — existing

### Active

- [ ] Todo has a priority level: low, medium, or high
- [ ] New todos default to medium priority
- [ ] Todo list shows a colored badge for each todo's priority
- [ ] Todo list is sorted high-to-low priority
- [ ] Store, components, and tests are all updated to cover priority

### Out of Scope

- User-configurable priority colors — no styling/theming system exists yet, not requested
- Custom priority levels beyond low/medium/high — fixed 3-tier scheme is sufficient for this sandbox
- Server-side/API-backed priority sync — app is localStorage-only by design

## Context

- Brownfield app, mapped via `/gsd-map-codebase` (`.planning/codebase/`) before this project was initialized.
- State lives in `src/store/todos.tsx` (Context + useReducer); persistence in `src/lib/storage.ts` (localStorage wrapper, fail-silent on error).
- Presentation components (`TodoItem`, `TodoList`, `AddTodo`) are prop-driven, pulling data/callbacks via the `useTodos()` hook — no props-drilling.
- `Todo` type lives in `src/types.ts` (currently: id, text, completed, createdAt).
- This is a **light workflow test**: GSD (`/gsd-discuss-phase`, `/gsd-plan-phase`, `/gsd-verify-work`) drives planning/verification; **Superpowers** (`writing-plans` → `subagent-driven-development`, strict TDD) replaces `/gsd-execute-phase` entirely. Keep phases small — this is meant to be one phase, end-to-end.

## Constraints

- **Tech stack**: React 18 + TypeScript 5.3 (strict) + Vite 5 + Vitest 1.6 — no new frameworks or state libraries for this feature.
- **Execution model**: Never run `/gsd-execute-phase`; execution is Superpowers' job (TDD, fresh subagent per task).
- **Persistence**: localStorage only, via the existing `storage.ts` wrapper — no backend.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Skip project-level domain research (GSD Step 6) | Todo-app domain is trivial and already brownfield-mapped; researching "2025 todo app stacks" adds no value for a one-field feature | ✓ Good |
| Single coarse-granularity phase for this feature | Feature is small (one field + badge + sort) and the workflow is meant to be tested light, per this sandbox's own README | — Pending |

---
*Last updated: 2026-07-10 after initialization*

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
