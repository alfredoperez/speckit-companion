# Quickstart: Spec Viewer UX Polish

**Feature**: 008-spec-viewer-ux
**Date**: 2026-01-25

## Overview

This guide provides step-by-step implementation instructions for the Spec Viewer UX Polish feature. Changes are organized by file to minimize context switching.

---

## Prerequisites

- VS Code extension development environment set up
- `npm run watch` running for TypeScript compilation
- Extension Development Host ready (F5 to launch)

---

## Implementation Steps

### Step 1: CSS Typography Adjustments

**File**: `webview/styles/spec-viewer/_typography.css`

1. Update H2 styling:
```css
#markdown-content h2 {
    font-size: 18px;              /* Was var(--text-2xl) ~28px */
    font-weight: 600;
    line-height: var(--leading-snug);
    letter-spacing: -0.01em;
    margin: 24px 0 8px 0;          /* Was 28px 0 14px 0 */
    color: var(--text-primary);
}
```

2. Update H3 styling:
```css
#markdown-content h3 {
    font-size: 15px;               /* Was 16px */
    font-weight: 600;
    line-height: 1.4;              /* Was var(--leading-snug) */
    margin: 20px 0 6px 0;          /* Was 24px 0 10px 0 */
    color: var(--text-primary);
}
```

### Step 2: Line Action Button Positioning

**File**: `webview/styles/spec-viewer/_line-actions.css`

1. Change button from right to left position:
```css
.line-add-btn {
    position: absolute;
    left: -28px;                   /* Was right: 8px */
    top: 4px;                      /* Was top: 50% */
    transform: none;               /* Was translateY(-50%) */
    /* ... rest unchanged ... */
}
```

2. Hide button when editor is open:
```css
/* Add after existing .line:hover .line-add-btn rule */
.line.editing .line-add-btn {
    display: none;
}
```

3. Adjust line padding for left gutter:
```css
.line {
    position: relative;
    padding: 3px 8px 3px 0;        /* Reduced right padding, removed button space */
    margin-left: 32px;             /* Add left margin for gutter */
    /* ... rest unchanged ... */
}
```

### Step 3: Editor Panel Cleanup

**File**: `webview/styles/spec-viewer/_editor.css`

1. Remove shadow and adjust styling:
```css
.inline-editor {
    margin: 8px 0 4px 0;
    padding: 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: none;              /* Was var(--shadow-md) */
    animation: slideDown var(--transition-fast) ease-out;
}
```

2. Remove divider styling (will be removed from HTML):
```css
/* Remove or comment out */
/* .editor-divider {
    height: 1px;
    background: var(--border);
    margin: 8px 0;
} */
```

**File**: `webview/src/spec-viewer/editor/inlineEditor.ts`

3. Remove divider element from editor HTML (around line 38):
```typescript
// Before:
editor.innerHTML = `
    <div class="editor-actions">
        ${getContextActions(lineType, lineNum)}
    </div>
    <div class="editor-divider"></div>     <!-- REMOVE THIS LINE -->
    <div class="editor-comment-section">
    ...
`;

// After:
editor.innerHTML = `
    <div class="editor-actions">
        ${getContextActions(lineType, lineNum)}
    </div>
    <div class="editor-comment-section">
    ...
`;
```

### Step 4: Quick Action Label Updates

**File**: `webview/src/spec-viewer/editor/lineActions.ts`

1. Update getContextActions labels (around line 45-54):
```typescript
export function getContextActions(lineType: LineType, lineNum: number): string {
    const actions: Record<LineType, string> = {
        'user-story': `<button class="context-action" data-action="remove-story" data-line="${lineNum}">Remove Story</button>`,
        'acceptance': `<button class="context-action" data-action="remove-scenario" data-line="${lineNum}">Remove Scenario</button>`,
        'task': `<button class="context-action" data-action="toggle-task" data-line="${lineNum}">Toggle</button><button class="context-action" data-action="remove-task" data-line="${lineNum}">Remove Task</button>`,
        'section': `<button class="context-action" data-action="remove-section" data-line="${lineNum}">Remove Section</button>`,
        'paragraph': `<button class="context-action" data-action="remove-line" data-line="${lineNum}">Remove Line</button>`
    };
    return actions[lineType];
}
```

