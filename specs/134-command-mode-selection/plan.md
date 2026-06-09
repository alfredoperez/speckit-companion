# Implementation Plan: Command Mode Selection

**Branch**: `134-command-mode-selection` | **Date**: 2026-06-09 | **Spec**: [`spec.md`](./spec.md)
**Input**: Feature specification from `/specs/134-command-mode-selection/spec.md`

## Summary

Today the standard-vs-lean pipeline choice is implemented as a destructive swap of two mutually-exclusive command bundles: selecting one runs `specify preset remove` on the other, which blanks the seven stock `/speckit.*` command files, and the paired `add` no-ops in a consumer install — leaving the project with no usable pipeline commands and an "Unknown command: /speckit-specify" error.

The fix reframes the choice as **non-destructive dispatch routing**. Both command families are already present by construction — stock `/speckit.*` (emitted by `specify init`) and namespaced `/speckit.companion.*` (declared in the companion extension's `provides.commands`). The mode simply selects which family a spec dispatches; the routing already exists in `resolveProfileCommand()`. We sever mode selection from the preset swap, repurpose the existing `speckit.companion.templateProfile` setting as the single Companion option that drives routing (seeding each spec's pinned `profile` at the specify step), keep the standard family alive via an add-only idempotent activation ensure (which also recovers already-stranded projects), and retire the right-click "Template Profile → Standard / Lean" submenu so the setting is the only mode-selection surface.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Webpack 5, `js-yaml`, the spec-kit CLI (`specify preset …`)
**Storage**: File-based — `speckit.companion.templateProfile` setting mirrored to `.specify/companion.yml`; per-spec `profile` in `<spec>/.spec-context.json`
**Testing**: Jest + ts-jest (`tsconfig.test.json`); VS Code mocked via `tests/__mocks__/vscode.ts`
**Target Platform**: VS Code ^1.84.0 (extension host, Node.js), across the README's supported AI providers
**Project Type**: Single VS Code extension (extension side `src/` + bundled webview)
**Performance Goals**: N/A — dispatch resolution is a synchronous file read on the command path; no perf-sensitive surface
**Constraints**: Activation must never throw on a CLI failure (failures logged, not thrown); the dispatch path must never throw on a corrupt `.spec-context.json`; the extension ships in isolation (no `.claude/**` runtime dependency)
**Scale/Scope**: ~6 source files touched + tests + docs; no new persisted schema fields

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Extensibility & Configuration | **Pass** — the mode option stays a VS Code setting; routing is provider-agnostic (handled in `resolveProfileCommand`, applied uniformly across dispatch paths). No provider rewrite. |
| II. Spec-Driven Workflow | **Pass** — preserves the Specify → Plan → Tasks → Implement pipeline; both shapes keep the sequential-phase, artifact-per-step model. The fix restores the pipeline for lean mode (it was broken). |
| III. Visual & Interactive | **Pass** — retiring the right-click submenu in favor of one setting is a deliberate consolidation (SC-003); the setting is a native VS Code UI surface. No regression to a CLI-only experience. |
| IV. Modular Architecture | **Pass** — changes stay within existing focused modules (`profileDispatch.ts`, `companionPresetReconciler.ts`, `specCommands.ts`, `extension.ts`); no new large webview feature. |

**Post-design re-check**: No new violations. The design removes behavior (the swap, the submenu) and repurposes existing seams; it adds no new architectural surface, so all four principles remain satisfied. **Complexity Tracking: empty.**

## Project Structure

### Documentation (this feature)

```text
specs/134-command-mode-selection/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 — delivery-mechanism decision
├── data-model.md        # Phase 1 — mode & option entities, state machine
├── quickstart.md        # Phase 1 — manual verification steps
├── contracts/
│   └── dispatch-and-reconcile.md   # Phase 1 — routing / setting / ensure contracts
├── checklists/
│   └── requirements.md  # Pre-existing requirements checklist
└── tasks.md             # Phase 2 (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── extension.ts                                  # Remove the two reconcile call sites;
│                                                 #   wire add-only activation ensure
├── core/
│   └── constants.ts                              # ConfigKeys.templateProfile (kept)
├── ai-providers/
│   └── promptBuilder.ts                          # Timing preamble (unchanged — confirms timing survives)
└── features/
    ├── specs/
    │   ├── profileDispatch.ts                    # resolveProfileCommand — routing (kept; add project-default fallback if needed)
    │   ├── specCommands.ts                       # Remove setProfileStandard/Lean handler registration
    │   └── stepLifecycle.ts                      # setProfile (kept as internal seeding writer)
    └── settings/
        ├── companionPresetReconciler.ts          # Repurpose: tri-state swap → add-only "ensure standard"
        └── companionPresetReconciler.test.ts     # Update: assert no destructive removes; idempotent ensure

package.json                                       # Remove profile submenu + setProfile* commands + menu
                                                   #   contributions; rewrite templateProfile description

docs/
├── template-profiles.md                          # Rewrite "Selecting a profile" + reconciler sections
├── sidebar.md                                     # Remove right-click Template-Profile menu reference
README.md                                          # Rewrite "Template Profiles" section (no swap, one surface)
speckit-extension/README.md                        # Rewrite "Template profiles" (no swap; routing model)
```

**Structure Decision**: Single VS Code extension. All work lands in the existing extension-side modules under `src/` plus the two READMEs and the `docs/` references; no webview UI changes (the retired surface is a `contributes.menus` submenu, removed in `package.json`). The change is concentrated in the settings/dispatch seam, matching Constitution Principle IV (focused modules, no new feature surface).

## Key implementation decisions (from Phase 0)

1. **Routing, not swapping** — the mode resolves to one of two always-present command families via `resolveProfileCommand()`; the preset swap is removed.
2. **The setting is the single option** — `speckit.companion.templateProfile`, decoupled from presets, seeds each spec's pinned `profile` at specify-time (in-flight safety).
3. **Add-only ensure** — activation idempotently ensures the standard family is present (recovery + steady state); it never removes the standard family.
4. **`off` stays an explicit upstream escape hatch** — outside the standard↔lean non-destructive guarantee.
5. **Retire the right-click submenu** — the `profile` field stays as internal plumbing; only the manual UI surface is removed.

See [`research.md`](./research.md) for rationale, alternatives, and the one implementation-time known-unknown (exact `specify preset` CLI re-emit semantics on a consumer install).

## Documentation impact (required, per CLAUDE.md)

This change alters documented behavior, so the following docs are updated in the same change (not a follow-up):

- `README.md` "Template Profiles" — drop the mutually-exclusive reconcile + right-click override; describe the single setting + routing.
- `speckit-extension/README.md` "Template profiles" — same reframe from the spec-kit-extension side.
- `docs/template-profiles.md` — rewrite "Selecting a profile — two levels" and the reconciler description to the add-only ensure + routing model; update the Files list.
- `docs/sidebar.md` — remove the right-click "Template Profile" menu item reference.
- `package.json` — the `templateProfile` setting `description` must stop referencing the preset reconcile and the retired menu.
- Both CHANGELOGs (root + `speckit-extension/`) — user-facing release note: "Switching modes no longer deletes your commands; lean mode no longer fails with 'Unknown command'."

## Complexity Tracking

> No Constitution Check violations — this section is intentionally empty.
