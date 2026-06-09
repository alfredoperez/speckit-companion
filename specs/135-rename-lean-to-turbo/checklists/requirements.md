# Specification Quality Checklist: Rename the "lean" template profile to "turbo"

**Purpose**: Validate turbo specification completeness before planning
**Created**: 2026-06-09
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user/business value and the change's intent
- [x] Overview states what is delivered and why in 1–3 sentences
- [x] All four sections present (Overview, Functional Requirements, Success Criteria, Assumptions)

## Requirement Completeness

- [x] Any [NEEDS CLARIFICATION] markers are genuine ambiguities (≤3) deferred to clarify — not unresolved guesses (none needed; the source issue resolves every choice)
- [x] Each Functional Requirement is a single, testable MUST/SHOULD statement
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] Edge cases are folded into Functional Requirements or Assumptions (historical references → FR-006 + Assumptions; no-alias hard cut → FR-007/SC-004; unchanged command names → FR-008)
- [x] Scope is clearly bounded (rename only; standard/off untouched; history exempt; local preset copies out of scope)
- [x] Dependencies and assumptions identified (sequencing after #225 confirmed satisfied; pre-release status justifies no migration)

## Feature Readiness

- [x] Every Functional Requirement maps to at least one Success Criterion (FR-001/004/006 → SC-001; FR-002 → SC-002; FR-003 → SC-003; FR-007 → SC-004; FR-005 → SC-005; FR-008 → SC-001)
- [x] Overview intent is reflected by the FR list (no orphan goals)
- [x] No implementation details leak into the specification

## Notes

- Items marked incomplete require spec updates before clarify or plan
- Self-check pass complete: SC-005 was reworded during the pass to remove an implementation-level reference to type definitions; all items now pass with no [NEEDS CLARIFICATION] markers.
