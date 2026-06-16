# Faithful Bench (2 modes · 3 sizes)

Run the **same feature** two ways — plain upstream spec-kit (**speckit**) vs the SpecKit Companion pipeline (**companion**) — at three sizes, and compare correctness, speed, artifacts/ceremony, lifecycle-capture fidelity, and an **Overall health composite**. You build each cell through the real SpecKit Companion extension in VS Code; the harness then judges, scores, and records it.

## What this bench is for (read this first)

Agents run far faster than an interactive GUI session. The original human GUI runs (2026-06-10) took roughly 10–28 minutes per feature; an agent runs the same feature in about 4–6 minutes. So the bench's **absolute wall-clock will not match a human GUI run**, and chasing that match is futile — a faster machine and a faster agent will always pull the numbers apart.

What the faithful bench actually delivers is two things you *can* trust:

1. **A trustworthy relative comparison** — stock vs companion, run identically (same dispatch preamble, same settle-wait), so any per-step delta between the two is attributable to the workflow, not to harness drift.
2. **Isolated capture overhead** — a separate row that reports the time spent journaling (`write-context`), so the speed comparison is work-time, not work-time-plus-the-capture-tax.

For the absolute yardstick — "how long does this feel in my editor?" — your own GUI runs are the source of truth. The bench answers "is companion faster or slower than stock, and how much does capture cost?", not "how many minutes will a human wait?".

## Quick start (TL;DR)

Three slash commands, one size at a time (`easy` | `medium` | `hard`):

```
/bench-sync                  # ONCE (or when spec-kit / speckit-extension / presets change):
                             #   re-bakes the 2 sandbox folders with the real installers.

/bench-prep <size>           # arms + resets the 2 folders, opens a VS Code window per folder,
                             #   and prints the ONE prompt to paste into both.

#   → in EACH window: paste the printed prompt, set provider = Claude, then run
#     specify → plan → tasks → implement.
#     speckit   → stock /speckit.*
#     companion → /speckit.companion.*

/bench-capture <size>        # judges + comparative review + measures + scores + records
                             #   + regenerates REPORT.md, then resets the folders.
```

That's the whole loop. Results land in `REPORT.md` (+ committed `stats.jsonl` / `history.jsonl` / `reviews/`). Everything below explains what each step does. First time on a fresh machine, run `/bench-sync` once first.

## The 2 modes

| Mode | What it is | Commands | Capture |
|---|---|---|---|
| `speckit` | plain upstream spec-kit, no companion | stock `/speckit.*` | none — blind control |
| `companion` | the SpecKit Companion pipeline | `/speckit.companion.*` | hooks + command bodies → `.spec-context.json` |

Post-#312 the pipeline consolidated to exactly these two workflows — the old `companion-logs` / `companion-standard` / `companion-turbo` / `companion-fast-path` rungs no longer exist as products, so the bench no longer generates them (it still *reads* any legacy rows already in `stats.jsonl` / `history.jsonl` without crashing — they just stop being produced). The two modes differ **only in the command family**; both receive the identical per-step GUI dispatch preamble (see *Faithful dispatch* below), so a per-step delta between them is attributable to the workflow. The MODES list lives in `lib.mjs`.

## The 3 sizes (graded by scope against the app)

| Size | Scope | This bench's feature |
|---|---|---|
| `easy` | update a route / title | rename the app title to "Task Manager" |
| `medium` | add a feature to the todos | due dates (input + overdue badge + sort) |
| `hard` | a whole new feature area | Tags (new `/tags` route + store slice + persistence + filter) |

The target app (`examples/todo-claude`) is layered on purpose — react-router routes, a `store/` slice with `localStorage` persistence, `lib/storage`, presentational `components/`, route `pages/`, and a committed test suite — so each size has real surface to attach to. See its `CLAUDE.md` for conventions.

## Faithful dispatch (the #325 fix)

The bench's whole point is to dispatch the way the GUI does. Two rules make it a faithful proxy instead of a misleading one:

**1. Prepend the same preamble — for both modes.** The GUI prepends a per-step capture/timing preamble to every command it dispatches (`src/ai-providers/promptBuilder.ts`). An agent driver must do the same. The pure renderers were extracted into `src/ai-providers/promptPreamble.ts` (vscode-free) so the bench can import the *compiled* version and never drift from the real dispatch path. `bench/driver.mjs` wraps them:

