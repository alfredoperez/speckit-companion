# Asset Discovery — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Agents and skills are authored by the user or by another tool and live outside the extension's own storage, so the extension must find them wherever the active provider keeps them and show what it found without ever failing activation over a file it did not write.

## Requirements

### Discovering user-authored assets is best-effort and never breaks activation
<!-- touches: src/features/agents/agentManager.ts, src/features/skills/skillManager.ts, src/features/settings/companionPresetReconciler.ts -->

Enumerating agents, skills, or presets SHALL treat a missing directory, an unreadable file, or a failing external CLI as "nothing found here" and continue. These sources are outside the extension's control and are frequently absent; a hard failure would take down the whole extension for a user who simply doesn't have the directory.

#### Scenario: the user has no skills directory
- **WHEN** the skill list is requested
- **THEN** an empty list is returned and the failure is logged, not surfaced as an error

#### Scenario: the external CLI a preset operation needs is not installed
- **WHEN** the operation runs
- **THEN** the failure is logged and the caller continues
- **AND** activation completes normally

### A malformed definition surfaces as a flagged entry, not a missing one
<!-- touches: src/features/skills/skillManager.ts -->

A skill whose definition file has absent or unparseable frontmatter SHALL still be listed, named from its containing folder and marked as needing attention. Silently dropping it is worse than showing it broken: the user's assistant may still load it, and an invisible entry gives them nothing to fix.

#### Scenario: a skill's frontmatter is invalid YAML
- **WHEN** the skill list is built
- **THEN** the skill appears under its folder name, flagged, with an explanation available on hover
- **AND** it is not omitted from the list

### Assets are discovered at every scope and attributed to their origin
<!-- touches: src/features/agents/agentManager.ts, src/features/skills/skillManager.ts -->

Discovery SHALL cover the project scope, the user scope, and installed plugins, and SHALL record which scope each asset came from. Plugin-sourced assets SHALL be namespaced by their plugin so two plugins providing the same name remain distinguishable.

#### Scenario: two plugins each provide an asset with the same name
- **WHEN** both are discovered
- **THEN** each is presented under its own plugin's namespace
- **AND** neither displaces the other

### Discovery follows the configured provider's layout rather than one vendor's
<!-- touches: src/features/skills/skillManager.ts, src/features/agents/agentManager.ts -->

Where an asset's on-disk location differs per AI provider, discovery SHALL resolve the directory from the active provider's path configuration. This applies to every provider-located asset type alike — no asset type may hard-code one vendor's layout, since doing so makes that feature silently empty for every other provider. [NEEDS CLARIFICATION: agent discovery still hard-codes one vendor's agents directory at both scopes, so the second scenario does not hold for agents today; is that a defect to fix or an intended exception?]

#### Scenario: a non-default provider is configured
- **WHEN** skills are enumerated
- **THEN** the provider's own skills directory is scanned at both project and user scope

#### Scenario: a provider whose on-disk layout differs from the default is active
- **WHEN** any provider-located asset type is enumerated
- **THEN** that provider's own directory is scanned and its assets are listed
- **AND** the section is not shown as empty because another vendor's layout was assumed

## Uncovered

_None — every file in the area was read._
