# Research: Plan Step Highlight and Sub-menu Ordering

**Feature Branch**: `006-plan-step-highlight`
**Created**: 2026-01-02

## Executive Summary

Research confirms that most of the required functionality is already implemented. The sub-menu ordering (Plan first, then alphabetical) is working correctly. The primary issue is that when switching between plan sub-sections, the Plan step highlight appears to work correctly based on code analysis - each new document that opens gets its own webview with fresh specInfo that correctly identifies `currentPhase: 2` for all plan-related documents.

## Research Tasks

### 1. Plan Step Highlighting Mechanism

**Question**: How is the Plan step highlighted when viewing plan sub-sections?

**Decision**: The existing implementation is correct and should work as expected.

**Rationale**:
- `specInfoParser.ts:49-58` correctly sets `currentPhase = 2` for:
  - `research.md` (line 49-52)
  - All other `.md` files in the spec folder (lines 53-57)
- `phaseUI.ts:18` applies `.active` class when `phaseNum === specInfo.currentPhase`
- For plan sub-sections: `currentPhase = 2`, `phaseNum = 2` (plan), so `.active` is applied

**Alternatives Considered**:
- Tracking a separate "parentPhase" property - unnecessary since currentPhase already correctly identifies plan sub-sections
- Using different highlighting mechanism - the existing `.active` class with ring/glow effect is appropriate

### 2. Tab Navigation Flow

**Question**: What happens when a user clicks a tab to switch between plan sub-sections?

**Decision**: Each document switch creates a new webview with correct phase info.

**Rationale**:
- `actionHandlers.ts:25-30`: `switchToDocument()` calls `openSpecFile()`
- Opening a new spec file triggers VS Code to create a new custom editor instance
- `workflowEditorProvider.ts:45-78`: `resolveCustomTextEditor()` parses fresh specInfo for each document
- The new webview receives correct `specInfo` with `currentPhase: 2` for plan sub-sections

**Key Finding**: The issue may not be in the code logic but could be a visual timing issue or the user might be experiencing a different scenario than assumed.

### 3. Sub-menu Ordering

**Question**: How are sub-menu items ordered?

**Decision**: Already correctly implemented - Plan first, then alphabetically.

**Rationale**:
- `specInfoParser.ts:117-124`: Plan.md is explicitly added first to `docsToShow` array
- `specInfoParser.ts:127-134`: Other docs are sorted alphabetically before being added
- Result order: `[Plan, Data Model, Quickstart, Research]` (alphabetically after Plan)

**Alternatives Considered**:
- Manual ordering configuration - adds unnecessary complexity
- Alphabetical only - would bury the primary "Plan" document

### 4. Visual Highlight CSS

**Question**: What visual styling is applied to the active step?

**Decision**: Existing CSS is appropriate and visible.

**Rationale** (from `workflow.css:181-206`):
- `.step.active .step-indicator` gets:
  - Blue background (`var(--accent)`)
  - Blue border
  - White text
  - Glow effect with box-shadow (4px ring + glow effects)
- This provides clear visual distinction from non-active states

**No changes needed** - the visual infrastructure is complete.

### 5. Edge Case: Direct Navigation/Deep Links

**Question**: What happens when a user directly opens a plan sub-section?

**Decision**: Works correctly - each document open triggers fresh specInfo parsing.

**Rationale**:
- Opening `research.md` directly triggers `resolveCustomTextEditor()`
- `parseSpecInfo()` correctly identifies it as `currentPhase: 2`
- The webview renders with Plan step highlighted

## Implementation Verification Needed

Based on code analysis, the feature appears to be correctly implemented. Before making any code changes, the following verification steps should be performed:

1. **Manual Testing**: Open research.md directly and verify Plan step is highlighted
2. **Tab Switching Test**: Click tabs between Plan, Research, Data Model and observe highlighting
3. **Refresh Test**: After switching tabs, refresh the page and verify correct highlight persists

## Potential Issues to Investigate

If manual testing reveals the highlight is NOT working:

1. **Webview Panel Timing**: Check if webview content loads before `updatePhaseUI()` is called
2. **CSS Specificity**: Verify `.step.active` styles aren't overridden
3. **Tab Switching Edge Case**: When switching tabs in the same panel vs opening new panel

## Conclusion

Research indicates the feature should be working based on code analysis. The sub-menu ordering is definitively working correctly. Recommend performing manual testing to verify actual behavior before implementing any changes.

If issues are found during testing, the fix would likely involve:
- Ensuring `updatePhaseUI()` is called after DOM is ready
- Adding explicit phase info update after tab switch if using same webview panel
