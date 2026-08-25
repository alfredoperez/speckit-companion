# Contract: UI Surfaces, Commands, and Message Protocol

The identifiers and copy a consumer or test codes against. Strings pinned by the spec's Verbatim Constraints appear exactly as pinned — never renamed, recased, or pluralized.

## Pinned copy (verbatim)

| Surface | String |
|---|---|
| Welcome action 1 | `Create your first spec` |
| Welcome action 2 | `Open a live sample` |
| Companion proof line (choice-card description) | `specs 60–68% leaner, same correctness` |
| Trial affordance | `Try Companion for this spec` |

## Zero-spec welcome (`package.json` `viewsWelcome`, view `speckit.views.explorer`)

- Exactly ONE welcome block renders for any zero-spec state: the two variants' `when` clauses are mutually exclusive by construction (companion-installed-or-dismissed vs companion-absent-and-not-dismissed), both under `speckit.detected && !speckit.constitutionNeedsSetup`.
- Both variants contain: one value line, `Create your first spec` → `command:speckit.create`, `Open a live sample` → `command:speckit.openSampleSpec`. The companion-absent variant folds the install line into the same block (surface argument `welcome`, coerced through the existing install-prompt allow-list).
- Contract test: `src/features/specs/__tests__/manifest.test.ts` asserts the single-block invariant and both pinned action strings.

## Commands

| Command id | Registration | Behavior contract |
|---|---|---|
| `speckit.openSampleSpec` | NEW — `contributes.commands` + `src/features/specs/sampleSpec.ts` | No workspace folder → error message, zero writes. Target `specs/<sample-dir>` absent → copy bundled `assets/sample-spec/` (`overwrite: false`), open via `speckit.openSpec`, emit `sample.opened`. Target present → reopen via `speckit.openSpec`, zero writes. Never overwrites any existing directory. |
| `speckit.create` | existing | unchanged (delegates to the spec editor) |
| `speckit.openSpec` | existing | unchanged; the seeding command's only viewer entry point |
| `selectWorkflow` / `needsSelection` (workflowSelector) | REMOVED | dead code; no contribution existed |

## Bundled asset

- Location in package: `assets/sample-spec/{spec.md, plan.md, tasks.md, .spec-context.json}`; `.vscodeignore` must ship it (and must exclude `assets/social/**`).
- The bundled `.spec-context.json` carries `sampleSpec: true` and NO `telemetryInstanceId`; its `history[]` is extension-stamped so the viewer renders per-phase timing.

## Create Spec message protocol (extension ⇄ webview)

`init` payload — each workflow entry (extension `types.ts` mirrored in webview `types.ts`):

```ts
{ name, displayName, description, installed, supportsAuto?, specifyCommands? }
```

- `description` is required for built-ins (Companion's is the proof line, verbatim); rendered visibly on the choice card — never only a tooltip.
- `installed: false` renders the card in install-to-enable state; the install-first decision stays extension-side (inbound flag only).
- `workflows.length <= 1` → the chooser is hidden entirely (unchanged).

Submit-family messages (`submit`, `submitAuto`, `submitCommand`) gain:

```ts
{ workflow: string, chosenAs: 'default' | 'picked' | 'trial' }
```

- `chosenAs: 'trial'` is set only by the `Try Companion for this spec` affordance, shown on the Companion card whenever the pre-selected default is not Companion.
- Invariant: NO code path introduced by this feature reads or writes `speckit.defaultWorkflow`; the trial changes this submission's `workflow` only.
- `submitAuto` stops discarding the message's workflow silently — it still requires Companion, but reports through the same `chosenAs` channel.

## Shared workflow-list builder

- `buildWorkflowChoices(root, provider)` in `src/features/workflows/workflowManager.ts` is the ONLY producer of pick-surface workflow lists. Guarantees: canonical validation/dedupe/reserved-names/provider-filter applied; Companion ALWAYS present with `installed` from `isCompanionSelectable()` — the single shared predicate (FR-007).
- `SpecEditorProvider` consumes it; its private `getWorkflows()` is removed.

## Storybook parity (editor-ui living-spec obligation)

`CreateSpecMock.tsx` + `CreateSpec.stories.tsx` gain, in the same change as the real form: multi-workflow choice cards, Companion-not-installed (install-to-enable) state, and the trial affordance state — rendered through the shipped `spec-editor.css` class names.
