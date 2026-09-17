# Ai providers config — Living Spec

<!-- reviewed: a9c0b02b -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The per-provider registry and the user settings that select and permission an AI provider, so a bad registry entry fails at activation and a stale setting never does.

## Requirements

### The provider registry is validated at activation, not at first dispatch
<!-- touches: src/ai-providers/providerRegistry.ts -->

Per-provider configuration SHALL be checked when the extension loads, and a malformed entry MUST throw immediately naming the provider and field. This catches silent misconfiguration such as a flag that runs into the next argument, an icon that renders as nothing, or a directory declared without its enumerating pattern.

#### Scenario: a provider entry is edited incorrectly
- **WHEN** an entry declares a command format outside the allowed set, or a flag that would concatenate into the following argument
- **THEN** activation fails with a message naming that provider and every failing field at once
- **AND** the extension never reaches a dispatch built from the bad value

### A stale or unknown provider setting never breaks activation
<!-- touches: src/ai-providers/aiProvider.ts -->

Every read of the configured provider SHALL fall back to the default provider when the value no longer exists. An unrecognized setting MUST degrade to a working assistant, never a crash on dispatch.

#### Scenario: a persisted provider id was renamed or removed
- **WHEN** the setting holds an identifier the registry does not know
- **THEN** the default provider is used
- **AND** the extension activates and dispatches normally

### Permission mode is honored where it can be, and overridden loudly where it cannot
<!-- touches: src/ai-providers/permissionValidation.ts -->

The permission-mode setting SHALL resolve to the target CLI's own flag. When a CLI cannot honor interactive approval in scripted mode, the provider MUST apply the auto-approve flag and warn once per provider, instead of dispatching something that hangs on an unanswerable prompt. The user SHOULD be offered the matching setting change once, with their decision remembered.

#### Scenario: interactive mode on a CLI that cannot prompt
- **WHEN** the user has interactive permissions selected and the configured CLI cannot honor it
- **THEN** the dispatch carries the auto-approve flag and the override is logged once
- **AND** the user is offered a one-time prompt to switch the setting, and declining is remembered

## Uncovered

_None. Every file in the area was read._
