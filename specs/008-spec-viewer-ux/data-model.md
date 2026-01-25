# Data Model: Spec Viewer UX Polish

**Feature**: 008-spec-viewer-ux
**Date**: 2026-01-25

## Overview

This feature primarily involves CSS and minor TypeScript changes. The data model impact is minimal - mainly extending existing types to support spec status propagation.

---

## Entity: SpecStatus

**Purpose**: Represents the completion status of a spec document for conditional UI rendering.

### Type Definition

```typescript
// Add to: src/features/spec-viewer/types.ts

/**
 * Spec document status values
 * Used to control UI element visibility
 */
export type SpecStatus =
    | 'draft'           // Default - shows all editing controls
    | 'in-progress'     // Shows all editing controls
    | 'spec-completed'  // Hides add-comment buttons, DRAFT badge, refinement CTAs
    | 'plan-completed'  // Future use
    | 'done';           // Future use

/**
 * Check if a status allows editing/refinement
 */
export function isEditableStatus(status: SpecStatus): boolean {
    return status === 'draft' || status === 'in-progress';
}
```

### Status Detection Logic

Status is extracted from the spec document's front matter or metadata section:

```typescript
// Pattern to match in spec.md content
const STATUS_PATTERNS = [
    /\*\*Status\*\*:\s*(\w[\w\s-]*)/i,          // **Status**: Draft
    /Status:\s*(\w[\w\s-]*)/i,                   // Status: Draft
    /status:\s*["']?(\w[\w\s-]*)["']?/i         // status: "Draft" (YAML)
];

function extractSpecStatus(content: string): SpecStatus {
    for (const pattern of STATUS_PATTERNS) {
        const match = content.match(pattern);
        if (match) {
            const rawStatus = match[1].toLowerCase().trim();
            if (rawStatus.includes('completed') || rawStatus === 'done') {
                return 'spec-completed';
            }
            if (rawStatus.includes('progress')) {
                return 'in-progress';
            }
        }
    }
    return 'draft'; // Default
}
```

---

## Entity: LineType (Existing - No Changes)

Already defined in `types.ts`:

```typescript
export type LineType =
    | 'paragraph'
    | 'user-story'
    | 'acceptance'
    | 'task'
    | 'section';
```

No modifications needed.

---

## Entity: Refinement (Existing - No Changes)

Already defined for storing line comments:

```typescript
interface Refinement {
    id: string;           // Timestamp-based unique ID
    lineNum: number;      // Line number
    lineContent: string;  // Original content
    comment: string;      // User's comment
    lineType: LineType;   // Type of line
}
```

No modifications needed. The "Remove Line" quick action will create a refinement with a standard removal comment.

---

## CSS Custom Properties (Variables)

### New/Modified Variables

```css
/* Add to _variables.css or inline in relevant partials */

/* Typography adjustments for spec.md FR-004, FR-005 */
--h2-margin-top: 24px;      /* Was 28px */
--h2-margin-bottom: 8px;    /* Was 14px */
--h2-font-size: 18px;       /* Was ~28px (var(--text-2xl)) */

--h3-margin-top: 20px;      /* Was 24px */
--h3-margin-bottom: 6px;    /* Was 10px */
--h3-font-size: 15px;       /* Was 16px */

/* Line action positioning for spec.md FR-012 */
--line-btn-position: left;  /* Was right */
--line-btn-offset: -28px;   /* Position in left gutter */
```

### State-Based CSS Selectors

```css
/* Hide editing controls when spec is completed */
body[data-spec-status="spec-completed"] .line-add-btn,
body[data-spec-status="spec-completed"] .row-add-btn {
    display: none !important;
}

body[data-spec-status="spec-completed"] .meta-status-draft {
    display: none;
}

body[data-spec-status="spec-completed"] .actions button.enhancement,
body[data-spec-status="spec-completed"] #clarify-btn,
body[data-spec-status="spec-completed"] #refine-btn {
    display: none;
}
```

---

## HTML Structure Changes

### Acceptance Scenario List (New Format)

**Old (Table)**:
```html
<table class="scenario-table">
  <thead>...</thead>
  <tbody>
    <tr class="scenario-row" data-row="1">
      <td class="col-num">...</td>
      <td class="col-given">...</td>
      <td class="col-when">...</td>
      <td class="col-then">...</td>
    </tr>
  </tbody>
</table>
```

**New (List)**:
```html
<ol class="acceptance-scenarios">
  <li class="scenario-item line" data-line="X">
    <button class="line-add-btn" data-line="X">...</button>
    <div class="line-content">
      <strong class="keyword-given">Given</strong> condition,
      <strong class="keyword-when">When</strong> action,
      <strong class="keyword-then">Then</strong> result
    </div>
    <div class="line-comment-slot"></div>
  </li>
</ol>
```

### Body Element Status Attribute

```html
<!-- Extension injects status as data attribute -->
<body class="vscode-dark" data-spec-status="draft">
  ...
</body>
```

---

## State Transitions

### Spec Status Flow

```
┌─────────┐     user edits    ┌─────────────┐     approve     ┌────────────────┐
│  draft  │ ───────────────►  │ in-progress │ ─────────────►  │ spec-completed │
└─────────┘                   └─────────────┘                 └────────────────┘
     ▲                                                               │
     │                     re-open for edits                         │
     └───────────────────────────────────────────────────────────────┘
```

Status changes are made externally (in spec.md file) and detected on document load.

---

## Validation Rules

1. **SpecStatus**: Must be one of the defined enum values; unknown values default to 'draft'
2. **LineType**: Unchanged validation
3. **Refinement.comment**: Required non-empty string when adding via "Remove Line" action

---

## Relationships

```
SpecDocument (1) ─────────────────────────► (1) SpecStatus
     │
     │ contains
     ▼
LineItem (n) ─────────────────────────────► (0..n) Refinement
     │
     │ has type
     ▼
LineType (1)
```

---

## Migration Notes

No data migration required. All changes are additive:
- New CSS rules don't affect existing content
- SpecStatus detection gracefully defaults to 'draft'
- Existing refinements remain compatible
