# Feature Specification: Complexity Fast-Path

**Feature Branch**: `137-complexity-fast-path`  
**Created**: 2026-06-09  
**Status**: Draft  
**Input**: User description: "Auto-detect small changes and right-size the ceremony. A classify step plus a minimal-mode branch in the pipeline commands; small changes fast-track from specify straight to implement in one shot, big changes get the full pipeline. Threshold mirrors tinyspec (5 files / 10 tasks). Config knob to opt out."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Small change fast-tracks to implementation (Priority: P1)

A developer starts a spec for a trivial change (a typo fix, a rename, a one-line tweak). Instead of being walked through separate specify, plan, and tasks stages, the pipeline recognizes the change is small and produces a single combined artifact, landing the developer directly at the implementation step in one shot.

**Why this priority**: This is the core value of the feature — the headline promise that small changes stop paying the same ceremony cost as large ones. Without it, nothing else in this feature matters. It is the MVP slice.

**Independent Test**: Start a spec whose description is clearly a one-line change ("rename `foo` to `bar`"). Confirm the run emerges at the implement step with a single combined spec/plan/tasks artifact and no separate plan or tasks stages were generated.

**Acceptance Scenarios**:

1. **Given** a feature description for a one-line change, **When** the developer runs the specify command, **Then** the change is classified as simple and the pipeline emits one combined artifact and advances straight to implement.
2. **Given** a simple change was fast-tracked, **When** the developer views the spec's progress, **Then** the recorded lifecycle reflects that plan and tasks were folded into the fast-path rather than skipped or left incomplete.

---

### User Story 2 - Large change keeps the full pipeline (Priority: P1)

A developer starts a spec for a substantial change (a new authentication system, a multi-file refactor). The pipeline recognizes the change is large and runs the full sequence — specify, then plan, then tasks, then implement — exactly as it does today, so nothing is lost for work that genuinely needs the ceremony.

**Why this priority**: Right-sizing only works if it is safe in both directions. Fast-tracking a large change would strip the planning a complex feature needs. This guardrail is as essential as the fast-path itself.

**Independent Test**: Start a spec for a clearly large feature ("add OAuth login with token refresh and session storage"). Confirm the run is classified as normal and proceeds through distinct plan and tasks stages before implement.

**Acceptance Scenarios**:

1. **Given** a feature description for a large, multi-file feature, **When** the developer runs the specify command, **Then** the change is classified as normal and the full specify → plan → tasks → implement pipeline runs.
2. **Given** a change sits near the boundary (more files or tasks than the small-change threshold), **When** it is classified, **Then** it is treated as normal and the developer is warned that it exceeded the small-change guardrail rather than being silently fast-tracked.

---

### User Story 3 - Developer can force the full pipeline (Priority: P2)

A developer who wants every change to go through the full ceremony — regardless of size — turns the fast-path off via a configuration setting. From then on, even trivial changes run the complete specify → plan → tasks → implement sequence.

**Why this priority**: Teams differ on how much ceremony they want. Auto-detection is the right default, but it must be overridable. This is important for adoption but not required for the core behavior to ship.

**Independent Test**: Disable the complexity feature in configuration, start a spec for a one-line change, and confirm it runs the full pipeline instead of fast-tracking.

**Acceptance Scenarios**:

1. **Given** the complexity fast-path is disabled in configuration, **When** the developer runs the specify command on a trivial change, **Then** the full pipeline runs and no fast-path combining occurs.
2. **Given** no configuration override is present, **When** the developer runs any spec, **Then** the fast-path is active by default (opt-out, not opt-in).

---

### Edge Cases

