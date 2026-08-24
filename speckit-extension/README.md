<p align="center">
  <img src="https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/speckit-extension/assets/hero.jpg" alt="SpecKit Companion spec-kit extension" width="100%">
</p>

<h1 align="center">SpecKit Companion: the Spec Kit Extension</h1>

<p align="center">
  <strong>Everything your AI does in a spec run, recorded as it happens.</strong> This is the Spec Kit side of <a href="https://marketplace.visualstudio.com/items?itemName=alfredoperez.speckit-companion">SpecKit Companion</a>: it runs inside <a href="https://github.com/github/spec-kit">Spec Kit</a> and writes every step of your spec-driven runs into <code>.spec-context.json</code>, the plain file that powers live progress, a full run history, and one-command resume.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/extension-companion-0b6dd9" alt="extension: companion">
  <img src="https://img.shields.io/badge/version-0.20.2-0b6dd9" alt="version 0.20.2">
  <img src="https://img.shields.io/badge/spec--kit-%E2%89%A50.9.5-008080" alt="requires spec-kit >= 0.9.5">
  <img src="https://img.shields.io/badge/license-MIT-gold" alt="license MIT">
</p>

```bash
# Install and update (same command: the URL always serves the newest build)
specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip --force
```

> Tags: `#spec-driven-development` `#tracking` `#companion` · Independently maintained.

---

## The engine half: pair it with the free visual workspace

SpecKit Companion is two halves. This extension is the engine: it rides your Spec Kit runs and records everything that happens. The other half is a **free VS Code extension** that turns everything the engine records into a visual workspace: a sidebar that shows where every feature stands, specs rendered as readable documents with pull-request-style review comments, a live view of the run while it happens, and an Overview that keeps the record of what the AI actually did and why.

<!-- These screenshots live in the ROOT repo at docs/screenshots/generated/. The raw URLs resolve once the docs/readme-rewrite branch merges to main. -->
![A spec rendered as a structured page in the VS Code extension: requirements as labeled rows, the pipeline rail, and on-page navigation](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/generated/spec-viewer.png)

