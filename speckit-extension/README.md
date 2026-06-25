<p align="center">
  <img src="https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/speckit-extension/assets/hero.jpg" alt="SpecKit Companion — spec-kit extension" width="100%">
</p>

<h1 align="center">SpecKit Companion — spec-kit Extension</h1>

<p align="center">
  <strong>Make your spec-driven work visible.</strong> Captures your spec-kit lifecycle into <code>.spec-context.json</code> so the SpecKit Companion VS Code GUI lights up on your existing flow — plus <code>status</code> &amp; <code>resume</code> to pick up where you left off.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/extension-companion-0b6dd9" alt="extension: companion">
  <img src="https://img.shields.io/badge/version-0.11.0-0b6dd9" alt="version 0.11.0">
  <img src="https://img.shields.io/badge/spec--kit-%E2%89%A50.9.5-008080" alt="requires spec-kit >= 0.9.5">
  <img src="https://img.shields.io/badge/license-MIT-gold" alt="license MIT">
</p>

```bash
# Install — and update, by re-running with --force (always pulls the newest build)
specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip --force
```

> The URL above is **stable** — it always serves the newest release, so the same command installs and updates. To update later, just re-run it (the `--force` flag refreshes an existing install in place).

> Tags: `#spec-driven-development` `#tracking` `#companion` · Independently maintained.

---

## Made for the SpecKit Companion VS Code extension

