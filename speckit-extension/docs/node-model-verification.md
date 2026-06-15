# #317 verification findings

What was checked before shipping the composable-command-nodes work, and what's left for a human to eyeball in VS Code.

## Deterministic checks (all green)

| Check | Result |
|-------|--------|
| `assemble-nodes.py --check` — every command re-assembles byte-identical to golden | PASS (4 commands) |
| `check-shape-parity.py` — part-fence region + golden parity | PASS (13 bodies) |
| `build-commands.py --check` — non-decomposed bodies still fill from parts | PASS (8 bodies) |
| Python unittest suite (`speckit-extension/tests`) | PASS (76 tests) |
| `npm run compile` (TypeScript) | PASS |
| `npm test` (Jest) | PASS (1008 tests, 84 suites) |
| Assembler writer is a no-op vs committed commands (nodes == committed) | PASS |

The merge contract (hook order, recipe override, `reads:` validation, failure table) and the auto-complete fix (`implementing`+100% → `completed`; last-task finish lands at `implemented`) are each covered by unit tests.

## Headless pipeline runs — the three spec sizes

Run by acting as the runtime against the assembled `speckit.companion.*` command bodies in a scratch workspace (no GUI), using the real `write-context.py`. This confirms the decomposed commands still drive the pipeline exactly as before.

- **Small** ("add a clear-completed button"): `specify` classified it *simple* and fast-pathed — wrote `spec.md` (with an Approach section), a pointer `plan.md`, and a real `tasks.md`, then folded plan+tasks in history and landed at **`ready-to-implement`**. A minimal `implement` journaled each task, auto-advanced to `implemented`, and `mark-complete` reached **`completed`**.
- **Normal** ("sort & filter todos"): `specify` printed the guardrail line and wrote **`spec.md` only** (no fold). `plan`, `tasks`, and `implement` then ran as separate commands, each producing its artifact; history was the full canonical sequence specify → plan → tasks → implement → completed.
- **Oversized** ("migrate the whole app to React"): `specify` printed the guardrail warning and wrote `spec.md` only; `classify` returns `size=oversized`, so the workflow routes to the oversized branch — a visible warning and the **full** pipeline **with review gates**. The self-advance prose stops at the first review gate (no auto-advance), which is the intended oversized behavior.

## Surprises found and fixed during verification

- The live per-task journal (`journal_task_finish`) advanced a 100%-done spec to `implemented` but didn't write the step-level implement *complete* that the `sync_tasks` backstop writes — so the two close paths could diverge. Fixed so the live path closes the step too (idempotent with the backstop).

## Manual verification — please eyeball in VS Code (GUI not broken)

These are the live-AI / GUI surfaces tests don't exercise:

1. **Footer dispatch** — open a spec in the viewer; confirm the footer shows the right next-step button for its state and that clicking it dispatches the correct `/speckit.companion.*` command. (The fix makes the footer resolve the spec's own workflow instead of always the default.)
2. **Auto-complete** — take a spec to 100% tasks and confirm it reaches **Completed** (status `completed`) without getting stuck at `implementing`.
3. **A real Companion run** — run a small spec end-to-end via the panel and confirm it reaches `completed`. The real e2e path is `examples/todo-claude/bench` / `/eval-speckit-extension`, not ad-hoc runs.

> Both the document scan and the footer-button derivation (`deriveViewerState` in `buildViewerPayload`) now resolve the spec's own workflow via `resolveWorkflowSteps`, falling back to the default pipeline only when none is set — so a workflow whose step *set* differs from the canonical pipeline drives the footer button correctly, not just the document scan.
