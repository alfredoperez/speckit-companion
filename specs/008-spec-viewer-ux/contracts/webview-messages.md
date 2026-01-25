# Webview Message Contracts

**Feature**: 008-spec-viewer-ux
**Date**: 2026-01-25

## Overview

This feature makes minimal changes to the webview message protocol. The primary addition is passing spec status in the initial HTML generation.

---

## New: Body Data Attributes

### spec-status Attribute

**Location**: `<body>` element in webview HTML

**Format**:
```html
<body class="vscode-dark" data-spec-status="draft|in-progress|spec-completed|done">
```

**Values**:
| Value | Description | UI Effect |
|-------|-------------|-----------|
| `draft` | Default state | All editing controls visible |
| `in-progress` | Being edited | All editing controls visible |
| `spec-completed` | Spec approved | Hide: add-comment buttons, DRAFT badge, refinement CTAs |
| `done` | Fully complete | Same as spec-completed |

**Producer**: `specViewerProvider.ts` - `getWebviewContent()` method

**Consumer**: CSS selectors in `_line-actions.css`, `_content.css`, `_footer.css`

---

## Existing Messages (Unchanged)

### Webview → Extension

| Type | Payload | Notes |
|------|---------|-------|
| `switchDocument` | `{ docType: string }` | Tab navigation |
| `editDocument` | `{ docType: string }` | Open in editor |
| `editSource` | `{}` | Open source file |
| `refineLine` | `{ lineNum, comment, lineContent }` | Submit refinement |
| `editLine` | `{ lineNum, newText }` | Direct edit |
| `removeLine` | `{ lineNum }` | **No longer used** - replaced by refinement |
| `toggleCheckbox` | `{ lineNum, checked }` | Task completion |

### Extension → Webview

| Type | Payload | Notes |
|------|---------|-------|
| `contentUpdated` | `{ markdown, navState }` | Content refresh |
| `navStateUpdated` | `{ ... }` | Navigation change |
| `error` | `{ message }` | Error display |

---

## Changed Behavior

### removeLine Message

**Previous Behavior**:
- Quick action buttons sent `removeLine` message
- Extension immediately deleted the line from source

**New Behavior**:
- Quick action buttons call `addRefinement()` with removal comment
- No `removeLine` message sent
- User must submit refinements to apply changes

**Migration**: No breaking changes - the `removeLine` handler can remain for backwards compatibility or be deprecated.

---

## Type Definitions

```typescript
// src/features/spec-viewer/types.ts

export type SpecStatus = 'draft' | 'in-progress' | 'spec-completed' | 'done';

// No new message types required
```