![The Overview in the VS Code extension: run status with honest per-phase timing, task and coverage counts, and the plan's intent](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/generated/overview-annotated.png)

The two halves install independently and meet in one file. This extension **writes** the canonical `.spec-context.json`; the VS Code extension **reads** it. The JSON is useful to any tool on its own, but it is built to feed that GUI:

```bash
code --install-extension alfredoperez.speckit-companion   # the GUI (VS Code Marketplace / OpenVSX)
specify extension add companion --from <release-url>      # this extension (Spec Kit side)
```

It works wherever Spec Kit runs (Claude Code, Copilot, Cursor, Gemini, and more), and it is careful by design: writes are atomic, preserve unknown fields, never regress a shipped spec, and never fail your Spec Kit command. Stdlib-only Python; capture degrades gracefully when `python3` is absent.

## What you get

1. **[See every run without changing how you work](#see-every-run-without-changing-how-you-work)**: install it, change nothing, and your existing `/speckit.*` commands light up the GUI.
2. **[Pick up where you left off](#pick-up-where-you-left-off)**: one command shows where every run stands, one continues it.
3. **[Hand it a feature and let it run](#hand-it-a-feature-and-let-it-run)**: a leaner pipeline with review gates, an unattended mode, and ceremony sized to the change.
4. **[Living specs](#living-specs-documentation-that-keeps-up-with-your-code-opt-in)**: durable per-capability docs that stay current as the code evolves, with drift detection and one-pass sync.

## See every run without changing how you work

Install it and change nothing else. The extension rides your *existing* Spec Kit commands through lifecycle hooks, the small scripts Spec Kit runs after each command finishes. Each step (specify, plan, tasks, implement) is recorded as it happens, implement journals every task as it completes, and each step also records *why*: the goal and out-of-scope fence at specify, decisions with rejected alternatives at plan, requirement-to-task coverage at tasks, and what was verified at implement. Resume, handoff, and audit read the reasoning, not just the timeline.

It also **never lies about state**. When a hook didn't fire (a skipped command, an out-of-band run, a project that never had the extension), `derive-from-files.py` reconstructs the state from the artifacts on disk, so the GUI reflects reality, not a half-truth.

<!-- TODO(alfredo): the per-task history / traceability presentation is awaiting Alfredo's design pass. Do not redesign how it is presented (here or in the docs) until that lands; this table row keeps only the benefit-led naming treatment. -->

| What you get | Stock Spec Kit | + SpecKit Companion |
|---|:---:|:---:|
| The spec-driven pipeline itself (`specify` → `plan` → `tasks` → `implement`) | ✅ | ✅ |
| Works with the AI assistants you already use (Claude, Copilot, Cursor, Gemini, …) | ✅ | ✅ |
| Live progress in the VS Code sidebar while a run happens | ❌ | ✅ |
| A history of every task the AI completed, kept per task | ❌ | ✅ |
| Pick up where you left off (`status` shows the run, `resume` continues it) | ❌ | ✅ |
| Leaner specs that skip sections a typical change never needs | ❌ | ✅ |
| Ceremony sized to the change: small ones take a shorter path | ❌ | ✅ |
| An accurate picture even when a step ran outside the hooks | ❌ | ✅ |

## Pick up where you left off

A run you stepped away from is not lost, because its state lives in a committed file, not in a chat scrollback. `/speckit.companion.status` prints where the active spec stands: the current step, its status, the decisions recorded so far, and the next action. `/speckit.companion.resume` continues from exactly that point with those decisions in scope, and inside implement it restarts at the next unchecked task. Close the laptop mid-run, or hand the branch to a teammate; either way the next session starts where the last one stopped.

## Hand it a feature and let it run

Beyond tracking, the extension ships its own **leaner pipeline**: `/speckit.companion.specify · plan · tasks · implement`. Same four steps, smaller output: the specs it writes skip sections a typical change never needs (formal user stories among them), order tasks by the files they touch and what depends on what, and leave no throwaway side files. The stock `/speckit.*` commands stay installed unchanged; the two families coexist, and installing one never deletes the other. A run also finishes itself: capture records each step and task as it lands, and a terminal **mark-complete** step moves a finished run into Completed on its own.

### Skip the ceremony when the change is small

Not every change deserves four documents. After specify, the change is sized `small`, `normal`, or `oversized` against a fixed bar (about five files or ten tasks). A small change takes a folded path: one lean specify pass that carries the plan inline, then straight to implement. An oversized one gets a visible warning and then the full pipeline. Nothing is ever skipped silently, and an ambiguous size always runs every phase.

```mermaid
flowchart LR
    A[your change] --> B{sized how?}
    B -->|small| C[lean spec, then implement]
    B -->|normal| D[the full pipeline]
    B -->|oversized| E[warn first, then the full pipeline]
```

### Or run the whole thing unattended

`/speckit.companion.auto "what you want built"` runs the entire pipeline with no approval pauses: specify, plan, tasks, implement, completion. It sets an `unattended` signal that project checkpoint hooks can read (record the checkpoint and keep going instead of waiting for a human). On a plain one-shot terminal it gracefully falls back: the first step runs, then you trigger the rest as usual.

### Or let Spec Kit drive it, with checkpoints

The pipeline also ships as a Spec Kit **workflow definition**: a file that tells the Spec Kit engine which step follows which, and where to stop for you. Run it and the engine drives the whole spec end to end, pausing at two review gates (one before plan, one before tasks) so you approve the direction before the detail:

```mermaid
flowchart LR
    S[specify] --> G1{review gate} --> P[plan] --> G2{review gate} --> T[tasks] --> I[implement] --> M[mark complete]
```

```bash
specify workflow add speckit-extension/workflows/speckit-companion.workflow.yml
specify workflow run speckit-companion
specify workflow resume <run_id>   # paused at a gate? pick up from the exact node
```

On an agentic CLI each Companion command also continues into the next step on its own, honoring the same gates, so you get the hands-off flow without `workflow run`. Full reference: [template-profiles.md](../docs/template-profiles.md).

## Living specs: documentation that keeps up with your code (opt-in)

Most specs describe one change and then go quiet. **Living specs** are the opposite: one durable spec per *capability* (checkout, auth, billing) that stays current as the code evolves. You register capabilities in a `living-specs.yml` at the project root, mapping file globs to spec files, and Companion does the rest:

- **Auto-loading**: starting a feature loads the living specs of the capabilities it touches into the assistant's context before it drafts, so you stop re-explaining the codebase.
- **Folding**: completing a feature folds its delta sections back into each affected capability's spec. The feature spec was the proposal; the living spec becomes the record, reviewed in the same PR as the code.
- **Adoption**: `/speckit.companion.living-adopt` drafts first-pass specs for an existing code area, surface-first and honestly marked (`[DRAFT]`, `inferred` tags, an `Uncovered` list).
- **Drift and sync**: `/speckit.companion.living-drift` reports which files changed since a spec was last committed; `/speckit.companion.living-sync` updates every affected spec from your current changes in one pass, uncommitted work included, update-not-regenerate.
- **Coverage**: `/speckit.companion.living-coverage` reports which requirements have a mapped test.

The loop that keeps a spec honest:

```mermaid
flowchart LR
    A[code moves on] --> B[drift flags the gap] --> C[sync updates the spec] --> D[spec matches code] --> A
```

The whole family is **opt-in** (no `living-specs.yml`, no behavior change), its writes are **append-only** and preserve what you wrote, and it **never fails** your run: drift and coverage are read-only reports, and sync leaves its edits uncommitted so they ship with the code that caused them.

Full reference, including the registry format, the resolver, delta sections, and the architecture/coverage tiers: [living-specs.md](./docs/living-specs.md).

## Commands

Four families. Most commands are yours to run; the hook commands run themselves and should never be typed by hand.

### Pipeline

The spec-driven run itself, in the order you'd use them.

| Command | What it does |
|---------|--------------|
| `/speckit.companion.specify` | Write `spec.md` (requirements, acceptance scenarios, success criteria) and classify the change's size |
| `/speckit.companion.plan` | Write `plan.md` and its design artifacts, right-sized to that classification |
| `/speckit.companion.tasks` | Write `tasks.md`: a dependency-ordered task list |
| `/speckit.companion.implement` | Execute `tasks.md`, journaling each task as it finishes |
| `/speckit.companion.auto` | Run the whole pipeline hands-off, no approval pauses. The Run button in Create Spec triggers the same flow |
| `speckit.companion.classify` | Emit a `small \| normal \| oversized` size signal so the workflow can right-size the pipeline. Dispatched by the workflow's routing step |
| `speckit.companion.mark-complete` | Write `status: completed`, the workflow's terminal step. The command writes it; the AI never hand-writes `completed`. Dispatched by the workflow |

### Pick up where you left off

| Command | What it does |
|---------|--------------|
| `/speckit.companion.status` | Print where the active spec stands: current step, status, recorded decisions, and the next action |
| `/speckit.companion.resume` | Continue from the recorded step, carrying decisions into scope, and dispatch the next command in the family the spec has been running (at the next unchecked task inside implement) |

### Living specs

With no `living-specs.yml` in your project these report nothing and change nothing.

| Command | What it does |
|---------|--------------|
| `/speckit.companion.living-adopt` | Brownfield adoption wizard: draft living specs for the code areas you name, surface-first, and register the capabilities (incremental) |
| `/speckit.companion.living-drift` | Per-capability report of source files changed since the living spec was last committed, classified `tracked` vs `unspeced` (read-only; `--working` also counts uncommitted changes) |
| `/speckit.companion.living-sync` | Group working-tree changes (uncommitted included) by capability and update every affected spec in one pass, update-not-regenerate |
| `/speckit.companion.living-coverage` | Per-capability requirement-to-test report: which requirements have a test mapped in the capability's `.coverage.md` tier (read-only) |
| `/speckit.companion.living-move` | Move a living spec between central and colocated storage: the file, its tier siblings, and the registry entry together (reversible) |

### Hooks (never invoke these)

These run automatically when their lifecycle event fires. They keep `.spec-context.json` current; they are listed here so you recognize them, not so you call them.

| Command | Fired by | What it records |
|---------|----------|-----------------|
| `speckit.companion.after-specify` | `after_specify` | Specify completion (`specified`) |
| `speckit.companion.after-plan` | `after_plan` | Plan completion (`planned`) |
| `speckit.companion.after-tasks` | `after_tasks` | Tasks completion (`ready-to-implement`) |
| `speckit.companion.after-implement` | `after_implement` | Per-task journaling on implement (`implemented` when every task is checked) |

Full reference: [docs/commands.md](./docs/commands.md). This table is checked against the extension's own command list on every build, so a command can't be added without appearing here.

## Add your own steps without forking a command

The Companion commands are assembled from composable **nodes**: small named sections inside a command. An optional, project-local `.specify/companion.yml` lets you attach your own work before or after any node (run a shell command, add an instruction, or call a reusable node file) without forking the command itself. If the file is absent, every command runs exactly as it ships. A hook marked `owns: validation` after `implement-exec` takes over the pipeline's final validation task, so your consolidated test run happens once, not twice.

This is separate from stock Spec Kit's own `.specify/extensions.yml` hooks: a Companion run honors those too. A worked example (a review, PR, merge, reinstall ship tail) is in [examples/ship-ticket/](./examples/ship-ticket/); full reference in [docs/node-model.md](./docs/node-model.md).

## Installation

Requires a **github-source** Spec Kit; the stock PyPI `specify-cli` has no `extension` subsystem:

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git --force

# From the release archive (recommended); re-run the SAME line to update later
specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip --force

# Or from a local checkout while developing
specify extension add ./speckit-extension --dev
```

Verify with `specify extension list` (`companion` present), then run a real `/speckit.specify` and confirm `specs/<NNN>/.spec-context.json` is written. `python3` is optional: capture skips gracefully without it and never fails the host command. Full prerequisites and a CLI-less fallback: [docs/install.md](./docs/install.md). The release archive is a runtime-only allow-list generated and CI-checked from `scripts/package-manifest.py`; see [docs/publishing.md](./docs/publishing.md).

## How it works

```
/speckit.specify  →  after_specify hook  →  speckit.companion.after-specify
                                              →  write-context.py
                                              →  .spec-context.json  (append-only history[])  →  GUI lights up
```

Each lifecycle hook appends one entry to the canonical `history[]` and advances `currentStep` / `status`. Inside implement, each completed task is journaled as a substep, so the viewer never mistakes a single task for the whole step finishing. When no hook fired, `derive-from-files.py` rebuilds the same shape from the artifacts on disk, tagged `by: "derive"`. Full chain, the writer's guarantees, and the canonical schema: [docs/how-it-works.md](./docs/how-it-works.md).

## Docs & links

- [**SpecKit Companion (VS Code)**](https://marketplace.visualstudio.com/items?itemName=alfredoperez.speckit-companion): the GUI this feeds.
- [docs/install.md](./docs/install.md): install (release / dev / fallback) + verification.
- [docs/commands.md](./docs/commands.md): the commands and the hooks they run.
- [docs/living-specs.md](./docs/living-specs.md): the living specs reference.
- [docs/how-it-works.md](./docs/how-it-works.md): the hook → script → `.spec-context.json` chain and canonical schema.
- [docs/node-model.md](./docs/node-model.md): how Companion commands are composed from nodes and the `.specify/companion.yml` hook model.
- [docs/publishing.md](./docs/publishing.md): how this extension is released (separate from the VS Code extension).
- [ROADMAP.md](./ROADMAP.md): the migration plan and per-step status.
- [CHANGELOG.md](./CHANGELOG.md): version history (independent of the VS Code extension).

## License

[MIT](./LICENSE) © alfredoperez. Independently maintained; not affiliated with the Spec Kit core team.
