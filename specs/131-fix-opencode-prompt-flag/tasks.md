---
description: "Task list for fixing the wrong CLI prompt flag for OpenCode"
---

# Tasks: Fix Wrong CLI Prompt Flag for OpenCode

**Input**: Design documents from `/specs/131-fix-opencode-prompt-flag/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli-dispatch.md, quickstart.md

**Tests**: Included. A regression test is mandated by `contracts/cli-dispatch.md` (Verification) and `quickstart.md` (Automated check) — it locks in both the fix and the no-regression guarantee for other providers.

**Organization**: One user story (P1) — the only journey affected. Setup and Foundational phases have no work (existing TypeScript project, Jest harness, and the `cliPromptFlag()` override seam already exist).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1)

## Path Conventions

Single-project VS Code extension — source at `src/`, tests co-located in `src/ai-providers/__tests__/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

No tasks — the TypeScript project, dependencies, and Jest harness (`tests/__mocks__/vscode.ts`) already exist. No new dependencies (plan.md: "no new dependencies").

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before user-story work

No tasks — the fix reuses the existing per-provider `cliPromptFlag()` override hook in `CliTerminalProvider` and the shared `buildPromptDispatchCommand()` assembly. No shared infrastructure to build.

---

## Phase 3: User Story 1 - OpenCode user dispatches a SpecKit action (Priority: P1) 🎯 MVP

**Goal**: When OpenCode is the selected provider, dispatch `opencode run "$(cat <tmp>)"` so OpenCode consumes the prompt and starts its task, instead of `opencode -p "…"` (where `-p` is `--password`, which makes OpenCode print its help screen).

**Independent Test**: Configure `"speckit.aiProvider": "opencode"`, trigger a prompt-dispatching action, and confirm OpenCode acts on the prompt rather than printing usage/help (quickstart.md).

### Tests for User Story 1 ⚠️

> **NOTE: Write this test FIRST and confirm it FAILS before T002 (the fix).**

- [x] **T001** [P] [US1] Add regression test in `src/ai-providers/__tests__/openCodeDispatch.test.ts`: assert `OpenCodeProvider`'s dispatched command contains `opencode run "` and does NOT contain `-p`, and assert the regression guards — `QwenCliProvider` still emits `qwen --yolo -p ` and `CopilotCliProvider` still emits `copilot -p ` (byte-for-byte unchanged per FR-003/SC-002). Follow the existing pattern in `src/ai-providers/__tests__/promptCommand.test.ts` (drive `buildPromptDispatchCommand` / the provider's flag; bash shell form).

### Implementation for User Story 1

- [x] **T002** [US1] Override `cliPromptFlag()` in `src/ai-providers/openCodeProvider.ts` to return `'run '` (trailing space), and update the class doc comment from `opencode -p "$(cat <tmp>)"` to `opencode run "$(cat <tmp>)"`. This makes T001 pass (FR-001, FR-002, FR-004).
- [x] **T003** [P] [US1] Correct the doc comment on `cliPromptFlag()` in `src/ai-providers/cliTerminalProvider.ts` (~line 170) to drop OpenCode from the `-p ` default note — the default now fits Copilot and Qwen only. Comment-only; no behavior change.

**Checkpoint**: OpenCode dispatches via `run`; T001 passes; Copilot/Qwen/Codex/Claude/Gemini command strings are unchanged.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Verify the fix end-to-end and confirm zero regressions

- [x] **T004** Run the full suite with `npm test` and confirm `openCodeDispatch` passes alongside the existing `promptCommand` / provider-registry regression tests (SC-001, SC-002). ✅ 72 suites / 833 tests pass.
- [ ] T005 Execute manual verification per `specs/131-fix-opencode-prompt-flag/quickstart.md`: set `"speckit.aiProvider": "opencode"`, trigger a prompt-dispatching action, confirm the terminal shows `opencode run "$(cat …)"` and OpenCode acts on the prompt instead of printing help (SC-003).

> Docs: no README change required (plan.md Docs Impact — the README never documented the `-p` form and the OpenCode row stays correct).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** / **Foundational (Phase 2)**: no tasks — skip.
- **User Story 1 (Phase 3)**: the entire feature.
- **Polish (Phase 4)**: depends on Phase 3 completion.

### Within User Story 1

- T001 (test) is written FIRST and must FAIL before T002.
- T002 (the fix) makes T001 pass.
- T003 is comment-only and independent of T001/T002 (different file).

### Parallel Opportunities

- T001 and T003 touch different files from each other and can be authored in parallel; T002 lands after the test exists (TDD).

---

## Parallel Example: User Story 1

```bash
# T001 (new test file) and T003 (cliTerminalProvider doc comment) are independent files:
Task: "Add regression test in src/ai-providers/__tests__/openCodeDispatch.test.ts"
Task: "Correct cliPromptFlag() doc comment in src/ai-providers/cliTerminalProvider.ts"
# Then T002 makes the test pass:
Task: "Override cliPromptFlag() → 'run ' in src/ai-providers/openCodeProvider.ts"
```

---

## Implementation Strategy

### MVP (User Story 1 = the whole fix)

1. T001 — write the failing regression test.
2. T002 — override `cliPromptFlag()` → `'run '` (test goes green).
3. T003 — correct the base-class doc comment.
4. T004 — `npm test` (full suite green).
5. T005 — manual quickstart verification.

This is a one-provider, ~1-line behavior change behind the existing override seam; there is no incremental/parallel-team strategy beyond the steps above.

---

## Notes

- [P] = different files, no dependencies.
- The behavioral change is a single line: `OpenCodeProvider.cliPromptFlag()` → `'run '`. Everything else is a test plus two doc-comment corrections.
- Regression invariant (FR-003 / SC-002): Copilot, Qwen, Codex, Claude, Gemini command strings must remain byte-for-byte unchanged — T001 guards this.
