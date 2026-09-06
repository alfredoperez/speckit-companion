# Examples and sandboxes

Three kinds of folder are involved, and the difference is whether git tracks them and which repository they belong to.

## Fixtures — committed here, read-only

`examples/todo-*` are baked projects the tests and the docs read from. Each is one provider or one storage layout of the same small todo app, so a screenshot or a manual check has something real to point at. Treat them as fixtures: do not run a spec through one in place.

| Folder | What it is |
|---|---|
| `todo-claude/` | The canonical app, and the one the docs' screenshots come from |
| `todo-copilot/`, `todo-gemini/` | The same app set up for other providers |
| `todo-living-central/`, `todo-living-colocated/` | The two living-spec storage layouts |
| `todo-gsd-superpowers/`, `todo-matt-skills/` | Skill-pack comparison fixtures, slated to move to the workflow builder |
| `todo-claude/bench/living-specs/` | The living-spec correctness matrix (`ls-r3.mjs`) — evidence that the resolver, drift, fold-back and coverage behave |

The spec-kit extension keeps its own example at `speckit-extension/examples/ship-ticket/` — five real node files and two configs, the ship-tail a project can copy.

## The benchmark — two sibling repositories

The stock-vs-Companion benchmark used to live in `examples/todo-claude/bench/`, with its cells under `examples/bench-sandboxes/` and its results committed here. Twice that put a bench round inside an unrelated product commit. It now lives outside this repository entirely.

| Repository | What it holds |
|---|---|
| [`speckit-bench`](https://github.com/alfredoperez/speckit-bench) | The harness: scripts, app configs, prompts, acceptance oracles, living-spec fixtures, and every result (`stats.jsonl`, `history.jsonl`, `runs/`, `reviews/`, `REPORT.md`) |
| [`conduit`](https://github.com/alfredoperez/conduit) | The app it measures: the RealWorld reference client in React with Feature-Sliced Design, vendored from `yurisldk/realworld-react-fsd` at `v1.2.1` |

Clone both next to this one and nothing needs configuring:

```
~/dev/GitHub/speckit-companion   ← you are here
~/dev/GitHub/speckit-bench
```

The `/bench-sync` → `/bench-prep` → `/bench-capture` commands in this repo drive the harness there. Override `COMPANION_DIR`, `BENCH_APP_DIR` or `BENCH_CELLS_DIR` (environment or `speckit-bench/bench.config.json`) if your layout differs.

### The cells

A round runs three arms per size — stock spec-kit, Companion, and Companion starting from adopted living specs — across four sizes, so twelve cells:

```
~/dev/projects/.conduit                 the app clone, `yarn install`ed once per laptop
~/dev/projects/conduit-easy-{a,b,c}
~/dev/projects/conduit-medium-{a,b,c}
~/dev/projects/conduit-hard-{a,b,c}
~/dev/projects/conduit-oversized-{a,b,c}
```

Each cell is a copy-on-write reflink of the clone — `node_modules` included, so a full bake takes seconds and installs nothing.

**The letter is opaque on purpose.** An agent working a cell reads its own path in every prompt, and `conduit-medium-companion` would tell it which side of the comparison it is on. Which letter carries which arm is shuffled at bake time and recorded in `speckit-bench/cells.json`, harness-side. To see the mapping:

```bash
node ../speckit-bench/run-all.mjs --dry-run
```

That also prints the three versions the round was baked with — the spec-kit CLI, the spec-kit extension, and the Companion extension — and every result row carries all three.

A bake fails loudly if any file in a cell mentions the bench, so a leak is caught before a round runs rather than after it is measured.

### Re-pointing a cell at a different extension

The bake takes `--ext latest` (the rolling `companion-latest` release asset, the default), `--ext code` (this checkout's `speckit-extension/`, for measuring unreleased work), or `--ext <tag>` (an archived release), and `--speckit latest|keep` for the CLI. Re-bake rather than editing a cell by hand:

```bash
node ../speckit-bench/sync-templates.mjs --sizes easy,medium,hard,oversized --ext code
```

## Sandboxes — gitignored, yours to break

`examples/bench-sandboxes/` is the one place inside this repository a throwaway project goes. Everything in it is gitignored, and each folder is its **own git repo** so the capture writer resolves the sandbox as the project root rather than this repository. Open a sandbox as its own VS Code window; opening the whole repository points the pipeline at the extension's `.specify/`, not the sandbox's.

| Folder | For | Made by |
|---|---|---|
| `bench-sandboxes/ls-*` | Living-spec correctness cells | `todo-claude/bench/living-specs/ls-r3.mjs` |
| `bench-sandboxes/582-fresh-install/` | A fresh `specify init` with nothing else, for install-path bugs | by hand |
| `bench-sandboxes/builder-qa/` | The pipeline builder's manual test plan — hook fixtures and two run prompts are already in it | by hand; the recipe is in `RUNS.md` inside it |

A sandbox points at whichever extension source it was installed from. After a branch merges, re-point it:

```bash
cd examples/bench-sandboxes/<name>
specify extension add ../../../speckit-extension --dev --force
```

**Do not make a project sandbox anywhere else.** Bench cells go under `~/dev/projects/` and nowhere else; everything else goes in `examples/bench-sandboxes/`. Four earlier one-offs — `~/dev/GitHub/speckit-status-sandbox`, `~/dev/stock-capture-sandbox`, `~/dev/GitHub/sandbox/speckit`, `~/dev/GitHub/sandbox/custom-ai-workflow-demo` — are the reason this file exists.
