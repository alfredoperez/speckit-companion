# Research: Fix Badge Status Display

## R1: How stepHistory flows into computeBadgeText

**Decision**: Widen `computeBadgeText` signature to accept `stepHistory` from the existing `featureCtx` object.

**Rationale**: `featureCtx` (type `FeatureWorkflowContext`) already contains `stepHistory` and is passed directly to `computeBadgeText` at two call sites (`specViewerProvider.ts:480,696`). No plumbing changes needed — the function just needs to read the field.

**Alternatives considered**:
- Derive completion state from file existence (e.g., `plan.md` exists → plan complete): Rejected — file existence doesn't mean the step was intentionally completed; `stepHistory.completedAt` is the authoritative signal.
- Pre-compute a `completed` boolean upstream: Rejected — adds unnecessary indirection when `computeBadgeText` can check `stepHistory` directly.

## R2: Completion vs. in-progress precedence

**Decision**: When `progress` is non-null, always show in-progress indicator even if `completedAt` is set.

**Rationale**: The `progress` field is set by SDD agents during active work. If an agent is doing post-completion work (e.g., code review after implement), the badge should reflect that activity. The `completedAt` timestamp is durable; the `progress` indicator is transient. Transient state takes priority for the badge.

**Alternatives considered**:
- Show completion when `completedAt` is set regardless of `progress`: Rejected — could show "COMPLETE" while an agent is visibly working, which contradicts the `...` convention.

## R3: Legacy specs without stepHistory

**Decision**: Fall through to existing verb-based badge logic when `stepHistory` is missing or doesn't contain the current step.

**Rationale**: FR-006 requires graceful degradation. Many older specs have no `stepHistory`. Existing behavior (showing step verb like "PLANNING") is correct for these cases — it's the default "idle step" display.

**Alternatives considered**:
- Backfill `stepHistory` on read: Rejected — over-engineering for a display-only fix. Can be done later if needed.

## R4: Badge text wording

**Decision**: Use `"<STEP> COMPLETE"` pattern (e.g., "TASKS COMPLETE", "PLAN COMPLETE").

**Rationale**: Matches the spec's acceptance scenarios (e.g., "SPECIFY COMPLETE", "PLAN COMPLETE"). Consistent with existing uppercase badge convention. Clear distinction from in-progress verbs.

**Alternatives considered**:
- Checkmark emoji (e.g., "TASKS ✓"): Rejected — badge uses text only; emojis may render inconsistently.
- Past tense (e.g., "SPECIFIED", "PLANNED"): Rejected — less clear for non-native speakers; "COMPLETE" is unambiguous.