- **Ambiguous size**: When a description gives no strong signal of size (neither obviously trivial nor obviously large), the classifier defaults to the safer choice — treat it as normal and run the full pipeline rather than risk under-planning.
- **Conflicting signals**: A short description that nonetheless names many files, or uses a "rewrite"/"overhaul" scope phrase, is treated as normal even if it would otherwise look small.
- **Boundary exactly at threshold**: A change at exactly the threshold (5 files / 10 tasks) is treated as the small-change ceiling; anything past it is normal and triggers the guardrail warning.
- **Fast-path on a non-companion run**: The fast-path only applies to this project's own pipeline commands. A change run through core spec-kit commands is unaffected and always follows core behavior.
- **Configuration disagreement**: When the project-level setting and the editor-level setting disagree, the behavior resolves to a single, predictable outcome (documented in Assumptions) so the developer is never surprised.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST classify each new spec as either *simple* or *normal* based on the feature description, before the pipeline decides how much ceremony to apply.
- **FR-002**: Classification MUST be derived from observable signals in the description: the number of files projected to change, the number of tasks projected, and scope phrases that indicate size (e.g. "one-line fix", "rename" → smaller; "rewrite", "overhaul", "new system" → larger).
- **FR-003**: The system MUST use a small-change threshold that mirrors the project's existing tiny-change guardrail: a change is only eligible to be *simple* when it stays within 5 files and 10 tasks.
- **FR-004**: When a change is classified *simple* (and the fast-path is enabled), the pipeline MUST produce a single combined spec/plan/tasks artifact and advance directly to the implement step in one run, without separate plan and tasks stages.
- **FR-005**: When a change is classified *normal*, the pipeline MUST run the full specify → plan → tasks → implement sequence unchanged.
- **FR-006**: When a change exceeds the small-change threshold, the system MUST warn that the guardrail was crossed rather than silently fast-tracking it.
- **FR-007**: The system MUST expose a configuration knob to disable the fast-path entirely, defaulting to enabled (opt-out behavior).
- **FR-008**: The configuration knob MUST be settable both at the project level (a project configuration file) and through the host editor's settings, with a single, predictable resolution when the two disagree.
- **FR-009**: The fast-path behavior MUST apply only to this project's own pipeline commands and MUST NOT change the behavior of core spec-kit pipeline commands.
- **FR-010**: When the fast-path folds plan and tasks into a single artifact, the spec's recorded lifecycle MUST reflect that those steps were satisfied by the fast-path, so progress tracking does not show them as missing or stuck.

### Key Entities *(include if feature involves data)*

- **Complexity classification**: The simple/normal verdict for a spec, derived from the description's size signals; determines which pipeline path runs.
- **Size signals**: The inputs to classification — projected file count, projected task count, and scope phrases — evaluated against the small-change threshold.
- **Fast-path setting**: The opt-out configuration controlling whether auto-detection is active, resolvable from project-level and editor-level sources.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A one-line change spec run through the pipeline reaches the implement step in a single run, with zero separate plan or tasks stages generated.
- **SC-002**: A large-scope change spec (e.g. "add OAuth") still produces distinct plan and tasks stages 100% of the time.
- **SC-003**: Every change that exceeds the 5-files / 10-tasks threshold produces a guardrail warning; none are silently fast-tracked.
- **SC-004**: With the fast-path disabled, 100% of changes — including trivial ones — run the full pipeline.
- **SC-005**: For small changes, the number of developer-facing pipeline steps drops from four (specify, plan, tasks, implement) to two (combined artifact, implement), measurably reducing the ceremony for trivial work.

## Assumptions

- **Threshold values**: The small-change ceiling is fixed at 5 files / 10 tasks to mirror the project's existing tiny-change guardrail. These are not independently configurable in this feature; they track the existing guardrail.
- **Default state**: The fast-path is on by default (opt-out). A team that wants full ceremony on every change disables it explicitly.
- **Configuration precedence**: When the project-level setting and the editor-level setting disagree, the project-level setting wins, on the assumption that a project's checked-in policy should govern everyone working in it. (Recorded here as the predictable resolution for FR-008.)
- **Scope of effect**: Per the project's architecture decision on presets-vs-commands, complexity logic lives in this project's own pipeline commands only. Core spec-kit command behavior is intentionally untouched; the shared preset shapes templates, not command flow.
- **Classification is best-effort**: Size signals are heuristic. When signals are weak or conflicting, the classifier errs toward *normal* so a change is never under-planned by accident.
