# Stock-capture eval — forced-preamble sandbox run

## What it proves

When the GUI dispatches a *stock* SpecKit command, it prepends context-update instructions. This eval proves those instructions actually work where they matter most: a workspace **without** the companion spec-kit extension. A real headless AI receives the exact preamble the extension would build (stock branch, writer pointed at the bundled script), runs a tiny specify→plan→tasks→implement pipeline in a throwaway sandbox, and the produced `.spec-context.json` is graded.

A passing run means a stock-workspace user gets a working lifecycle (status advances — no spec stuck at "specifying") and a populated Activity panel (intent, out-of-scope, context, titled requirements, journaled tasks, verified checks).

## How to run

```bash
npm run compile                      # the eval composes the preamble from dist/
node tests/eval/stock-capture/run.mjs        # add --keep to retain a passing sandbox
```

Prerequisites: `python3` and the `claude` CLI on PATH. The run takes a few minutes and burns real model tokens — it is deliberately **not** part of `npm test`. Re-run it whenever the stock preamble text changes (`src/ai-providers/promptPreamble.ts`).

## Under the hood

- `run.mjs` — scaffolds the sandbox (git init, `specs/`, a bare `.specify/` marker, **no** `extensions/companion`), composes `renderSpecifyCreationLifecyclePreamble(…, companionInstalled=false, writerPath=<repo's write-context.py>)` from the compiled output, prepends it to a 2-FR feature instruction, and drives `claude -p` headless in the sandbox.
- `assert_capture.py <feature-dir>` — exits non-zero unless: status advanced past `specifying`, `intent` non-empty, ≥1 expectation, ≥1 context entry, every coverage requirement titled, every journaled task has a summary, ≥1 verified check, and the history log is append-shaped.

On failure (or with `--keep`) the sandbox is retained and its path printed — the forced prompt is at `.eval-prompt.txt` and the model transcript at `.eval-transcript.txt`.
