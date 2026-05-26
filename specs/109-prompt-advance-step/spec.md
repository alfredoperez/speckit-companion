# Spec: Prompt Advance Step

**Slug**: 109-prompt-advance-step | **Date**: 2026-05-26

## Summary

The step-completion instruction injected by `promptBuilder.ts` tells the AI to flip `status` and append a completion transition, but never tells it to move `currentStep` to the next step. Every spec dispatched through the extension stays pinned on the completed step, so the PhasesCard reads "in progress" until the user manually triggers the next command. This change adds an explicit "advance currentStep" instruction to the prompt preamble so the workflow visibly progresses on its own.

## Requirements

- **R001** (MUST): After the completion transition is appended, the AI is instructed to set `currentStep` to the next step in the canonical order `specify → plan → tasks → implement`.
- **R002** (MUST): For the terminal step (`implement`), the AI is instructed NOT to advance `currentStep` — it stays on `implement` once completed.
- **R003** (MUST): The new instruction appears in BOTH preamble shapes — the single-step preamble (`renderPreamble`) used by `buildPrompt`, and the multi-step lifecycle body (`renderLifecycleBody`) used by `buildLifecyclePrompt` and `buildSpecifyCreationPreamble` — so every provider path that goes through `promptBuilder` carries the rule.
- **R004** (SHOULD): The step-order sequence in the prompt mirrors the existing typed source of truth (e.g., the four-step subset of `STEP_NAMES` already referenced through `CANONICAL_SUBSTEPS`) rather than being declared as an independent magic list inside the prompt string.

## Scenarios

### Specify completes and advances to plan

**When** the AI finishes `/speckit.specify` (or the SDD equivalent) and writes the completion transition
**Then** it also sets `currentStep` to `"plan"` in `.spec-context.json`, the status flips to `"specified"`, and the PhasesCard advances the active tab to Plan instead of leaving Specify ringed.

### Implement completes and stays terminal

**When** the AI finishes `/speckit.implement` and writes the completion transition
**Then** `currentStep` remains `"implement"`, `status` flips to `"completed"`, and no further advancement is attempted.

### All provider paths receive the instruction

**When** a command is dispatched via any provider (`buildPrompt`, `buildLifecyclePrompt`, or `buildSpecifyCreationPreamble`)
**Then** the rendered preamble between the `speckit-companion:context-update` markers includes the "advance currentStep" instruction.

## Out of Scope

- Spec #107 (inline comment persistence).
- Any TypeScript-side enforcement that would mutate `currentStep` from the extension instead of via the prompt.
- Redesign of `.spec-context.json` schema, `stepHistory`, or PhasesCard rendering.
- Changes to the `clarify` / `analyze` optional steps — only the four-step canonical sequence is in scope.
