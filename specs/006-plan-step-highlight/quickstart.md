# Quickstart: Plan Step Highlight and Sub-menu Ordering

**Feature Branch**: `006-plan-step-highlight`
**Created**: 2026-01-02

## Overview

This guide explains how to implement and test the Plan Step Highlight feature. Based on code analysis, the feature may already be working correctly - this guide includes verification steps.

## Prerequisites

- VS Code ^1.84.0
- Node.js (for building the extension)
- The SpecKit Companion extension source code

## Verification Steps (Before Implementation)

Before making any code changes, verify the current behavior:

### 1. Start the Extension Development Host

```bash
# From the repo root
npm run compile
# Then press F5 in VS Code to launch Extension Development Host
```

### 2. Test Plan Step Highlighting

1. Create or open a spec folder with multiple plan documents:
   ```
   specs/test-feature/
   ├── spec.md
   ├── plan.md
   ├── research.md
   ├── data-model.md
   └── quickstart.md
   ```

2. Open `research.md` in the workflow editor
3. **Expected**: Plan step (2) in the progress bar should show blue ring/glow
4. **If NOT highlighted**: Proceed with implementation

### 3. Test Sub-menu Ordering

1. Open any plan sub-section (research.md, data-model.md, etc.)
2. View the tabs above the content area
3. **Expected**: Tabs should be ordered: `Plan | Data Model | Quickstart | Research`
4. **If NOT ordered correctly**: Check `specInfoParser.ts:117-134`

## Implementation Guide (If Needed)

If verification shows the feature is NOT working:

### Step 1: Check specInfoParser.ts

Verify lines 49-58 correctly set `currentPhase = 2` for plan sub-sections:

```typescript
// src/features/workflow-editor/workflow/specInfoParser.ts
} else if (fileName === 'research.md') {
    currentPhase = 2;  // Research is part of Plan phase
    phaseIcon = '🔍';
    documentType = 'plan';  // Treat as plan-related
} else if (fileName.endsWith('.md')) {
    // Related docs (data-model.md, quickstart.md, etc.) are part of the Plan phase
    currentPhase = 2;
    phaseIcon = '📄';
    documentType = 'plan';  // Treat as plan-related
}
```

### Step 2: Check phaseUI.ts

Verify line 18 applies `.active` class correctly:

```typescript
// webview/src/ui/phaseUI.ts
step.classList.toggle('active', phaseNum === specInfo.currentPhase && phase !== 'done');
```

For plan sub-sections:
- `phaseNum` for Plan step = 2
- `specInfo.currentPhase` = 2
- Result: `.active` class is applied ✓

### Step 3: Check CSS

Verify `.step.active` styling in workflow.css:

```css
/* webview/styles/workflow.css lines 181-206 */
.step.active .step-indicator {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.4),
                0 0 20px var(--accent),
                0 0 40px rgba(59, 130, 246, 0.3);
}
```

## Files Modified

| File | Purpose |
|------|---------|
| `src/features/workflow-editor/workflow/specInfoParser.ts` | Phase detection for plan sub-sections |
| `webview/src/ui/phaseUI.ts` | CSS class application for step highlighting |
| `webview/styles/workflow.css` | Visual styling for active state |

## Testing Checklist

- [ ] Open spec.md → Spec step highlighted
- [ ] Open plan.md → Plan step highlighted
- [ ] Open research.md → Plan step highlighted
- [ ] Open data-model.md → Plan step highlighted
- [ ] Open quickstart.md → Plan step highlighted
- [ ] Open tasks.md → Tasks step highlighted
- [ ] Tabs show: Plan first, then alphabetical
- [ ] Page refresh preserves correct highlight

## Troubleshooting

### Plan step not highlighted on sub-sections

1. Check browser dev tools (Help > Toggle Developer Tools in Extension Dev Host)
2. Inspect the Plan step element
3. Verify `.active` class is present
4. If present but not visible, check CSS specificity

### Tabs not ordered correctly

1. Add console.log in `getRelatedDocs()` function
2. Verify Plan.md is added before `sortedOtherDocs`
3. Check alphabetical sorting of other docs

### Changes not reflected

1. Run `npm run compile`
2. Reload the Extension Development Host (Cmd+R or Ctrl+R)
3. Close and reopen the spec file
