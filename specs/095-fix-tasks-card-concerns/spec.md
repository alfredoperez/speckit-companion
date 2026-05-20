# Spec: Fix Tasks Card Concerns Crash

**Slug**: 095-fix-tasks-card-concerns | **Date**: 2026-05-20

## Summary

The Activity panel blanks out the moment the first implement-step `task_summaries` entry lands on disk, because `TasksCard` calls `.map()` on `concerns` assuming `string[]` but AI writers frequently produce a plain string (`"None"`, `"Spec exploration was wrong …"`). The fix tolerates non-array shapes in the viewer, normalizes them at the reader boundary so downstream code keeps its typed contract, and tightens the prompt directive so future writes follow the schema — all without breaking the existing wire contract between SpecKit Companion and SDD.

## Requirements

- **R001** (MUST): `TasksCard` MUST NOT throw or unmount the Activity panel when any task summary has `concerns` of type string, `null`, `undefined`, number, or other non-array — including the realistic `"None"` case captured in the FIRM-11132 bundle. The same defensive handling applies to `files`.
- **R002** (MUST): `normalizeSpecContext` (in `src/features/specs/specContextReader.ts`) MUST coerce every `task_summaries[*].concerns` value into a canonical `string[]` shape before the value crosses the extension → webview boundary. Coercion rules:
  - Already a `string[]` → unchanged.
  - String value whose trimmed lowercase form is `""` / `"none"` / `"n/a"` → `[]` (no card row, no noise).
  - Any other non-empty string → `[trimmedString]` (rendered as a single bullet).
  - `null` / `undefined` / non-string / non-array → omitted from the normalized object so the optional field stays optional.
  - Same coercion applied to `task_summaries[*].files` (non-string entries dropped; non-array coerced to `[]`).
- **R003** (MUST): The wire contract between SpecKit Companion and SDD MUST stay backwards-compatible:
  - Existing `.spec-context.json` files that already use `concerns: string[]` continue to parse and render unchanged.
  - The canonical `TaskSummary` type in `src/core/types/specContext.ts` continues to declare `concerns?: string[]` and `files?: string[]` — the type contract is the same; only the reader becomes lenient on input.
  - SDD-side writers (the `/sdd:implement` skill and any tooling that writes `task_summaries`) are NOT required to change behavior to keep the viewer working. The viewer becomes tolerant; SDD remains free to emit either shape.
- **R004** (MUST): The `speckit-companion:context-update` directive built in `src/ai-providers/promptBuilder.ts` MUST explicitly state the expected shapes so future AI writes converge on the canonical form: `concerns: string[]` (omit entirely when empty), `files: string[]`, and `status: "DONE" | "DONE_WITH_CONCERNS"`. Existing call sites of the directive must continue to produce a valid prompt.
- **R005** (SHOULD): The Activity panel SHOULD be wrapped in a Preact error boundary so a future crash in any single card does not blank the whole panel. The boundary surfaces a quiet inline notice for the failed card and lets sibling cards keep rendering. (Defense in depth — independent of R001's fix.)
- **R006** (MUST): The fix is verifiable locally by copying the FIRM-11132 `task_summaries` payload into a fixture and confirming the Activity panel renders Phases + Tasks without throwing. A unit/component test using that fixture is the canonical verification artifact.
- **R007** (MAY): The `statusLabel` / `statusClass` helpers MAY accept the canonical SDD/AI status vocabulary (`"completed"`, `"reverted"`, `"in-progress"`) in addition to the existing `"DONE"` / `"DONE_WITH_CONCERNS"` codes, mapping them to the same visual treatment. Out of scope to enforce one over the other.

## Scenarios

### Task summary with string `concerns: "None"` (FIRM-11132 case)

**When** the webview receives a `viewerState` whose `taskSummaries.T001.concerns` is the string `"None — to-rem() matches the file's own precedent"`
**Then** `TasksCard` renders the task row, omits the concerns list entirely (treated as empty), and the rest of the Activity panel (Phases, Approach, etc.) keeps rendering.

### Task summary with non-empty string `concerns`

**When** `taskSummaries.RT2.concerns` is `"Fees-Tax has no @else read-only branch (excluded)."`
**Then** the card renders one concerns bullet containing that exact text, no crash.

### Mixed shapes across tasks

**When** one task has `concerns: ["a", "b"]`, another has `concerns: "none"`, a third has `concerns: undefined`, and a fourth has `concerns: 42`
**Then** all four tasks render in order — the first shows two concerns, the second/third/fourth show no concerns list — and the Activity panel never unmounts.

### Reader normalization (extension boundary)

**When** `readSpecContext` parses a `.spec-context.json` file where multiple `task_summaries` entries use string `concerns`
**Then** the returned `SpecContext` has every `concerns` value normalized to `string[]` (or absent), so consumers downstream of the reader — including `deriveViewerState` and any future card — see only the typed shape.

### Backwards-compatible existing data

**When** an existing spec written before this change has `task_summaries.T001.concerns: ["something specific"]` (already canonical)
**Then** the value flows through unchanged, the card renders identically to before, and no existing test/snapshot has to be updated for shape reasons.

### FIRM-11132 fixture reproduces locally

**When** a developer copies the reconstructed FIRM-11132 `.spec-context.json` into a test fixture and feeds it through the real `normalizeSpecContext` + `deriveViewerState` + `ActivityPanel` render path
**Then** the test passes (no throw), and the rendered output contains the Phases card (plan + implement groups) and the Tasks card (7 task rows: T001-T004 string, T001-T004 hyphenated rollup, RT1, RT2, RT3) with no card row attempting `.map()` on a string.

### Prompt directive clarifies shape

**When** the speckit-companion provider builds the `context-update` prompt block for `/sdd:implement`
**Then** the emitted block contains an explicit line stating `concerns` is `string[]` and that empty `concerns` should be omitted rather than written as `"None"`, and the existing `promptBuilder` snapshot test is updated to match.

## Non-Functional Requirements

- **NFR001** (MUST): Reader normalization MUST be allocation-light — at most one allocation per task summary, no full deep clone of the SpecContext just to coerce two fields.
- **NFR002** (SHOULD): The error boundary (R005) SHOULD log the underlying error to the VS Code output channel for diagnostics without surfacing a noisy banner to the user.

## Out of Scope

- Reshaping the canonical `TaskSummary` TypeScript type to widen `concerns` to `string | string[]`. The canonical type stays `string[]`; coercion happens at the reader.
- Forcing SDD's `/sdd:implement` skill or any external CLI to emit the canonical shape — viewer tolerance is the contract, not writer conformance.
- Status vocabulary unification (R007 is explicitly MAY). This spec does not migrate `"completed"` → `"DONE"` across the codebase.
- The other findings in the FIRM-11132 bundle audit (wrong branch, status skipping, duplicate transitions, missing `tasks` step). Those are separate concerns and out of scope here.
