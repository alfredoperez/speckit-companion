# Asset Discovery — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

How the extension finds user-authored agents and skills across project, user, and plugin scopes, following the active provider's layout, and how it degrades when a source is missing or malformed.

## Requirements

### Discovering user-authored assets is best-effort and never breaks activation

Enumerating agents, skills, or presets SHALL treat a missing directory, an unreadable file, or a failing external CLI as "nothing found here" and continue. These sources are outside the extension's control and are frequently absent; a hard failure would take down the whole extension for a user who simply doesn't have the directory.

#### Scenario: the user has no skills directory
- **WHEN** the skill list is requested
- **THEN** an empty list is returned and the failure is logged, not surfaced as an error

#### Scenario: the external CLI a preset operation needs is not installed
- **WHEN** the operation runs
- **THEN** the failure is logged and the caller continues
- **AND** activation completes normally

### A malformed definition surfaces as a flagged entry, not a missing one

A skill whose definition file has absent or unparseable frontmatter SHALL still be listed, named from its containing folder and marked as needing attention. Silently dropping it is worse than showing it broken: the user's assistant may still load it, and an invisible entry gives them nothing to fix.

#### Scenario: a skill's frontmatter is invalid YAML
- **WHEN** the skill list is built
- **THEN** the skill appears under its folder name, flagged, with an explanation available on hover
- **AND** it is not omitted from the list

### Assets are discovered at every scope and attributed to their origin

Discovery SHALL cover the project scope, the user scope, and installed plugins, and SHALL record which scope each asset came from. Plugin-sourced assets SHALL be namespaced by their plugin so two plugins providing the same name remain distinguishable.

#### Scenario: two plugins each provide an asset with the same name
- **WHEN** both are discovered
- **THEN** each is presented under its own plugin's namespace
- **AND** neither displaces the other

### Discovery follows the configured provider's layout rather than one vendor's

Where an asset's on-disk location differs per AI provider, discovery SHALL resolve the directory from the active provider's path configuration. This applies to every provider-located asset type alike — no asset type may hard-code one vendor's layout, since doing so makes that feature silently empty for every other provider.

#### Scenario: a non-default provider is configured
- **WHEN** skills are enumerated
- **THEN** the provider's own skills directory is scanned at both project and user scope

#### Scenario: a provider whose on-disk layout differs from the default is active
- **WHEN** any provider-located asset type is enumerated
- **THEN** that provider's own directory is scanned and its assets are listed
- **AND** the section is not shown as empty because another vendor's layout was assumed

## Uncovered

_None — every file in the agents and skills areas was read._
