# Plan — Companion Workflow Engine

> Spec: [`spec.md`](./spec.md) · Surface: **spec-kit extension** (`speckit-extension/`) only · Profile: turbo

## Summary

Ship the SpecKit Companion pipeline as a first-class spec-kit **workflow definition** (`speckit-extension/workflows/speckit-companion.workflow.yml`) that runs on spec-kit's own engine (`specify workflow run`/`resume`), mirroring the bundled `speckit` workflow's shape. The definition walks `specify → plan → tasks → implement → mark-complete`, inserts review **gates** before plan and before tasks, and uses a **`switch` routing node** after specify to right-size small vs. normal vs. oversized changes (replacing the retired `complexityFastPath` setting — thresholds now live in YAML). It is purely additive: no stock spec-kit file is edited, and we author no orchestrator — the engine provides steps, gates, conditional routing, and pause/resume.

## Technical Context

- **Language/format**: YAML workflow definition (spec-kit `schema_version: "1.0"`); supporting Markdown command + docs.
- **Engine**: installed `specify` CLI **0.9.5.dev0** (validation target). Step registry (verified): `command, shell, prompt, gate, if, switch, while, do-while, fan-out, fan-in`. Engine commands: `specify workflow run|resume|status|list|add|info`.
- **Storage**: workflow file under `speckit-extension/workflows/`; runs persist in `.specify/workflows/runs/<run_id>/`; capture lands in each spec's `.spec-context.json` (existing hook/command path, unchanged).
- **Testing**: `specify workflow info <path>` (zero validation errors) + a live `run`/`resume` against a fixture spec; the `/eval-speckit-extension` capture eval for the full run.
- **Hard constraints**: additive only (SC-005 byte-for-byte unchanged stock files); no edits to `.claude/**` or stock `.specify/**`; spec-kit-extension docs/version only (never root README/CHANGELOG/`package.json`).

## Decisions (pre-flight reconciliation — FR-011)

Pre-flight against the installed 0.9.5.dev0 surfaced three gaps between the spec's assumptions and what the CLI actually accepts. Reconcile the spec to these before finalizing the YAML:

1. **Routing node type is `switch`, not `if_then`.** The valid type *key* is `switch` (fields: `expression:` + `cases:` mapping + `default:` list) or `if` (fields: `condition:` + `then:`/`else:` inline arrays). `if_then` is the internal class name, **not** a usable `type:` value. Use `switch` keyed on a `small|normal|oversized` signal. **Branches contain inline nested step definitions, not ID references** — so the plan/tasks/implement steps for each route are inlined inside the `cases`/`default` arrays (this shapes the file: it is not a flat sibling list with jumps).

2. **Workflows are NOT registered via `extension.yml` `provides`.** The extension schema validates only `provides.commands` (+ `scripts`) and `hooks`; it requires ≥1 command/hook and ignores unknown `provides` keys (no `workflows`, no `category`/`effect` fields exist in that schema). Workflows live in a **separate catalog** (`specify workflow add <path>` → `.specify/workflows/workflow-registry.json`). **Reconcile FR-007**: the workflow ships as a file in `speckit-extension/workflows/` and is consumed via `specify workflow run <path>` (local path — supported) and/or `specify workflow add`. Drop the "register under `provides` / `category`/`effect`" requirement; it does not match the installed schema.

3. **`speckit_version` floor → `>=0.9.5`.** The bundled `speckit` workflow floors at `>=0.8.5` (for `integration: auto`), but `workflow run`/`resume` + the `switch`/`if`/`gate` step registry are the engine surface this workflow rides; pin to the validation target `>=0.9.5` (FR-008). **RESOLVED (T002):** no earlier 0.9.x was confirmed to ship `workflow run`/`resume`, so the floor stays `>=0.9.5`. The installed CLI reports `specify 0.9.5.dev0`.

### Pre-flight findings — validated against installed CLI 0.9.5.dev0 (T002, FR-011)

Confirmed by reading the installed engine source and exercising the CLI:

