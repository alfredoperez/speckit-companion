# Adoption-Ladder Bench (5 modes · 3 sizes)

Run the **same feature** through five workflow configurations — an *adoption ladder* where each rung adds exactly one thing — at three sizes, and compare correctness, speed, artifacts/ceremony, lifecycle-capture fidelity, and an **Overall health composite**. You build each cell through the real SpecKit Companion extension in VS Code; the harness then judges, scores, and records it.

## Quick start (TL;DR)

Three slash commands, one size at a time (`easy` | `medium` | `hard`):

```
/bench-sync                  # ONCE (or when spec-kit / speckit-extension / presets change):
                             #   re-bakes the 5 sandbox folders with the real installers.

/bench-prep <size>           # arms + resets the 5 folders, opens a VS Code window per folder,
                             #   and prints the ONE prompt to paste into all 5.

#   → in EACH window: paste the printed prompt, set provider = Claude, then run
#     specify → plan → tasks → implement.
#     speckit / companion-logs / companion-standard → stock /speckit.*
#     companion-turbo / companion-fast-path        → /speckit.companion.*

/bench-capture <size>        # judges + comparative review + measures + scores + records
                             #   + regenerates REPORT.md, then resets the folders.
```

That's the whole loop. Results land in `REPORT.md` (+ committed `stats.jsonl` / `history.jsonl` / `reviews/`). Everything below explains what each step does. First time on a fresh machine, run `/bench-sync` once first.

## The 5 modes (each rung adds one thing vs the prior)

| Mode | What it adds | Commands | Capture |
|---|---|---|---|
| `speckit` | plain upstream spec-kit, no companion | stock `/speckit.*` | none — blind |
| `companion-logs` | companion installed, profile `off` | same stock `/speckit.*` | hooks → `.spec-context.json` |
| `companion-standard` | `companion-standard` preset | stock `/speckit.*` shape + timing | capture |
| `companion-turbo` | `companion-turbo` preset, lean bodies | `/speckit.companion.*` | baked in |
| `companion-fast-path` | turbo **plus** `complexityFastPath` | `/speckit.companion.*` | baked in |

Adjacent pairs differ by ONE variable, so a metric delta between them is attributable. The MODES list lives in `lib.mjs`.

## The 3 sizes (graded by scope against the app)

| Size | Scope | This bench's feature |
|---|---|---|
| `easy` | update a route / title | rename the app title to "Task Manager" |
| `medium` | add a feature to the todos | due dates (input + overdue badge + sort) |
| `hard` | a whole new feature area | Tags (new `/tags` route + store slice + persistence + filter) |

The target app (`examples/todo-claude`) is layered on purpose — react-router routes, a `store/` slice with `localStorage` persistence, `lib/storage`, presentational `components/`, route `pages/`, and a committed test suite — so each size has real surface to attach to. See its `CLAUDE.md` for conventions.

## Run-in-folders model (no copies)

