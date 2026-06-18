# Phase 0 Research: Command-family-aware capture preamble

## Decision: What "slim" keeps vs drops (companion path)

**Decision**: For a companion command dispatch, emit a slim preamble carrying only the *dynamic dispatch context* the static command body cannot self-source:
- The real dispatch timestamp (`DISPATCH TIME (UTC): …`) — the body has no clock at authoring time.
- The feature dir / target path (`<specDir>/.spec-context.json`) — runtime value.
- The next-step-start guard ("Leave currentStep on `<step>` … writing a start-entry for the next step is a lie").
- The seed start-entry instruction (currentStep + matching in-progress status + the `{ kind: "start", by: "extension", at: <dispatchUtc> }` entry using the dispatch time) — this is the one write that *depends on the dispatch timestamp*, so the body can't self-source it.

**Drop** (the companion body already states these):
- `SPEC_CONTEXT_SCHEMA` block.
- `STATUS_LIFECYCLE` block.
- `renderSharedRules(...)` (timestamps/authorship/task-summaries prose).
- The substep finish boilerplate and per-task finish command (the timing part in the body owns it).

**Rationale**: The companion command body is assembled from `presets/_parts/timing.md` + the schema/status prose, so it carries the full protocol. Re-emitting it in the preamble wastes tokens and risks the model double-logging. The dynamic bits are NOT in the body (no clock, no runtime dir), so they must stay.

**Alternatives considered**: Drop the preamble entirely for companion commands. Rejected — the dispatch timestamp and the "extension wrote the seed start" attribution are load-bearing for honest timing and only the extension knows them at dispatch.

## Decision: Stock path keeps full + modernizes to `--advance`

**Decision**: The stock-path closing instruction switches from the implicit hand-authored "flip status + append complete" to referencing `write-context.py --step <step> --advance --by ai` for advancing steps (specify, plan, tasks). `clarify`/`analyze` stay finish-only (`--finish`), matching `STEP_COMPLETED_STATUS` (which omits them).

**Rationale**: `--advance` (shipped #354) appends the step's complete AND flips status forward-only in one atomic, idempotent call — replacing the awkward two-step dance the AI had to improvise. The map in `write-context.py` is `specify→specified, plan→planned, tasks→ready-to-implement, implement→implemented`; clarify/analyze absent → finish-only.

**Alternatives considered**: Keep the hand-authored JSON instruction. Rejected — the ticket explicitly asks to modernize to `--advance`, and the script path is more reliable (real clock, no format drift).

## Decision: Condition on command family, not install state

**Decision**: For command dispatches keep `companionRecordsSteps(command)` (`/companion/i.test(command)`) as the signal threaded into the renderers. The create-spec flow (`buildSpecifyCreationPreamble`) has no command verb, so it keeps its install-state signal (`workflow === 'companion' && companionInstalledHere()`), and applies the same slim/full split off that boolean.

**Rationale**: A `/speckit.companion.*` command verb is itself proof the body self-records; that's a stronger signal than install probing. The create flow legitimately falls back to install state (per the ticket).

## Key files

- `src/ai-providers/promptPreamble.ts` — the pure renderers (`renderPreamble`, `renderLifecycleBody`, `renderClosingInstruction`, `renderSpecifyCreationLifecyclePreamble`). All edits here; no `import vscode`.
- `src/ai-providers/promptBuilder.ts` — threads `companionRecordsSteps(command)`. No change needed to the signal.
- `speckit-extension/scripts/write-context.py` — `--advance` verb + `STEP_COMPLETED_STATUS` map (read-only reference).
- `tests/unit/ai-providers/promptPreamble.spec.ts` — NEW test file (no existing coverage for these renderers).
- `docs/capture-and-timing.md` — extend the "Mode-aware self-close (#332)" section for the slim/full split.
- `CHANGELOG.md` — user-facing entry.
