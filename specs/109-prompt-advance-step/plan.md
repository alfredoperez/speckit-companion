# Plan: Prompt Advance Step

**Slug**: 109-prompt-advance-step | **Date**: 2026-05-26

## Approach

Extend the existing prompt fragments in `src/ai-providers/promptBuilder.ts` with one additional instruction: after the AI appends the completion transition and flips `status`, it must also set `currentStep` to the next step in the canonical four-step order, except when the completing step is `implement` (terminal — no advancement).

Encode the next-step lookup once near the existing `COMPLETED_STATUS_BY_STEP` / `DONE_PHRASE_BY_STEP` maps as `NEXT_STEP_BY_STEP: Record<PromptStep, PromptStep | null>` (with `implement → null`), and reference it from `renderPreamble`. For the two lifecycle preambles, append a single sentence to `renderLifecycleBody` describing the same rule (the multi-step preamble is intentionally less procedural, so a one-line rule is enough; the per-step `currentStep` set in step 1 of the next iteration will pick it up naturally).

Update the existing `promptBuilder.test.ts` to cover the new behavior — both shapes — without rewriting the surrounding tests.

## Files to Change

- `src/ai-providers/promptBuilder.ts` — add `NEXT_STEP_BY_STEP` map; extend `renderPreamble`'s "MUST DO BEFORE ENDING" block with a `(d)` clause for non-terminal steps and an explicit terminal-state note for `implement`; add a corresponding one-liner to `renderLifecycleBody`.
- `src/ai-providers/__tests__/promptBuilder.test.ts` — add cases asserting (1) preamble for `specify`/`plan`/`tasks` instructs setting `currentStep` to the next step, (2) preamble for `implement` instructs leaving `currentStep` on `implement`, and (3) the lifecycle preamble produced by `buildLifecyclePrompt` and `buildSpecifyCreationPreamble` includes the rule.
