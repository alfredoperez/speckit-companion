# Quickstart: Edit Input Auto-Sizing with Original Value Display

**Feature**: 002-edit-input-sizing
**Date**: 2025-12-30

## Overview

This feature enhances the refine popover in the workflow editor webview by:
1. Adding auto-sizing to the text input (grows/shrinks with content)
2. Displaying the original line content as a reference during editing

## Prerequisites

- Node.js and npm installed
- VS Code with extension development support
- Repository cloned and dependencies installed (`npm install`)

## Quick Implementation Guide

### Step 1: Update CSS for Auto-Sizing Input

Edit `webview/styles/workflow.css` and update the `.refine-input` class:

```css
.refine-input {
    width: 100%;
    min-width: 200px;
    padding: 10px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
    transition: border-color var(--transition-fast);
    /* Auto-sizing: use field-sizing if available */
    field-sizing: content;
}
```

### Step 2: Add Original Value Display Styles

Add new styles for the original value reference:

```css
.original-value-reference {
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
    margin-bottom: 8px;
    padding: 6px 8px;
    background: var(--bg-secondary);
    border-radius: var(--radius-sm);
    border-left: 2px solid var(--accent);
    word-break: break-word;
    max-height: 60px;
    overflow-y: auto;
}

.original-value-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    margin-bottom: 4px;
    font-style: normal;
}
```

### Step 3: Update Popover HTML Template

Edit `webview/src/ui/refinePopover.ts` and update the popover HTML:

```typescript
const popover = document.createElement('div');
popover.className = 'refine-popover';
popover.innerHTML = `
    <div class="refine-popover-header">What should be refined?</div>
    <div class="original-value-reference" aria-label="Original content">
        <div class="original-value-label">Original</div>
        ${escapeHtml(lineContent)}
    </div>
    <input
        type="text"
        class="refine-input"
        placeholder="e.g., Make more specific..."
        aria-describedby="original-ref"
    >
    <div class="refine-popover-actions">
        <button class="refine-cancel">Cancel</button>
        <button class="refine-submit">Refine</button>
    </div>
`;
```

### Step 4: Add HTML Escaping Utility

Add a helper function to escape HTML in `refinePopover.ts`:

```typescript
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

## Testing

### Manual Testing

1. Run `npm run watch` to compile in watch mode
2. Press F5 in VS Code to launch Extension Development Host
3. Open a spec file in the workflow editor
4. Hover over a line and click the refine (pencil) button
5. Verify:
   - Original value appears above the input
   - Input auto-sizes as you type
   - Styling is visually distinct

### Test Scenarios

| Scenario | Expected Result |
|----------|-----------------|
| Open refine popover | Original value displayed above input |
| Type long text | Input expands horizontally |
| Delete text | Input shrinks to fit content |
| Very long original | Original value scrolls within container |
| Empty original | No original value section shown |

## Build & Package

```bash
# Compile once
npm run compile

# Package extension
npm run package
```

## File Changes Summary

| File | Changes |
|------|---------|
| `webview/styles/workflow.css` | Add `field-sizing`, original value styles |
| `webview/src/ui/refinePopover.ts` | Update HTML template, add escapeHtml |

## Rollback

If issues arise, revert changes to the two files listed above. No database migrations or configuration changes are involved.
