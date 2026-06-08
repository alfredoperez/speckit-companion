# Phase 0 Research: OpenCode Non-Interactive Invocation

## Unknown

What command form makes the OpenCode CLI consume a prompt passed from the extension non-interactively, instead of printing its help/usage screen?

## Investigation

The extension's shared dispatch builds `<cli> <flags>"$(cat <tempfile>)"`, where `<flags>` for OpenCode resolves to the base-class default prompt flag `'-p '` (OpenCode's `autoApproveFlag` is empty, so no permission flag is prepended). The emitted command is therefore:

```
opencode -p "$(cat <tempfile>)"
```

Per the OpenCode CLI documentation:

- Non-interactive runs use the **`run` subcommand**, with the message passed as a **positional** argument: `opencode run [message..]` — e.g. `opencode run "Explain how closures work in JavaScript"`.
- `-p` is **not** a prompt flag. It is the short form of `--password` (basic-auth password used when attaching to a running OpenCode server via `--attach`). Invoked as `opencode -p "<text>"` with no subcommand, OpenCode does not start a task — it falls through to printing usage/help.

This exactly matches issue #202: OpenCode shows its help text instead of acting on the prompt.

## Decision

Dispatch OpenCode via its `run` subcommand:

```
opencode run "$(cat <tempfile>)"
```

Implement by overriding `cliPromptFlag()` in `OpenCodeProvider` to return `'run '` (trailing space). Because the prompt is positional for `run`, the existing `<flags>"$(cat <tmp>)"` assembly produces the correct command with **no** change to temp-file creation, shell substitution, or cleanup.

**Rationale**:
- `run` is the documented, supported non-interactive entry point; the message is positional, so it slots into the existing `"$(cat …)"` substitution unchanged (satisfies FR-001, FR-002, FR-004).
- The change is localized to the single failing provider via the existing override seam — Copilot, Qwen, Codex, Claude, and Gemini command strings are untouched (satisfies FR-003 / SC-002).
- OpenCode's `autoApproveFlag` is empty, so no permission flag is interleaved before the subcommand; the resulting command is precisely `opencode run "$(cat <tmp>)"`.

## Alternatives Considered

1. **Long flag `--prompt`** (spec mentioned as a possibility). Rejected: OpenCode's documented non-interactive surface is the `run` subcommand with a positional message; there is no documented `--prompt` option for top-level invocation, whereas `run` is canonical and example-backed. The `run` subcommand is the lowest-risk supported form.
2. **Change the base-class default `cliPromptFlag()` to `'run '`**. Rejected: that flag is shared with Copilot and Qwen, which legitimately use `-p`; changing the default would regress them (violates FR-003). The override must be OpenCode-only.
3. **Override `prepareDispatch()` wholesale for OpenCode** (as Codex/Claude do). Rejected as unnecessary: the only difference is the prompt-flag token, which the `cliPromptFlag()` hook exists precisely to express. A full override would duplicate the shared temp-file/cleanup dance for no benefit (violates the constitution's "extract shared logic" mandate).

## Resolved

No NEEDS CLARIFICATION remain. Sources: [OpenCode CLI docs](https://opencode.ai/docs/cli/).
