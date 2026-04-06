# Spec: Explorer & Viewer Fixes

**Slug**: 051-explorer-viewer-fixes | **Date**: 2026-04-05

## Summary

Fix 8 issues across the spec explorer and spec viewer: prevent read-only operations from writing `.spec-context.json`, sort completed/archived specs by date, show spec directories with only `.spec-context.json`, add visual boundary to refinement comments, fix line action button spacing, add mermaid diagram zoom, disable non-existent step tabs, and fix stepper badge/pulse visual states.

## Requirements

- **R001** (MUST): `getOrSelectWorkflow()` called from tree rendering and viewer init must resolve the default workflow in-memory without writing to disk
- **R002** (MUST): Only persist workflow to `.spec-context.json` when user explicitly executes a step or selects a workflow
- **R003** (MUST): Completed and Archived spec groups sorted by creation date descending (newest first), same as Active
- **R004** (MUST): Spec directories containing only `.spec-context.json` (no `.md` files) appear in the explorer
- **R005** (MUST): Refinement comment area (textarea + buttons) has a visible border/container distinguishing it from surrounding content
- **R006** (MUST): Line action buttons do not inflate bullet point line spacing
- **R007** (MUST): Mermaid diagrams have zoom controls or render at natural size with horizontal scroll
- **R008** (MUST): Step tabs whose files don't exist are visually disabled and don't respond to clicks
- **R009** (MUST): Badge text always reflects real `.spec-context.json` state regardless of which tab is viewed
- **R010** (MUST): Pulsing dot stops when step's `completedAt` is set in stepHistory
- **R011** (SHOULD): Working step pulse uses green (`--success`) color instead of `--accent`
- **R012** (SHOULD): Active working step uses bold primary/accent color text to stand out from merely viewed tabs

## Scenarios

### Read-only tree refresh does not write files

**When** the spec explorer tree refreshes or spec viewer opens
**Then** no `.spec-context.json` files are modified on disk

### Explicit step execution persists workflow

**When** user explicitly executes a workflow step via specCommands
**Then** the workflow selection is saved to `.spec-context.json`

### Completed specs sorted by date

**When** the explorer shows the Completed group
**Then** specs appear sorted by creation date, newest first

### Spec directory with only context file

**When** a spec directory contains only `.spec-context.json` (no `.md` files)
**Then** the directory appears in the explorer tree

### Refinement area has visual boundary

**When** the refinement comment UI is displayed in the spec viewer
**Then** a visible border/container wraps the textarea and action buttons

### Bullet point spacing unaffected by line actions

**When** bullet point lines render with line action buttons
**Then** the line height matches lines without action buttons

### Mermaid diagram zoom

**When** a mermaid diagram with many nodes renders in the spec viewer
**Then** zoom controls allow the user to enlarge and read the diagram

### Non-existent step tabs are disabled

**When** a step tab's file does not exist
**Then** the tab is visually disabled and clicks are ignored

### Badge reflects real context state

**When** user navigates to a different step tab
**Then** the badge still shows the status from `.spec-context.json` currentStep, not the viewed tab

### Pulse stops on completed steps

**When** a step has `completedAt` set in stepHistory
**Then** the pulsing animation does not play for that step

## Out of Scope

- Reworking the file watcher debounce logic (existing debounce is sufficient once writes are eliminated)
- Adding workflow selection UI to read-only paths
- Changing the step execution flow or command registration
