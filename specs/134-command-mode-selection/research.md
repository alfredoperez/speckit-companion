# Phase 0 Research: Command Mode Selection

**Feature**: `134-command-mode-selection` · **Date**: 2026-06-09

This phase resolves the one open question the spec left to planning ("the underlying delivery mechanism for each shape is left to planning") and the technical unknowns behind the regression. The spec is fundamentally a regression fix: today, selecting a mode swaps two mutually-exclusive command bundles, and the swap can strand a project with no usable `/speckit.*` commands ("Unknown command: /speckit-specify").

## Decision 1 — Mode selection becomes dispatch-routing, not a preset swap

**Decision**: Sever mode selection from preset reconciliation entirely. The mode no longer adds, removes, or swaps any preset. Instead, the mode picks which of two **always-present** command families a spec dispatches: the stock `/speckit.*` family (standard shape) or the namespaced `/speckit.companion.*` family (lean shape). The routing already exists — `src/features/specs/profileDispatch.ts:resolveProfileCommand()` maps a stock command to its `/speckit.companion.*` twin when a spec's recorded `profile === 'lean'`.

**Rationale**: The two command families coexist by construction and neither is touched by mode selection:

- Stock `/speckit.specify | plan | tasks | implement` are emitted by `specify init` and carried by the always-present `companion-standard` preset (see Decision 3).
- `/speckit.companion.specify | plan | tasks | implement` are declared in `speckit-extension/extension.yml` under `provides.commands`, installed with the companion spec-kit extension, and exist regardless of which preset is active.

The only thing that ever removed a command set was the reconciler's swap: switching to lean ran `specify preset remove companion-standard` (which blanks the seven stock command files) followed by a `companion-lean` add that no-ops in the consumer install — leaving zero usable pipeline commands. Removing the swap removes the regression at its source (FR-001, FR-002, FR-005). Routing-by-profile then produces the right shape per spec (FR-004) using files that are always on disk.

**Alternatives considered**:

- *Install both presets simultaneously*: rejected. Both `companion-standard` and `companion-lean` are `type: command` overrides of the **same** seven files, so they are mutually exclusive on disk — "both present" cannot mean both presets installed. It must mean stock family + namespaced family, which is what this decision delivers.
- *Keep the swap but make removes non-destructive*: rejected. It depends on spec-kit restoring upstream bodies on `preset remove` (it blanks instead) and on the bundled `add` succeeding in a consumer install (it no-ops). Both are exactly the fragilities the regression exposed; routing avoids depending on either.

## Decision 2 — The single Companion option is the existing `speckit.companion.templateProfile` setting, decoupled from presets

**Decision**: The "single SpecKit Companion option" of FR-003 is the existing `speckit.companion.templateProfile` window-scoped setting, repurposed from "drives the preset swap" to "drives dispatch routing." It is the project default. Each new spec pins the project default into its own `.spec-context.json` `profile` field at the specify step, so a later change to the project default never retroactively reshapes an in-flight spec (Edge Case: "switching the mode while a spec is in flight must not strand or corrupt that spec").

**Rationale**: The setting is already a single, persisted Companion option surfaced in the standard VS Code settings UI; only its *effect* was wrong (preset reconcile). Repointing it to routing satisfies FR-003 with no new UI surface. Pinning per-spec preserves the per-spec granularity the spec assumes ("selected per spec ... with a project-level default") while keeping exactly one place the choice is made (SC-003). When no spec-level `profile` and no setting are present, routing returns the stock command unchanged — the standard shape — satisfying FR-008 (option unavailable → default standard).

**Relationship to #218**: The spec's assumption names the eventual richer per-spec surface as the beta-gated / install-gated picker tracked in #218. That picker is not built (confirmed: no mode-picker code exists; only the right-click submenu and this setting). This feature does **not** build new picker UI — it delivers the non-destructive reframe and the single-option semantics through the existing setting; #218 remains the future home for an in-creation per-spec picker. This keeps scope on the regression and the MUST requirements.

**Alternatives considered**:

- *Build the #218 per-spec picker now*: rejected as out of scope. None of FR-001..FR-009 require new picker UI, and #218 owns that surface; bundling it here widens a regression fix into a feature build.
- *Read the project default live at every dispatch (no per-spec pin)*: rejected. A mid-pipeline default change would reshape an already-started spec, violating the in-flight edge case. Pinning at specify-time is the safer default.

## Decision 3 — Keep `companion-standard` as an add-only, idempotent carrier of the standard family; retire `companion-lean` from the selection path; this is also the recovery path

