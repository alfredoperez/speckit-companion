---
description: "SDD — Spec-Driven Development: generate a lean phased task list."
handoffs:
  - label: Implement
    agent: sdd.implement
    prompt: Implement the tasks
    send: true
---

## Steps

### 1. Load Context

If `$ARGUMENTS` is provided, use `specs/{$ARGUMENTS}/` as the target directory.
Otherwise, find the most recently modified directory under `specs/` that contains both `spec.md` and `plan.md`.

Read in parallel:
- `specs/{NNN}-{slug}/spec.md` — feature name, requirements, scenarios
- `specs/{NNN}-{slug}/plan.md` — approach, files to create/modify
- `specs/{NNN}-{slug}/state.json` — current step/task (if exists)

If no spec/plan found, stop: "Run `/sdd.specify` and `/sdd.plan` first."

Update `specs/{NNN}-{slug}/state.json`:

```json
{ "step": "tasks", "task": null, "updated": "{TODAY}" }
```

---

### 2. Write `specs/{NNN}-{slug}/tasks.md`

```markdown
# Tasks: {Feature Name}

**Plan**: [plan.md](./plan.md) | **Date**: {TODAY}

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [ ] **T001** {title} — `path/to/file`
  - **Do**: [Exact action — file path + what to write or change]
  - **Verify**: [build passes / UI shows X / type checks]

- [ ] **T002** {title} *(depends on T001)* — `path/to/file`
  - **Do**: [...]
  - **Verify**: [...]

- [ ] **T003** {title} *(depends on T002)* — `path/to/file`
  - **Do**: [...]
  - **Verify**: [...]

---

## Phase 2: Quality (Parallel — launch agents in single message)

- [ ] **T004** [P][A] Unit tests — `test-expert`
  - **Files**: `path/to/file.spec.ts`
  - **Pattern**: [test framework and patterns used in this project]
  - **Reference**: `path/to/existing.spec.ts`

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001–T00N | [ ] |
| Phase 2 | T004 | [ ] |
```

**Phase rules:**
- Phase 1: all core implementation tasks in dependency order (T001, T002, ...) — always sequential
- Phase 2: always include unit tests; only include a docs task if plan.md explicitly flagged docs work
- Omit Phase 2 entirely for trivial single-file changes
- Use `[P][A]` markers only in Phase 2

**Skip**: dependency graphs, user story labels ([US1] etc.), parallel execution analysis, formal validation steps.

---

### 3. Summary

Display exactly this format:

```
--- Tasks complete ---
Feature: {Feature Name}
Tasks:   specs/{NNN}-{slug}/tasks.md  —  {N} tasks ({N} sequential, {N} parallel)

Next: /sdd.implement {NNN}-{slug}
```
