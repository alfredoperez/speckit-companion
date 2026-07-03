# Feature Specification: Phases as a horizontal step-time strip

**Feature**: 388-phases-strip
**Source**: [#403](https://github.com/alfredoperez/speckit-companion/issues/403)

## Overview

The Phases card renders a tall vertical timeline whose substep rows are mostly "no substeps recorded" noise, and the Work tab swaps a heavy card stack. Collapse Phases to a single horizontal strip — step dots with name and time, connected left to right — keeping the Started/Total/Ended summary and dropping per-step bars and substep rows.

## User Scenarios & Testing

### User Story 1 - Read the run's shape in one line (Priority: P1)

A reviewer opens the Work tab and reads the whole phase story on one line: `● Specify 1m 48s ── ● Plan 1m 6s ── ● Tasks 20s ── ● Implement 14m`, with the in-flight step visually distinct.

**Acceptance Scenarios**:
1. **Given** a completed spec, **When** Work renders, **Then** each recorded step shows as a dot + name + time on one horizontal line, in pipeline order.
2. **Given** an in-flight step, **Then** its dot pulses/differs and shows elapsed-so-far.
3. **Given** narrow widths, **Then** the strip wraps gracefully (no overflow).
4. **Given** the previous layout's substep rows and per-step bars, **Then** they are gone — no "no substeps recorded" filler anywhere.

## Edge Cases

- A step with an untrusted duration → shows its name with time omitted (never a fake duration).
- Single-step specs → one dot, no connectors.
- Multi-day specs → the Started/Ended summary still carries dates.

## Requirements

### Functional Requirements

- **FR-001**: The Phases card MUST render steps as a single horizontal strip (dot + name + time, connected), preserving the Started/Total/Ended summary row.
- **FR-002**: Substep rows and per-step progress bars MUST be removed.
- **FR-003**: Times MUST render only for measured spans (active-duration logic unchanged); the in-flight step is visually distinct.
- **FR-004**: Stories MUST cover completed, in-flight, and single-step states; existing panel stories keep passing.
- **FR-005**: The Coverage card's requirement list MUST be expanded by default (uncovered rows first), with the disclosure remaining as a clearly visible collapse control.
- **FR-006**: Each tab MUST read as one surface: the panel carries the card chrome, inner cards render as flat sections within it, and a tab with a single section drops its redundant title.

## Success Criteria

- **SC-001**: The Phases card height drops to a fraction of the current layout for a 4-step spec (one strip + summary vs. per-step blocks).
- **SC-002**: impeccable clean on the changed surface; all suites green.

## Assumptions

- Substep timing detail is intentionally dropped from the card (capture is thin by design); the data remains in the context file.
- The existing active-duration computation (idle-gap capping) is reused for the per-step times.

## Approach

- Rework `PhasesCard.tsx` body: keep the overall Started/Total/Ended row; replace the vertical track with a `phases-strip` flex row of step nodes (dot + name + time) joined by connector lines; drop substep rendering and the duration bars from the previous iteration.
- CSS in `_activity.css`: strip layout, connectors, in-flight pulse reuse, wrap behavior.
- Update `PhasesCard`/panel stories for the three states.

Dependencies: none beyond the existing card. Files: `webview/src/spec-viewer/components/cards/PhasesCard.tsx`, `webview/styles/spec-viewer/_activity.css`, stories.
