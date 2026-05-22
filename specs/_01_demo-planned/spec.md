# Spec: Demo — CSV Export

> Canonical testing fixture in the **planned** state (spec + plan, no tasks).
> Committed at a fixed baseline — do NOT commit local edits (see CLAUDE.md).

## Summary

Let users export the current table view to a CSV file.

## Requirements

- **R001** (MUST): An "Export CSV" action downloads the current rows as `.csv`.
- **R002** (MUST): The export respects the active filter and sort.
- **R003** (SHOULD): Column headers match the visible table headers.

## Scenarios

### Export the current view

**When** the user clicks "Export CSV" with a filter applied
**Then** a CSV of the filtered, sorted rows downloads with matching headers
