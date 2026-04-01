# Spec: Active Spec Grouping & Step Indicator

**Slug**: 028-spinning-active-step | **Date**: 2026-03-31

## Summary

Group specs in the explorer tree into "Active" (expanded) and "Earlier" (collapsed) based on file modification time. Show a spinning icon on the spec node when a step command is running. Remove the static circle status indicators from step descriptions.

## Requirements

- **R001** (MUST): Group specs into two collapsible sections: "Active" (expanded by default) and "Earlier" (collapsed by default)
- **R002** (MUST): Classify a spec as "Active" if any file in its directory was modified today (based on filesystem mtime); otherwise classify as "Earlier"
- **R003** (MUST): Sort specs within Active group newest-first (most recently modified at top)
- **R004** (MUST): Remove the static circle status indicators (○, ◐, ●) from step description text
- **R005** (MUST): Show a spinning icon (`sync~spin`) on the spec parent node when a step command is executed, replacing the `beaker` icon
- **R006** (MUST): Clear the spinning icon on extension reload (in-memory state only, no persistence needed)
- **R007** (SHOULD): Classification must be tool-agnostic — based solely on file mtime, no dependency on state.json or any specific tool's artifacts

## Scenarios

### New spec created today

**When** a spec directory has files modified today
**Then** it appears in the "Active" group, expanded, sorted newest-first

### Spec from yesterday

**When** all files in a spec directory were last modified before today
**Then** it appears in the "Earlier" group, collapsed by default

### Step command executed

**When** the user clicks a step button (e.g., Plan, Tasks) for a spec
**Then** the spec's parent node icon changes from `beaker` to `sync~spin`

### Extension reload

**When** the extension reloads or VS Code restarts
**Then** all spinning indicators are cleared; grouping recalculates from file mtime

### Multiple active specs

**When** multiple specs have files modified today
**Then** all appear in Active group, newest-first; clicking a step on one spec sets only that spec as spinning

## Out of Scope

- Tracking command success/failure from terminal output
- Persisting active/spinning state across sessions
- Modifying the steering explorer tree
- Dependency on SDD state.json or any tool-specific artifact
