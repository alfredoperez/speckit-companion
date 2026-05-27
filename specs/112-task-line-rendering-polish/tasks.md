# Tasks: Task-Line Rendering Polish

**Input**: Design documents from `specs/112-task-line-rendering-polish/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, quickstart.md ✅

**Tech stack**: TypeScript 5.3+ (webview), CSS3, Preact, Storybook 7  
**Source structure**: `webview/styles/spec-viewer/` (CSS), `webview/src/spec-viewer/components/` (stories)

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[US1]**: Stable task-row layout on hover
- **[US2]**: No trailing break after wrapping task descriptions
- **[US3]**: Storybook coverage for task-row states

---

## Phase 1: Setup

**Purpose**: Confirm the dev environment compiles and Storybook is available before any edits.

- [X] T001 Verify `npm run compile` and `npm run storybook` complete without errors (no file changes)

**Checkpoint**: Environment green → proceed to user stories.

---

## Phase 3: User Story 1 — Stable Task-Row Layout on Hover (Priority: P1) 🎯 MVP

**Goal**: Zero layout shift when the `+` inline-comment trigger appears/disappears on hover.

**Independent Test**: Press F5 (Extension Development Host), open any spec with tasks, hover a task row — text and row height must not change before and after the `+` button appears.

**Root cause (research.md)**: The `:hover` shorthand `padding: var(--space-1) var(--space-2)` overwrites the idle `padding-right: 24px` (reserved for the absolutely-positioned `+` button) with `var(--space-2)` (8 px). The 16 px reduction narrows the flex text column, reflowing wrapped text.

### Implementation for User Story 1

- [X] T002 [US1] In `webview/styles/spec-viewer/_tasks.css`, add `padding-right: 24px;` immediately after the `padding: var(--space-1) var(--space-2);` line inside the `li.task-item:hover` rule — this re-asserts the button-slot reservation that the shorthand clobbers
- [X] T003 [US1] Manual verify in Extension Development Host: open a spec with multi-line wrapping tasks, hover each task row, confirm the task text bounding box does not shift horizontally or vertically and the row height is identical in idle and hover states

**Checkpoint**: US1 complete — task rows hover-stable ✅

---

## Phase 4: User Story 2 — No Trailing Line Break After Wrapping Tasks (Priority: P1)

**Goal**: The vertical gap below a wrapping task row is indistinguishable from the gap below a single-line task row.

**Independent Test**: Open a spec with at least one long task description (e.g. multiple `code` spans). Compare the bottom gap of the wrapping task to a single-line task — must be identical.

**Root cause (research.md)**: `li.task-item` is `display: flex; flex-wrap: wrap`. The always-present `<div class="line-comment-slot"></div>` carries `flex-basis: 100%`, forcing it onto its own full-width flex row. On single-line tasks this phantom row has zero visual height; on wrapping tasks the container is taller and the empty row produces a visible trailing gap.

### Implementation for User Story 2

- [X] T004 [US2] In `webview/styles/spec-viewer/_tasks.css`, add the following rule immediately after the existing `li.task-item .line-comment-slot` rule block:
  ```css
  #markdown-content li.task-item .line-comment-slot:empty {
    display: none;
  }
  ```
  The `:empty` selector matches the slot only when it has no child nodes (the renderer always emits it as `<div class="line-comment-slot"></div>` with no whitespace), so the slot collapses only when empty and correctly displays when a comment child is appended.
- [X] T005 [US2] Manual verify in Extension Development Host: open a spec with wrapping task descriptions (`specs/_02_demo-tasked/tasks.md` works), confirm the gap below a wrapping task is visually identical to the gap below a single-line task and to an uncommented paragraph row

**Checkpoint**: US2 complete — wrapping-task trailing gap eliminated ✅

---

## Phase 5: User Story 3 — Storybook Coverage for Task-Row States (Priority: P2)

**Goal**: Five Storybook stories covering idle/hover × single-line/wrapping + paragraph baseline that catch future CSS regressions.

**Independent Test**: Run `npm run storybook`, open the `Viewer/TaskLine` story group — all stories render without trailing gaps or content shift.

**Pattern**: Follow `webview/src/spec-viewer/components/InlineComment.stories.tsx` exactly — `DocumentContextDecorator` injects CSS variable overrides, stories render raw JSX with the same class names and structure the renderer emits.

### Implementation for User Story 3

- [X] T006 [US3] Create `webview/src/spec-viewer/components/TaskLine.stories.tsx`:
  - Copy `DocumentContextDecorator` from `InlineComment.stories.tsx` (includes all CSS variable overrides)
  - Add `TaskLineSingleLineIdle` — `li.task-item.line` with a short task description, no comment slot child
  - Add `TaskLineSingleLineHover` — same element with an inline `style={{ background: 'var(--bg-hover)', marginLeft: 'calc(-1 * var(--space-2))', marginRight: 'calc(-1 * var(--space-2))', paddingLeft: 'var(--space-2)', paddingRight: '24px', borderRadius: 'var(--radius-sm)' }}` to simulate the hover state statically
  - Add `TaskLineWrappingIdle` — `li.task-item.line` with a long description containing multiple `` `code` `` spans that forces wrapping at normal story width (400 px container), no comment slot child
  - Add `TaskLineWrappingHover` — same wrapping content as above, same hover style as `TaskLineSingleLineHover`
  - Add `ParagraphLineBaseline` — a `div.line` containing a `div.line-content > p` paragraph of similar length, for gap comparison
- [X] T007 [US3] Run `npm run storybook`, open `Viewer/TaskLine`, visually verify: (a) idle stories show no trailing gap, (b) hover stories show the hover background with no content shift relative to the idle state, (c) paragraph baseline gap matches the task-row gap

**Checkpoint**: US3 complete — Storybook stories cover all required states ✅

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Regression guard and build sign-off.

- [X] T008 [P] Spec 110 regression check: open a spec that has inline comments on task lines in the Extension Development Host; verify commented and uncommented task lines still render at identical heights (height-parity from spec 110 must not be broken)
- [X] T009 [P] Run `npm run compile` from repo root; confirm zero TypeScript errors introduced by `TaskLine.stories.tsx`

---

## Dependencies

```
T001
├── T002 → T003
├── T004 → T005
└── T006 (after T003 + T005 so stories demonstrate the fixed behavior)
    └── T007
        ├── T008
        └── T009
```

T002 and T004 both edit `webview/styles/spec-viewer/_tasks.css` but target distinct, non-overlapping rule blocks — they can be applied in the same edit pass.  
T008 and T009 are independent of each other and can run in parallel.

## Parallel Execution Examples

**Within US1+US2** (same-file edits — apply in one pass):
```
Edit _tasks.css:
  1. T002: add padding-right to :hover rule
  2. T004: add :empty rule after .line-comment-slot block
```

**Final phase** (truly parallel):
```
T008: regression-check in Extension Development Host
T009: npm run compile
```

## Implementation Strategy

**MVP scope (US1 + US2 only)**: T001 → T002 → T004 → T003 → T005 → T008 → T009  
The two CSS fixes are self-contained and deliver the core visual quality promise. US3 (Storybook) can follow as a separate PR if preferred, but is included in this spec to prevent future regressions.

**Recommended order**: Apply both CSS edits in a single `_tasks.css` pass (T002 + T004), reload the extension, manually verify both fixes together (T003 + T005), then add Storybook stories (T006 + T007), then run the regression and compile checks (T008 + T009).
