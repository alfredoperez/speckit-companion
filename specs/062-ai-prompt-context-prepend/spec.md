# Spec: AI Prompt Context Prepend

**Slug**: 062-ai-prompt-context-prepend | **Date**: 2026-04-13

## Summary

Prepend a short, canonical context-update instruction block to every prompt the extension dispatches to an AI CLI (Claude, Gemini, Copilot, Codex, Qwen) so the AI keeps `.spec-context.json` current during its run — especially substeps that the extension cannot observe from the outside. This complements spec 061's hard step-boundary writes with fine-grained substep data.

## Requirements

- **R001** (MUST): A new module `src/ai-providers/promptBuilder.ts` exports a function that wraps a raw AI command string with a context-update preamble and returns the combined prompt text.
- **R002** (MUST): Every call site that currently invokes `getAIProvider().executeInTerminal(prompt)` for a SpecKit step (specify, plan, tasks, implement) routes the prompt through `promptBuilder` so the preamble is added consistently.
- **R003** (MUST): The preamble references canonical substep names from `CANONICAL_SUBSTEPS` in `src/core/types/specContext.ts` for the step being dispatched.
- **R004** (MUST): A VS Code configuration option `speckit.aiContextInstructions` (boolean, default `true`) gates the preamble. When `false`, `promptBuilder` returns the raw command unchanged.
- **R005** (MUST): The same preamble shape is emitted for all providers (Claude, Gemini, Copilot, Codex, Qwen) — no per-provider forking of the text.
- **R006** (MUST): The preamble instructs the AI to preserve unknown fields and treat `transitions` as append-only, matching the canonical schema's invariants.
- **R007** (SHOULD): The preamble is wrapped in marker comments `<!-- speckit-companion:context-update -->` / `<!-- /speckit-companion:context-update -->` so it can be grepped in logs.
- **R008** (SHOULD): Total preamble length is under ~300 tokens (roughly under 1,500 characters) to keep the AI context budget intact.
- **R009** (MUST): The `speckit.aiContextInstructions` setting is documented in `README.md` alongside other configuration options.
- **R010** (SHOULD): `promptBuilder` is covered by unit tests asserting golden-string output for each step and the opt-out path.

## Scenarios

### Dispatch with preamble enabled (default)

**When** the user runs a SpecKit command (e.g., `speckit.plan`) and the extension calls `executeInTerminal`
**Then** the dispatched prompt begins with the marker-wrapped preamble that names the current step and its canonical substeps, followed by the original command

### Dispatch with preamble disabled

**When** the user sets `speckit.aiContextInstructions` to `false` and runs a SpecKit command
**Then** `promptBuilder` returns the raw command unchanged and no marker comment appears in the dispatched text

### All providers emit identical preamble

**When** the user switches the configured AI provider between Claude, Gemini, Copilot, Codex, and Qwen and runs the same step
**Then** the preamble body is byte-identical across providers (only the trailing command differs)

### Unknown step requested

**When** `promptBuilder` is invoked with a step name not in `CANONICAL_SUBSTEPS`
**Then** the preamble is omitted (raw command returned) rather than emitting a malformed substep list

## Non-Functional Requirements

- **NFR001** (SHOULD): Preamble adds ≤ 300 tokens per dispatch to keep AI context cost bounded.
- **NFR002** (MUST): No spec content or absolute path prefixes outside the workspace are embedded in the preamble — only the workspace-relative spec directory.

## Out of Scope

- Enforcing that the AI actually writes `.spec-context.json` (best-effort; spec 061 is the hard guarantee).
- Modifying `.claude/skills/speckit-*/SKILL.md` or `.specify/**` — those are dev-workspace-only and do not ship with the extension.
- Observability/telemetry for preamble compliance rates.
- Localization of the preamble (English only).
