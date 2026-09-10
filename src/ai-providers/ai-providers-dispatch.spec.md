# Ai providers dispatch — Living Spec

<!-- reviewed: a9c0b02b -->

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

This capability is how the extension hands work to whatever AI coding assistant the user actually has. This file covers how a composed command reaches an assistant: the one provider contract, the terminal CLI lifecycle, and host-chat targets that are probed rather than assumed.

## Requirements

### Dispatch is one-way and unobservable
<!-- touches: src/ai-providers/aiProvider.ts, src/ai-providers/ideChatProvider.ts, src/ai-providers/claudePanelProvider.ts -->

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
<!-- touches: src/ai-providers/aiProvider.ts, src/ai-providers/aiProviderFactory.ts -->

All assistants SHALL be reached through a single provider interface covering installation check, interactive dispatch, background dispatch, slash-command dispatch, and permission-flag resolution. A feature MUST NOT branch on which assistant is configured; adding an assistant means adding a provider, not editing call sites.

#### Scenario: a new assistant is supported
- **WHEN** support for another AI tool is added
- **THEN** it is introduced as a new provider registered in the factory and the paths registry
- **AND** no existing feature code changes to accommodate it

### Terminal CLIs share one dispatch lifecycle
<!-- touches: src/ai-providers/cliTerminalProvider.ts -->

Providers that drive a CLI in a terminal SHALL inherit a common lifecycle — verify the CLI is present, stage the prompt to a temporary file, build the shell line, create the terminal, wait for the shell to be ready before sending, then clean the temporary file up on a delay. A concrete provider MUST override only the parts that genuinely differ for its CLI. Assistants whose interaction model does not fit this shape (an interactive TUI that must boot before accepting input, a reused long-lived session) may stay outside the shared lifecycle rather than being forced through it.

#### Scenario: a CLI provider needs a different command line
- **WHEN** a CLI takes its prompt in a form the shared line does not produce
- **THEN** the provider overrides the dispatch-preparation step and returns its own command line plus the temp files to clean
- **AND** install verification, terminal creation, shell readiness, and cleanup remain inherited

#### Scenario: the CLI is not installed
- **WHEN** a provider that declares an install hint dispatches and its binary is absent
- **THEN** the user is told how to get it and the dispatch fails loudly rather than sending text into a shell that cannot act on it
- **AND** the hint is either a copyable install command (package-manager CLIs) or an "Open Install Page" link that opens the tool's download page (download-based tools such as the `agy` CLI), matching how that tool is actually obtained

### The prompt is never pasted into visible terminal scrollback
<!-- touches: src/ai-providers/aiProvider.ts, src/core/utils/shellDetection.ts -->

Assembled prompt text SHALL be delivered through a temporary file read by the shell at invocation time rather than inlined into the command line, so long instructions do not flood the terminal and shell quoting cannot corrupt them. The substitution form MUST be chosen from the detected shell family. Where a shell offers no such substitution, the provider MUST fall back to inlining with that shell's escaping and MUST refuse — with an actionable message naming a shell to switch to — rather than silently truncating when the resulting line exceeds what the shell accepts.

#### Scenario: a long prompt on a shell without file substitution
- **WHEN** the assembled command line would exceed the shell's command-length limit
- **THEN** dispatch fails with a message naming the limit and suggesting a different terminal shell
- **AND** no truncated command is sent

### Dispatch targets are probed at dispatch time, not assumed
<!-- touches: src/ai-providers/ideChatProvider.ts, src/ai-providers/wibeyPanelProvider.ts -->

Surfaces the extension does not own — a host editor's chat, another extension's panel — SHALL be resolved by checking what is actually registered at the moment of dispatch, in a per-target preference order, degrading through fallbacks. When no target resolves, the provider MUST surface an actionable message naming a way forward and MUST NOT throw. `[inferred]` The degradation ladder ends at copying the command to the clipboard and opening the surface, so a target that accepts no programmatic input still works with one user paste.

#### Scenario: the host editor exposes no chat command
- **WHEN** none of the candidate chat commands are registered in the running editor
- **THEN** the user is warned that no built-in chat was found and told to switch to a CLI provider
- **AND** a host that ships its own CLI provider (an Antigravity host, whose `agy` CLI the dedicated Antigravity provider runs) is named directly rather than pointed at the generic switch-to-CLI hint
- **AND** nothing throws

#### Scenario: the host drops the prompt it is handed
- **WHEN** a target opens its chat but discards the supplied query
- **THEN** the command is placed on the clipboard and the user is told to paste and press Enter

### Commands are not auto-submitted into a surface that cannot resolve them
<!-- touches: src/ai-providers/ideChatProvider.ts -->

Before a SpecKit command is fired into a host editor's chat, the extension SHALL check that spec-kit has scaffolded those commands for that editor. When it has not, the command MUST be prefilled rather than submitted, and the user MUST be told why, with a route to initialize.

#### Scenario: the workspace is not spec-kit initialized
- **WHEN** a command is dispatched to a host chat with no spec-kit scaffolding present
- **THEN** the chat opens with the command prefilled but not submitted
- **AND** the user is warned and offered the initialize action

## Uncovered

_None — every file in the area was read._
