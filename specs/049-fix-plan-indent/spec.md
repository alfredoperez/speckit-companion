# Feature Specification: Fix Plan Sub-files Indentation in Sidebar

**Feature Branch**: `049-fix-plan-indent`  
**Created**: 2026-04-05  
**Status**: Draft  
**Input**: User description: "fix that plan files are not indented in the side bar as in the Specification"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Plan sub-files display as children (Priority: P1)

When a user expands a spec in the Specs sidebar, the Plan step's sub-files (research, data-model, quickstart, contracts) should appear indented as children of the Plan node, exactly like Requirements appears indented under Specification.

Currently, plan sub-files (research, data-model) appear at the same indentation level as Plan rather than nested under it, breaking the visual hierarchy.

**Why this priority**: This is the core visual bug. Without proper indentation, users cannot distinguish between workflow steps and their sub-documents, making the sidebar confusing.

**Independent Test**: Expand a spec that has a Plan with existing sub-files (research.md, data-model.md). Verify they appear indented under Plan, matching how Requirements appears under Specification.

**Acceptance Scenarios**:

1. **Given** a spec with research.md and data-model.md files, **When** the user expands the spec in the sidebar, **Then** Plan appears as a collapsible node with research and data-model indented as its children
2. **Given** a spec with checklists/requirements.md, **When** the user expands the spec, **Then** Specification shows Requirements indented at the same depth that Plan shows its sub-files
3. **Given** a spec with no plan sub-files, **When** the user views the sidebar, **Then** Plan appears as a non-collapsible leaf node with no children

---

### Edge Cases

- What happens when plan sub-files are added or removed while the sidebar is open? (Tree should refresh and update hierarchy correctly)
- What happens when a Plan step has both subFiles and subDir entries? (Both sources should appear as children)
- What happens when a Plan step has `includeRelatedDocs: true` and there are unattached .md files? (Related docs should also appear as children of Plan)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Plan sub-files (research, data-model, quickstart, contracts) MUST appear as indented children under the Plan tree node, matching the same visual hierarchy used by Specification/Requirements
- **FR-002**: The collapsible/expandable behavior of Plan MUST work identically to Specification when sub-files exist
- **FR-003**: All workflow steps with sub-files or sub-directories MUST display their children at consistent indentation depth
- **FR-004**: The fix MUST NOT change the behavior of steps without sub-files (e.g., Tasks appearing as a leaf node)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Plan sub-files render at one indentation level deeper than the Plan node, visually matching Specification/Requirements nesting
- **SC-002**: All existing tree view functionality (expand, collapse, click to open, status icons) continues to work correctly for all steps
- **SC-003**: Users can visually distinguish between workflow steps and their sub-documents at a glance
