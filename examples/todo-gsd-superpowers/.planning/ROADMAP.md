# Roadmap: Todo App — GSD × Superpowers Sandbox (Priority Levels)

## Overview

This is a single-feature slice on an existing todo app: add a priority level (low/medium/high) to each todo, default new todos to medium, show a colored priority badge, and keep the list sorted high-to-low. The whole feature is small and cohesive enough to ship as one phase — there's no natural seam to split store changes, badge UI, and sorting into separate delivery boundaries; a user only benefits once all three land together.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Priority Levels** - Todos have a priority (low/medium/high), default to medium, show a colored badge, and the list sorts high-to-low

## Phase Details

### Phase 1: Priority Levels
**Mode:** mvp
**Goal**: Users can assign, see, and rely on priority to organize their todos, without breaking any existing todo behavior
**Depends on**: Nothing (first phase)
**Requirements**: PRIO-01, PRIO-02, PRIO-03, PRIO-04, PRIO-05
**Success Criteria** (what must be TRUE):
  1. Each todo in the list shows a colored badge indicating its priority (low, medium, or high) — PRIO-01, PRIO-03
  2. A newly created todo appears with medium priority by default — PRIO-02
  3. The todo list is always ordered high-to-low priority (high first, low last) — PRIO-04
  4. Existing todo behaviors (add, toggle, delete, clear-completed, localStorage persistence) continue to work correctly, confirmed by updated tests across the store, types, and components — PRIO-05
**Plans**: 1 plan
- [ ] 01-01-PLAN.md — Priority type + Todo.priority field, store default (medium) + high-to-low sort, PriorityBadge, AddTodo priority selector, updated store/component/integration tests
**UI hint**: yes

## Progress

**Execution Order:**
Single phase: 1

| Phase | Plans Complete | Status | Completed |
|-------|-----------------|--------|-----------|
| 1. Priority Levels | 0/1 | Not started | - |
