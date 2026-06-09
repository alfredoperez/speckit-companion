# Companion Template Profiles

The long-form reference for how SpecKit Companion reshapes the spec-kit pipeline into selectable **profiles**, why the shape lives in command bodies (not document templates), how timing fidelity is baked in, and how a profile is selected. This is a living design doc — update it whenever the profiles, their command bodies, the timing partial, the setting/selection, or the reconciler change (see CLAUDE.md → Documentation).

> Status: shipped. Mode selection is **non-destructive dispatch routing** — both command families are always present, and the setting only chooses which one a spec dispatches (no preset swap). This doc is the durable reference that outlives any one spec folder.

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
| `spec.md` | **redo** — User Scenarios (user stories) → replaced by a 1–3 line Overview; Key Entities → moved to `data-model.md` only when it helps build the change (assess on demand); keep Functional Requirements, Success Criteria, Assumptions. |
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

## Selecting a profile — one setting, routed per spec

Mode selection is **dispatch routing**, not a preset swap. Both command families are always present — the stock `/speckit.*` family (emitted by `specify init`, kept present by the always-on `companion-standard` carrier) and the namespaced `/speckit.companion.*` family (from the extension's `provides.commands`). The mode only picks which family a spec dispatches; nothing is ever removed.

1. **Project default** — `speckit.companion.templateProfile` (`"standard" | "lean" | "off"`, default `standard`), mirrored to `.specify/companion.yml`. Changing it only records the default and seeds new specs — it issues **no** preset add/remove/swap, so it can never blank a command set.
2. **Per-spec pin, seeded at the specify step** — each new spec records its shape in `.spec-context.json` `profile`, seeded from the project default at creation (`src/features/specs/profileDispatch.ts` `seedProfileForNewSpec`). `src/features/specs/profileDispatch.ts` `resolveProfileCommand` then maps `speckit.X` → `speckit.companion.X` for a `lean` spec across every dispatch path. Because the shape is pinned at creation, changing the default later never reshapes a spec already in flight; `standard`/absent/`off`/invalid all resolve to the stock command. The **specify** step is special — a brand-new spec has no pin yet, so `resolveNewSpecProfileCommand` routes its specify command from the project default directly (`lean` → `/speckit.companion.specify`), keeping the first artifact on the same shape the rest of the spec is seeded to.

**Keeping the standard family present (recovery + steady state).** On activation the extension runs an **add-only** ensure (`src/features/settings/companionPresetReconciler.ts` `ensureStandardFamily`): it adds `companion-standard` from the bundled path when absent — re-materializing the stock command files on a fresh checkout and recovering a project a prior swap left stranded — and is a no-op when already present. It **never** removes the standard family, so it cannot strand a project. A one-time migration removes a leftover `companion-lean` install if present, but the setting itself issues no removes thereafter. CLI failures are logged, not thrown. The `off` escape hatch is the one exception — it opts out of the ensure entirely (`shouldEnsureStandard`), so `off` stays plain upstream spec-kit with no `companion-standard` carrier pulled in.

## Naming

The feature carries **no "sdd"** tokens. Canonical names: presets `companion-standard` / `companion-lean`; setting `speckit.companion.templateProfile`; config file `.specify/companion.yml`; reconciler `companionPresetReconciler.ts`; `ConfigKeys.templateProfile`.

## Files

- `speckit-extension/presets/companion-standard/` · `companion-lean/` — `preset.yml` (7 `type: command` `replaces:` entries) + `commands/speckit.<cmd>.md` (7 each) + `README.md`.
- `speckit-extension/presets/_shared/timing-partial.md` — the canonical timing block embedded in every body.
- `speckit-extension/commands/speckit.companion.{specify,plan,tasks,implement}.md` — the per-spec lean opt-in commands (track the lean bodies).
- `speckit-extension/scripts/check-shape-parity.py` — body/partial parity guard.
- `speckit-extension/scripts/write-context.py` — duplicate-start dedup + specify self-close.
- `src/features/settings/companionPresetReconciler.ts` (+ test) — the add-only `ensureStandardFamily` / `decideEnsureStandardOps` (keep-standard-present + one-time lean/legacy migration) and the `.specify/companion.yml` read/write helpers.
- `src/features/specs/profileDispatch.ts` (+ test) — `resolveProfileCommand` (route `lean` specs to the `/speckit.companion.*` twin) and `seedProfileForNewSpec` (pin the project default at the specify step).
- `package.json` `speckit.companion.templateProfile`; `src/core/constants.ts` `ConfigKeys.templateProfile`; `.specify/companion.yml`.

## Areas to improve (open)

- **14 hand-maintained bodies** (7 commands × 2 profiles) drift against upstream stock + the timing partial. Mitigation: `companion-standard` is a verbatim stock copy + the one shared partial; the parity check locks the partial. A generator could reduce hand-maintenance.
- **Best-effort cadence** — substep/self-close `date -u` stamps are still hand-authored second-precision; per-task timing is now finish-only via a script (`write-context.py --task <id> --kind complete`), which the eval grades by honest deltas (see `docs/capture-and-timing.md`).
- **Catalog-add seam** — the bundled-path `add` (`specify preset add --dev .specify/extensions/companion/presets/companion-standard`) is what the add-only ensure uses to (re-)materialize the standard family; catalog-form `add <id>` silently no-ops in a consumer install, which is why the `--dev` bundled path is required.
- **Lean plan/tasks templates** — viable later where template overrides flow via the setup scripts (see Mechanism).
