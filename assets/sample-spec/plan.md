# Plan: Command Palette Quick-Open

**Spec**: [spec.md](./spec.md)

## Approach

A modal overlay backed by a small fuzzy matcher over an in-memory item index. The matcher scores each item against the query and the list re-ranks on every keystroke. Recent items come from a capped most-recently-used list persisted to local storage, shown whenever the query is empty.

No new dependencies: the fuzzy scorer is ~40 lines, and the overlay reuses the app's existing modal primitives.

## Design Decisions

- **Score in memory, not on the server** — the item index is small enough to hold client-side, and per-keystroke round-trips would make ranking feel laggy.
- **MRU list capped at 10** — enough to cover "return to what I was just doing" without becoming a second navigation system.
- **One shortcut, no chords** — a single well-known binding keeps the palette discoverable; power users can rebind it in settings.

## Files

- `palette/fuzzy.ts` — ranking/scoring for the query.
- `palette/CommandPalette.tsx` — modal, input, result list, keyboard nav.
- `palette/useRecentItems.ts` — MRU list persisted to local storage.
- `palette/registry.ts` — the navigable-item index the matcher scores against.
