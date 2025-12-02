# Implementation Plan: Due Dates for Todo Items

**Branch**: `001-due-dates` | **Date**: 2025-12-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-due-dates/spec.md`

## Summary

Add optional due dates to todo items with a date picker on the creation form, display due dates next to each todo, visual highlighting (red) for overdue incomplete items, and a sort-by-due-date button. Implementation will extend the existing Todo interface and modify AddTodo, TodoItem, and TodoList components while adding persistence via localStorage.

## Technical Context

**Language/Version**: TypeScript 5.3.0 with strict mode enabled
**Primary Dependencies**: React 18.2.0, Vite 5.0.0
**Storage**: localStorage (for persistence across page refreshes - FR-011)
**Testing**: NEEDS CLARIFICATION (no test framework currently installed)
**Target Platform**: Modern browsers (Chrome, Firefox, Safari, Edge - latest 2 versions)
**Project Type**: Single React application
**Performance Goals**: FCP < 1.5s, TTI < 3s, Bundle < 200KB gzipped (per constitution)
**Constraints**: No external date picker library (prefer native HTML date input for simplicity - YAGNI principle)
**Scale/Scope**: Small todo app, < 100 todos expected

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status |
|-----------|-------------|--------|
| I. Type Safety First | Explicit types for dueDate, props, functions | ✅ PASS - Will add `dueDate?: Date` to Todo interface |
| II. Component-First | Single responsibility, testable components | ✅ PASS - Due date display in TodoItem, picker in AddTodo |
| III. Test-First (TDD) | Tests before implementation | ⚠️ NEEDS CLARIFICATION - No test framework installed |
| IV. Simplicity (YAGNI) | Minimum viable solution | ✅ PASS - Native date input, no external libraries |
| V. Code Quality | Linting, formatting, small functions | ✅ PASS - Will follow existing patterns |

**Gate Result**: CONDITIONAL PASS - TDD principle requires test framework setup before implementation.

## Project Structure

### Documentation (this feature)

```text
specs/001-due-dates/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no API)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── types.ts             # Todo interface (add dueDate field)
├── App.tsx              # State management (add sort, persistence)
├── utils/               # NEW: date utilities
│   └── dateUtils.ts     # isOverdue, formatDate, sortByDueDate
└── components/
    ├── AddTodo.tsx      # Add date picker input
    ├── TodoItem.tsx     # Display due date, overdue styling
    └── TodoList.tsx     # Add sort button, pass sort handler
```

**Structure Decision**: Single React application structure. Adding `src/utils/` directory for date-related pure functions to keep components focused and enable isolated unit testing.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

No constitution violations. Feature is straightforward with no over-engineering needed.
