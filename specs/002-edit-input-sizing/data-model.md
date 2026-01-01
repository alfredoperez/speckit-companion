# Data Model: Edit Input Auto-Sizing with Original Value Display

**Feature**: 002-edit-input-sizing
**Date**: 2025-12-30
**Status**: Complete

## Overview

This feature is a UI-only enhancement with no persistent data storage. The data model describes the runtime state and component interfaces.

## Entities

### EditableField (Conceptual - from spec)

Represents a text field that can be edited within the workflow editor.

| Property | Type | Description |
|----------|------|-------------|
| `currentValue` | `string` | The current content being edited |
| `originalValue` | `string` | The value before editing began |
| `isEditing` | `boolean` | Whether the field is in edit mode |
| `inputSize` | `{ width: number }` | Calculated input dimensions |

**Note**: This entity is conceptual. In implementation, these properties are managed as local component state within the popover lifecycle.

---

### EditSession (Conceptual - from spec)

Represents an active editing session.

| Property | Type | Description |
|----------|------|-------------|
| `originalValue` | `string` | Snapshot of value when edit started |
| `currentInput` | `string` | Live input value as user types |
| `startTime` | `number` | Timestamp when edit began (for analytics if needed) |

**Note**: This entity is conceptual. In practice, `originalValue` is captured when the popover opens and `currentInput` is the live `<input>` value.

---

## Component Interfaces

### RefinePopover State (Runtime)

```typescript
interface RefinePopoverState {
  /** The line number being refined */
  lineNum: number;

  /** Original line content (displayed as reference) */
  originalContent: string;

  /** Current input value */
  instructionText: string;

  /** Whether popover is visible */
  isVisible: boolean;
}
```

### Popover Props (Function Parameters)

```typescript
interface ShowRefineInputParams {
  /** Line number in the document */
  lineNum: string;

  /** Original content of the line (for display) */
  lineContent: string;

  /** Button element that triggered the popover */
  buttonEl: HTMLElement;

  /** VS Code API for messaging */
  vscode: VSCodeApi;
}
```

---

## State Transitions

### Edit Session Lifecycle

```
[Idle] ---(click refine)--> [Edit Active]
                                 |
                                 |---(Enter/Submit)--> [Submitted] --> [Idle]
                                 |
                                 |---(Escape/Cancel)--> [Cancelled] --> [Idle]
                                 |
                                 |---(Outside click)--> [Cancelled] --> [Idle]
```

### State Details

| State | Description | UI |
|-------|-------------|-----|
| Idle | No active edit session | Normal line display |
| Edit Active | Popover visible, input focused | Popover with original value + auto-sizing input |
| Submitted | User confirmed changes | Message sent to extension, popover closes |
| Cancelled | User discarded changes | Popover closes, no message sent |

---

## Validation Rules

### Input Validation

| Rule | Constraint | Error Handling |
|------|-----------|----------------|
| Non-empty instruction | `instruction.trim().length > 0` | Submit button disabled or no-op |
| Max length | Reasonable limit (500 chars suggested) | Truncate or warn |

### Sizing Validation

| Rule | Constraint | Handling |
|------|-----------|----------|
| Minimum width | `>= 100px` | CSS `min-width` |
| Maximum width | `<= container width` | CSS `max-width: 100%` |

---

## CSS Properties (Design Tokens)

These are the CSS custom properties used by the component:

```css
/* Existing tokens (no changes) */
--bg-primary: #0a0a0a;
--bg-elevated: #1a1a1a;
--text-primary: #fafafa;
--text-muted: #666666;
--border: #262626;
--accent: #3b82f6;

/* New tokens for original value display */
--original-value-color: var(--text-muted);
--original-value-font-size: 12px;
--original-value-font-style: italic;
```

---

## Message Protocol (Unchanged)

The existing message protocol is sufficient. No new message types required.

```typescript
// Existing message type (no changes)
interface RefineLineMessage {
  type: 'refineLine';
  lineNum: number;
  content: string;      // Original line content
  instruction: string;  // User's refinement instruction
}
```

---

## Data Flow

```
User Action                Component                    Extension
    |                          |                            |
    |---(click refine)-------->|                            |
    |                          |                            |
    |                    [Capture originalContent]          |
    |                    [Show popover]                     |
    |                    [Display original value]           |
    |                    [Focus auto-sizing input]          |
    |                          |                            |
    |---(type instruction)---->|                            |
    |                    [Auto-resize input]                |
    |                          |                            |
    |---(submit)-------------->|                            |
    |                          |---(postMessage)----------->|
    |                          |                     [Process refinement]
    |                          |                            |
```

---

## Summary

This is a purely frontend/UI feature with:
- **No database or file storage changes**
- **No new message types**
- **No backend logic changes**
- **State managed within component lifecycle**
- **CSS-based sizing with optional JS fallback**
