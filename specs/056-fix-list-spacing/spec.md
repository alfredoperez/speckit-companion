# Spec: Fix List Item Spacing

**Slug**: 056-fix-list-spacing | **Date**: 2026-04-10

## Summary

The spec viewer renders bullet and numbered list items with too much vertical space between them. The gap comes from the combination of `line-height: 1.625` on `li`, `padding: 2px 0` inherited from `.line`, and `margin-bottom: 2px` on `#markdown-content li`. This creates ~15px of visual gap between items which feels loose and wastes vertical space.

## Requirements

- **R001** (MUST): Reduce vertical spacing between list items in the spec viewer so items feel compact
- **R002** (MUST): Preserve readability — items must not feel cramped or overlap
- **R003** (MUST): Nested lists must still appear visually indented and distinguishable from parent items
- **R004** (SHOULD): Spacing should feel consistent with VS Code's native markdown preview density

## Scenarios

### Compact list rendering

**When** a spec with bullet or numbered lists is displayed in the spec viewer
**Then** list items should have tighter vertical spacing (~8-10px gap instead of ~15px)

### Nested list readability

**When** a list contains nested sub-lists
**Then** nested items should still be visually grouped under their parent with appropriate indentation and spacing

## Out of Scope

- Task list checkbox styling (separate component with its own spacing)
- Paragraph spacing changes outside of lists
- Line-height changes to non-list content
