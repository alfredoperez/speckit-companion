# Tasks: grammar fixture

Both halves of the product parse this file, and they must agree on every line.
It is deliberately awkward: each case below is one the two parsers once
answered differently.

## Phase 1: the ordinary forms

- [x] **T001** Bold marker, checked — the companion template's shape
- [ ] **T002** Bold marker, unchecked
- [x] T003 Plain marker, checked — the stock template's shape
- [ ] T004 Plain marker, unchecked
* [x] T005 Asterisk bullet, checked
- [X] T006 Capital X counts as checked

## Phase 2: lines that are not tasks

- [P] = different files, no ordering dependency
- [x] `npm run compile` green (a verification note, carrying no task id)
- [ ] Refactor the loader (a prose checklist item, carrying no task id)
- Not a checkbox at all

## Phase 3: checkboxes inside code

```markdown
- [x] T901 Documentation showing the syntax — never a real task
- [ ] T902 Also documentation
```

Inline `- [x] T903` inside a code span is documentation too.

## Phase 4: after the fence closes

- [x] T007 Parsing resumes correctly once the fenced block ends