### Step 5: "Remove Line" Adds Comment

**File**: `webview/src/spec-viewer/editor/lineActions.ts`

1. Import addRefinement at top:
```typescript
import { addRefinement } from './refinements';
```

2. Update handleContextAction (around line 59-82):
```typescript
export function handleContextAction(
    action: string,
    lineNum: number,
    closeEditor: () => void,
    lineElement?: HTMLElement      // Add this parameter
): void {
    switch (action) {
        case 'remove-line':
        case 'remove-story':
        case 'remove-section':
        case 'remove-scenario':
        case 'remove-task':
            // Add removal comment instead of immediate deletion
            if (lineElement) {
                const actionLabel = action.replace('remove-', '').replace('-', ' ');
                addRefinement(lineNum, `🗑️ Remove this ${actionLabel}`, lineElement);
            }
            closeEditor();
            break;
        case 'toggle-task':
            // ... existing toggle logic unchanged ...
            closeEditor();
            break;
    }
}
```

3. Update caller in `inlineEditor.ts` to pass lineElement:
```typescript
// Around line 96-101
contextButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const action = (e.target as HTMLElement).dataset.action;
        handleContextAction(action || '', lineNum, closeInlineEditor, lineElement);
    });
});
```

### Step 6: Spec Status Detection & Conditional UI

**File**: `src/features/spec-viewer/types.ts`

1. Add SpecStatus type:
```typescript
export type SpecStatus = 'draft' | 'in-progress' | 'spec-completed' | 'done';

export function isEditableStatus(status: SpecStatus): boolean {
    return status === 'draft' || status === 'in-progress';
}
```

**File**: `src/features/spec-viewer/specViewerProvider.ts`

2. Add status extraction function:
```typescript
function extractSpecStatus(content: string): SpecStatus {
    const patterns = [
        /\*\*Status\*\*:\s*([\w\s-]+)/i,
        /Status:\s*([\w\s-]+)/i
    ];
    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
            const status = match[1].toLowerCase().trim();
            if (status.includes('completed') || status === 'done') {
                return 'spec-completed';
            }
            if (status.includes('progress')) {
                return 'in-progress';
            }
        }
    }
    return 'draft';
}
```

3. Pass status to HTML generation in `getWebviewContent()`:
```typescript
// Add to the body tag
const specStatus = extractSpecStatus(markdownContent);
// In HTML template:
<body class="${themeClass}" data-spec-status="${specStatus}">
```

**File**: `webview/styles/spec-viewer/_line-actions.css`

4. Add status-based hiding:
```css
/* Hide add buttons when spec is completed */
body[data-spec-status="spec-completed"] .line-add-btn,
body[data-spec-status="spec-completed"] .row-add-btn {
    display: none !important;
}
```

**File**: `webview/styles/spec-viewer/_content.css`

5. Hide DRAFT badge when completed:
```css
body[data-spec-status="spec-completed"] .meta-status-draft {
    display: none;
}
```

**File**: `webview/styles/spec-viewer/_footer.css`

6. Hide refinement CTAs when completed:
```css
body[data-spec-status="spec-completed"] .actions button.enhancement,
body[data-spec-status="spec-completed"] #clarify-btn {
    display: none;
}
```

### Step 7: Acceptance Scenarios → List Format

**File**: `webview/src/spec-viewer/markdown/scenarios.ts`

Replace `parseAcceptanceScenarios()` function:

