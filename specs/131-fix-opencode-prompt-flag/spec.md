# Feature Specification: Fix Wrong CLI Prompt Flag for OpenCode

**Feature Branch**: `131-fix-opencode-prompt-flag`
**Created**: 2026-06-08
**Status**: Draft
**Input**: User description: "Fix wrong CLI prompt flag for opencode provider (issue #202)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - OpenCode user dispatches a SpecKit action (Priority: P1)

A developer has configured SpecKit Companion to use OpenCode as their AI provider (`"speckit.aiProvider": "opencode"`). They trigger any SpecKit action that hands a prompt to the CLI — for example, running an analyze, plan, or implement action against a valid `tasks.md`. They expect OpenCode to receive the prompt and start working on it.

**Why this priority**: This is the only user journey affected. With the wrong flag, OpenCode is completely unusable from the extension — every prompt-dispatching action fails. The provider is advertised as supported but does not function, so fixing it restores the entire OpenCode integration.

**Independent Test**: Configure OpenCode as the provider, trigger a prompt-dispatching action, and confirm OpenCode actually consumes the prompt and begins its task instead of printing its help/usage screen.

**Acceptance Scenarios**:

1. **Given** OpenCode is selected as the AI provider, **When** the user triggers a SpecKit action that dispatches a prompt to the CLI, **Then** OpenCode reads the prompt and starts processing it rather than displaying its command-usage help text.
2. **Given** OpenCode is selected as the AI provider, **When** the dispatched command is shown in the terminal, **Then** it uses a prompt-input mechanism that OpenCode actually supports.

### Edge Cases

- What happens when the dispatched prompt contains spec content with quotes, newlines, or special shell characters? The prompt must still reach OpenCode intact (the prompt continues to be passed via the existing temp-file mechanism).
- How does the system behave for the other CLI providers (Copilot, Qwen) that currently share the default prompt flag? Their behavior must remain unchanged by this fix.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When OpenCode is the selected AI provider, the extension MUST dispatch prompts using an invocation that OpenCode supports for non-interactive prompt input.
- **FR-002**: The dispatched OpenCode command MUST cause OpenCode to consume the supplied prompt and begin its task, rather than printing its usage/help screen.
- **FR-003**: The fix MUST NOT change the dispatch behavior of any other CLI provider (e.g., Copilot, Qwen) that relies on the existing default prompt flag.
- **FR-004**: The existing prompt-delivery mechanism (prompt written to a temp file and substituted into the command) MUST continue to work so that large or special-character prompts are passed intact.

### Key Entities

- **AI Provider Dispatch Command**: The shell command the extension builds to hand a prompt to a chosen CLI; for OpenCode it must be corrected to a supported prompt-input form.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of prompt-dispatching SpecKit actions succeed when OpenCode is the configured provider (OpenCode receives and acts on the prompt instead of showing help).
- **SC-002**: Zero regressions for other CLI providers — their dispatched commands are byte-for-byte unchanged from before the fix.
- **SC-003**: A user can go from selecting OpenCode to seeing it act on a SpecKit prompt in a single action, with no manual command editing.

## Assumptions

- The correct supported invocation for OpenCode non-interactive prompt input is its documented `run` subcommand (`opencode run "<prompt>"`) or its `--prompt` option, as opposed to the unsupported `-p` flag. The exact form (subcommand vs. long flag) is an implementation detail to be settled during planning, provided it satisfies FR-002.
- Only the OpenCode provider is affected; the issue does not report problems with other providers, so their shared default flag remains correct for them.
