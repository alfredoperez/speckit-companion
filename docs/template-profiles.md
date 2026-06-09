# Companion Template Profiles

The long-form reference for how SpecKit Companion reshapes the spec-kit pipeline into selectable **profiles**, why the shape lives in command bodies (not document templates), how timing fidelity is baked in, and how a profile is selected. This is a living design doc — update it whenever the profiles, their command bodies, the timing partial, the setting/selection, or the reconciler change (see CLAUDE.md → Documentation).

> Status: design locked, implementation in progress on branch `132-sdd-lean-pipeline`. The spec/plan for the first build live under `specs/132-sdd-lean-pipeline/`; this doc is the durable reference that outlives the spec folder.

## The two profiles (+ off)

| Profile | What it is | Output |
|---|---|---|
| `standard` (default) | The **stock** spec-kit commands, unchanged, with timing instructions added. | Same sections, same files as upstream spec-kit. |
| `lean` | The same commands with specific sections trimmed or replaced (no user stories, files/dependencies task axis), plus the same timing. | A smaller spec folder — always `spec.md` + `plan.md` + `tasks.md` + `checklists/requirements.md`; side files created on demand. |
| `off` | No overrides at all. | Plain upstream spec-kit. |

Both `standard` and `lean` override the same **7** commands — `specify`, `clarify`, `plan`, `tasks`, `analyze`, `implement`, `constitution`. `checklist` and `taskstoissues` are left on stock.

## Mechanism: shape lives in commands, not templates

A spec-kit preset can override two kinds of file: `type: command` (the AI prompt the agent runs) and `type: template` (a document scaffold like `spec-template.md`). **The shape is carried by command overrides.** We deliberately do **not** ship lean document-template overrides. The reason is not stylistic — it is that template overrides do not reach all commands:

- spec-kit resolves a preset's `type: template` override through a layered stack (`.specify/templates/overrides/` → presets → extensions → core `.specify/templates/`), **but only when a setup script invokes the resolver**.
- `specify` copies its template by literal path — *"Copy `templates/spec-template.md`"* — and never runs the resolver. A lean `spec-template.md` override would therefore **silently do nothing** for `specify` (the agent reads the core template). The lean spec shape *must* come from the command body.
- `plan` and `tasks` go through `setup-plan.sh` / `setup-tasks.sh`, which *do* resolve through the stack — so a template override there *would* take effect.

So template overrides are **mixed** (work for plan/tasks, no-op for specify). Command overrides apply **uniformly** to every command. Putting the shape in command bodies is the only reliable single mechanism, so that is where it lives.

**Consequence — accepted tradeoff:** in `lean` mode the on-disk `.specify/templates/spec-template.md` still shows the stock (user-story) shape; lean mode just doesn't read it. That cosmetic mismatch is the price of a reliable, single-source mechanism. Template-reading *secondary* surfaces (the stock `checklist`/`analyze` commands, the GUI spec editor) likewise see the stock template — acceptable for v1.

**Future option:** if we later want the lean shape enforced at the skeleton level for `plan`/`tasks` specifically — where template overrides *do* flow via the setup scripts — we can add just those two lean templates then. Not needed for v1.

## Per-file lean treatment

`standard` keeps every section/file verbatim (+ timing). `lean` per file, relative to stock:

| File | Lean treatment |
|---|---|
| `spec.md` | **redo** — User Scenarios (user stories) → replaced by a 1–3 line Overview; Key Entities → moved to `data-model.md` (if any); keep Functional Requirements, Success Criteria, Assumptions. |
| `checklists/requirements.md` | **keep** — a lean quality checklist (no user-story / acceptance-scenario items), graded in a single self-check pass; the FR/SC list still lives in `spec.md`. |
| `plan.md` | **redo** — drop the dual-option Project Structure tree + Complexity Tracking; replace with a lean Approach & Structure (files/deps); add Out of Scope; keep Summary, Technical Context, short Constitution Check. |
| `research.md` | **assess on demand** — create only for real unknowns/trade-offs worth their own file; otherwise fold a compact Decisions note into `plan.md`. |
| `data-model.md` | **assess on demand** — create only when a dev needs entities spelled out to build this change; compact. |
| `contracts/` | **assess on demand** — create only when it exposes an interface (API / CLI / schema / UI) a consumer codes against. |
| `quickstart.md` | **assess on demand** — create only when there is a non-obvious setup/verification path a dev would otherwise miss. |
| `tasks.md` | **redo** — drop user-story grouping/`[US#]` labels/MVP framing; keep strict `[Tn] [P?] + path`, Setup→Foundational→Core→Integration→Polish layering, deps/parallel notes. |
| `constitution.md` | **redo** — keep principles/governance + semver bump + write the file; drop the template-propagation checklist + Sync-Impact ceremony. |

