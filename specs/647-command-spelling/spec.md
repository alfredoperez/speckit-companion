# Feature Specification: Spell commands the way the project registered them

**Feature directory**: `specs/647-command-spelling`
**Source**: #929 (item w6)

## User Scenarios & Testing

### User Story 1 - A Copilot project gets the dash commands it has (Priority: P1)

A developer initialises a project with spec-kit 1.2.5 for Copilot. The project holds only dash-named skills (`speckit-plan`), and spec-kit records that separator in `.specify/integration.json`. Companion's provider table still says Copilot uses dots, so the viewer sends `/speckit.plan`, a name that is not on disk. With this change, Companion reads the separator spec-kit recorded for the provider's agent first, then what is on disk, and only then its own table.

**Why this priority**: a command that names nothing on disk does nothing.

**Independent Test**: in a project whose `integration.json` records `invoke_separator: "-"` for copilot, the plan command reads `/speckit-plan`.

**Acceptance Scenarios**:

1. **Given** `integration.json` records `-` for the provider's agent, **When** Companion spells plan, **Then** it sends `speckit-plan`.
2. **Given** no `integration.json` but `speckit-specify/SKILL.md` in the agent's skills folder, **When** Companion spells plan, **Then** it sends `speckit-plan`.
3. **Given** neither, **When** Companion spells plan, **Then** it uses the provider table as before.
4. **Given** the user set `speckit.commandFormat` to `dot` or `dash`, **When** Companion spells plan, **Then** the setting wins.

## Edge Cases

- `integration.json` that does not parse, or has no entry for the agent: fall through to the disk.
- A project initialised for two agents: each provider reads its own agent's entry.
- The IDE chat provider maps to the agent of the host editor.

## Requirements

### Functional Requirements

- **FR-001**: In `auto` mode, the command spelling MUST come from `integration_settings[<provider's agent>].invoke_separator` when spec-kit recorded it.
- **FR-002**: Without a recorded separator, it MUST come from the agent's skills folder on disk.
- **FR-003**: Without either, it MUST fall back to the provider table.
- **FR-004**: An explicit `dot` or `dash` setting MUST still win.
- **FR-005**: The `speckit.commandFormat` description MUST no longer say Copilot uses dots.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A v1.2.5 Copilot project gets `/speckit-plan` from the viewer.
- **SC-002**: A project without spec-kit's record spells commands exactly as before.

## Assumptions

- Keeping or dropping the leading slash for the Copilot CLI needs a recorded manual run first, so this slice leaves it as is.

## Verbatim Constraints

- `invoke_separator`
- `.specify/integration.json`
- `speckit.commandFormat`

## Approach

- `apps/vscode/src/speckit/commandSeparator.ts` (new): reads the recorded separator for an agent, then probes `<skills dir>/speckit-specify/SKILL.md`.
- `apps/vscode/src/ai-providers/aiProvider.ts`: `formatCommandForProvider` asks it before the table, keyed on the provider's agent.
- `package.json`: the `commandFormat` descriptions.
- A test with a v1.2.5 Copilot fixture, a disk-only project and a bare one.
- Changelog line in the root `CHANGELOG.md`.
