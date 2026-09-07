# Terminal Dispatch — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Providers that drive a CLI in a VS Code terminal share one lifecycle and deliver the prompt through a temp file instead of the command line.

## Requirements

### Terminal CLIs share one dispatch lifecycle

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

Assembled prompt text SHALL be delivered through a temporary file read by the shell at invocation time rather than inlined into the command line, so long instructions do not flood the terminal and shell quoting cannot corrupt them. The substitution form MUST be chosen from the detected shell family. Where a shell offers no such substitution, the provider MUST fall back to inlining with that shell's escaping and MUST refuse — with an actionable message naming a shell to switch to — rather than silently truncating when the resulting line exceeds what the shell accepts.

#### Scenario: a long prompt on a shell without file substitution
- **WHEN** the assembled command line would exceed the shell's command-length limit
- **THEN** dispatch fails with a message naming the limit and suggesting a different terminal shell
- **AND** no truncated command is sent
