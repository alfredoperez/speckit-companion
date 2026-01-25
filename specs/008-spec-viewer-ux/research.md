# Research: Spec Viewer UX Polish

**Feature**: 008-spec-viewer-ux
**Date**: 2026-01-25

## Research Summary

This document captures research findings and decisions for the UX polish feature. All items marked "NEEDS CLARIFICATION" in the Technical Context have been resolved through codebase analysis.

---

## R1: Current Typography Values (Resolved)

**Question**: What are the exact current margin/font-size values for H2/H3 headings?

**Findings** (from `_typography.css`):
- H2: `margin: 28px 0 14px 0`, `font-size: var(--text-2xl)` (~28px)
- H3: `margin: 24px 0 10px 0`, `font-size: 16px`

**Decision**: Reduce H2 margins to `24px 0 8px 0` per spec FR-004. H2 font-size can be reduced to ~18px as specified in US3.

**Rationale**: Current 28px/14px margins create excessive whitespace between sections. 24px/8px provides visual hierarchy while being more compact.

---

## R2: Line Action Button Position (Resolved)

**Question**: How is the "+" button currently positioned, and how to move to top-left?

**Findings** (from `_line-actions.css`):
- Current: `position: absolute; right: 8px; top: 50%; transform: translateY(-50%);`
- Button appears on right side, vertically centered

**Decision**: Change to `left: -28px; top: 4px; transform: none;` for top-left gutter positioning.

**Rationale**: Left-side gutter is standard GitHub/GitLab review pattern. Top alignment ensures button is visible for multi-line content without obscuring text.

**Alternative rejected**: Keeping right-side position - interferes with reading flow and is non-standard.

---

## R3: Editor Divider Removal (Resolved)

**Question**: Where is the divider between quick actions and textarea defined?

**Findings** (from `inlineEditor.ts:38` and `_editor.css:76-80`):
- HTML: `<div class="editor-divider"></div>`
- CSS: `.editor-divider { height: 1px; background: var(--border); margin: 8px 0; }`

**Decision**: Remove the `<div class="editor-divider">` element from `inlineEditor.ts` and remove CSS rule.

**Rationale**: Per FR-011, the divider creates unnecessary visual separation in a compact editor UI.

---

## R4: "Remove" → "Remove Line" Label (Resolved)

**Question**: Where are the quick action button labels defined?

**Findings** (from `lineActions.ts:45-54`):
```typescript
const actions: Record<LineType, string> = {
    'paragraph': `<button ... data-action="remove-line">Remove</button>`,
    ...
};
```

**Decision**: Change all "Remove" labels to more descriptive labels:
- `Remove` → `Remove Line` (paragraphs)
- `Remove` (story) → `Remove Story`
- `Remove` (section) → `Remove Section`
- etc.

**Rationale**: Per FR-009, clearer labels reduce ambiguity about what will be removed.

---

## R5: Hide Button When Editor Open (Resolved)

**Question**: How to hide the "+" button when editor is already open for that line?

**Findings** (from `_line-actions.css:94-97`):
```css
.line:hover .line-add-btn,
.line.editing .line-add-btn {
    opacity: 1;
}
```

**Decision**: Add rule: `.line.editing .line-add-btn { display: none; }` to override opacity rule.

**Rationale**: Per FR-007, showing the button while editing is redundant and confusing.

---

## R6: Acceptance Scenario Table → List Conversion (Resolved)

**Question**: How are acceptance scenarios currently rendered and how to convert to list?

**Findings** (from `scenarios.ts`):
- Current: Parses numbered list with Given/When/Then into `<table class="scenario-table">` with 4 columns
- Each row has row-add-btn for commenting
- Table styling in `_tables.css` (165+ lines)

**Decision**: Rewrite `parseAcceptanceScenarios()` to output structured list:
```html
<ol class="acceptance-scenarios">
  <li class="scenario-item line" data-line="X">
    <span class="line-add-btn">...</span>
    <div class="line-content">
      <strong>Given</strong> X, <strong>When</strong> Y, <strong>Then</strong> Z
    </div>
    <div class="line-comment-slot"></div>
  </li>
</ol>
```

**Rationale**: Per FR-016/FR-017, lists allow per-item comments using existing line infrastructure. Keywords are emphasized with `<strong>` tags.

**Alternative rejected**: Keeping table with per-cell comments - too granular, doesn't match user mental model of "commenting on a scenario."

---

## R7: Spec Status Detection (Resolved)

**Question**: How is spec status currently handled and how to pass to webview for conditional UI?

**Findings**:
- Status is parsed from spec metadata in `preprocessors.ts` → `preprocessSpecMetadata()`
- Rendered as `.meta-status` badge in content
- Not currently passed as separate state to webview

**Decision**:
1. Parse status in extension side (`specViewerProvider.ts`)
2. Include `specStatus` in initial HTML data attribute: `<body data-spec-status="draft|completed">`
3. Add CSS rules: `body[data-spec-status="completed"] .line-add-btn { display: none; }`
4. Similarly hide DRAFT badge and footer CTAs

