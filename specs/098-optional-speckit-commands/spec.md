# Spec: Optional SpecKit Commands

**Slug**: 098-optional-speckit-commands | **Date**: 2026-05-21

## Summary

SpecKit ships three optional refinement commands — `/clarify`, `/analyze`, and
`/checklist` ([spec-kit optional commands](https://github.com/github/spec-kit#optional-commands)) —
that are already registered as VS Code commands and reachable from the Command
Palette, but they are invisible in the spec viewer where users actually work
through a spec's lifecycle. This feature surfaces each optional command as a
step-scoped button in the spec viewer so the right refinement is offered at the
right moment: Clarify while reviewing the spec, Checklist while reviewing the
plan, and Analyze before implementing. Closes
[#156](https://github.com/alfredoperez/speckit-companion/issues/156).

## Requirements

- **R001** (MUST): The spec viewer shows a **Clarify** button while the **spec**
  (specify) tab is active. Clicking it runs the `speckit.clarify` flow for the
  current spec.
- **R002** (MUST): The spec viewer shows a **Checklist** button while the
  **plan** tab is active. Clicking it runs the `speckit.checklist` flow for the
  current spec.
- **R003** (MUST): The spec viewer shows an **Analyze** button while the
  **tasks** tab is active. Clicking it runs the `speckit.analyze` flow for the
  current spec.
- **R004** (MUST): Clicking a button dispatches the same provider-formatted
  slash command and spec-directory argument that invoking the corresponding
  registered command (`speckit.clarify` / `speckit.analyze` /
  `speckit.checklist`) already produces, so behavior is identical to running the
  command from the Command Palette.
- **R005** (MUST): These buttons are part of the built-in SpecKit workflow and
  require no user configuration in `customCommands` or `customWorkflows`.
- **R006** (SHOULD): A button appears only on its associated step tab and is
  hidden on the other tabs.
- **R007** (SHOULD): User-defined `customCommands` / `customWorkflows` commands
  continue to work and are de-duplicated against the built-in buttons so the
  same command does not render twice.

## Scenarios

### Clarify offered on the spec tab

**When** the user opens a spec in the viewer and the spec (specify) tab is active
**Then** a Clarify button is shown, and clicking it runs the clarify command in
the AI CLI terminal scoped to that spec's directory

### Checklist offered on the plan tab

**When** the user switches to the plan tab
**Then** the Clarify button is no longer shown, a Checklist button is shown, and
clicking it runs the checklist command for that spec

### Analyze offered on the tasks tab

**When** the user switches to the tasks tab (before implementing)
**Then** an Analyze button is shown, and clicking it runs the analyze command for
that spec

### Built-in buttons coexist with user custom commands

**When** the user has configured their own `customCommands` for a step
**Then** both the built-in optional-command button and the user's custom buttons
appear, with no duplicate rendering of an identical command

## Out of Scope

- Adding new SpecKit commands beyond the three optional ones already registered.
- Changing the underlying behavior of the clarify / analyze / checklist
  commands themselves.
- Surfacing optional commands in the sidebar tree or Command Palette (already
  available there).
- Auto-running any optional command as part of the `sdd:auto` / lifecycle flow.