```js
import { buildStepPreamble, waitForSettle } from './driver.mjs'

// compile the extension once at the repo root so dist/ exists:  npm run compile
const dispatchUtc = new Date().toISOString()
const preamble = await buildStepPreamble('plan', specDir, dispatchUtc) // SAME for both modes
// dispatch:  `${preamble}\n\n${command}`   ← command is the ONLY thing that differs:
//   speckit   → /speckit.plan
//   companion → /speckit.companion.plan
```

Stock and companion get byte-identical preambles; only the command family differs, exactly like the GUI.

**2. Wait for the step to settle — don't fire capture synchronously.** After dispatching a step, block until the cell's `.spec-context.json` reaches that step's completed-form status (`specified` / `planned` / `ready-to-implement` / `implemented`) — the same settle signal the GUI's file watchers wait on — before advancing:

```js
const res = await waitForSettle(cellDir, 'plan', /* timeoutMs */ 600000)
if (!res.settled) console.warn(`plan never settled (status=${res.status})`)
```

`waitForSettle` lives in `lib.mjs` and has unit coverage in `bench/waitForSettle.test.mjs` (run `node --test examples/todo-claude/bench/waitForSettle.test.mjs` — no AI needed).

**3. Track capture time as its own line.** As the driver runs `cap.mjs` / `write-context.py`, accumulate the wall-time spent inside those calls and write it to the cell's `.run-meta.json` as `captureOverheadSec`. `capture` surfaces it on the row and report as the **Capture overhead** line, separate from work time. `speckit` has no capture, so its overhead is `—`.

