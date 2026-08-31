# Companion Workflow (pipeline shape & timing)

The long-form reference for how SpecKit Companion reshapes the spec-kit pipeline, why the shape lives in command bodies (not document templates), how timing fidelity is baked in, and how the workflow is chosen. This is a living design doc — update it whenever the Companion command bodies, the timing partial, the workflow choice/selection, the routing step, or the reconciler change (see CLAUDE.md → Documentation).

> Status: shipped. The extension exposes a single **workflow choice** — stock **SpecKit** or **SpecKit Companion** — on `speckit.defaultWorkflow`. Both command families are always present; the chosen workflow only picks which family a spec dispatches (no preset swap). The three former toggles (`templateProfile`, `turboWorkflowPicker`, `complexityFastPath`) are retired and folded into this one choice. This doc is the durable reference that outlives any one spec folder.

## The two workflows

| Workflow | What it is | Output |
|---|---|---|
| `speckit` (default) | The **stock** spec-kit commands, unchanged, with timing instructions added by the always-present `companion-standard` carrier preset. | Same sections, same files as upstream spec-kit. |
| `companion` | The same commands with specific sections trimmed or replaced (no user stories, files/dependencies task axis), plus the same timing and a terminal `mark-complete` step. | A smaller spec folder — `spec.md` + `plan.md` + `tasks.md` + `checklists/requirements.md`; side files created on demand. (When the Companion workflow routes a *small* change, that one specify pass still emits three lean files — `spec.md` with an inline Approach, a `plan.md` pointer to it, and a real-checklist `tasks.md` — see [Companion workflow routing step](#companion-workflow-routing-step).) |

The Companion command family overrides the same **7** commands the stock family carries timing for — `specify`, `clarify`, `plan`, `tasks`, `analyze`, `implement`, `constitution`. `checklist` and `taskstoissues` are left on stock.

## Mechanism: shape lives in commands, not templates

A spec-kit preset can override two kinds of file: `type: command` (the AI prompt the agent runs) and `type: template` (a document scaffold like `spec-template.md`). **The shape is carried by command overrides.** We deliberately do **not** ship Companion document-template overrides. The reason is not stylistic — it is that template overrides do not reach all commands:

- spec-kit resolves a preset's `type: template` override through a layered stack (`.specify/templates/overrides/` → presets → extensions → core `.specify/templates/`), **but only when a setup script invokes the resolver**.
- `specify` copies its template by literal path — *"Copy `templates/spec-template.md`"* — and never runs the resolver. A Companion `spec-template.md` override would therefore **silently do nothing** for `specify` (the agent reads the core template). The Companion spec shape *must* come from the command body.
- `plan` and `tasks` go through `setup-plan.sh` / `setup-tasks.sh`, which *do* resolve through the stack — so a template override there *would* take effect.

So template overrides are **mixed** (work for plan/tasks, no-op for specify). Command overrides apply **uniformly** to every command. Putting the shape in command bodies is the only reliable single mechanism, so that is where it lives.

**Consequence — accepted tradeoff:** on the Companion workflow the on-disk `.specify/templates/spec-template.md` still shows the stock (user-story) shape; the Companion commands just don't read it. That cosmetic mismatch is the price of a reliable, single-source mechanism. Template-reading *secondary* surfaces (the stock `checklist`/`analyze` commands, the GUI spec editor) likewise see the stock template — acceptable for v1.

**Future option:** if we later want the Companion shape enforced at the skeleton level for `plan`/`tasks` specifically — where template overrides *do* flow via the setup scripts — we can add just those two Companion templates then. Not needed for v1.

## Per-file Companion treatment

| Command | Stock | Companion |
|---|---|---|
| `specify` | user stories + acceptance scenarios | no user-story section; lean requirements + success criteria |
| `tasks` | per stock template | files & dependencies task axis |
| `plan` / `implement` / `clarify` / `analyze` / `constitution` | stock body | stock body + the shared timing partial |

**Single-owner validation (tasks Polish).** The Companion `tasks` body's Polish phase defers its "validate against Success Criteria" suite-run task to a post-implement hook only when that hook is explicitly marked `owns: validation` under `commands.implement.hooks.after.implement-exec` in `.specify/companion.yml` — so a project that already owns a consolidated validation run doesn't run the suites twice. The deferral is gated on the marker, not on the presence of a hook: the same anchor also hosts review/PR/deploy hooks (see `examples/ship-ticket/`), so keying on presence would silently drop validation for any project with a ship tail. With no marked hook, Polish owns and generates the run. This lives in the `tasks-doc` node (`speckit-extension/nodes/tasks/tasks-doc.md`); it changes task *generation*, not capture or timing.

## Timing fidelity (both workflows)

Both families bake a single shared **timing partial** into every overridden command body, so durations stay honest for any dispatcher — not only when the GUI prepends its preamble (`src/ai-providers/promptBuilder.ts`). The partial fixes three logged bugs:

1. **Closed boundaries** — every pipeline step gets a script-stamped `complete` when its work ends: specify closes itself, plan/tasks are closed by their after-step hooks, implement by its end-of-step hook; the AI self-closes only clarify/analyze. (Previously `specify` never self-closed, and plan/tasks got their start stamped *after* the AI's close — see `docs/capture-and-timing.md`, #509.)
2. **No duplicate start** — a repeated same-step `start` is deduped at write time in `speckit-extension/scripts/write-context.py` instead of doubling `history[]`.
3. **Live cadence** — one fresh `date -u` per substep/task, plus a per-task `complete` (not just `start`); no end-of-run burst with 0ms gaps.

The GUI preamble stays as the extra path; the body-embedded partial is the standalone path. A parity check (`speckit-extension/scripts/check-shape-parity.py`) locks every body's partial so the two can't fork. Caveat: per-task `date -u` is still best-effort — it can burst on very fast tasks. A burst is still caught by the eval's `timestamps-real` round-millisecond check (`.claude/skills/eval-speckit-extension/check_capture.py`); folding the 0ms-gap signal into the `task-cadence` verdict specifically is a pending follow-up in the kaiju eval source (see "Areas to improve").

## Companion workflow routing step

> The Companion commands are themselves assembled from composable **nodes** (sections inside a command) — see [`docs/node-model.md`](./node-model.md). Here "routing" is a `switch` **step** in the workflow, not a command node; the node-model glossary keeps the two terms apart.

Right-sizing the ceremony to the change runs **inside the Companion workflow** (`speckit-extension/workflows/speckit-companion.workflow.yml`) via `specify workflow run speckit-companion`. The command-driven `/speckit.companion.specify` path also right-sizes automatically — its small-change fast-path is **on by default**, with no flag to set. Either way there is **no user-facing on/off setting**: the thresholds live in the workflow definition (and, for the command path, in the specify body) and a small change is routed automatically.

After specify, the workflow runs a thin **classify** step (`speckit.companion.classify`) that emits a single size signal — `small | normal | oversized` — from a fixed **5 files / 10 tasks** guardrail. A `switch` routing step reads that signal and picks a branch:

- **`small` — folded path.** Less ceremony for a tiny change: the branch folds plan/tasks toward implement, with no review gate.
- **`normal` — full pipeline.** The default branch: review-spec gate → plan → review-plan gate → tasks → implement, mirroring the bundled `speckit` workflow's gates.
- **`oversized` — warn, then full pipeline.** A visible warning step runs first, then the **same** full pipeline. It never silently skips a phase.

The `switch`'s `default:` branch is the full pipeline, so an ambiguous or unresolved size always runs every phase — a change is never under-planned by accident. (Today the engine captures only `exit_code`/`stdout`/`stderr` from a command step, so the classify size doesn't yet resolve into the `switch` at runtime and the safe default runs; the `small` fold is latent until the engine captures structured command output. The full pipeline is always correct in the meantime.)

On the **command path**, the `simple` verdict folds plan/tasks inside the `specify` finalize step, and that fold is a first-class capture surface: it records plan and tasks as ordered, extension-stamped, step-level boundaries so the timing display counts specify/plan/tasks as measured phases, and it loads the touched area's living specs (skipped `plan` is where a full run would) so a small change still gets Overview chips and mark-complete fold-back. See [`docs/capture-and-timing.md`](./capture-and-timing.md) → "Fast-path fold" for the boundary shape and the evals that pin it.

The workflow ends with a terminal `mark-complete` step (`speckit.companion.mark-complete`) that writes `status: completed` — the command writes it, never the AI. That same step also **folds the feature's changes back into the living specs it touched**: before the fold, the assistant authors a `## ADDED/MODIFIED/REMOVED/RENAMED Requirements` block per loaded-and-changed capability (each marked `<!-- capability: <name> -->`) into the feature `spec.md`, then `write-context.py --fold-living-spec` routes each block to its capability's `capabilities/<name>/spec.md` — a feature that changed several capabilities updates each, and each spec receives only its own requirements. The extension/scripts never invent spec content; the assistant authors the deltas from the real change and the Python only applies them, so the fold shows up in the feature's PR diff. Both the decomposed `implement` command (the `complete` node) and the standalone `mark-complete` command carry the authoring instruction. Runs pause at the review gates and resume from the exact node with `specify workflow resume <run_id>`; each step still captures into `.spec-context.json`.

## Picking a different block or shape

The pipeline ships one implementation of each node and one shape for each document. Both are choices, and the panel offers the alternatives rather than asking anyone to write a file first.

**A variant is a shipped node with its own id.** `speckit-extension/nodes/<step>/_order.yml` names them under `optional:`, and `variants:` says which default node each stands in for:

```yaml
optional:
  - draft-spec-delta
  - quality-checklist-blocking

variants:
  draft-spec: [draft-spec-delta]
  quality-checklist: [quality-checklist-blocking]
```

A node with alternatives shows **Replace** in the inspector. Picking one rewrites the step's order and grouping with that id in place of the old one — the same recipe write a drag makes — so the block stays editable, restorable, and yours the moment you save over it. A node listed under `optional:` but not under `variants:` is an add-on: it appears in the phase's **+ node** picker instead.

Two rules make swaps work, and both are worth knowing if you write a variant:

- **The order and the grouping are written together.** A swap removes and adds at once, so writing either half alone is refused by the check that reads the other half as it still was.
- **A variant satisfies what the slot promised.** `quality-checklist` declares `reads: [draft-spec]`; a variant of `draft-spec` occupies that slot, so the dependency holds. Without it, no node worth reading could ever be replaced.

**A fragment is an alternative for one template section**, addressed by its `## heading`. They live in `speckit-extension/fragments/` and a project's own `.specify/companion/fragments/` wins over a shipped one of the same name. Each declares what it is for:

```yaml
---
name: Outcomes
section: User Scenarios & Testing
for: specify
summary: Observable outcomes instead of prioritized user stories.
---
```

The `§` button on a step opens its document's shape: one row per section the template has, each offering the fragments written for it and **As it ships**. Restoring a section removes the entry rather than writing "shipped", because an absent entry already means the template's own words.

Shipped today: `outcomes` and `ears-requirements` as alternatives to prioritized user stories, `stories-classic` and `technical-context-classic` for the stock shapes, and `tasks-self-verify` / `tasks-coding-only` / `tasks-demo-line` as constraint blocks for the task list.

**A step is a directory of nodes**, so a project can add one. **+ step** at the end of the board writes `.specify/companion/nodes/<step>/` seeded runnable — a frame, an `_order.yml`, and one authoring node — and opens that node to edit. The build finds it the same way it finds the shipped four (`decomposed_commands()` is a directory listing), so it assembles into `/speckit.companion.<step>` and the capture layer records runs of it: the step vocabulary is what the project declares, not a fixed list. A misspelling is still refused, by name, against the steps that exist.

Where it runs is one key in its own `_order.yml`:

```yaml
# Omit this line for a step you launch when you want it.
after: implement
```

A step with `after:` takes its turn in the run and is drawn between the two steps it sits between. A step without one is drawn beside the board, like `auto` — available, not part of the sequence. Everything else about it works like a shipped step: nodes can be added, reordered, replaced and hooked, and its `_frame.md` is its own preamble.

The name becomes a command, so it has to be one you can type: lowercase letters, digits and dashes, and not a name a step already has.

**Work can attach to a step's edges.** A hook anchored on the step name rather than a node or phase renders outside every phase — the one anchor a regroup cannot orphan.

## Starting from something rather than nothing

A **preset** is a whole configuration Companion ships as a starting point. **New workflow…** offers them under **Start from**, next to "what this project runs now" and "the pipeline as it ships". Picking one copies that file into `.specify/companion/workflows/<name>.yml` and switches to it; from there it is an ordinary workflow, and everything in it can be changed one node or one section at a time.

Shipped today:

- **Classic spec-kit** — stock spec-kit's document shapes: prioritized P1/P2/P3 user stories, and the full Technical Context block in the plan. It changes what the documents look like, not what the run does.
- **Brownfield** — for changing a system that already exists: the spec is written as a delta (`draft-spec-delta`), the folder is numbered against every branch (`resolve-dir-git`), the task list is attacked before it runs (`review-gaps`), and a person opens the thing before it is called done (`verify-manually`).

A preset lives at `speckit-extension/workflows/presets/<name>.yml`. It is an ordinary workflow file plus two keys that only describe it — `preset:` (how it reads in the picker) and `summary:` (what it does) — and those two are dropped from the copy, because they are documentation rather than configuration.

## Selecting a workflow — recorded per spec

The workflow choice is **dispatch routing**, not a preset swap. Both command families are always present — the stock `/speckit.*` family (emitted by `specify init`, kept present by the always-on `companion-standard` carrier) and the namespaced `/speckit.companion.*` family (from the extension's `provides.commands`). The choice only picks which family a spec dispatches; nothing is ever removed.

1. **Project default** — `speckit.defaultWorkflow` (`"speckit" | "companion"`, schema default `speckit`). It is the workflow the Create-Spec picker pre-selects and the per-feature resolution falls back to; it issues **no** preset add/remove/swap, so it can never blank a command set. **Install-aware effective default:** when the setting is **unset**, the effective default resolves to `companion` if the companion spec-kit extension is installed (`isCompanionInstalled(root)`), else `speckit` — so installing the extension is enough to make Companion the pre-selected default without also flipping a setting. An **explicit** value (set at any scope — global, workspace, or workspace-folder) is always honored, including an explicit `speckit`, so the install-aware default never overrides a deliberate choice. The unset-vs-explicit distinction is read via `config.inspect('defaultWorkflow')` (a `config.get(key, 'speckit')` cannot tell unset from explicit-`speckit`). This effective resolution lives in one place — `resolveEffectiveDefaultWorkflow(root)` in `src/features/workflows/workflowManager.ts`, used by both workflow-pick sites. Adoption telemetry deliberately reports the **raw configured** value (unset → `speckit`), not the effective one, so an install-derived default is never miscounted as a companion choice.
2. **Recorded per spec** — each spec records its chosen workflow in `.spec-context.json` `workflow`, seeded verbatim at creation (`buildSpecifyCreationPreamble`). Every dispatch path (viewer footer, sidebar resume, command palette, Create-Spec specify) resolves that workflow's command for each step via `resolveStepCommand` and then applies the missing-extension fallback (`src/features/specs/profileDispatch.ts` `resolveDispatchWithFallback`): a `/speckit.companion.*` command resolves as-is when the spec-kit extension is installed, and downgrades to its stock twin (`fellBack: true`, with a one-click install warning) when it isn't. `clarify`/`analyze`/`constitution` and custom commands have no companion twin and pass through unchanged.
3. **Create-Spec picker.** The **Workflow** dropdown in *Create New Spec* lists the two built-in workflows (pre-selecting the **effective** default from item 1 — so an unset default pre-selects Companion once the extension is installed) **whenever the spec-kit extension is installed** — there is no enable toggle. `getWorkflows()` seeds `COMPANION_WORKFLOW` into the selection list under that single install check (`isCompanionSelectable()`), and the webview shows the dropdown when the list has more than one entry. When the extension isn't installed, Create Spec runs stock SpecKit with no picker (no hollow Companion option). Resolution (`getAllWorkflows()`) is ungated, so an existing Companion spec keeps its real steps regardless. Picking **SpecKit Companion** seeds `workflow: companion` and dispatches `/speckit.companion.specify` (downgrading to stock specify + warning when the extension is missing). The chosen workflow then carries the whole pipeline through `resolveStepCommand`.

**Keeping the stock family present (recovery + steady state).** On activation the extension runs an **add-only** ensure (`src/features/settings/companionPresetReconciler.ts` `ensureStandardFamily`): it adds `companion-standard` from the bundled path when absent — re-materializing the stock command files on a fresh checkout and recovering a project a prior swap left stranded — and is a no-op when already present. It **never** removes the stock family, so it cannot strand a project. A one-time migration removes a leftover `companion-turbo` install if present (and the pre-rename `companion-lean` / `sdd-lean` leftovers). CLI failures are logged, not thrown.

## Naming

The feature carries **no "sdd"** tokens. Canonical names: preset `companion-standard` (the stock-commands-plus-timing carrier); the old `companion-turbo` preset is gone — its id survives only as a leftover the reconciler removes on first ensure; setting `speckit.defaultWorkflow`; reconciler `companionPresetReconciler.ts`; workflow constant `COMPANION_WORKFLOW` (`src/features/workflows/workflowManager.ts`).

## Files

- `speckit-extension/presets/companion-standard/` — `preset.yml` (7 `type: command` `replaces:` entries) + `commands/speckit.<cmd>.md` (7) + `README.md`. The carrier for the timing-augmented stock command family.
- `speckit-extension/workflows/presets/` — the whole configurations **New workflow…** can start from (`classic.yml`, `brownfield.yml`). Distinct from `presets/` above, which carries stock command bodies rather than a pipeline configuration.
- `speckit-extension/presets/_parts/` — the single-source shared blocks each command body is composed from: `timing.md` (the canonical timing block, relocated here from the old `_shared/timing-partial.md`), `sizing.md` (the small/normal/oversized definition + the 5-files / 10-tasks bar), `routing.md` (which step runs next given the size), and `self-advance.md` (the agentic-CLI handoff). A rule lives in exactly one part; commands embed it via a `<!-- speckit-companion:part NAME -->…<!-- /…part NAME -->` fence.
- `speckit-extension/commands/speckit.companion.{specify,plan,tasks,implement}.md` — the Companion pipeline commands; `speckit.companion.{classify,mark-complete}.md` — the routing/terminal commands.
- `speckit-extension/scripts/build-commands.py` — assembles the parts into whole, self-contained command bodies (`--check` mode diffs instead of writing). `capture-golden.py` froze the pre-reshape command set under `tests/golden/commands/`.
- `speckit-extension/scripts/check-shape-parity.py` — the parity gate: each fenced region must equal its part byte-for-byte, and each unchanged body must equal its golden capture.
- `speckit-extension/scripts/write-context.py` — duplicate-start dedup + specify self-close.
- `src/features/settings/companionPresetReconciler.ts` (+ test) — the add-only `ensureStandardFamily` / `decideEnsureStandardOps` and `isCompanionInstalled`.
- `src/features/specs/profileDispatch.ts` (+ test) — `resolveDispatchWithFallback` / `resolveDispatchForRoot` (the missing-extension fallback applied to an already-resolved workflow command).
- `src/features/workflows/workflowManager.ts` — `DEFAULT_WORKFLOW` (`speckit`) and `COMPANION_WORKFLOW` (`companion`), surfaced by `getWorkflows()`; `resolveEffectiveDefaultWorkflow(root)` (+ pure `pickEffectiveDefaultWorkflow`) resolving the install-aware effective default for the two workflow-pick sites (`workflowSelector.resolveDefaultWorkflow`, `specEditorProvider.handleReady`).
- `package.json` `speckit.defaultWorkflow` (two-value enum); `src/core/constants.ts` `ConfigKeys.defaultWorkflow`, `COMPANION_WORKFLOW_NAME`.
- `src/features/spec-editor/specEditorProvider.ts` (the two-workflow picker; `handleSubmit` seeds the chosen workflow) + `src/ai-providers/promptBuilder.ts` (`buildSpecifyCreationPreamble` seeds `workflow`).

## Areas to improve (open)

- **Hand-maintained stock bodies** still drift against upstream. Each `companion-standard` carrier is the **raw upstream spec-kit command template** (it carries the upstream placeholders — `{SCRIPT}`, `__CONTEXT_FILE__`, `/memory/constitution.md` — not the agent-rendered form) **plus the single-sourced `timing` part**, injected by a `<!-- speckit-companion:part timing -->` fence. The timing block is therefore edited in exactly one place (`presets/_parts/timing.md`); the parity check locks the fenced region to that part, and a separate check fails any carrier that drops the fence and inlines its own copy — so the timing single-source can't silently regress. **What's left (deferred):** the stock body above the fence is still maintained by hand. Assembling it from a separately-vendored upstream source byte-for-byte would need an upstream-vendor input pinned into the repo (there is no second copy of the raw template to assemble from today); that is a larger change than this anti-drift pass and is intentionally not done here.
- **Best-effort cadence** — substep/self-close `date -u` stamps are still hand-authored second-precision; per-task timing is finish-only via a script (`write-context.py --task <id> --kind complete`), which the eval grades by honest deltas (see `docs/capture-and-timing.md`).
- **Catalog-add seam** — the bundled-path `add` (`specify preset add --dev .specify/extensions/companion/presets/companion-standard`) is what the add-only ensure uses to (re-)materialize the standard family; catalog-form `add <id>` silently no-ops in a consumer install, which is why the `--dev` bundled path is required.
- **Latent small-fold** — the workflow routing step's `small` branch is latent until the engine captures structured command output from the classify step; the safe full-pipeline default runs in the meantime.