This is the **spec-kit-side half** of [**SpecKit Companion**](https://marketplace.visualstudio.com/items?itemName=alfredoperez.speckit-companion) (`id: companion`). It runs inside spec-kit and **writes** the canonical `.spec-context.json` that the **VS Code GUI reads** — it never reads or depends on the GUI at runtime. The two are installed independently:

```bash
code --install-extension alfredoperez.speckit-companion   # the GUI (VS Code Marketplace / OpenVSX)
specify extension add --from <release-url>                # this extension (spec-kit side)
```

Capture works on its own (the JSON is useful to any tool), but it's **built to feed the SpecKit Companion GUI** — that's where the captured state becomes a live sidebar, status badges, history, and a Resume button.

## Why install it

- **Live progress in the GUI** — each spec-kit step (specify → … → implement) appears in the Companion sidebar as it happens, with status and per-task history.
- **Zero workflow change** — it rides your *existing* spec-kit commands via lifecycle hooks. No new commands required just to get tracking.
- **Never lies about state** — when a hook didn't fire (skipped command, out-of-band run, a project that never had the extension), `derive-from-files.py` reconstructs the state from the artifacts on disk. The GUI reflects reality, not a half-truth.
- **Agent-agnostic** — works wherever spec-kit runs (Claude Code, Copilot, Cursor, Gemini, …), with extra depth on Claude.
- **Safe by design** — writes are atomic and append-only, preserve unknown fields, never regress a shipped spec, and never fail your spec-kit command. Stdlib-only Python; degrades gracefully when `python3` is absent.

## Stock spec-kit vs + SpecKit Companion

| Capability | Stock spec-kit | + SpecKit Companion |
|---|:---:|:---:|
| Spec-driven pipeline (`specify` → `plan` → `tasks` → `implement`) | ✅ | ✅ |
| Runs across agents (Claude, Copilot, Cursor, Gemini, …) | ✅ | ✅ |
| Live progress in the VS Code GUI (sidebar + status badges) | ❌ | ✅ |
| Per-task history during implement | ❌ | ✅ |
| `status` — where does this spec stand right now? | ❌ | ✅ |
| `resume` — pick up exactly where you left off | ❌ | ✅ |
| Lean Companion pipeline shape (no user stories, trimmed plan/tasks) | ❌ | ✅ |
| One real workflow on spec-kit's engine (`specify workflow run`/`resume`) with built-in size routing | ❌ | ✅ |
| Honest state recovery when a lifecycle hook didn't fire | ❌ | ✅ |

Companion rides your **existing** spec-kit commands via lifecycle hooks — you get the whole right-hand column with **zero workflow change**.

## What you get

| Capability | Status | What it gives you |
|---|---|---|
| **Lifecycle progress capture** | ✅ Shipped | Every spec-kit step (specify → plan → tasks → implement) is recorded into `.spec-context.json` as it happens — the GUI lights up on your existing flow, no new commands. |
| **Per-task implement history** | ✅ Shipped | Implement journals each task as it completes, so the GUI shows real per-task progress, not just "in progress." |
| **Honest state recovery** | ✅ Shipped | When a hook didn't fire, `derive-from-files.py` reconstructs state from the artifacts on disk — the GUI reflects reality, never a half-truth. |
| **`/speckit.companion.status`** | ✅ Shipped | One command prints where the active spec stands — step, status, recorded decisions, and the next action. |
| **`/speckit.companion.resume`** | ✅ Shipped | Pick up where you left off — carries recorded decisions into scope and dispatches the next command in the family the spec has been running. |
| **SpecKit Companion workflow** ([details](../docs/template-profiles.md)) | ✅ Shipped | The lean `/speckit.companion.*` pipeline — no user stories, a trimmed plan, files/dependencies tasks, smaller spec folder. The stock `/speckit.*` commands stay installed with better timing capture; both families coexist non-destructively. |
| **Companion workflow** ([engine](../docs/template-profiles.md#companion-workflow-routing-step)) | ✅ Shipped | The whole Companion pipeline as one spec-kit workflow the engine drives end to end — `specify workflow run speckit-companion` walks specify → plan → tasks → implement → mark-complete with review gates, and a built-in routing step right-sizes small vs. oversized changes (no on/off setting — the thresholds live in the workflow). |
| **Agent-agnostic, safe by design** | ✅ Shipped | Runs wherever spec-kit runs (Claude, Copilot, Cursor, Gemini, …). Writes are atomic, append-only, never regress a shipped spec, and never fail your command; stdlib-only Python. |

## Commands

Four capture commands run automatically as lifecycle hooks; the rest are yours to run.

| Command | Runs | What it does |
|---------|------|--------------|
| `speckit.companion.capture` | `after_specify` hook | Record specify completion into `.spec-context.json` |
| `speckit.companion.capture-plan` | `after_plan` hook | Record plan completion (`planned`) |
| `speckit.companion.capture-tasks` | `after_tasks` hook | Record tasks completion (`ready-to-implement`) |
| `speckit.companion.capture-implement` | `after_implement` hook | Per-task journaling on implement (`implemented` when all tasks checked) |
| `/speckit.companion.status` | you | Print the current step, status, recorded decisions, and the next action |
| `/speckit.companion.resume` | you | Continue the pipeline from the recorded step — carries decisions into scope and dispatches the next command in the family the spec has been running (`/speckit.companion.<step>` for Companion specs, `/speckit.<step>` for stock specs; at the next unchecked task inside implement) |
| `/speckit.companion.specify` · `.plan` · `.tasks` · `.implement` | you | The SpecKit Companion pipeline — emit the lean shape (no user stories, trimmed plan, files/dependencies tasks) for a spec |
| `speckit.companion.classify` | workflow routing step | Emit a `small \| normal \| oversized` size signal so the Companion workflow can right-size the pipeline (thresholds live here, not in a setting) |
| `speckit.companion.mark-complete` | workflow terminal step | Write `status: completed` to `.spec-context.json` — the Companion workflow's final step (the command writes it; the AI never hand-writes `completed`) |
| `/speckit.companion.auto` | you | Run the whole pipeline hands-off — specify → plan → tasks → implement → completed, no approval pauses. The Run button in Create Spec triggers the same flow |
| `/speckit.companion.adopt` | you | Brownfield adoption wizard — draft a living spec for one code area surface-first (`[DRAFT]`, observed/inferred tags, `## Uncovered`) and register the capability (opt-in, incremental) |

Full reference: [docs/commands.md](./docs/commands.md).

### Run the whole spec hands-off

`/speckit.companion.auto "what you want built"` builds the entire spec end to end and only stops when it is finished — it walks specify, plan, tasks, implement, and the final completion step on its own, without pausing for approval in between. It is the unattended sibling of the manual one-step-at-a-time flow, and it rides on top of the exact same per-step commands, so it can never drift from what they do.

Because it runs unattended, auto sets an **`unattended`** signal that project checkpoint hooks read. A checkpoint hook ("Continue / Fix / Stop") that would normally stop and ask a person to proceed checks this signal and instead records the checkpoint and keeps going. Background work, reviews, and PR steps still run as usual — only the wait-for-a-human pause is skipped. Authors of checkpoint hooks should branch on the `unattended` flag: if it is set, record and continue; otherwise ask.

Auto needs an AI agent that keeps working after each step finishes. On a plain one-shot terminal it gracefully falls back to the normal flow: it runs the first step and stops, and the rest is triggered the usual way.

### Familiar spec-kit output, plus right-sizing and completion

Companion's `/speckit.companion.*` commands produce the same shape of artifacts as stock spec-kit, so the output reads the way you already expect: a spec with prioritized user stories, acceptance scenarios, key entities, and edge cases; a plan with a summary, a constitution check, the concrete file layout, and the design files (`research.md`, `data-model.md`, `contracts/`); and a task list grouped by user story into phases.

On top of that familiar shape, the Companion pipeline adds three things stock does not have. It **right-sizes** the run, so a small change skips the review pauses and a large one gets extra scrutiny. It **captures lifecycle timing** into `.spec-context.json` as each step and task finishes, which is what lights up the GUI. And it **marks the spec complete** at the end, so the run lands in Completed on its own instead of stopping at "implemented."

## SpecKit Companion workflow — the lean pipeline shape

There is one SpecKit Companion workflow: the lean `/speckit.companion.specify · plan · tasks · implement` commands — a trimmed shape with no user-story section, a trimmed plan, files/dependencies tasks, and a smaller spec folder. It runs alongside the **stock** `/speckit.*` commands, which stay installed unchanged with better timing capture (closest to upstream spec-kit). The two families coexist — installing one never deletes the other.

**How to turn it on:** the Companion workflow is an opt-in beta gated by the `speckit.companion.speckitCompanionWorkflow` VS Code setting (off by default). When it's on, the SpecKit / SpecKit Companion picker appears in Create Spec and the Continue/Resume button lights up on sidebar specs. Stock SpecKit is always available regardless of the gate.

Under the hood the stock family stays present via an add-only activation step that also recovers a project whose commands a prior version may have stranded. The shared timing instructions are kept in one place: a `scripts/check-shape-parity.py` guard asserts every stock command body still pulls them from that single shared copy via a fence and fails the build if a command ever forks its own pasted copy — so editing the timing rules stays a one-place change. Full reference: [`../docs/template-profiles.md`](../docs/template-profiles.md).

## Companion workflow — run the whole pipeline on spec-kit's engine

The Companion pipeline also ships as a first-class spec-kit **workflow definition** (`workflows/speckit-companion.workflow.yml`) that runs on spec-kit's own engine, so you drive specify → plan → tasks → implement → mark-complete with one command instead of invoking the commands by hand:

```bash
# Run by local path (no install needed) …
specify workflow run speckit-extension/workflows/speckit-companion.workflow.yml

# … or register it once, then run by ID
specify workflow add speckit-extension/workflows/speckit-companion.workflow.yml
specify workflow run speckit-companion

# Paused at a review gate? Pick up from the exact node it stopped at
specify workflow resume <run_id>
```

The run **pauses at review gates** before planning and before tasks (reject aborts), and **ends by marking the spec `completed`** — the terminal `mark-complete` step the stock `speckit` workflow doesn't have. Each step still captures into `.spec-context.json`, so the VS Code GUI reflects progress for both `run` and `resume`.

You don't have to use `workflow run` to get this hand-off. On an agentic CLI that keeps working after a step finishes, each Companion command now reads the pipeline and **continues into the next step on its own** — pausing at the same review gates and running `mark-complete` after implement, so the spec still lands in **Completed** without invoking a separate run command. In a plain or one-shot terminal nothing auto-advances: you trigger each step yourself (or from the GUI), exactly as before.

### Companion workflow routing step

A built-in **routing step** right-sizes the pipeline with no on/off setting — the thresholds live in the workflow, not in a VS Code toggle. After specify, `speckit.companion.classify` emits a `small | normal | oversized` signal from the same ≤ 5-files / ≤ 10-tasks guardrail the command-body fast-path uses:

- **small** — folds plan/tasks toward implement (less ceremony).
- **normal** — the full pipeline with both review gates.
- **oversized** — prints a **visible warning** and still runs the **full** pipeline — it never silently skips a phase.

The workflow's safe default is the full pipeline, so an ambiguous size never drops a step. Full reference: [`../docs/template-profiles.md`](../docs/template-profiles.md#companion-workflow-routing-step).

## Customize the pipeline (`.specify/companion.yml`)

The Companion commands are assembled from composable **nodes** — small sections inside a command. An optional, project-local `.specify/companion.yml` lets you attach your own work before or after any node (run a shell command, add an instruction, or call a reusable node file) and reorder which nodes a command runs — without forking a command. If the file is absent, every command runs exactly as it ships. A worked example (a review → PR → Copilot → merge → reinstall ship tail) is in [`examples/ship-ticket/`](./examples/ship-ticket/). Full reference: [`docs/node-model.md`](./docs/node-model.md).

This is separate from stock spec-kit's own extension hooks (`.specify/extensions.yml`): a Companion run honors those too, so any spec-kit extension you've installed (the git extension and others) fires at the start and end of each step exactly as it would on a stock `/speckit.*` run. Both hook systems run on the same pipeline.

## Living specs — map your code to durable capability specs (opt-in)

Most specs describe one change and then go quiet. **Living specs** are the opposite: a durable spec per *capability* — checkout, auth, billing, todos — that stays current as the code evolves. You declare which files belong to each capability and where its spec lives, and a resolver answers "which capabilities does this change touch?" so the right specs can be kept in sync.

The feature is **off by default**. With no `livingSpecs` block (or `enabled: false`), nothing changes — every command behaves exactly as it does today. To turn it on, add a `livingSpecs` block to `.specify/companion.yml`:

```yaml
livingSpecs:
  enabled: true
  capabilities:
    - name: checkout
      match: ["src/checkout/**"]        # files that belong to this capability
      exclude: ["src/checkout/**/*.test.ts"]   # optional — subtracted from membership
    - name: checkout-cart
      match: ["src/checkout/cart/**"]
      # spec defaults to capabilities/checkout-cart/spec.md
    - name: billing
      match: ["src/billing/**"]
      spec: src/billing/billing.spec.md  # colocated — lives next to the code
```

Each capability has a `name`, the `match` globs that define which files belong to it, an optional `exclude`, and where its living spec lives. By default a capability's spec is **centralized** at `capabilities/<name>/spec.md`; give an explicit `spec` path to **colocate** it next to the code. A spec file uses the `.spec.md` extension (the hot tier loaded today); the reserved `.arch.md` / `.coverage.md` siblings are recognized and never flagged as stray.

The resolver ships as `resolve-spec-paths.py` and runs in three modes. By default it prints a concise human list; add `--json` for the full machine-readable object (names, resolved paths, locations, existence):

```bash
# Which capabilities own a changed file? (most-specific first)
python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --changed src/checkout/cart/x.ts
#   [checkout-cart, checkout]

# Every capability + any stray .spec.md on disk (orphans)
python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --all
#   capabilities: [checkout, checkout-cart, todos]
#   orphans: []

# Just the orphans — .spec.md files no capability claims or owns
python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --orphans
#   []

# Add --json for the full record the sync/fold/drift steps consume
python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --changed src/checkout/cart/x.ts --json
```

An orphan is a `.spec.md` that no capability claims **and** that does not live inside a configured capability's spec directory — so another file under `capabilities/checkout/` (or a reserved `.arch.md` / `.coverage.md` sibling) is never flagged as stray.

### Auto-loading living specs into specify & plan

When living specs are turned on, you stop re-explaining the codebase. As you start a feature, Companion looks at the files the change touches, finds the capabilities they belong to, and reads those capabilities' living specs into the assistant's context **before it drafts** — most-specific first, so the leaf capability is the primary frame and any parent capability sits behind it as context. The `specify` step records which capabilities it loaded, and the `plan` step reuses that record instead of resolving again.

This stays **opt-in by presence and never blocks a run**: with no `livingSpecs` block or `enabled: false`, specify and plan behave exactly as they do today — no load, no recording. A capability that matches but whose spec file isn't written yet is silently skipped, and specify/plan are strictly read-only — they never create or edit a living spec. The loaded capability names are stored on the spec's context under a `livingSpecs.loaded` list (additive metadata, never a lifecycle field), which is what lets `plan` reuse them.

### Folding feature deltas back into the living spec on completion

A feature spec is a one-time proposal. When you finish a feature, the change it described should become part of the durable record. If your feature spec includes a delta section describing how it changes a capability — what it adds, modifies, removes, or renames — those changes **fold into the capability's living spec** the moment you mark the spec complete. The feature spec was the proposal; the living spec becomes the record. (This is OpenSpec's "archive" step.)

Write the deltas as top-level sections in the feature's `spec.md`, using the requirement-and-scenario shape:

```markdown
## ADDED Requirements

### Users can set a due date on a todo

#### Scenario: set a due date
- WHEN a user picks a date for a todo
- THEN the todo shows the due date
```

The same four section types are recognized — `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, and `## RENAMED Requirements` (a rename reads `### Old name -> New name`). At completion, Companion resolves which capability the change touched and applies the deltas to its `capabilities/<name>/spec.md`: adds append, modifies replace, removes delete, renames rewrite the heading. When several capabilities are in scope it writes only the **most-specific** one, unless a delta section carries a `<!-- capability: <name> -->` marker naming a different or additional target.

This stays **opt-in and safe**: with living specs off there is no fold. A feature spec with no delta section is a clean no-op (the common additive case leaves the living spec byte-for-byte unchanged), and re-running completion folds nothing already there — it's idempotent. The synced capability names are recorded on the spec's context under `livingSpecs.synced` (additive metadata, never a lifecycle field). The whole step is best-effort and never fails completion.

### Adopting an existing code area into a living spec

Starting living specs on a codebase you didn't grow this way is the slow part — you'd normally hand-write one spec per area. The **adoption wizard** does the first draft for you, one area at a time. You point `/speckit.companion.adopt` at a single code area (say the billing module); it reads that area's surface, proposes a small set of capabilities for *just that area*, and drafts a living spec for each from what the code already exposes.

Because the read is surface-first — exported functions, routes, props, signatures, not a deep behavioral study — every draft wears its limits openly. The whole spec is marked `[DRAFT]`, each requirement is tagged `observed` (drawn straight from the code surface) or `inferred` (an educated guess), genuinely uncertain items carry an inline `[NEEDS CLARIFICATION: …]`, and any file the assistant couldn't read is listed under a `## Uncovered` heading so nobody mistakes a quick draft for a verified spec. You review and confirm, and the wizard registers the capability into your `livingSpecs` block so the resolver immediately recognizes it.

Adoption is **opt-in and incremental**: you run it deliberately for the area you care about, it appends one capability at a time (never a whole-repo bootstrap), re-running it for an area that's already registered is a safe no-op, and it changes no other command's behavior. Registration goes through a small helper that reuses the same config reader the resolver does, so it never corrupts a `companion.yml` it can't fully parse.

## Installation

Requires a **github-source** spec-kit — the stock PyPI `specify-cli` has no `extension` subsystem:

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git --force
```

Then install the extension:

```bash
# From the release archive (recommended) — this URL is stable, so the SAME line updates you later
specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip --force

# Or from a local checkout while developing
specify extension add ./speckit-extension --dev
```

**To update:** re-run the exact same command — the `companion-latest/companion.zip` URL always serves the newest release, and `--force` refreshes the installed copy in place. No version string to bump, no new URL to find. Once it lands in the spec-kit community catalog this shortens to `specify extension add companion`. `python3` is used by the capture scripts but is **optional** — capture skips gracefully if it's missing and never fails the host command. Full prerequisites + a CLI-less fallback: [docs/install.md](./docs/install.md).

Verify:

```bash
specify extension list        # `companion` present
# then run a real /speckit.specify and confirm specs/<NNN>/.spec-context.json is written
```

## How it works

```
/speckit.specify  →  after_specify hook  →  speckit.companion.capture
                                              →  write-context.py
                                              →  .spec-context.json  (append-only history[])  →  GUI lights up
```

Each lifecycle hook appends one entry to the canonical append-only `history[]` and advances `currentStep` / `status`. Inside implement, each completed `- [x] **T###**` task is journaled as a **substep** (so the viewer never mistakes a single task for the whole step finishing). When no hook fired, `derive-from-files.py` rebuilds the same shape from `spec.md` / `plan.md` / `tasks.md` + git, tagged `by: "derive"`. Full chain, the writer's guarantees, and the canonical schema: [docs/how-it-works.md](./docs/how-it-works.md).

## Docs & links

- [**SpecKit Companion (VS Code)**](https://marketplace.visualstudio.com/items?itemName=alfredoperez.speckit-companion) — the GUI this feeds.
- [docs/install.md](./docs/install.md) — install (release / dev / fallback) + verification.
- [docs/commands.md](./docs/commands.md) — the commands and the hooks they run.
- [docs/how-it-works.md](./docs/how-it-works.md) — the hook → script → `.spec-context.json` chain and canonical schema.
- [docs/node-model.md](./docs/node-model.md) — how Companion commands are composed from nodes, the `.specify/companion.yml` hook/recipe model, and the byte-parity assembler.
- [docs/publishing.md](./docs/publishing.md) — how this extension is released to the spec-kit catalog (separate from the VS Code extension).
- [ROADMAP.md](./ROADMAP.md) — the migration plan and per-step status.
- [CHANGELOG.md](./CHANGELOG.md) — version history (independent of the VS Code extension).

## License

[MIT](./LICENSE) © alfredoperez. Independently maintained; not affiliated with the spec-kit core team.
