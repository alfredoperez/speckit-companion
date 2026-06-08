# Lean-vs-Standard Bench

Run the **same feature** through both template profiles — **lean** (`companion-lean`) and **standard** (`companion-standard`) — at three sizes, and compare correctness and speed. You drive the pipeline by hand in VS Code (SpecKit Companion + speckit extension); two Claude Code slash commands handle setup and measurement.

The three sizes are graded by **scope against the app**:

| Size | Scope | This bench's feature |
|---|---|---|
| `easy` | update a route / title | rename the app title to "Task Manager" |
| `medium` | add a feature to the todos | due dates (input + overdue badge + sort) |
| `hard` | a whole new feature area | Tags (new `/tags` route + store slice + persistence + filter) |

The target app (`examples/todo-claude`) is layered on purpose — react-router routes, a `store/` slice with `localStorage` persistence, `lib/storage`, presentational `components/`, route `pages/`, and a committed test suite — so each size has real surface to attach to. See its `CLAUDE.md` for conventions.

## Where this runs (not a separate repo)

The bench lives **inside this repo** at `examples/todo-claude/` — it is **not** a separate repository. But you **open it as its own VS Code workspace**, because the spec-kit pipeline always operates on the workspace root that contains `.specify/`, and the sandbox has its own (`examples/todo-claude/.specify/`, distinct from the repo root's). Opening the whole `speckit-companion` repo would point the pipeline at the *extension's* `.specify/`, not the sandbox's.

Everything the bench generates is isolated and gitignored — its `node_modules`, `dist`, the `.specify/companion.yml` / `.specify/presets/` / `.specify/extensions/` install artifacts, and the per-run `.run-state.json`. Only the harness, prompts, oracle, and `stats.jsonl`/`REPORT.md` are committed. So nested-but-isolated gives you a real, buildable target co-located with the lean-mode code under test, without git churn. (If you ever want full git isolation, the same `bench/` tree drops into a standalone clone of just this folder — nothing here depends on the parent repo except the `speckit-extension/presets/` source that `/bench-prep` installs via `--dev`.)

## Setup (one-time)

```bash
cd examples/todo-claude
npm install
```

**Install the latest spec-kit extension** (the `companion` spec-kit extension — *not* the VS Code extension). This is what provides the `/speckit.companion.*` commands the lean runs use, and keeps them current with your local `speckit-extension/` source:

```bash
# from examples/todo-claude (the workspace the pipeline reads)
specify extension add ../../speckit-extension --dev --force
```

- `--dev` installs from the local directory (`speckit-extension/` in this repo, the source of truth); `--force` overwrites a prior install. It emits the companion commands into `.specify/extensions/companion/` (gitignored).
- **Re-run this whenever you change `speckit-extension/`** so the bench tests the latest. (`specify extension list` shows what's installed; details in [`speckit-extension/docs/install.md`](../../../speckit-extension/docs/install.md).)
- If `specify` lacks the `extension` subcommand (stock PyPI build), see that install doc — you need the spec-kit build that ships `specify extension`.

The **presets** (`companion-lean` / `companion-standard`) are installed automatically by `/bench-prep` (also `--dev`, from `speckit-extension/presets/`), so you don't install those by hand.

Finally, **open `examples/todo-claude` as the VS Code workspace** and set the SpecKit Companion provider to Claude.

## Each run (one size × one mode = one "cell")

1. **In Claude Code:** `/bench-prep easy lean` (it asks if you omit size/mode). This sets the sandbox `templateProfile`, reconciles the `companion-<mode>` preset (`--dev`), snapshots a git baseline into `.run-state.json`, and prints the **prompt to paste** + the **exact commands for that mode**.
2. **In VS Code:** run **specify → plan → tasks → implement** for that spec.
   - **lean** → use `/speckit.companion.*` (always lean), or stock `/speckit.*` (the `companion-lean` preset is active).
   - **standard** → use stock `/speckit.*` (the `companion-standard` preset is active). Never `/speckit.companion.*` — those are always lean.
3. **In Claude Code:** `/bench-finish`. It reads timing from the spec's `.spec-context.json`, runs `npm run build` + the size's acceptance suite, diffs the implementation, appends a row to `stats.jsonl`, and re-renders `REPORT.md`.
4. **Reset for the next cell:** `git restore examples/todo-claude/src && git clean -fd examples/todo-claude/specs` (drops the generated implementation + spec so the next mode starts clean). Then repeat for the other mode, then the other sizes.

Six cells total (3 sizes × 2 modes) fully populate `REPORT.md`.

## How "passes" is graded

`bench/acceptance/{size}.test.tsx` are the hidden grading key — RTL suites that render the real app and assert the user-visible affordances each prompt mandates (the `data-testid`s in `bench/prompts/{size}.md`). They are **not** part of `tsc`/`vite build` (tsconfig only includes `src/`), so they never block a build. "Passes" = build green **and** the size's acceptance suite green.

## How timing is measured

Straight from the run's `specs/<dir>/.spec-context.json` `history[]` — it timestamps every step (specify/plan/tasks/implement) regardless of who wrote it. `finish` derives total + per-step durations from those stamps.

## Files

| Path | What |
|---|---|
| `prompts/{easy,medium,hard}.md` | Paste-in feature text with baked-in required affordances |
| `acceptance/{easy,medium,hard}.test.tsx` | Correctness oracle (RTL); shared render helper in `acceptance/harness.tsx` |
| `prep.mjs` / `finish.mjs` | Arm a run / measure + report (called by the slash commands) |
| `lib.mjs` | Shared paths + helpers |
| `stats.jsonl` | Append-only ledger, one row per run (committed) |
| `REPORT.md` | Generated lean-vs-standard comparison |
| `.run-state.json` | Current armed run (gitignored) |

Don't hand-edit `stats.jsonl` or `REPORT.md` — they're generated.
