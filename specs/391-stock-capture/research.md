# Research: Stock-mode capture — bundled writer + enriched prompts

## Decision 1 — Ship the script by un-ignoring it, not by copying it

**Decision**: Add `!speckit-extension/scripts/write-context.py` to `.vscodeignore` so the packaged extension carries the actual source file at its existing relative path.
**Rationale**: `write-context.py` is a single stdlib-only file (verified: argparse/json/os/re/subprocess/pathlib only), so nothing else needs to ride along. A negation ships the source itself — byte-identical by construction (SC-003 is structural, not a build assertion), and the F5 development host resolves the same relative path because the dev extension root *is* the repo. A copy step would need build wiring plus a drift guard.
**Alternatives considered**: build-time copy into `assets/`/`dist/` — rejected (wiring + drift risk + a second path to reason about); committing a duplicate — rejected outright (two sources of truth).

## Decision 2 — Path lookup in the builder, path parameter in the preamble

**Decision**: `promptBuilder.ts` gains a `bundledWriterPath()` helper using `vscode.extensions.getExtension('alfredoperez.speckit-companion')?.extensionPath` joined to the script's relative path, falling back to the workspace-relative companion path when the lookup fails; the pure `promptPreamble.ts` functions take the writer path as a parameter.
**Rationale**: The preamble module is deliberately vscode-free (that's what makes it unit-testable); the builder is the existing impure seam. The extensions-API lookup works without an activation context. The fallback keeps behavior identical to today in the pathological case where the extension can't see itself.
**Alternatives considered**: threading `ExtensionContext` — rejected, the builder has no context and the API lookup is equivalent; module-level mutable path set at activation — rejected, hidden state complicates tests.

## Decision 3 — Always the bundled path in stock mode, even when the companion extension is installed

**Decision**: Stock-mode preambles reference only the bundled writer; the workspace companion path disappears from stock output entirely.
**Rationale**: One code path, one contract (SC-001's "zero workspace references" becomes a trivial assertion). The two scripts are the same file by construction when the spec-kit extension is current, and the writer operates on the workspace's context file regardless of where the script itself lives.
**Alternatives considered**: prefer the workspace copy when present — rejected: two branches to test for no behavioral gain, and a stale workspace copy would silently win over the shipped one.

## Decision 4 — Compact capture block, script-flag form, per step

**Decision**: The stock capture additions reuse the writer's existing flags verbatim (`--set intent=…`, `--expectation`, `--context`, `--coverage-req … --title`, `--set approach=…`, `--decision`, `--verified`, `--coverage-req … --tests`, `--step-summary`), grouped as a short per-step block (~10 lines) inside the existing stock preamble, marked best-effort (skip silently if python3 is unavailable).
**Rationale**: The flags are the same protocol the companion command bodies teach, so the Activity panel needs zero changes and the capture semantics (de-dupe, additive, atomic) come free. Best-effort keeps the no-python degradation identical to today.
**Alternatives considered**: teaching hand-authored JSON for these fields — rejected, hand-edits are the established corruption vector; a single "capture everything at the end" block — rejected, the fields belong to specific steps and end-batching loses the specify-time requirement titles.

## Decision 5 — Eval drives a real headless AI against the forced preamble, outside jest

**Decision**: `tests/eval/stock-capture/run.mjs` scaffolds a temp companion-free sandbox (git init, `specs/`, minimal `.specify/` marker), composes the exact preamble `renderLifecyclePreamble`/`renderPreamble` would emit (compiled output, stock branch, bundled path pointed at this repo's script), prepends it to a small feature instruction, runs a headless AI CLI in the sandbox, then `assert_capture.py` checks the produced `.spec-context.json` (status advanced, intent/expectations/context present, requirements titled, tasks journaled, ≥1 verified).
**Rationale**: The bug shipped because nothing exercised the stock path end-to-end; asserting on the *produced file* after a real model follows the *real text* is the only honest test. Outside jest because it shells out to an AI CLI and takes minutes.
**Alternatives considered**: snapshot-testing the preamble text only — kept (as unit tests) but insufficient alone, it can't catch instructions a model misreads; a full stock spec-kit `specify init` sandbox — rejected for the harness (heavy, tests spec-kit's own templates rather than the preamble; the preamble contract is dispatcher-side).