- **Step registry** present: `command, shell, prompt, gate, if, switch, while, do-while, fan-out, fan-in`. Routing uses `switch` (`expression:` + `cases:` mapping + `default:` list, inline nested steps). Step IDs are validated **globally and recursively** (duplicates across branches are rejected), so each route branch uses a distinct ID namespace (`oversized-*` vs. the `default` branch's `review-spec`/`plan`/…); `normal` carries no `cases` key and falls through to `default`, avoiding a duplicate-ID clash with it.
- **Engine commands** present: `specify workflow run | resume | status | list | add | info | remove | search | catalog`. Validation is clean: `specify workflow info <path>` and the engine validator both report **zero errors** (SC-007).
- **Registration** is via the separate workflow catalog, NOT `extension.yml`. The extension schema (`extensions.py`) validates only `provides.commands` (+ `scripts`) and `hooks`, requires ≥1 command/hook, and ignores unknown `provides` keys (no `workflows`/`category`/`effect`). `specify workflow add <path>` installs into the catalog (`.specify/workflows/workflow-registry.json`) and the workflow is then runnable by ID; a local path also runs directly via `specify workflow run <path>`. **FR-007 reconciled accordingly.**
- **New finding — thin command output → safe default.** A `command`/`prompt` step's captured output is currently only `exit_code`/`stdout`/`stderr` (full structured-output capture is a documented planned engine enhancement). So `steps.classify.output.size` does not resolve to the emitted size at runtime today, and the `switch` falls through to `default`. The YAML is shaped so `default` is the **full pipeline** — an unresolved size therefore runs every phase and never silently skips (satisfies FR-004). The `small` fold is best-effort, latent until the engine captures structured command output.
- **New finding — `completed` promotion guard.** `write-context.py` `update_context` refuses to advance a spec whose status is already terminal (`implemented`), so the terminal `mark-complete` step cannot reuse the plain step-write path. Added a dedicated `--mark-complete` promotion path (the only sanctioned writer of `completed`; keeps `currentStep=implement`; idempotent for already-shipped specs).

4. **Complexity signal source.** The routing `expression` reads from step context (`steps.<id>.output.<field>`). A plain `command` step's structured output is thin, so insert a thin **classify step** (a `speckit.companion.*` command or `prompt` step) right after specify that emits `small|normal|oversized` from the same ≤5-files / ≤10-tasks heuristic the old `complexityFastPath` used; the `switch` matches on that. The heuristic constants (5 / 10) live in the workflow YAML / classify command, not a VS Code setting.

5. **`mark-complete` terminal step.** Realized by a thin Companion command the terminal node dispatches (the AI never hand-writes `completed`; the command writes `status: completed`). Reuse/extend an existing `speckit.companion.*` command rather than hand-editing `.spec-context.json`.

## Approach & Structure

Order of attack, by file:

1. **`speckit-extension/workflows/speckit-companion.workflow.yml`** *(new — the core deliverable)*. Mirror the bundled `speckit/workflow.yml`: `schema_version`, `workflow` (id `speckit-companion`), `requires` (`speckit_version: ">=0.9.5"`, `integrations.any`), `inputs` (`spec`, `integration: auto`, `scope`). `steps`:
   - `specify` → `command: speckit.companion.specify` (`integration: "{{ inputs.integration }}"`).
   - `classify` → thin step emitting `small|normal|oversized` (Decision 4).
   - `route` → `type: switch`, `expression: "{{ steps.classify.output.size }}"`, with `cases:` — `small:` inlines a folded path toward implement; `normal:` and the `default:` inline the full `review-plan → plan → review-tasks → tasks → implement` sequence; `oversized:` inlines a visible-warning step then the full sequence (never silently skips — FR-004). Gates before plan and before tasks mirror `speckit`'s `gate` steps (`options: [approve, reject]`, `on_reject: abort`).
   - `implement` → `command: speckit.companion.implement`.
   - `mark-complete` → terminal `command` dispatching the Companion completion command (FR-006).

2. **Terminal completion command** — confirm whether an existing `speckit.companion.*` command writes `status: completed`; if none, add a thin `speckit.companion.mark-complete` (`commands/…md`) + register it in `extension.yml` `provides.commands`.

3. **`speckit-extension/extension.yml`** — raise `requires.speckit_version` to `>=0.9.5`; add the mark-complete command to `provides.commands` if introduced; bump `extension.version`. (Do **not** add a `provides.workflows` block — unsupported.)

4. **Docs (same change — FR-012)**: `speckit-extension/README.md` (new "Companion workflow" section + how to `workflow run`/`add`/`resume`; retire the `complexityFastPath` setting copy in favor of the YAML routing node), `speckit-extension/CHANGELOG.md`, `docs/template-profiles.md` (fast-path → routing node), `docs/capture-and-timing.md` if the run/resume capture path is described, and root `CLAUDE.md` where the dual-extension/capture model is described. **Root README/CHANGELOG/`package.json` untouched.**

5. **Validate**: `specify workflow info speckit-extension/workflows/speckit-companion.workflow.yml` (zero errors — SC-007), then a live `run` + forced-pause `resume` against a fixture (SC-001/SC-002), the three route fixtures (small/normal/oversized — SC-003), and `/eval-speckit-extension` (SC-006).

## Out of Scope

- The VS Code / webview extension surface — GUI consumption of `.spec-context.json` rides existing capture behavior; no `src/` or `webview/` changes.
- Any edit to the stock `speckit` workflow, its commands, or other installed extensions (must stay byte-for-byte unchanged — SC-005).
- New engine step types or a custom orchestrator — the routing node uses the existing `switch`.
- A user-facing on/off complexity toggle — thresholds live in the workflow definition (FR-005); the `complexityFastPath` VS Code setting is retired, not re-exposed.
- Root-extension release artifacts (`v*` tag, Marketplace) — this ships via the spec-kit-extension flow (`speckit-ext-v*`).

## Constitution Check

- **I. Extensibility / configuration** — PASS. Additive workflow definition; stock pipeline and other extensions untouched; behavior expressed in overridable YAML, not a fork.
- **II. Spec-Driven Workflow** — PASS. Preserves the non-negotiable Specify → Plan → Tasks → Implement pipeline and the Active → Completed lifecycle (terminal `mark-complete` writes `completed` as an explicit step, not a heuristic).
- **III. Visual / interactive** — N/A (spec-kit-extension-only; GUI consumes existing capture).
- **IV. Modular architecture** — PASS. Single declarative YAML + thin command(s); no large webview feature introduced.

No violations — Complexity-Tracking table omitted.

---

**In plain English:** Today the Companion pipeline is a loose bag of `/speckit.companion.*` commands a user runs by hand. This turns it into one real spec-kit *workflow* the engine drives end to end — specify, pause for review, plan, pause, tasks, implement, then mark the spec completed — with a built-in fork that does less ceremony for tiny changes and warns (never skips) on oversized ones. Pre-flight against the actually-installed CLI found three spec assumptions that don't hold: the routing step type is `switch` (not `if_then`), workflows aren't registered through `extension.yml` (they have their own `workflow add` catalog), and the version floor should be `>=0.9.5`. The plan reconciles to those, keeps the whole thing additive (stock spec-kit stays byte-for-byte identical), and ships only spec-kit-extension docs and a version bump.