Net lean spec folder: always `spec.md` + `plan.md` + `tasks.md` + `checklists/requirements.md`; side files (`research.md` / `data-model.md` / `contracts/` / `quickstart.md`) created on demand, only when they help understand or build the change.

## Timing fidelity (both profiles)

Both profiles bake a single shared **timing partial** into every overridden command body, so durations stay honest for any dispatcher — not only when the GUI prepends its preamble (`src/ai-providers/promptBuilder.ts`). The partial fixes three logged bugs:

1. **Self-close** — each step writes its own `complete` when its work ends. (Previously `specify` never self-closed, so the next step stamped its end.)
2. **No duplicate start** — a repeated same-step `start` is deduped at write time in `speckit-extension/scripts/write-context.py` instead of doubling `history[]`.
3. **Live cadence** — one fresh `date -u` per substep/task, plus a per-task `complete` (not just `start`); no end-of-run burst with 0ms gaps.

The GUI preamble stays as the extra path; the body-embedded partial is the standalone path. A parity check (`speckit-extension/scripts/check-shape-parity.py`) locks every body's partial so the two can't fork. Caveat: per-task `date -u` is still best-effort — it can burst on very fast tasks. A burst is still caught by the eval's `timestamps-real` round-millisecond check (`.claude/skills/eval-speckit-extension/check_capture.py`); folding the 0ms-gap signal into the `task-cadence` verdict specifically is a pending follow-up in the kaiju eval source (see "Areas to improve").

## Selecting a profile — two levels

1. **Project default** — `speckit.companion.templateProfile` (`"standard" | "lean" | "off"`, default `standard`), persisted to `.specify/companion.yml`. This rides the spec-kit **preset**: selecting a profile installs the matching `companion-*` preset and removes the other (mutually exclusive); `off` removes both. Handled by `src/features/settings/companionPresetReconciler.ts` (tri-state, removes-before-adds, CLI failures logged not thrown).
2. **Per-spec, at the specify step** — a Standard/Lean control overrides the default for *one* spec, records `"profile"` in that spec's `.spec-context.json`, and the GUI dispatches the matching commands through plan → tasks → implement. This rides the **namespaced** `/speckit.companion.*` commands (always available regardless of preset). `off` uses neither path.

## Naming

The feature carries **no "sdd"** tokens. Canonical names: presets `companion-standard` / `companion-lean`; setting `speckit.companion.templateProfile`; config file `.specify/companion.yml`; reconciler `companionPresetReconciler.ts`; `ConfigKeys.templateProfile`.

## Files

- `speckit-extension/presets/companion-standard/` · `companion-lean/` — `preset.yml` (7 `type: command` `replaces:` entries) + `commands/speckit.<cmd>.md` (7 each) + `README.md`.
- `speckit-extension/presets/_shared/timing-partial.md` — the canonical timing block embedded in every body.
- `speckit-extension/commands/speckit.companion.{specify,plan,tasks,implement}.md` — the per-spec lean opt-in commands (track the lean bodies).
- `speckit-extension/scripts/check-shape-parity.py` — body/partial parity guard.
- `speckit-extension/scripts/write-context.py` — duplicate-start dedup + specify self-close.
- `src/features/settings/companionPresetReconciler.ts` (+ test) — profile → preset ops.
- `package.json` `speckit.companion.templateProfile`; `src/core/constants.ts` `ConfigKeys.templateProfile`; `.specify/companion.yml`.

## Areas to improve (open)

- **14 hand-maintained bodies** (7 commands × 2 profiles) drift against upstream stock + the timing partial. Mitigation: `companion-standard` is a verbatim stock copy + the one shared partial; the parity check locks the partial. A generator could reduce hand-maintenance.
- **Best-effort cadence** — substep/self-close `date -u` stamps are still hand-authored second-precision; per-task timing is now finish-only via a script (`write-context.py --task <id> --kind complete`), which the eval grades by honest deltas (see `docs/capture-and-timing.md`).
- **Catalog-add seam — fixed** — the runtime toggle now installs the `add` op from the bundled path (`specify preset add --dev .specify/extensions/companion/presets/<id>`) instead of catalog-form `add <id>`, so toggling `speckit.companion.templateProfile` activates the matching preset with no manual command. `enable`/`remove` stay id-form; `off` removes both.
- **Per-spec control** — the specify-step Standard/Lean affordance + the `profile` field in `.spec-context.json` + the GUI dispatch-by-profile logic are a workstream beyond the preset/reconciler core.
- **Lean plan/tasks templates** — viable later where template overrides flow via the setup scripts (see Mechanism).
