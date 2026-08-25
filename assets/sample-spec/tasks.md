# Tasks: Command Palette Quick-Open

**Plan**: [plan.md](./plan.md)

## Phase 1: Core

- [ ] **T001** Fuzzy matcher with per-keystroke scoring — `palette/fuzzy.ts` | R001
- [ ] **T002** [P] Navigable-item registry the matcher indexes — `palette/registry.ts` | R001
- [ ] **T003** [P] Recent-items MRU hook (capped at 10, local storage) — `palette/useRecentItems.ts` | R003

## Phase 2: Surface

- [ ] **T004** Palette modal: input, ranked result list, keyboard nav — `palette/CommandPalette.tsx` *(depends on T001, T002)* | R001, R002, R004
- [ ] **T005** Wire the open shortcut, navigation on Enter, Escape dismiss — `palette/CommandPalette.tsx` *(depends on T004)* | R002, R004
- [ ] **T006** Empty-query state renders the MRU list — `palette/CommandPalette.tsx` *(depends on T003, T004)* | R003