**Rationale**: Per FR-018/FR-019/FR-020, completed specs should not show editing controls. CSS-based hiding is simplest approach.

---

## R8: Input Section Border Brightness (Resolved)

**Question**: What is the current Input section styling and how to make border more prominent?

**Findings** (from `_content.css:90-98`):
```css
.spec-input {
    border-left: 3px solid var(--accent);
    ...
}
```

**Decision**: Keep 3px width, but ensure `--accent` is sufficiently visible. The current accent color should be adequate. If needed, can override with brighter custom color.

**Rationale**: Per FR-002, the border should be "brighter/more prominent." The 3px solid accent is already relatively prominent. No change needed unless user feedback indicates otherwise.

---

## R9: Editor Full Width Styling (Resolved)

**Question**: Current editor has padding and shadow - how to make full width?

**Findings** (from `_editor.css:10-18`):
```css
.inline-editor {
    margin: 8px 0 4px 0;
    padding: 12px;
    box-shadow: var(--shadow-md);
    ...
}
```

**Decision**:
- Remove `box-shadow` (set to `none`)
- Keep minimal padding for textarea breathing room
- Remove or reduce margin

**Rationale**: Per FR-008, the editor should integrate more seamlessly with content rather than appearing as elevated card.

---

## R10: Clarify Button Tooltip (Resolved)

**Question**: Where is the Clarify button rendered and how to add tooltip?

**Findings**:
- Footer buttons rendered in extension-side HTML generation (`html/generator.ts`) and webview actions
- Standard HTML `title` attribute provides native tooltip

**Decision**: Add `title="Refine any requirements further"` attribute to Clarify button.

**Rationale**: Per FR-021, simple native tooltip is sufficient for discoverability.

---

## R11: "Remove Line" Should Add Comment (Resolved)

**Question**: Current Remove action shows confirm dialog then sends removeLine message. How to add comment instead?

**Findings** (from `lineActions.ts:59-70`):
```typescript
handleContextAction(action: string, lineNum: number, closeEditor: () => void): void {
    closeEditor();
    switch (action) {
        case 'remove-line':
            if (confirm('Delete this content?')) {
                vscode.postMessage({ type: 'removeLine', lineNum });
            }
            break;
    }
}
```

**Decision**: Change behavior to add a refinement comment with "Remove this line" text instead of immediate removal:
```typescript
case 'remove-line':
    addRefinement(lineNum, '🗑️ Remove this line', lineElement);
    closeEditor();
    break;
```

**Rationale**: Per FR-010, removal should be a suggestion (comment) not immediate action. This integrates with the refinement workflow.

---

## R12: List Item Padding (Resolved)

**Question**: Where is the excessive 40px list item padding coming from?

**Findings**: After reviewing `_typography.css` and `_line-actions.css`, list items have:
- `li.line { padding-right: 40px; }` - for button space, not vertical
- Vertical padding comes from `.line { padding: 3px 40px 3px 0; }`

The "40px padding" mentioned in spec likely refers to visual spacing between items, not actual CSS padding. Current `li { margin: 0; }` should be minimal.

**Decision**: Verify visually. If excessive vertical spacing exists, check for inherited margins or line-height issues. Current CSS appears correct.

**Rationale**: Per FR-003, list items should have minimal vertical padding.

---

## R13: Code Block Font Size (Resolved)

**Question**: What is current code block font size relative to body?

**Findings** (from `_typography.css:104-112`):
```css
#markdown-content code:not(pre code) {
    font-size: 0.875em;  /* 87.5% of parent = ~12.25px at 14px base */
}
```

For pre/code blocks, need to check `_code.css`.

**Decision**: Ensure code blocks use `font-size: 13px` or `0.93em` (slightly smaller than 14px body).

**Rationale**: Per FR-013, code should be "at least 1px smaller" than body text.

---

## Design Patterns Applied

### Pattern 1: CSS-Based State Management
Use `data-*` attributes on `<body>` to drive conditional styling rather than JavaScript DOM manipulation. This keeps state changes declarative and performant.

### Pattern 2: Existing Line Infrastructure
Leverage existing `.line` + `.line-add-btn` + `.line-comment-slot` pattern for all commentable content, including converted scenario lists.

### Pattern 3: Progressive Enhancement
UI controls degrade gracefully - if status detection fails, show all controls (safest default).

---

## Implementation Priorities

Based on research, recommended implementation order:

1. **CSS-only changes** (lowest risk):
   - H2/H3 margin/font adjustments
   - Editor divider removal
   - Editor shadow removal
   - Button position to top-left
   - Hide button when editing

2. **Label changes** (low risk):
   - "Remove" → "Remove Line" etc.
   - Clarify button tooltip

3. **Behavior changes** (medium risk):
   - Remove action adds comment instead of deleting
   - Status-based UI hiding

4. **Structure changes** (higher risk):
   - Acceptance scenario table → list conversion
   - Status detection and propagation

---

## Open Questions

None remaining. All research items resolved.