**Decision**: On activation, idempotently **ensure** the `companion-standard` preset is installed (add-only from the bundled path; never removed by mode selection). This materializes the seven stock command files with standard bodies + timing, and is the recovery vehicle for a project a prior swap left stranded (FR-009). The `companion-lean` preset is no longer part of mode selection: the lean shape is delivered solely by the always-present `/speckit.companion.*` commands. A one-time migration removes a leftover `companion-lean` (and the legacy `sdd-lean`) install if present, but the mode setting itself issues **no** removes going forward.

**Rationale**: This gives the strongest form of "both sets always present" (FR-001) and "persist across reload and fresh checkout" (FR-006): the standard family is re-asserted every activation by an add-only operation that cannot strand the project (no remove → no blanked files; the bug required a remove). A project already stranded by the old swap recovers automatically on the next activation when the ensure-add re-emits the stock files (FR-009). Lean specs dispatch `/speckit.companion.*`, so the stock bodies always being "standard" never conflicts with lean output. Timing stays intact on every path: the GUI dispatch path prepends the timing preamble via `promptBuilder` regardless of preset, and the standard bodies still carry the shared timing partial for non-GUI dispatch.

**Known unknown (validate during implementation, not blocking design)**: the precise `specify preset` CLI semantics on a consumer install — specifically whether a removed `type: command` preset blanks the seven files versus reverting them to upstream, and whether `add --dev <bundled path>` reliably re-emits them. The design is chosen to *not depend* on remove-reverting behavior (it never removes the standard family) and to use the same bundled-path add the current reconciler already emits (`specify preset add --dev .specify/extensions/companion/presets/companion-standard`). Implementation verifies the ensure-add re-materializes the files against the real CLI; if the bundled add no-ops the same way the old lean add did, the fallback is to detect missing stock command files and surface a one-click "repair commands" affordance rather than silently leaving them absent.

**Alternatives considered**:

- *Drop `companion-standard` entirely; rely only on `specify init` output*: viable and simpler, but loses body-embedded timing for non-GUI dispatch of standard specs and gives no in-extension recovery vehicle for an already-stranded project (the extension cannot cleanly re-run `specify init`). Keeping `companion-standard` as an add-only carrier costs little and buys recovery + timing parity.
- *Keep the full tri-state reconciler*: rejected — its remove-before-add swap is the regression.

## Decision 4 — `off` stays an explicit upstream escape hatch, outside the standard↔lean non-destructive guarantee

**Decision**: Keep the `off` value meaning "plain upstream spec-kit": route to stock commands and do not ensure `companion-standard`. The standard↔lean non-destructive guarantee (FR-001, FR-002) is scoped to the two managed shapes; `off` is a deliberate opt-out where the user accepts upstream behavior.

**Rationale**: `off` is niche and intentional. The regression the spec targets is the standard↔lean swap, which routing fully eliminates. Folding `off`'s upstream-removal into the same non-destructive promise would over-scope; documenting it as an explicit escape hatch keeps the contract honest. (Whether `off` should also be retired is a future simplification, not required here.)

## Decision 5 — Retire the right-click "Template Profile → Standard / Lean" submenu

**Decision**: Remove the `speckit.specs.profile` submenu, the `speckit.specs.setProfileStandard` / `setProfileLean` commands and their `package.json` menu contributions, and the command-handler registrations in `src/features/specs/specCommands.ts`. The per-spec `profile` field and its writer (`setProfile` in `stepLifecycle.ts`) are retained as internal plumbing — now driven by specify-time seeding from the project default rather than a manual menu click.

**Rationale**: FR-007 requires the submenu retired so the single Companion option is the only mode-selection surface (SC-003). The underlying `profile` field is still how a spec records its pinned shape for routing (Decision 2), so the data path stays; only the manual UI surface is removed.

## Resolved unknowns summary

| Unknown | Resolution |
|---|---|
| Delivery mechanism for each shape | Dispatch routing to two always-present command families (Decision 1). |
| What "single Companion option" is | The existing `speckit.companion.templateProfile` setting, decoupled from presets (Decision 2). |
| How both sets stay present across reload/checkout | Stock family carried by an add-only `companion-standard` ensure on activation; lean family from the extension's `provides.commands` (Decision 3). |
| How a stranded project recovers | The same add-only ensure re-emits stock command files on activation (Decision 3). |
| In-flight spec safety on a default change | `profile` pinned per spec at specify-time (Decision 2). |
| Where the choice is made after the fix | One surface — the setting; right-click submenu retired (Decision 5). |
| Does retiring the swap lose timing | No — GUI path timing comes from the `promptBuilder` preamble regardless of preset (verified in `src/ai-providers/promptBuilder.ts`). |
