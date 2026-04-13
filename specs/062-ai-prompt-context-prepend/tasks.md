# Tasks: AI Prompt Context Prepend

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-13

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add `speckit.aiContextInstructions` configuration — `package.json` | R004
  - **Do**: Under `contributes.configuration.properties`, add `speckit.aiContextInstructions` as a boolean with `default: true` and a description explaining the preamble behavior and opt-out.
  - **Verify**: `npm run compile` passes; setting appears in the Extensions > SpecKit Companion settings panel after F5 launch.
  - **Leverage**: Existing `contributes.configuration.properties` entries in `package.json`.

- [x] **T002** Create `promptBuilder` helper *(depends on T001)* — `src/ai-providers/promptBuilder.ts` | R001, R003, R004, R005, R006, R007, R008, NFR001, NFR002
  - **Do**: Export `buildPrompt({ command, step, specDir })` that reads `vscode.workspace.getConfiguration('speckit').get<boolean>('aiContextInstructions', true)`. When `true` and `step` is a known key in `CANONICAL_SUBSTEPS`, return a preamble (marker-wrapped `<!-- speckit-companion:context-update -->`) listing canonical substeps + append-only `transitions` invariant, followed by a blank line + the raw command. Otherwise return `command` unchanged. Keep the preamble body identical across providers and under ~1,500 chars.
  - **Verify**: `npm run compile` passes; module exports are type-checked against `CANONICAL_SUBSTEPS` keys.
  - **Leverage**: `src/core/types/specContext.ts` (`CANONICAL_SUBSTEPS`).

- [x] **T003** Unit tests for `promptBuilder` *(depends on T002)* — `src/ai-providers/__tests__/promptBuilder.test.ts` | R001, R003, R004, R005, R010, NFR002
  - **Do**: Golden-string tests for `specify`, `plan`, `tasks`, `implement` (preamble present, marker comments present, substeps listed); opt-out test (config `false` → raw command byte-identical); unknown-step test (returns raw command); path-leakage test (only workspace-relative `specDir` appears).
  - **Verify**: `npm test` — new tests pass; no regressions.
  - **Leverage**: Existing Jest setup; mock `vscode.workspace.getConfiguration` via `tests/__mocks__/vscode.ts`.

- [x] **T004** Route `executeInTerminal` callers through `promptBuilder` *(depends on T002)* — `src/features/specs/specCommands.ts` | R002, R005
  - **Do**: For every SpecKit-step dispatch that currently calls `getAIProvider().executeInTerminal(prompt)`, wrap the prompt with `buildPrompt({ command: prompt, step, specDir })` using the appropriate `step` (`specify`/`plan`/`tasks`/`implement`) and the resolved workspace-relative `specDir`.
  - **Verify**: `npm run compile` passes; existing `specCommands.test.ts` still passes; dispatched prompt in manual F5 run contains the `<!-- speckit-companion:context-update -->` marker when the setting is default.
  - **Leverage**: Existing command handlers in `specCommands.ts`.

- [x] **T005** Document setting in README *(depends on T001)* — `README.md` | R009
  - **Do**: Add a section or row under existing configuration documentation describing `speckit.aiContextInstructions` (default `true`), what the preamble does, and when to disable it.
  - **Verify**: README renders correctly; search for `aiContextInstructions` returns the new entry.
  - **Leverage**: Existing configuration documentation in `README.md`.

---

## Progress

- Phase 1: T001–T005 [x]
