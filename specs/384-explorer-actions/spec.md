# Feature Specification: Spec Explorer actions — drift, coverage, adopt

**Feature**: 384-explorer-actions
**Source**: [#393](https://github.com/alfredoperez/speckit-companion/issues/393)

## Overview

The Spec Explorer shows a project's living specs — its capabilities and their spec/architecture/coverage files — but it is read-only: the drift, coverage, and adopt workflows that act on those capabilities run only from the command line. This feature makes the tree actionable: right-click a capability to check its drift or coverage, start brownfield adoption from the view itself, and see each capability's health at a glance on its row.

## User Scenarios & Testing

### User Story 1 - Check a capability's drift from the tree (Priority: P1)

A developer looking at a capability in the Spec Explorer wants to know whether its code has moved ahead of its living spec. They right-click the capability and choose the drift check; the request is dispatched to their AI assistant, which runs the drift report for that capability and shows what changed tracked vs unspeced.

**Why this priority**: Drift is the core "is my living spec still honest?" question, and forcing a terminal round-trip for it is the biggest gap between the shipped logic and the GUI.

**Independent Test**: With living specs enabled and one capability configured, right-click the capability node and invoke the drift action; verify the drift command for that capability is dispatched to the configured AI provider.

**Acceptance Scenarios**:
1. **Given** a capability node in the Spec Explorer, **When** the user opens its context menu, **Then** a drift-check action is offered.
2. **Given** the user invokes the drift action, **When** dispatch occurs, **Then** the existing drift command is sent to the AI provider scoped to that capability.
3. **Given** the spec-kit companion extension is not installed in the workspace, **When** the user opens the context menu, **Then** the action is absent or clearly unavailable rather than failing.

### User Story 2 - Check a capability's requirement coverage from the tree (Priority: P1)

From the same context menu, the developer runs the coverage check to see which of the capability's requirements are mapped to tests and which are uncovered.

**Why this priority**: Pairs with drift as the second read-only health check; same friction, same fix, same menu.

**Independent Test**: Right-click a capability with a coverage tier and invoke the coverage action; verify the coverage command is dispatched scoped to that capability.

**Acceptance Scenarios**:
1. **Given** a capability node, **When** the user opens its context menu, **Then** a coverage-check action is offered.
2. **Given** the user invokes it, **When** dispatch occurs, **Then** the existing coverage command is sent to the AI provider scoped to that capability.

### User Story 3 - Adopt a code area from the view (Priority: P2)

A developer whose project has living specs enabled (or who wants to start) can begin the brownfield adoption wizard from the Spec Explorer itself — from the view's toolbar/overflow menu, or from the empty state when no capabilities exist yet — instead of typing the command by hand.

**Why this priority**: Adoption is the on-ramp; surfacing it in the empty view turns "Living specs are turned off / No living specs yet" from a dead end into a next step.

**Independent Test**: With an empty or unconfigured Spec Explorer, invoke the adopt action from the view menu; verify the adopt command is dispatched (the wizard itself runs in the AI session, prompting for the area).

**Acceptance Scenarios**:
1. **Given** the Spec Explorer view, **When** the user opens its title/overflow menu, **Then** an adopt action is offered.
2. **Given** the user invokes it, **When** dispatch occurs, **Then** the existing adopt command is sent to the AI provider.

### User Story 4 - See capability health on the row (Priority: P2)

Each capability row shows a lightweight health signal without running anything: how many of its requirements have a mapped test (when a coverage tier exists), and a marker when its source files have changed since the living spec was last committed (drift). Hovering explains the numbers.

**Why this priority**: At-a-glance state is what makes the tree a dashboard instead of a file list, but it must never slow or break the tree — hence second tier.

**Independent Test**: Configure a capability with a coverage tier mapping some requirements; open the Spec Explorer; the row shows the covered/total count. Touch a source file after committing the spec; refresh; the row indicates drift.

**Acceptance Scenarios**:
1. **Given** a capability with a coverage tier, **When** the tree renders, **Then** its row shows covered/total requirements.
2. **Given** a capability whose matched files changed since its spec's last commit, **When** the tree renders (or is refreshed), **Then** the row carries a drift indicator with an explanatory tooltip.
3. **Given** state cannot be computed (no git, unreadable files), **When** the tree renders, **Then** the row renders exactly as today — no error, no stale badge.

## Edge Cases

- Spec-kit companion extension not installed → actions hidden/no-op with guidance, never a thrown error.
- Living specs disabled or config absent → view keeps its current "turned off" message; adopt remains offered as the on-ramp; per-capability actions absent.
- Capability whose spec file doesn't exist yet (`not created`) → drift/coverage actions may be offered but must degrade gracefully in the AI session; row health shows nothing.
- No AI provider terminal available (chat-only provider) → dispatch follows the same path/behavior as every other Companion command.
- Health computation on a large repo → must not block tree rendering; compute lazily/asynchronously or on refresh.
- Workspace not a git repository → drift indicator simply absent.

## Requirements

### Functional Requirements

- **FR-001**: Capability nodes MUST offer a context-menu action that dispatches the existing drift command scoped to that capability.
- **FR-002**: Capability nodes MUST offer a context-menu action that dispatches the existing coverage command scoped to that capability.
- **FR-003**: The Spec Explorer view MUST offer an adopt action (title/overflow menu) that dispatches the existing adopt command.
- **FR-004**: All three actions MUST dispatch through the same AI-provider command path used by other Companion commands (one-way dispatch; no new execution engine).
- **FR-005**: The actions MUST be visible only when the spec-kit companion extension is installed in the workspace; per-capability actions additionally require the node to be a capability.
- **FR-006**: Capability rows SHOULD surface coverage state (covered/total requirements) when a coverage tier exists, computed without dispatching to the AI.
- **FR-007**: Capability rows SHOULD surface a drift indicator when matched source files changed since the living spec's last commit, computed without dispatching to the AI.
- **FR-008**: Health computation MUST be best-effort and non-blocking: any failure (no git, missing files, parse error) renders the tree exactly as today.
- **FR-009**: The view MUST offer a refresh action that recomputes health state on demand.
- **FR-010**: New actions and state MUST be covered by unit tests (menu/command registration, dispatch wiring, health computation, failure fallbacks).
- **FR-011**: The sidebar documentation and the README's sidebar summary MUST describe the new actions in the same change.

### Key Entities

- **Capability row health**: per-capability derived state — covered/total requirement count (from the coverage tier) and a drifted yes/no (files changed since the spec's last commit); absent when not computable.
- **Explorer action**: a menu-triggered dispatch of an existing Companion command (drift, coverage, adopt), optionally scoped to a capability name.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Drift and coverage can each be initiated from the Spec Explorer in 2 interactions (right-click → action), down from a typed terminal command.
- **SC-002**: Adoption can be initiated from the view in 2 interactions, including from the empty state.
- **SC-003**: With a coverage tier present, 100% of capability rows show a covered/total count; with none, 0% show a stale or fabricated count.
- **SC-004**: With health computation failing (no git, missing tiers), the tree renders identically to the pre-feature tree — zero errors surfaced.
- **SC-005**: All new behavior is exercised by automated tests that pass in CI.

## Assumptions

- The three actions dispatch the existing spec-kit commands to the AI session (the AI runs the Python scripts); the extension itself never executes workspace Python — consistent with the extension-isolation rule.
- Row health is computed natively in the extension (reading the coverage tier file and git state directly), extending the existing TS living-specs reader — not by shelling to workspace scripts.
- Drift indication uses the same definition as the CLI report (files matching the capability changed since the spec's last commit), but the row shows only a boolean/count, not the full report.
- Scoping the dispatched command to a capability appends the capability name to the command text (the commands accept free-form arguments interpreted by the AI).
- The existing "Living specs are turned off" empty state remains; adopt is the only action offered there.
