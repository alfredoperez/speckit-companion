# Ai Providers — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

This capability is how the extension hands work to whatever AI coding assistant the user actually has — a terminal CLI, the host editor's built-in chat, or a GUI chat panel. Without it every feature would have to know which assistant is configured and how that assistant takes input, and the extension would only ever work with one tool.

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

### Terminal CLIs share one dispatch lifecycle

Providers that drive a CLI in a terminal SHALL inherit a common lifecycle — verify the CLI is present, stage the prompt to a temporary file, build the shell line, create the terminal, wait for the shell to be ready before sending, then clean the temporary file up on a delay. A concrete provider MUST override only the parts that genuinely differ for its CLI. Assistants whose interaction model does not fit this shape (an interactive TUI that must boot before accepting input, a reused long-lived session) may stay outside the shared lifecycle rather than being forced through it.

#### Scenario: a CLI provider needs a different command line
- **WHEN** a CLI takes its prompt in a form the shared line does not produce
- **THEN** the provider overrides the dispatch-preparation step and returns its own command line plus the temp files to clean
- **AND** install verification, terminal creation, shell readiness, and cleanup remain inherited

#### Scenario: the CLI is not installed
- **WHEN** a provider that declares an install hint dispatches and its binary is absent
- **THEN** the user is told what to install with a copyable install command and the dispatch fails loudly rather than sending text into a shell that cannot act on it

### The prompt is never pasted into visible terminal scrollback

Assembled prompt text SHALL be delivered through a temporary file read by the shell at invocation time rather than inlined into the command line, so long instructions do not flood the terminal and shell quoting cannot corrupt them. The substitution form MUST be chosen from the detected shell family. Where a shell offers no such substitution, the provider MUST fall back to inlining with that shell's escaping and MUST refuse — with an actionable message naming a shell to switch to — rather than silently truncating when the resulting line exceeds what the shell accepts.

#### Scenario: a long prompt on a shell without file substitution
- **WHEN** the assembled command line would exceed the shell's command-length limit
- **THEN** dispatch fails with a message naming the limit and suggesting a different terminal shell
- **AND** no truncated command is sent

### Bookkeeping instructions travel separately from the user-facing command

The extension prepends spec-context bookkeeping to the prompt, delimited by markers so it can be separated again. Every surface a human reads — a chat input, a GUI panel prefill, a TUI input line — MUST show only the command, never the bookkeeping. Surfaces that can carry the bookkeeping out of band SHOULD do so; surfaces that cannot MUST drop it rather than display it.

#### Scenario: dispatching to a chat the user is looking at
- **WHEN** the prompt carries a bookkeeping preamble
- **THEN** the chat input receives only the command
- **AND** the bookkeeping is either routed through a side channel the assistant still reads, or dropped

#### Scenario: a CLI that accepts a system-prompt channel
- **WHEN** the prompt carries a preamble and the CLI supports appending to its system prompt
- **THEN** the preamble is staged separately and passed through that channel so it neither pollutes scrollback nor interferes with slash-command resolution

### Command names are rewritten to whatever the target actually registered

The canonical dotted command form SHALL be translated to the form the target assistant resolves — some tools register these commands with dots, others as dash-named skills. The translation MUST be driven by per-target configuration and MUST be overridable by an explicit user setting. It MUST apply to the command verb only, never to its argument, and MUST leave non-SpecKit commands untouched.

#### Scenario: a namespaced command reaches a dash-form target
- **WHEN** a multi-segment SpecKit command is dispatched to a target whose commands are dash-named
- **THEN** every separator in the verb becomes a hyphen so the whole name matches the registered skill
- **AND** an argument that happens to contain a dot or the word "companion" is not rewritten

### Arguments are reshaped for the surface that will display them

An argument that is a filesystem path is meaningful to a terminal agent but useless in a chat input a human reads, and unreadable to a CLI sandboxed to the project directory. Providers SHALL reshape the argument for their surface: inline a staged description file's contents where the target cannot open it, shorten a spec directory path to the spec's name where a human will read it, and leave free-text arguments alone.

#### Scenario: creating a spec from a staged description file
- **WHEN** the create flow dispatches a command whose argument is a path to a staged description outside the project
- **THEN** a chat or panel surface receives the description text inlined, with the appended bookkeeping stripped
- **AND** a project-sandboxed CLI receives the file's full contents inlined rather than the unreadable path

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

### Dispatch targets are probed at dispatch time, not assumed

Surfaces the extension does not own — a host editor's chat, another extension's panel — SHALL be resolved by checking what is actually registered at the moment of dispatch, in a per-target preference order, degrading through fallbacks. When no target resolves, the provider MUST surface an actionable message naming a way forward and MUST NOT throw. `[inferred]` The degradation ladder ends at copying the command to the clipboard and opening the surface, so a target that accepts no programmatic input still works with one user paste.

#### Scenario: the host editor exposes no chat command
- **WHEN** none of the candidate chat commands are registered in the running editor
- **THEN** the user is warned that no built-in chat was found and told to switch to a CLI provider
- **AND** nothing throws

#### Scenario: the host drops the prompt it is handed
- **WHEN** a target opens its chat but discards the supplied query
- **THEN** the command is placed on the clipboard and the user is told to paste and press Enter

### Commands are not auto-submitted into a surface that cannot resolve them

Before a SpecKit command is fired into a host editor's chat, the extension SHALL check that spec-kit has scaffolded those commands for that editor. When it has not, the command MUST be prefilled rather than submitted, and the user MUST be told why, with a route to initialize.

#### Scenario: the workspace is not spec-kit initialized
- **WHEN** a command is dispatched to a host chat with no spec-kit scaffolding present
- **THEN** the chat opens with the command prefilled but not submitted
- **AND** the user is warned and offered the initialize action

## Uncovered

_None — every file in the area was read._

### The dispatch preamble names the main agent as the per-task serializing writer

The implement preamble SHALL instruct that per-task journaling is performed by the main agent — one task at a time, in the foreground, including tasks whose work was fanned out — and that workers never write the shared context file. The slim companion preamble SHALL describe step closure as extension-stamped (bodies record starts, hooks and scripts record completes), reserving AI self-close for clarify/analyze.

#### Scenario: implement is dispatched with the full preamble
- **WHEN** the AI fans tasks out to workers
- **THEN** the preamble directs the main agent to journal each returned task itself, serially

#### Scenario: a companion command is dispatched
- **WHEN** the slim preamble is rendered
- **THEN** it defers step closure to the body-and-hook model and never asks the AI to self-close plan or tasks