The five folders `examples/bench-sandboxes/todo-{speckit,companion-logs,companion-standard,companion-turbo,companion-fast-path}/` **are** the run folders — you open each as its own VS Code window and build the feature in place. They are gitignored, each is its **own git repo** (so the capture writer's `git rev-parse --show-toplevel` resolves to the folder, not the parent), and they're baked by `bench/sync-templates.mjs` via the **real installers** (`specify init` + `specify extension add` + preset + profile). The diff baseline is the canonical `examples/todo-claude/src`.

You must open each folder as its own VS Code workspace, because the spec-kit pipeline operates on the workspace root that contains `.specify/`. Opening the whole `speckit-companion` repo would point the pipeline at the *extension's* `.specify/`, not the sandbox's.

## How to run it

Three slash commands, one size at a time:

1. **`/bench-sync`** *(occasional)* — pull latest spec-kit + `speckit-extension`, then `node bench/sync-templates.mjs` re-bakes all five folders with the real installers. Re-run whenever the app, `speckit-extension/`, or the presets change.
2. **`/bench-prep <size>`** — `node bench/run-all.mjs prep --size <size>` resets each folder to pristine (restores `src/` + `index.html` from the canonical app, clears `specs/`), writes a `.run-meta.json` marker, **prints the paste-able prompt**, and **opens all five folders in VS Code** (`code -n` per folder; `--no-open` to skip).
3. Build the feature in each window through the extension: **specify → plan → tasks → implement** (Companion provider = Claude). `speckit`/`logs`/`standard` use stock `/speckit.*`; `turbo`/`fast-path` use `/speckit.companion.*`.
4. **`/bench-capture <size>`** — spawns 5 independent rubric judges + one cross-solution **comparative reviewer**, then `node bench/run-all.mjs capture --size <size>` measures every signal, computes the Overall composite, records it, regenerates `REPORT.md`, and resets the folders.

`/bench-run-all <size>` is the agent-driven automation of the same loop (drives the folders headlessly via Workflow agents instead of you in VS Code).

## What gets measured

Per cell: `npm run build` · the hidden **acceptance oracle** (`acceptance/<size>.test.tsx`) · the **full regression suite** (`src/**`) · convention + blast-radius checks · the **capture eval** (`check_capture.py`, skipped for `speckit`) · an independent **rubric** (readability/conventions/scope) · artifact shape (spec/plan/tasks lines, **total artifact lines across all files**, task count, side files) · diff size · and the **comparative review** (`reviews/<size>.md`).

### Overall health composite

A 0–100 score per cell so runs are comparable over time:

```
composite = round( 45·correctness + 30·rubric + 25·capture )
  correctness = (build?1:0) × accept_ratio × regress_ratio
  rubric      = (readability + conventions + scope) / 15
  capture     = companion → pass/(pass+fail);  speckit → 0 (blind is the point)
```

It is **cohort-independent** on purpose — a cell's score only moves when its own correctness, quality, or visibility moves, so a drop between runs is a real regression signal. Ceremony/efficiency stays in its own rows (it would wobble per cohort). The report shows it with two axes: **· vs speckit** (the companion value-add — an all-green speckit cell tops out at 75, a captured companion cell reaches 100) and **· vs last run** (the trend; renders `—` until a second run exists).

## How "passes" is graded

`acceptance/{size}.test.tsx` are the hidden grading key — RTL suites that render the real app and assert the user-visible affordances each prompt mandates (the `data-testid`s in `prompts/{size}.md`). They are **not** part of `tsc`/`vite build` (tsconfig only includes `src/`), so they never block a build. "Passes" = build green **and** the size's acceptance suite green.

## How timing is measured

Straight from the run's `specs/<dir>/.spec-context.json` `history[]` — it timestamps every step regardless of who wrote it. `capture` derives total + per-step durations from those stamps. `speckit` is blind, so it has no per-step timeline.

## History is durable — diff it later

Committed and **never deleted**, so any future build can compare against today:

| Path | What |
|---|---|
| `prompts/{easy,medium,hard}.md` | Paste-in feature text with baked-in required affordances |
| `acceptance/{easy,medium,hard}.test.tsx` | Correctness oracle (RTL); shared render helper in `acceptance/harness.tsx` |
| `lib.mjs` / `run-all.mjs` / `sync-templates.mjs` | Harness: helpers · prep/capture engine · folder baker |
| `cap.mjs` | Terse wrapper over `write-context.py` (companion capture) |
| `stats.jsonl` | Latest row per cell (deduped) — the current `REPORT.md` source |
| `history.jsonl` | **Append-only** — every run forever; powers `· vs last run` |
| `REPORT.md` | Generated 5-column comparison (incl. Overall) |
| `runs/<runId>.json` | Per-run snapshots |
| `reviews/<size>.md` | Comparative reviewer output, prepended per run |
| `reports/*.html` | Committed copies of the HTML briefs |

Don't hand-edit `stats.jsonl`, `history.jsonl`, or `REPORT.md` — they're generated. The folders' `node_modules`/`dist`/`.specify` install artifacts are gitignored.
