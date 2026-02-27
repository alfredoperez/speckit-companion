# Tasks: {Feature Name}

**Plan**: [plan.md](./plan.md) | **Date**: {TODAY}

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [ ] **T001** {title} — `path/to/file`
  - **Do**: [Exact action — file path + what to write or change]
  - **Verify**: build passes / type checks

- [ ] **T002** {title} *(depends on T001)* — `path/to/file`
  - **Do**: [...]
  - **Verify**: [...]

- [ ] **T003** {title} *(depends on T002)* — `path/to/file`
  - **Do**: [...]
  - **Verify**: [...]

- [ ] **T004** Wire up / register *(depends on T003)* — `path/to/file`
  - **Do**: [...]
  - **Verify**: `nx build ngx-dev-toolbar` passes

---

## Phase 2: Quality (Parallel — launch agents in single message)

<!-- Always include T005 in normal mode. Only include T006 if plan.md flagged docs/README work. -->
<!-- Omit Phase 2 entirely for minimal mode. -->

- [ ] **T005** [P][A] Unit tests — `test-expert`
  - **Files**: `path/to/file.spec.ts`
  - **Pattern**: Jest, AAA, Angular TestBed, signals (computed/effect)
  - **Reference**: `path/to/existing.spec.ts`

- [ ] **T006** [P][A] Docs update — `docs-expert`
  - **Files**: `README.md`, `apps/docs/src/content/docs/[page].md`
  - **Scope**: [from Auxiliary Work section in plan.md]

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001–T004 | [ ] |
| Phase 2 | T005–T006 | [ ] |
