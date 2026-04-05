# Spec: Fix Explorer Tree View

**Slug**: 047-fix-explorer-tree-view | **Date**: 2026-04-05

## Summary

Fix three bugs in the spec explorer sidebar tree view: step status indicator uses the wrong field (currentStep instead of SDD step), related documents render as siblings instead of indented children, and unregistered markdown files in the spec directory are not discovered as related docs.

## Requirements

- **R001** (MUST): Step status icon prefers `specContext.step` (SDD-managed) over `specContext.currentStep` (extension-managed tab click) when determining the in-progress step indicator
- **R002** (MUST): When `step` is absent in spec-context.json, fall back to `currentStep` for the in-progress indicator (backward compatibility)
- **R003** (MUST): Related documents (subFiles, related docs) render as indented children of their parent step in the tree view, not as siblings
- **R004** (MUST): Markdown files in the spec root directory that are not declared in any workflow step's `subFiles` or `subDir` config are discovered and shown as children of the step with `includeRelatedDocs: true`
- **R005** (SHOULD): Discovery of unregistered docs excludes core step files (spec.md, plan.md, tasks.md) and hidden files/directories

## Scenarios

### Step status prefers SDD step field

**When** spec-context.json has `step: "implement"` and `currentStep: "plan"` (user last clicked Plan tab)
**Then** the Implement step shows the blue in-progress dot, not Plan

### Step status falls back to currentStep

**When** spec-context.json has `currentStep: "plan"` but no `step` field
**Then** the Plan step shows the blue in-progress dot (existing behavior preserved)

### Related docs render as children

**When** a step (e.g., Plan) has subFiles like research.md and related docs
**Then** they appear indented under Plan in the tree, expandable via the collapse/expand toggle

### Unregistered docs discovered

**When** a file `requirements.md` exists in the spec root but is not in any step's subFiles config
**Then** it appears as a child of the step with `includeRelatedDocs: true` (Plan by default)

### Core files excluded from discovery

**When** `spec.md`, `plan.md`, `tasks.md` exist in the spec root
**Then** they are NOT shown as related docs (they are already represented as step items)

## Out of Scope

- Changing the `currentStep` update logic when users click tabs
- Adding new workflow step types or configuration options
- Modifying the spec-context.json schema
