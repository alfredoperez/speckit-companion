# Plan: Fix Tasks Card Concerns Crash

**Spec**: [spec.md](./spec.md)

## Approach

Make the Activity panel tolerant of the real-world `task_summaries` shapes AI writers produce (string `concerns`, "None" sentinels, missing arrays), without changing the canonical `TaskSummary` TypeScript contract or asking SDD-side writers to change their output. The fix lives at three layers, each independently valuable: (a) `normalizeSpecContext` coerces inbound `task_summaries[*].concerns` and `.files` into `string[]` at the extension's read boundary, so the rest of the codebase keeps seeing the typed shape; (b) `TasksCard` adds a single defensive line that handles non-array values even when the reader isn't in the loop (e.g., Storybook fixtures, future direct webview consumers); (c) `ActivityPanel` is wrapped in a Preact error boundary so any future card crash blanks one card, not the whole panel. The injected `speckit-companion:context-update` directive is tightened so future writes converge on the canonical shape — the prompt change is documentation, not enforcement.

## Files

### Create

- `webview/src/spec-viewer/components/ActivityErrorBoundary.tsx` — Preact class component that catches render errors in its subtree, posts the error to the extension via `vscode.postMessage({ type: 'webviewError' })`, and renders a quiet inline notice. Wraps `<ActivityPanel/>` only.
- `webview/src/spec-viewer/components/cards/__tests__/TasksCard.test.tsx` — render tests against the realistic shapes from the FIRM-11132 bundle (string `concerns`, mixed shapes, empty/none sentinels). Verifies no throw, correct row count, correct concerns bullet count.
- `src/features/specs/__tests__/specContextReader.test.ts` — normalization tests covering the new `task_summaries` coercion rules from spec R002, plus a regression test using the FIRM-11132 fixture.
- `specs/095-fix-tasks-card-concerns/fixtures/firm-11132.spec-context.json` — verbatim final-state reconstruction of the FIRM-11132 `.spec-context.json` (best-effort from the bundle's `mutations.md`), used as the canonical "did this fix work" fixture by both new test files.

### Modify

- `webview/src/spec-viewer/components/cards/TasksCard.tsx` — replace the `t.concerns && t.concerns.length > 0` guard and `.map()` call with a local `toStringArray(value)` helper. Same treatment for `t.files`. The helper: returns `value` if `Array.isArray`; returns `[]` for `null`/`undefined`/empty string/`"none"`/`"n/a"` (case-insensitive, trimmed); returns `[String(value).trim()]` for any other primitive. No allocation when value is already an array.
- `src/features/specs/specContextReader.ts` — extend `normalizeSpecContext` to coerce every `task_summaries[*].concerns` and `.files` using the same rules. Walk the object once; reuse the helper extracted next to `pickConcerns`. Preserves the existing rule that unknown top-level fields pass through unchanged (FR-013) — coercion only touches the two known fields inside each task entry.
- `src/ai-providers/promptBuilder.ts` — replace the two-line `TASK SUMMARIES` block in `SHARED_RULES` (lines 43–44) with a four-line block that explicitly states: `status` is `"DONE"` or `"DONE_WITH_CONCERNS"`, `did` is one sentence, `files` and `concerns` are `string[]`, and `concerns` must be omitted when empty (never `"None"`).
- `webview/src/spec-viewer/App.tsx` — wrap `<ActivityPanel />` in `<ActivityErrorBoundary>`. No layout change; the boundary is transparent in the happy path.
- `src/ai-providers/__tests__/promptBuilder.test.ts` — update the snapshot/contains assertions to match the tightened directive text. Add one positive assertion that the emitted block contains `concerns: string[]`.

## Testing Strategy

- **Unit (extension)**: New `specContextReader.test.ts` covers each shape rule from spec R002 with one test per branch (array passthrough, "None" string → `[]`, arbitrary string → `[trimmed]`, `null`/`undefined` → omitted, number → omitted, mixed across multiple task entries). One end-to-end test loads `firm-11132.spec-context.json` and asserts the returned `task_summaries.T001.concerns` is `[]` (was `"None — …"`) and `task_summaries.RT2.concerns` is `[]` (was `"Fees-Tax …"` — wait, RT2 says "Fees-Tax has no @else read-only branch (excluded). PDF preview tab still ART-7889. No SCSS change." → that's substantive, becomes `[<that string>]`). Use the fixture's actual values.
- **Unit (webview)**: New `TasksCard.test.tsx` renders the card against four shapes: `concerns: []`, `concerns: ["a","b"]`, `concerns: "real concern text"`, `concerns: "None"`. Asserts row count, concerns bullet count, and that no test throws. Add a "mixed across summaries" test feeding the entire FIRM-11132 `task_summaries` object.
- **Error boundary**: Force a throw inside a child card (via a dedicated `<ThrowingCard/>` test double) and assert the rest of the panel still renders and the boundary's inline notice appears once.
- **Snapshot**: `promptBuilder.test.ts` updated assertion is the regression guard against the directive drifting back to the ambiguous two-line form.

## Risks

- **Reader coercion changes data semantically when it strips `"None"`.** A reader downstream that *wanted* the literal string `"None"` would now see `[]`. Mitigation: `concerns` is consumed only by `TasksCard` today (verified via grep); the canonical `TaskSummary.concerns` type is already `string[]`, so any future consumer that wants the original string is out-of-contract. Documented explicitly in the spec's Out of Scope.
- **Prompt drift between speckit-companion and SDD.** The directive lives in the extension's prompt builder, but the SDD `/sdd:implement` skill in the separate `sdd/` repo has its own copy of `task_summaries` guidance. We are not coordinating that change here — we make the viewer tolerant of *both* shapes so the two repos can update independently.
