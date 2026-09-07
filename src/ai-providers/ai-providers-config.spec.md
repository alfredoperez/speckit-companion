# Ai providers config — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

This capability is how the extension hands work to whatever AI coding assistant the user actually has. This file covers the per-provider registry and the user settings that select and permission a provider, so a bad entry fails at activation and a stale setting never does.

## Requirements

### The provider registry is validated at activation, not at first dispatch
<!-- touches: src/ai-providers/providerRegistry.ts -->

Per-provider configuration SHALL be checked when the extension loads, and a malformed entry MUST throw immediately with the offending provider and field named. Silent misconfiguration is the failure mode this guards against — a flag that runs into the next argument, an icon that renders as nothing, a directory declared without the pattern that enumerates it.

#### Scenario: a provider entry is edited incorrectly
- **WHEN** an entry declares a command format outside the allowed set, or a flag that would concatenate into the following argument
- **THEN** activation fails with a message naming that provider and every failing field at once
- **AND** the extension never reaches a dispatch built from the bad value

### A stale or unknown provider setting never breaks activation
<!-- touches: src/ai-providers/aiProvider.ts -->

The configured provider value is user-editable and survives renames, so every read SHALL tolerate a value that no longer exists by falling back to the default provider. An unrecognized setting MUST degrade to a working assistant, never to a crash on every dispatch.

#### Scenario: a persisted provider id was renamed or removed
- **WHEN** the setting holds an identifier the registry does not know
- **THEN** the default provider is used
- **AND** the extension activates and dispatches normally

### Permission mode is honored where it can be, and overridden loudly where it cannot
<!-- touches: src/ai-providers/permissionValidation.ts -->

The single permission-mode setting SHALL resolve to the target CLI's own flag. When a CLI cannot honor interactive approval in scripted mode, the provider MUST apply the auto-approve flag anyway and warn once per provider, rather than dispatching something that will hang waiting for a prompt nobody can answer. The user SHOULD be offered the matching setting change once, with their decision remembered.

#### Scenario: interactive mode on a CLI that cannot prompt
- **WHEN** the user has interactive permissions selected and the configured CLI cannot honor it
- **THEN** the dispatch carries the auto-approve flag and the override is logged once
- **AND** the user is offered a one-time prompt to switch the setting, and declining is remembered

## Uncovered

_None — every file in the area was read._