```typescript
export function parseAcceptanceScenarios(markdown: string): string {
    scenarioTableCounter = 0;

    const sectionPattern = /(\*\*Acceptance Scenarios\*\*:?\s*\n)((?:\d+\.\s+[\s\S]+?)(?=\n\n(?!\s*\d+\.)|$|\n#|\n\*\*))/gi;

    return markdown.replace(sectionPattern, (_match, header, listContent) => {
        const tableId = `scenario-list-${++scenarioTableCounter}`;

        // Pre-process: join wrapped lines
        const rawLines = listContent.trim().split('\n');
        const joinedLines: string[] = [];

        for (const line of rawLines) {
            if (/^\d+\.\s+/.test(line)) {
                joinedLines.push(line);
            } else if (joinedLines.length > 0 && line.trim()) {
                joinedLines[joinedLines.length - 1] += ' ' + line.trim();
            }
        }

        const commentIcon = `<svg width="14" height="14" viewBox="0 0 24 24">...</svg>`;

        const listItems = joinedLines.map((line, idx) => {
            const lineNum = idx + 1;
            const content = line.replace(/^\d+\.\s*/, '').trim();

            // Emphasize Given/When/Then keywords
            const emphasized = content
                .replace(/\*?\*?(Given)\*?\*?/gi, '<strong class="keyword-given">$1</strong>')
                .replace(/\*?\*?(When)\*?\*?/gi, '<strong class="keyword-when">$1</strong>')
                .replace(/\*?\*?(Then)\*?\*?/gi, '<strong class="keyword-then">$1</strong>');

            return `<li class="scenario-item line" data-line="${lineNum}" data-list-id="${tableId}">
                <button class="line-add-btn" data-line="${lineNum}" data-list-id="${tableId}" title="Add comment">${commentIcon}</button>
                <div class="line-content">${escapeHtmlInScenario(emphasized)}</div>
                <div class="line-comment-slot"></div>
            </li>`;
        }).join('');

        return `<p class="scenario-label"><strong>Acceptance Scenarios:</strong></p>
<ol class="acceptance-scenarios" id="${tableId}">${listItems}</ol>

`;
    });
}
```

**File**: `webview/styles/spec-viewer/_tables.css`

Add list styling:
```css
/* Acceptance Scenarios List Format */
.acceptance-scenarios {
    margin: var(--space-2) 0 var(--space-4) 0;
    padding-left: var(--space-5);
}

.scenario-item {
    margin: var(--space-1) 0;
    padding-right: 40px;
}

.scenario-item .keyword-given,
.scenario-item .keyword-when,
.scenario-item .keyword-then {
    font-weight: 600;
}

.scenario-item .keyword-given { color: var(--accent); }
.scenario-item .keyword-when { color: var(--warning); }
.scenario-item .keyword-then { color: var(--success); }
```

### Step 8: Clarify Button Tooltip

**File**: `src/features/spec-viewer/html/generator.ts` (or wherever footer buttons are generated)

Add title attribute to Clarify button:
```html
<button id="clarify-btn" class="enhancement" title="Refine any requirements further">
    <span class="icon">✨</span> Clarify
</button>
```

---

## Testing Checklist

### Visual Layout (US1)
- [ ] No double dividers between sections
- [ ] Input section has single accent border
- [ ] List items have minimal padding
- [ ] H2 margins: 24px top, 8px bottom
- [ ] H3 has smaller font/line-height

### Comment Interaction (US2)
- [ ] "+" button hidden when editor is open
- [ ] Editor has no shadow, full width
- [ ] "Remove" → "Remove Line" labels
- [ ] Remove action adds comment (not deletes)
- [ ] No divider between quick actions and textarea
- [ ] "+" button at top-left

### Typography (US3)
- [ ] H2 at ~18px
- [ ] Code blocks smaller than body text

### Acceptance Format (US4)
- [ ] Scenarios render as list (not table)
- [ ] Given/When/Then keywords are bold
- [ ] Can add comments to individual scenarios

### State-Aware UI (US5)
- [ ] DRAFT badge hidden when "Spec Completed"
- [ ] "+" buttons hidden when completed
- [ ] Footer CTAs hidden when completed

### Tooltip (US6)
- [ ] Clarify button shows tooltip on hover

---

## Rollback Plan

If issues arise, revert changes by file group:
1. CSS changes: Restore from git (`git checkout -- webview/styles/spec-viewer/*.css`)
2. TypeScript changes: Restore specific files
3. Full rollback: `git checkout main -- webview/ src/features/spec-viewer/`

---

## Performance Considerations

- CSS-based status hiding is lightweight (no JS manipulation)
- List format may slightly reduce render complexity vs tables
- No new dependencies added
