# Spec: Command Palette Quick-Open

## Summary

Add a keyboard-driven quick-open palette so users can jump to any item in the app by name, without reaching for the mouse or memorizing where things live.

This is a sample spec seeded by SpecKit Companion so you can explore the viewer with something real in it. It is an ordinary spec directory in your workspace — open the documents, click through the pipeline, and delete it whenever you like.

## User Story

A user working deep in one part of the app remembers an item by name and wants to be there now. They press a shortcut, type a few characters, and land on the item — the palette does the remembering of where things live.

## Requirements

- **R001** (MUST): A keyboard shortcut opens a fuzzy-search palette over all navigable items.
- **R002** (MUST): Selecting a result navigates to that item and closes the palette.
- **R003** (SHOULD): With an empty query, the palette lists recently visited items, most recent first.
- **R004** (SHOULD): The palette is fully keyboard-operable — arrows move the selection, Enter navigates, Escape dismisses.

## Scenarios

### Jump to an item by name

**When** the user presses the shortcut and types part of an item's name
**Then** matching items rank by relevance and Enter navigates to the top match

### Return to recent work

**When** the user opens the palette without typing
**Then** the most recently visited items appear, ready to re-open with one keystroke

### Dismiss without navigating

**When** the user presses Escape with the palette open
**Then** the palette closes and focus returns exactly where it was
