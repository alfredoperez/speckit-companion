# Spec: Fix Grayish Step Names

**Slug**: 1-fix-grayish-step-names | **Date**: 2026-03-31

## Summary

Step names in the spec explorer tree view appear grayish/dimmed because `resourceUri` is set on TreeItems pointing to files inside `.claude/`, which is typically git-ignored. VS Code automatically dims git-ignored files in tree views when `resourceUri` is present.

## Requirements

- **R001** (MUST): Spec tree items must not appear dimmed due to git-ignored status
- **R002** (MUST): Inline actions and commands that need file paths must continue to work

## Scenarios

### Git-Ignored Spec Files

**When** specs are stored in `.claude/` which is in `.gitignore`
**Then** tree item labels should appear in normal (non-dimmed) color

### Opening Spec Files

**When** a user clicks a spec tree item
**Then** the correct file opens (file path resolution still works without `resourceUri`)

## Out of Scope

- Webview CSS step label colors (not the cause)
- Changing where spec files are stored