The old drivers did **neither** of the first two — they followed raw command bodies and fired capture synchronously, which counted capture overhead as work time (companion looked ~30% slower) and let stock "complete" for the agent even though the GUI gets stuck (the #324 stock-settle bug). See `docs/capture-and-timing.md` for the settle model.

## Run-in-folders model (no copies)

The two folders `examples/bench-sandboxes/todo-{speckit,companion}/` **are** the run folders — you open each as its own VS Code window and build the feature in place. They are gitignored, each is its **own git repo** (so the capture writer's `git rev-parse --show-toplevel` resolves to the folder, not the parent), and they're baked by `bench/sync-templates.mjs` via the **real installers** (`specify init` + `specify extension add` + preset + profile). The diff baseline is the canonical `examples/todo-claude/src`.

You must open each folder as its own VS Code workspace, because the spec-kit pipeline operates on the workspace root that contains `.specify/`. Opening the whole `speckit-companion` repo would point the pipeline at the *extension's* `.specify/`, not the sandbox's.

## How to run it

Three slash commands, one size at a time:

1. **`/bench-sync`** *(occasional)* — pull latest spec-kit + `speckit-extension`, then `node bench/sync-templates.mjs` re-bakes both folders with the real installers. Re-run whenever the app, `speckit-extension/`, or the presets change.
2. **`/bench-prep <size>`** — `node bench/run-all.mjs prep --size <size>` resets each folder to pristine (restores `src/` + `index.html` from the canonical app, clears `specs/`), writes a `.run-meta.json` marker, **prints the paste-able prompt**, and **opens both folders in VS Code** (`code -n` per folder; `--no-open` to skip).
3. Build the feature in each window through the extension: **specify → plan → tasks → implement** (Companion provider = Claude). `speckit` uses stock `/speckit.*`; `companion` uses `/speckit.companion.*`.
4. **`/bench-capture <size>`** — spawns rubric judges + one cross-solution **comparative reviewer**, then `node bench/run-all.mjs capture --size <size>` measures every signal, computes the Overall composite, records it, regenerates `REPORT.md`, and resets the folders.

`/bench-run-all <size>` is the agent-driven automation of the same loop (drives the folders headlessly via Workflow agents instead of you in VS Code) — it uses `bench/driver.mjs` for faithful per-step dispatch + settle-waits.

## What gets measured

Per cell: `npm run build` · the **behavioral oracle** (`behavioral-judge.mjs`, with the testid suite as a labeled baseline) · the **full regression suite** (`src/**`) · convention + blast-radius checks · the **capture eval** (`check_capture.py`, skipped for `speckit`) · an independent **rubric** (readability/conventions/scope) · artifact shape (spec/plan/tasks lines, **total artifact lines across all files**, task count, side files) · diff size · **capture overhead** (time journaling, companion only) · and the **comparative review** (`reviews/<size>.md`).

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

Correctness is graded on **behavior**, not on exact `data-testid`s. The prompts (`prompts/{size}.md`) describe what a user can see and do — they no longer spell out test ids, which was both hinting the model and fighting the app's own role/text-query convention. We don't grade architecture; we grade "does the feature work."

The primary grader is the **behavioral judge** (`behavioral-judge.mjs`): it pulls the spec's own acceptance scenarios (the Given/When/Then lines), hands them plus the changed source to an LLM judge, and gets back a per-scenario pass/fail verdict that ignores wiring and naming. The judge command is configurable via `BENCH_JUDGE_CMD` (default `claude -p`); with no judge available it returns nothing and the cell falls back to the deterministic baseline. "Passes" = build green **and** the behavioral verdict green.

The old testid suites (`acceptance/{size}.test.tsx`) are kept as a **labeled baseline** only (`deterministicBaseline` in each stats row) — useful as a sanity check, but no longer the score driver, since the prompts intentionally don't reveal the ids they assert. Each cell records which grader was primary (`acceptanceSource: behavioral | deterministic`). The suites are still **not** part of `tsc`/`vite build`, so they never block a build.

**The oracle is never baked into a cell.** A baked cell's `bench/` is stripped down to just `vitest.setup.ts` (the bake does this), so the implementing model can't browse `acceptance/`, `prompts/`, or past `stats.jsonl` and code to the hidden grade. At scoring time `runAcceptance` copies the size's `acceptance/<size>.test.tsx` + `harness.tsx` from the **source** bench dir into the cell, runs it (vitest runs an explicit positional path even when it isn't in the cell's `include`), then removes it — so the deterministic baseline still works without the cell ever carrying the oracle between runs.

## How timing is measured

Straight from the run's `specs/<dir>/.spec-context.json` `history[]` — it timestamps every step regardless of who wrote it. `capture` derives total + per-step durations from those stamps, and the driver-tracked `captureOverheadSec` (time spent journaling) is reported as its own line so work-time and capture-tax don't blur. `speckit` isn't graded for capture fidelity (no companion install), but the always-on VS Code extension may still write a `.spec-context.json`, so a speckit cell can carry partial per-step timing — just don't treat it as a clean control.

## History is durable — diff it later

Committed and **never deleted**, so any future build can compare against today:

| Path | What |
|---|---|
| `prompts/{easy,medium,hard}.md` | Paste-in feature text — user-visible behavior only, no testid hints |
| `behavioral-judge.mjs` | Primary correctness oracle — judges the spec's acceptance scenarios against the built source (behavior, not testids); `BENCH_JUDGE_CMD` |
| `acceptance/{easy,medium,hard}.test.tsx` | Deterministic testid baseline (RTL), kept for sanity; shared render helper in `acceptance/harness.tsx` |
| `lib.mjs` / `run-all.mjs` / `sync-templates.mjs` | Harness: helpers · prep/capture engine · folder baker |
| `driver.mjs` | Faithful per-step dispatch (GUI preamble + settle-wait) for agent drivers |
| `waitForSettle.test.mjs` | Unit test for the settle-wait (`node --test`) |
| `cap.mjs` | Terse wrapper over `write-context.py` (companion capture) |
| `stats.jsonl` | Latest row per cell (deduped) — the current `REPORT.md` source |
| `history.jsonl` | **Append-only** — every run forever; powers `· vs last run` |
| `REPORT.md` | Generated 2-column comparison (incl. Overall + Capture overhead) |
| `runs/<runId>.json` | Per-run snapshots |
| `reviews/<size>.md` | Comparative reviewer output, prepended per run |
| `reports/*.html` | Committed copies of the HTML briefs |

Don't hand-edit `stats.jsonl`, `history.jsonl`, or `REPORT.md` — they're generated. The folders' `node_modules`/`dist`/`.specify` install artifacts are gitignored.
