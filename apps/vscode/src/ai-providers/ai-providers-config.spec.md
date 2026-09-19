# Ai providers config — Living Spec

<!-- reviewed: a9c0b02b -->

## Purpose

The per-provider registry and the settings that select and permission a provider, so a bad registry entry fails at activation and a stale setting never does.

## Requirements

### The provider registry is validated at activation, not at first dispatch
<!-- touches: src/ai-providers/providerRegistry.ts -->

A malformed entry, such as a flag that would run into the next argument, an icon VS Code would render as nothing, or a directory declared without its glob pattern, stops activation.

#### Scenario: a provider entry is edited incorrectly
- **WHEN** an entry declares an unknown command format and an auto-approve flag with no trailing space
- **THEN** activation fails with one error naming that provider and both fields

### A stale or unknown provider setting never breaks activation
<!-- touches: src/ai-providers/aiProvider.ts -->

#### Scenario: a persisted provider id was renamed or removed
- **WHEN** `speckit.aiProvider` holds an id the registry does not know
- **THEN** the extension activates and dispatches with the default provider

### Permission mode is honored where it can be, and overridden loudly where it cannot
<!-- touches: src/ai-providers/permissionValidation.ts -->

The permission-mode setting maps to the CLI's own auto-approve flag. A CLI that cannot prompt in scripted mode gets the auto-approve flag even in interactive mode, rather than a dispatch that hangs on an unanswerable prompt.

#### Scenario: interactive mode on a CLI that cannot prompt
- **WHEN** interactive permissions are selected and the CLI cannot honor them
- **THEN** the dispatch carries the auto-approve flag, and the override is logged once per provider

### The user is offered the matching permission setting once
<!-- touches: src/ai-providers/permissionValidation.ts -->

#### Scenario: the user keeps interactive mode
- **WHEN** the extension activates with interactive mode on a CLI that cannot prompt, and the user picks Keep Interactive
- **THEN** the offer to switch to auto-approve does not return for that provider and mode
