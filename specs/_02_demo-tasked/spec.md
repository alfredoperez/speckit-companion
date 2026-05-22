# Spec: Demo — Command Palette Quick-Open

> Canonical testing fixture in the **tasked-out** state (spec + plan + tasks,
> ready to implement). Committed at a fixed baseline — do NOT commit local edits
> (see CLAUDE.md).

## Summary

Add a keyboard-driven quick-open palette so users can jump to any item by name.

## Requirements

- **R001** (MUST): A shortcut opens a fuzzy-search palette over all items.
- **R002** (MUST): Selecting a result navigates to that item.
- **R003** (SHOULD): The palette shows recent items when the query is empty.

## Scenarios

### Jump to an item

**When** the user presses the shortcut and types part of an item's name
**Then** matching items rank by relevance and Enter navigates to the top match
