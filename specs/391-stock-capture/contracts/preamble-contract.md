# Contract: stock-mode preamble

The identifiers tests and the eval code against.

## Writer reference

- Source of truth (verbatim from the spec): `speckit-extension/scripts/write-context.py`.
- Packaged location: same relative path inside the extension install dir (shipped via a `.vscodeignore` negation `!speckit-extension/scripts/write-context.py`).
- Rendered form in stock preambles: `python3 "<abs-extension-path>/speckit-extension/scripts/write-context.py" …` — always double-quoted.
- The string `.specify/extensions/companion/scripts/write-context.py` MUST NOT appear in stock preamble output (unit-asserted), except as the fallback value when the extension cannot resolve its own install path.

## Stock capture block — flags per step (all best-effort, skip silently without python3)

| Step | Instructed writer calls |
|---|---|
| specify (and creation lifecycle) | `--set intent="…"` · `--expectation "…"` (per non-goal) · `--context "…"` (per context entry) · `--coverage-req FR-NNN --title "…"` (per requirement, at drafting time) |
| plan | `--set approach="…"` · `--decision '{"decision","why","rejected"}'` (per genuine choice) · `--step-summary` |
| tasks | `--coverage-req FR-NNN --tasks "T…"` (per requirement) · `--step-summary` |
| implement | existing per-task finish call (now bundled path) · `--verified '{"what","command","result","warnings"}'` (per real check) · `--coverage-req FR-NNN --tests "…"` (per covered requirement) · `--step-summary` |

Companion-mode slim preambles: byte-identical to today (unit-asserted).

## Eval surface

- `tests/eval/stock-capture/run.mjs` — scaffolds the sandbox, composes the forced preamble from the compiled builders (stock branch), runs the headless AI, invokes the asserter.
- `tests/eval/stock-capture/assert_capture.py` — exits non-zero unless: status advanced past `specifying`, `intent` non-empty, `expectations` ≥ 1, `context` ≥ 1, every `coverage` entry titled, every task journaled in `task_summaries`, `verified` ≥ 1.
