# Ai providers dispatch — Living Spec

<!-- reviewed: a9c0b02b -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

How a composed command reaches the user's AI coding assistant: the one provider contract, the terminal CLI lifecycle, and host-chat targets that are probed rather than assumed.

## Requirements

### Dispatch is one-way and unobservable
<!-- touches: src/ai-providers/aiProvider.ts, src/ai-providers/ideChatProvider.ts, src/ai-providers/claudePanelProvider.ts -->

A provider SHALL be treated as a write-only channel: the extension hands text to the assistant and cannot observe what happens next. No caller may treat a return value as evidence that the work happened. Providers that dispatch somewhere other than a terminal MUST satisfy the same interface and report a non-failure result, not an error.

#### Scenario: a step is dispatched to a chat surface
- **WHEN** the configured provider routes to the host editor's chat or a GUI panel instead of a terminal
- **THEN** the dispatch call resolves without a terminal handle and without throwing
- **AND** callers treat the absence of a failure signal as success, never as confirmation of completion

#### Scenario: the assistant ignores the instruction
- **WHEN** the assistant never acts on the dispatched text
- **THEN** the extension cannot detect this and does not claim the step completed
- **AND** completion is established by the assistant writing spec context, not by the dispatch returning

### Every assistant is reached through one provider contract
<!-- touches: src/ai-providers/aiProvider.ts, src/ai-providers/aiProviderFactory.ts -->

All assistants SHALL be reached through one provider interface covering installation check, interactive dispatch, background dispatch, slash-command dispatch, and permission-flag resolution. A feature MUST NOT branch on which assistant is configured, so adding an assistant means adding a provider, not editing call sites.

#### Scenario: a new assistant is supported
- **WHEN** support for another AI tool is added
- **THEN** it is a new provider registered in the factory and the paths registry
- **AND** no existing feature code changes to accommodate it

### Terminal CLIs share one dispatch lifecycle
<!-- touches: src/ai-providers/cliTerminalProvider.ts -->

Terminal CLI providers SHALL inherit one lifecycle: verify the CLI, stage the prompt to a temp file, build the shell line, create the terminal, wait for shell readiness, send, then delete the temp file after a delay. A concrete provider MUST override only the parts that differ for its CLI. Assistants that do not fit this shape, such as a TUI that must boot before input or a reused long-lived session, may stay outside it.

#### Scenario: a CLI provider needs a different command line
- **WHEN** a CLI takes its prompt in a form the shared line does not produce
- **THEN** the provider overrides the dispatch-preparation step and returns its own command line plus the temp files to clean
- **AND** install verification, terminal creation, shell readiness, and cleanup remain inherited

#### Scenario: the CLI is not installed
- **WHEN** a provider that declares an install hint dispatches and its binary is absent
- **THEN** the user is told how to get it and the dispatch fails loudly instead of sending text into a shell that cannot act on it
- **AND** the hint is a copyable install command for package-manager CLIs, or an "Open Install Page" link for download-based tools such as the `agy` CLI

### The prompt is never pasted into visible terminal scrollback
<!-- touches: src/ai-providers/aiProvider.ts, src/core/utils/shellDetection.ts -->

The assembled prompt SHALL be passed through a temp file the shell reads at invocation, not inlined into the command line. The substitution form MUST be chosen from the detected shell family. Where a shell has no such substitution, the provider MUST inline with that shell's escaping, and MUST refuse with a message naming a shell to switch to instead of truncating when the line exceeds the shell's limit.

#### Scenario: a long prompt on a shell without file substitution
- **WHEN** the assembled command line would exceed the shell's command-length limit
- **THEN** dispatch fails with a message naming the limit and suggesting a different terminal shell
- **AND** no truncated command is sent

### Dispatch targets are probed at dispatch time, not assumed
<!-- touches: src/ai-providers/ideChatProvider.ts, src/ai-providers/wibeyPanelProvider.ts -->

Surfaces the extension does not own, such as a host editor's chat or another extension's panel, SHALL be resolved by checking what is registered at dispatch time, in a per-target preference order with fallbacks. When no target resolves, the provider MUST show an actionable message and MUST NOT throw. `[inferred]` The last fallback copies the command to the clipboard and opens the surface, so a target with no programmatic input still works with one paste.

#### Scenario: the host editor exposes no chat command
- **WHEN** none of the candidate chat commands are registered in the running editor
- **THEN** the user is warned that no built-in chat was found and told to switch to a CLI provider
- **AND** a host that ships its own CLI provider (an Antigravity host, whose `agy` CLI the dedicated Antigravity provider runs) is named directly instead of the generic switch-to-CLI hint
- **AND** nothing throws

#### Scenario: the host drops the prompt it is handed
- **WHEN** a target opens its chat but discards the supplied query
- **THEN** the command is placed on the clipboard and the user is told to paste and press Enter

### Commands are not auto-submitted into a surface that cannot resolve them
<!-- touches: src/ai-providers/ideChatProvider.ts -->

Before firing a SpecKit command into a host editor's chat, the extension SHALL check that spec-kit has scaffolded those commands for that editor. If not, the command MUST be prefilled instead of submitted, and the user MUST be told why and offered a route to initialize.

#### Scenario: the workspace is not spec-kit initialized
- **WHEN** a command is dispatched to a host chat with no spec-kit scaffolding present
- **THEN** the chat opens with the command prefilled but not submitted
- **AND** the user is warned and offered the initialize action

## Uncovered

_None. Every file in the area was read._
