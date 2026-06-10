# Centralize the step-level vs per-task entry discriminator

## Overview

Every reader of a spec's `.spec-context.json` history must distinguish a step-level boundary entry from a per-task implement finish, but that rule (`substep == null && task == null`) is currently re-derived inline in ~6 places and the `lastEntryIsCompletionFor` helper is duplicated across two files. This delivers a single shared predicate so the same off-by-one bug class (steps reading as in-flight forever, or a per-task finish mislabeled as a step completion) cannot silently reappear and a future history-shape change touches one function instead of N.

## Functional Requirements

- **FR-001** The system MUST expose a single shared predicate that answers "is this history entry a step-level boundary?" defined as `substep == null && task == null`.
- **FR-002** The system MUST expose a single shared predicate that answers "is this history entry a per-task entry?" defined as `task != null`.
- **FR-003** Every history reader and derivation that currently inlines a step-level or per-task check MUST route through the shared predicates instead of an inline `substep`/`task` comparison. This covers, at minimum: step-history derivation (completion detection and row/label logic), the last-transition entry label, the spec-context reader normalization, and the spec-context manager's start/completion checks.
- **FR-004** The `lastEntryIsCompletionFor` helper, currently duplicated in two files, MUST collapse to a single implementation that all callers import.
- **FR-005** The structural history-entry type used by readers MUST model the `task` field; the duplicate `HistoryEntryLike` shape that omits `task` MUST be reconciled to the canonical `HistoryEntry` (or a shared minimal shape that includes `task`).
- **FR-006** The refactor MUST NOT change any observable behavior: the same entries are classified the same way before and after, including the regression cases where a backstop per-task finish lands after the step-level completion and where a per-task finish must not be labeled as "Implement completed".
- **FR-007** The existing golden-history reader contract test and the full test suite MUST pass unchanged (no test assertions weakened or removed to accommodate the refactor).
- **FR-008** The Python capture scripts (`write-context.py`, `check_capture.py`) SHOULD adopt an equivalent shared step-level/per-task helper where it removes duplication; if a shared Python helper does not cleanly fit, their inline checks MUST at least be made consistent with the canonical rule.
- **FR-009** A reader added later for a new entry shape MUST be able to rely on the shared predicate without re-deriving the step-level vs per-task rule.

## Success Criteria

- **SC-001** Exactly one definition each of the step-level predicate and the per-task predicate exists in the codebase; a search for inline `substep == null` / `substep === null` discriminators across the reader call-sites returns zero (only the shared predicate retains the comparison).
- **SC-002** `lastEntryIsCompletionFor` is defined exactly once (down from two copies).
- **SC-003** The full test suite, including the golden-history reader contract test, passes with no behavior change.
- **SC-004** Changing the history-shape rule in the future requires editing a single function, not multiple call-sites.

## Assumptions

- The shared predicates live alongside the existing history helpers (`historyHelpers.ts`) or in a small dedicated module; no new public extension API is introduced.
- The canonical `HistoryEntry` type (with optional `task`) is the source of truth; `HistoryEntryLike` is folded into it or a shared minimal shape that includes `task`.
- The Python adoption (FR-008) is best-effort: TypeScript consolidation is the primary deliverable, and the two languages are not required to share code, only the same rule.
- This is a pure internal refactor with no user-facing behavior, settings, or documentation surface change beyond the architecture doc if module boundaries shift.
