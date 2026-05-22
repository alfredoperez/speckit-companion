# Spec: Demo — Dark Mode Toggle

> Canonical testing fixture in the **specified** state (spec only, no plan/tasks).
> Committed at a fixed baseline — do NOT commit local edits (see CLAUDE.md).

## Summary

Add a dark-mode toggle to the app header so users can switch themes without
opening settings.

## Requirements

- **R001** (MUST): A toggle in the header switches between light and dark themes.
- **R002** (MUST): The chosen theme persists across reloads.
- **R003** (SHOULD): The toggle reflects the OS theme on first load.

## Scenarios

### Toggle the theme

**When** the user clicks the header toggle
**Then** the app switches theme immediately and remembers the choice on reload
