# Phase 0 Research: Spec-Context Tracking

## Decision 1: Canonical status vocabulary

**Decision**: Use `draft | specifying | specified | planning | planned | tasking | ready-to-implement | implementing | completed | archived` as the closed `status` enum, exactly as proposed in spec FR-003.

**Rationale**: Maps 1:1 to existing pipeline steps with explicit "in progress" vs "done" pairs, which lets the viewer pick badge text without inspecting `stepHistory`. `archived` is terminal and overrides everything per existing constitution lifecycle.

**Alternatives considered**:
- Single token per step (`specify`, `plan`, …) with separate `phase: in-progress|done`: rejected — duplicates state and complicates the viewer's single-source rule.
- Free-form strings: rejected — breaks SC-001 schema validation.

## Decision 2: Source of truth for step progression

**Decision**: `stepHistory.<step>.startedAt`/`completedAt` is the only signal for badge/pulse/highlight. File presence is ignored.

**Rationale**: Eliminates the false-positive class (template `plan.md` → "planned"). Matches FR-001 / FR-007.

**Alternatives**: Hybrid (file + history) — rejected; the bug we're fixing is precisely the hybrid heuristic.

## Decision 3: Backfill for terminal-only SpecKit runs

**Decision**: On viewer open, if `.spec-context.json` is missing, write a minimal `{ workflow: "speckit-terminal", specName, branch, status: "draft", currentStep: "specify", stepHistory: {}, transitions: [] }`. Never set any step `completedAt` from disk inspection.

**Rationale**: Satisfies FR-011. Keeps the "no inference from files" invariant. Viewer immediately becomes consistent without forcing the user to rerun.

**Alternatives**: Auto-mark `specify` complete when `spec.md` exists with non-template content — rejected; brittle template detection.

## Decision 4: Append-only transitions

**Decision**: `transitions: Array<{ step, substep|null, from: { step, substep|null }, by: "extension"|"user"|"cli", at: ISO8601 }>`. Writers always append; never mutate prior entries. Regenerate appends a new entry rather than rewriting.

**Rationale**: Matches FR-005, FR-012. Gives an audit log usable for future analytics without complicating the read path.

## Decision 5: Concurrent write safety

**Decision**: Writes go through a single `SpecContextWriter` that does read-modify-write with a temp-file + rename atomic swap. Unknown top-level fields are preserved (FR-013).

**Rationale**: Multiple writers (extension, prompt-driven CLI agent) may touch the file in quick succession. Atomic rename avoids partial JSON.

**Alternatives**: File lock — overkill for low-concurrency workspace files; rename is sufficient on POSIX and Windows (with replace).

## Decision 6: Prompt standardization

**Decision**: Add a shared "Spec Context Update" block at the top and bottom of every Companion skill prompt (`speckit-*` and `sdd*`). The block instructs the agent to (a) read `.spec-context.json`, (b) write `stepHistory.<step>.startedAt` + append a transition before work, and (c) write `completedAt`, advance `currentStep`/`status`, and append the closing transition after work. Substeps follow the same pattern when defined.

**Rationale**: Satisfies FR-006 and Story 7. Keeps the schema enforcement out of CLI internals (which we don't control) and into the prompt layer that we do.

**Alternatives**: Have the extension watch CLI exit and write context — rejected; doesn't work for terminal-only runs and races with prompt-driven writes.

## Decision 7: Footer button scope metadata

**Decision**: Each footer action declares `{ id, label, scope: "spec"|"step", visibleWhen: (ctx, step) => boolean, tooltip }`. Tooltip text is derived from `label` + scope ("Affects whole spec" / "Affects this step").

**Rationale**: Satisfies FR-009/FR-010 and Story 6. Centralizes visibility rules in `footerActions.ts` so the renderer stays dumb.
