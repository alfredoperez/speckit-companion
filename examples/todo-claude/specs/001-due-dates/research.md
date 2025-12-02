# Research: Due Dates Feature

**Feature**: 001-due-dates | **Date**: 2025-12-02

## Unknowns to Resolve

### 1. Testing Framework Setup

**Question**: What testing framework should be used for TDD compliance?

**Decision**: Vitest with React Testing Library

**Rationale**:
- Vitest is the recommended test runner for Vite projects (same ecosystem)
- Native ES modules support, fast execution, Vite-compatible configuration
- React Testing Library follows component testing best practices (user-centric)
- Jest-compatible API minimizes learning curve

**Alternatives Considered**:
| Option | Pros | Cons | Rejected Because |
|--------|------|------|------------------|
| Jest | Industry standard, mature | Requires additional Vite integration, slower | Extra config complexity |
| Vitest + Enzyme | N/A | Enzyme deprecated for React 18 | Not maintained |
| Cypress Component | Great for E2E | Heavier setup, overkill for unit tests | Over-engineering |

**Implementation**:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Add to `package.json`:
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

Add `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
```

---

### 2. Date Picker Implementation

**Question**: Should we use a date picker library or native HTML input?

**Decision**: Native HTML `<input type="date">`

**Rationale**:
- Constitution Principle IV (YAGNI): No external dependencies for basic date selection
- Native date input has excellent browser support in target browsers
- Smaller bundle size, no additional library to maintain
- Accessibility built-in (keyboard navigation, screen reader support)

**Alternatives Considered**:
| Option | Pros | Cons | Rejected Because |
|--------|------|------|------------------|
| react-datepicker | Feature-rich, customizable | 50KB+ bundle, external dependency | Over-engineering |
| @mui/x-date-pickers | Material design integration | Heavy dependency, overkill | Not using MUI |
| Native `<input type="date">` | Zero dependencies, accessible | Limited styling | ✅ Selected - sufficient for requirements |

**Browser Support**: All target browsers (Chrome, Firefox, Safari, Edge latest 2 versions) fully support `<input type="date">`.

---

### 3. Date Storage Format

**Question**: How should dates be serialized for localStorage persistence?

**Decision**: ISO 8601 string format (`YYYY-MM-DD`)

**Rationale**:
- Standard format, unambiguous across timezones
- Spec requires date-only comparison (no time component)
- Native `Date` constructor parses ISO strings correctly
- JSON serialization/deserialization is straightforward

**Implementation Pattern**:
```typescript
// Serialize for storage
const serialize = (date: Date): string => date.toISOString().split('T')[0]

// Deserialize from storage
const deserialize = (str: string): Date => new Date(str + 'T00:00:00')
```

---

### 4. Overdue Calculation

**Question**: How to reliably determine if a todo is overdue?

**Decision**: Compare date strings at midnight local time

**Rationale**:
- Spec edge case: "11:59 PM should NOT be overdue until following day"
- Date-only comparison avoids timezone complexities
- Comparing ISO date strings (YYYY-MM-DD) is lexicographically correct

**Implementation Pattern**:
```typescript
const isOverdue = (dueDate: Date, completed: boolean): boolean => {
  if (completed) return false
  const today = new Date().toISOString().split('T')[0]
  const due = dueDate.toISOString().split('T')[0]
  return due < today
}
```

---

### 5. Human-Readable Date Format

**Question**: What format should due dates display in?

**Decision**: `Intl.DateTimeFormat` with locale-aware formatting

**Rationale**:
- Spec requirement: "human-readable format (e.g., Dec 15, 2025)"
- `Intl.DateTimeFormat` provides localization automatically
- No external date library needed (YAGNI)

**Implementation Pattern**:
```typescript
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
}
// Output: "Dec 15, 2025"
```

---

### 6. Sort State Management

**Question**: Where should sort state live and how should sorting work?

**Decision**: Sort state in App.tsx, derived sorted array via useMemo

**Rationale**:
- App.tsx already manages todo state (consistent pattern)
- `useMemo` prevents re-sorting on every render
- Single source of truth for sort preference

**Implementation Pattern**:
```typescript
const [sortByDueDate, setSortByDueDate] = useState(false)

const displayedTodos = useMemo(() => {
  if (!sortByDueDate) return todos
  return [...todos].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate.getTime() - b.dueDate.getTime()
  })
}, [todos, sortByDueDate])
```

---

## Summary

All unknowns resolved. Key decisions:
1. **Testing**: Vitest + React Testing Library (TDD requirement satisfied)
2. **Date Picker**: Native HTML input (YAGNI compliance)
3. **Storage**: ISO 8601 date strings in localStorage
4. **Overdue Logic**: Date-string comparison, excludes completed items
5. **Display Format**: Intl.DateTimeFormat for locale-aware formatting
6. **Sorting**: App-level state with useMemo optimization
