# Concept: Saved filters for the orders list

- **Slug**: saved-filters
- **Created**: 2026-10-03
- **Recommended option**: B — Named private filters stored in user preferences

## Options

### Option A — Do nothing
- **Sketch**: Filters keep resetting on page load. People who want to keep one use a browser bookmark.
- **Appetite**: small (no work)
- **Trade-offs**: Wins: no new UI, no new stored data. Sacrifices: the daily rebuild continues, and bookmarked date ranges stay frozen.
- **Rabbit holes**: none.

### Option B — Named private filters
- **Sketch**: A "Save filter" control next to the filter bar asks for a name and stores the current filter under the person's preferences. A dropdown lists saved filters and applies one on click. A date rule is saved as relative ("older than 3 days") when it was entered that way.
- **Appetite**: small (days). Reuses `src/prefs.js`, which the column picker already uses.
- **Trade-offs**: Wins: meets all three goals, no new storage, nothing changes for people who never save. Sacrifices: filters are private, so each of the four people saves their own copy.
- **Rabbit holes**:
  - A relative date form for the filter object, which holds absolute dates today.
  - Renaming and deleting a saved filter.
  - A saved filter that names a customer who was later removed.

### Option C — Team-shared filters
- **Sketch**: Saved filters belong to the team. Anyone can apply one, and the person who made it can edit it.
- **Appetite**: medium (weeks). Needs a team scope that preferences do not have.
- **Trade-offs**: Wins: one copy of the daily filter for all four people. Sacrifices: a new ownership model, edit conflicts, and a migration for existing preferences.
- **Rabbit holes**:
  - Who may edit or delete a shared filter.
  - What a person sees when a shared filter they use is changed.

## Recommendation

Option B. It meets every goal with storage the app already has, and the one real unknown, relative dates, is small and contained in the filter object. Option C solves a problem nobody reported: the team asked to stop rebuilding a filter, not to share one.

## Out of Scope (for the recommended option)

- Sharing a filter with another person or the team.
- A default filter applied on page load.
- Saved filters on lists other than orders.

## Assumptions to Validate

- "Older than N days" is the only relative date form the team needs at first.
- Four private copies of the same filter is acceptable to the support lead.
- A soft limit of twenty saved filters per person is more than enough.
