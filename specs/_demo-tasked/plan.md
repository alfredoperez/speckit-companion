# Plan: Demo — Command Palette Quick-Open

**Spec**: [spec.md](./spec.md)

## Approach

A modal overlay backed by a small fuzzy matcher over an in-memory item index.
Recent items come from a capped MRU list in local storage.

## Files

- `palette/fuzzy.ts` — ranking/scoring for the query.
- `palette/CommandPalette.tsx` — modal, input, result list, keyboard nav.
- `palette/useRecentItems.ts` — MRU list persisted to local storage.
