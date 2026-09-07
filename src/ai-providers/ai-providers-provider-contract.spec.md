# Provider Contract — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

One interface reaches every assistant, the registry that backs it is validated at activation, and dispatch is a write-only channel whose outcome the extension never observes.

## Requirements

### Dispatch is one-way and unobservable

A provider SHALL be treated as a write-only channel: the extension composes text, hands it to the assistant, and cannot observe what the assistant does with it. No caller may depend on a return value as evidence that the work happened. Providers that dispatch somewhere other than a terminal MUST still satisfy the same interface, reporting a non-failure result rather than an error, because "the assistant did nothing" is indistinguishable from "the assistant succeeded" from here.

#### Scenario: a step is dispatched to a chat surface
- **WHEN** the configured provider routes to the host editor's chat or a GUI panel instead of a terminal
- **THEN** the dispatch call resolves without a terminal handle and without throwing
- **AND** callers treat the absence of a failure signal as success, never as confirmation of completion

#### Scenario: the assistant ignores the instruction
- **WHEN** the assistant never acts on the dispatched text
- **THEN** the extension has no way to detect this and does not claim the step completed
- **AND** completion is established by the assistant writing spec context, not by the dispatch returning

### Every assistant is reached through one provider contract

All assistants SHALL be reached through a single provider interface covering installation check, interactive dispatch, background dispatch, slash-command dispatch, and permission-flag resolution. A feature MUST NOT branch on which assistant is configured; adding an assistant means adding a provider, not editing call sites.

#### Scenario: a new assistant is supported
- **WHEN** support for another AI tool is added
- **THEN** it is introduced as a new provider registered in the factory and the paths registry
- **AND** no existing feature code changes to accommodate it

### A CLI provider is a terminal target; an editor-chat provider is not

Each provider SHALL be classifiable as dispatching either to a VS Code terminal (every CLI provider — including Antigravity, which runs the real `agy` binary interactively with `-i` rather than a non-existent `antigravity` command) or to the host editor's chat/panel (the in-editor chat and GUI-panel providers). An unknown provider value MUST default to the terminal classification, so a newly-added CLI provider is covered without editing this predicate. This classification is what lets a terminal-only affordance — such as the CLI install nudge — fire for CLI dispatch and stay silent for editor-chat dispatch.

#### Scenario: a newly-added provider is classified
- **WHEN** the terminal-versus-editor classification is asked about a provider it has never seen
- **THEN** it answers "terminal", so the new CLI provider behaves like the others without a code change
- **AND** only the in-editor chat and GUI-panel providers are excluded

### The provider registry is validated at activation, not at first dispatch

Per-provider configuration SHALL be checked when the extension loads, and a malformed entry MUST throw immediately with the offending provider and field named. Silent misconfiguration is the failure mode this guards against — a flag that runs into the next argument, an icon that renders as nothing, a directory declared without the pattern that enumerates it.

#### Scenario: a provider entry is edited incorrectly
- **WHEN** an entry declares a command format outside the allowed set, or a flag that would concatenate into the following argument
- **THEN** activation fails with a message naming that provider and every failing field at once
- **AND** the extension never reaches a dispatch built from the bad value

### A stale or unknown provider setting never breaks activation

The configured provider value is user-editable and survives renames, so every read SHALL tolerate a value that no longer exists by falling back to the default provider. An unrecognized setting MUST degrade to a working assistant, never to a crash on every dispatch.

#### Scenario: a persisted provider id was renamed or removed
- **WHEN** the setting holds an identifier the registry does not know
- **THEN** the default provider is used
- **AND** the extension activates and dispatches normally

### Permission mode is honored where it can be, and overridden loudly where it cannot

The single permission-mode setting SHALL resolve to the target CLI's own flag. When a CLI cannot honor interactive approval in scripted mode, the provider MUST apply the auto-approve flag anyway and warn once per provider, rather than dispatching something that will hang waiting for a prompt nobody can answer. The user SHOULD be offered the matching setting change once, with their decision remembered.

#### Scenario: interactive mode on a CLI that cannot prompt
- **WHEN** the user has interactive permissions selected and the configured CLI cannot honor it
- **THEN** the dispatch carries the auto-approve flag and the override is logged once
- **AND** the user is offered a one-time prompt to switch the setting, and declining is remembered

## Uncovered

_None — every file in the area was read._
