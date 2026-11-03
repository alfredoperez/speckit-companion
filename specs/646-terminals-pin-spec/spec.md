# Feature Specification: Terminals the extension opens pin the spec

**Feature directory**: `specs/646-terminals-pin-spec`
**Source**: #931 (item w23)

## User Scenarios & Testing

### User Story 1 - A step dispatched for one spec works on that spec (Priority: P1)

A developer has two specs open. `.specify/feature.json` points at the one they touched last. They click Plan on the other one in the viewer. Today the terminal's scripts and Companion's writer pick the spec from `feature.json`, so the step can stamp or read the wrong spec. With this change, every terminal the extension opens for a spec carries `SPECIFY_FEATURE_DIRECTORY` set to that spec's folder, which both resolvers read before `feature.json`.

**Why this priority**: a step that writes onto the wrong spec corrupts finished work.

**Independent Test**: dispatch a step from the viewer for spec B while `feature.json` names spec A; the terminal's environment names spec B.

**Acceptance Scenarios**:

1. **Given** `feature.json` names spec A, **When** the viewer dispatches plan for spec B, **Then** the terminal opens with `SPECIFY_FEATURE_DIRECTORY` set to spec B's folder.
2. **Given** a dispatch with no spec (steering, constitution, a new spec), **When** the terminal opens, **Then** it carries no pin.
3. **Given** the converge or step commands from the sidebar for a spec, **When** they dispatch, **Then** the terminal carries the same pin.

## Edge Cases

- A provider that dispatches somewhere other than a terminal (IDE chat, the Claude panel) ignores the pin.
- Gemini and Wibey run their own interactive terminals outside the shared provider; they are not pinned in this slice.
- The pin is an absolute folder path, which the resolvers accept.

## Requirements

### Functional Requirements

- **FR-001**: A spec-scoped dispatch MUST open its terminal with `SPECIFY_FEATURE_DIRECTORY` set to that spec's folder.
- **FR-002**: A dispatch with no spec MUST NOT set the pin.
- **FR-003**: The viewer's dispatches and the sidebar's step and converge commands MUST pass their spec folder.
- **FR-004**: Providers that do not open a terminal MUST keep working unchanged.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every viewer step dispatch carries the pin of the spec it was clicked on.
- **SC-002**: No dispatch without a spec gains the variable.

## Assumptions

- No background (headless) dispatch is spec-scoped today, so `SPECIFY_FEATURE_NO_PERSIST` has nothing to apply to yet.

## Verbatim Constraints

- `SPECIFY_FEATURE_DIRECTORY`

## Approach

- `apps/vscode/src/ai-providers/aiProvider.ts` and `cliTerminalProvider.ts`: `DispatchOptions` gains `specDir`; `runVisible` sets `env: { SPECIFY_FEATURE_DIRECTORY }` when it is given.
- `apps/vscode/src/features/spec-viewer/specViewerProvider.ts`: the panel's `executeInTerminal` passes its `specDirectory`.
- `apps/vscode/src/features/specs/specCommands.ts`: the step, sidebar command and converge dispatches pass their target folder.
- A test on the provider's terminal env, with and without a spec.
- Changelog line in the root `CHANGELOG.md`.
