# Phase 0 Research: Activation Funnel

Codebase findings and the decisions they force. Each entry: Decision / Rationale / Alternatives considered.

## R1 — Merged welcome: two mutually-exclusive `viewsWelcome` variants

**Decision**: Keep the welcome in `package.json` `viewsWelcome` (the tree provider deliberately returns `[]` when empty), replacing today's two overlapping blocks (lines 98–102 and 103–107) with two variants of ONE merged welcome whose `when` clauses are mutually exclusive: one for companion-installed-or-nudge-dismissed, one folding the install line into the same single block for companion-absent. Both variants carry the value line, `Create your first spec`, and `Open a live sample` (copy pinned by Verbatim Constraints). `manifest.test.ts` (which already asserts the install block at lines 323–336) gains an assertion that the zero-spec `when` combinations render exactly one block.

**Rationale**: The stacking bug is precisely that Block A (`speckit.detected && !speckit.constitutionNeedsSetup`) and Block B (`… && !speckit.companion.installed && !…installNudgeDismissed`) are not mutually exclusive, so VS Code stacks both. `viewsWelcome` markup is static, so conditional content *must* be expressed as exclusive `when` variants — that is the mechanism FR-001's "exactly one welcome block" maps to.

**Alternatives considered**: Rendering a welcome node from the tree provider — rejected: the provider's empty-state comment explicitly delegates to `viewsWelcome`, provider-rendered welcome rows lose the button styling and command-link affordances, and it would re-implement what the manifest already does declaratively.

## R2 — Sample ships at `assets/sample-spec/`, seeded by copy, reopened if present

**Decision**: Bundle the curated sample as `assets/sample-spec/` (spec.md, plan.md, tasks.md, `.spec-context.json`), curated from the `_02_demo-tasked` fixture ("Command Palette Quick-Open" — the richest: full document set plus a 6-entry extension-stamped history that renders a populated rail with per-phase timing). A new `speckit.openSampleSpec` command (module `src/features/specs/sampleSpec.ts`) copies it to `specs/<sample-dir>` via `vscode.workspace.fs.copy(src, dst, { overwrite: false })`, then opens it with the existing `speckit.openSpec`. If the target directory already exists: open it in the viewer (reopen semantics), never write into it. No workspace folder: `showErrorMessage` following the existing "No workspace folder open" convention. The existing `.spec-context.json` `onDidCreate` watcher already clears the empty state (fileWatchers.ts:164–170), so no extra refresh wiring is needed.

**Rationale**: `.vscodeignore` excludes `specs/**` from the `.vsix` (verified against the packaged artifact), and the spec's Assumptions forbid reading demo fixtures in place — so a dedicated bundled asset is required. `assets/icons/**` already ships (only `assets/mascot/**` is ignored), making `assets/` the proven packaging location. `workspace.fs.copy` recurses over directories in one call and `overwrite: false` enforces FR-004's never-overwrite rule at the API level.

**Alternatives considered**: `dist/resources/` — rejected: a known landmine (agentManager.ts already reads `dist/resources/*` paths that no build step produces; adding a webpack CopyPlugin pattern is avoidable complexity). Reading the sample in place from the extension directory — explicitly ruled out by the spec (seeding must produce an ordinary user-owned spec).

## R3 — Seeded sample is excluded from funnel telemetry

**Decision**: The bundled `.spec-context.json` carries a `sampleSpec: true` field (unknown fields survive read/write round-trips by contract). The watcher-created `spec.created` path (R10) skips contexts carrying it, and the seed command emits a dedicated bare `sample.opened` engagement event instead (per-session de-duped, disclosure-listed).

**Rationale**: Seeding writes a new context file, which would otherwise fire the terminal-created `spec.created` path and pollute the funnel's "spec created" rung with specs no user authored. A distinct event keeps the sample's own adoption measurable (it is the top-of-funnel intervention being evaluated) without corrupting the creation count.

**Alternatives considered**: No marker + accepting the pollution — rejected: the sample exists precisely to move the funnel's weakest rung, so it must not inflate the rung it feeds. Emitting nothing for the sample — rejected: SC-001's under-a-minute claim is unverifiable in production without an event.

## R4 — Descriptive choice control: radio-card group in the existing imperative DOM

**Decision**: `initWorkflows` in `webview/src/spec-editor/index.ts` replaces the `<select>` with a radio-group of workflow cards (one per entry: display name, description, install state), styled in `spec-editor.css`. Companion's card description is the pinned proof line `specs 60–68% leaner, same correctness`; a not-installed Companion card renders its install-to-enable state from the existing inbound `installed` flag. `getSelectedWorkflow()` keeps its signature (reads the checked radio), `updateCommandButtons` keeps deriving affordances from the selected workflow's declaration, and the ≤1-workflow case still hides the chooser entirely. `CreateSpecMock.tsx` and `CreateSpec.stories.tsx` gain the matching states in the same change (multi-workflow, Companion-not-installed, trial) per the editor-ui living spec's mock-parity requirement.

**Rationale**: FR-005 requires descriptions visible without a click — a `<select>`'s `title` tooltip (today's only description surface) cannot satisfy that. Radio cards are the accessible native pattern for a small mutually-exclusive choice with per-option prose, and staying imperative-DOM matches the entire existing form (no framework in the shipped webview).

**Alternatives considered**: Keeping the `<select>` plus a description panel below — rejected: descriptions render one-at-a-time, so comparing options (the selling moment) still takes clicks. Rewriting the form in Preact — rejected: out of scope, violates the "match surrounding code" rule, and the Storybook mock already covers the visual-review need.

## R5 — "Try Companion for this spec": a per-submission selection, no settings write

**Decision**: When the pre-selected default is not Companion, the Companion card carries the pinned `Try Companion for this spec` affordance; taking it selects Companion for this one submission and tags the selection `chosenAs: 'trial'` (vs `'default'` for the untouched pre-selection, `'picked'` for an ordinary change). The submission message carries `workflow` + `chosenAs`; nothing ever writes `speckit.defaultWorkflow`. The existing install-first modal is untouched: a trial pick without the companion piece hits the same gate (FR-010).

**Rationale**: The form's selection is already per-submission — only `getOrSelectWorkflow`'s persistence path writes a per-feature choice, and nothing in the form writes the default setting — so the trial is safe by construction; the work is making it *low-commitment and visible*. `chosenAs` is a shape-only enum, and telemetry already deliberately reports the RAW configured default (telemetry.ts:87–88), so the trial cannot corrupt the adoption metric.

**Alternatives considered**: A separate "trial" submit button — rejected: a third submit path multiplies the submit-gate surfaces the editor-ui living spec works to keep unified. A "for this spec only" checkbox — rejected: implies the non-checkbox path *does* change the default, which is false.

## R6 — One shared builder: `buildWorkflowChoices()` in workflowManager

**Decision**: Add `buildWorkflowChoices(root, provider)` to `src/features/workflows/workflowManager.ts`, built on the canonical `buildWorkflows` pipeline (validation, dedupe, provider filter, reserved names) plus choice metadata: every entry gains `description` and `installed`; the Companion entry is ALWAYS included with `installed` from the existing `isCompanionSelectable()` predicate — the one predicate every surface now shares. `SpecEditorProvider.getWorkflows()` (Builder B) is deleted and the provider delegates, keeping only its provider-specific step-command formatting. Built-in descriptions live with the built-in definitions (Companion's description is the proof line).

**Rationale**: FR-007 verbatim, and the spec-editor living spec names this exact shipped bug ("one of two independent list builders was gated and the other was not, and the ungated one was the one that rendered"). Today's divergence is real: Builder A omits not-installed Companion while Builder B always lists it, and Builder B skips validation/dedupe entirely, so an invalid custom workflow appears only in Create Spec. The living spec also pins the resolution: Companion is *always listed* as install-to-enable (Create Spec is the highest-intent install moment), so the shared builder adopts Builder B's inclusion rule with Builder A's rigor.

**Alternatives considered**: Patching both builders to agree — rejected: that preserves two derivations of one fact, the repo's named worst bug class. Gating Companion out when not installed (Builder A's rule) — rejected: contradicts the living spec's install-to-enable requirement and FR-005's selling purpose.

## R7 — FR-008: remove the dead picker, retire `workflow.selected`

**Decision**: Delete `selectWorkflow` and `needsSelection` from `workflowSelector.ts` (confirmed dead: no `contributes.commands`, no menu, no keybinding, no registration; the only reference is the barrel re-export). The live `getOrSelectWorkflow`/`resolveDefaultWorkflow` path stays. `workflow.selected` — whose only emit site is inside the dead function — is retired from `docs/telemetry.md` with a retirement note. Its file-local `workflowTelemetryId` coercer moves to `src/core/telemetry.ts` as the single shared workflow-name coercer (R8).

**Rationale**: The Create Spec form *is* the workflow picker after this feature; wiring a second, textual quick-pick would duplicate the surface this feature invests in. The disclosure doc currently documents an event no code path can emit — retiring it is the honest fix.

**Alternatives considered**: Wiring the quick-pick to a command-palette entry — rejected: redundant surface, and its `buildWorkflowDetail` prose duplicates what the new choice control renders visually.

## R8 — `spec.created` attribution: effective post-modal selection through one shared coercer

**Decision**: Replace the `command.includes('companion.')` sniff (specEditorProvider.ts:468–472) with the workflow name the submission actually resolved to *after* the install-first modal (i.e. the same value seeded into the spec's record by the creation preamble), coerced by the shared `workflowTelemetryId` now exported from `core/telemetry.ts` (built-ins verbatim, `default`→`speckit`, everything else → `custom`). The event also carries `chosenAs` (R5). The three existing coercer implementations (dead picker's, `defaultWorkflowTelemetryId`'s custom→`speckit` collapse, the inline ternary) converge on this one export.

**Rationale**: FR-009 verbatim. The sniff misreports custom workflows as `speckit` (the disclosure doc already promises `custom`), and attributing the post-modal effective value means the telemetry and the on-disk record — which already disagree today — can no longer diverge: a Companion pick downgraded via "use SpecKit instead" reports `speckit`, matching what the spec actually runs.

**Alternatives considered**: Attributing the raw pre-modal form value — rejected: it would report Companion for specs that ran stock, breaking the created→dispatched funnel join by workflow.

## R9 — Completion seam: status-transition detection in the context-file watcher

**Decision**: `spec.completed` is emitted from exactly one seam: `handleSpecContextChange` (fileWatchers.ts), through the existing `TransitionCache` (transitionLogger.ts) extended to also cache `status`. Old-status ≠ `completed` && new-status = `completed` → emit once with `specInstanceId` from `getSpecTelemetryContext`. The cache is seeded silently — at activation from the initial spec scan and on `onDidCreate` — so already-completed specs never fire a stale burst, mirroring the seed-then-diff semantics `StepCompletionNotifier` already proves out. The direct emit in the sidebar path (`specCommands.ts:372`) is deleted; the event's sole owner becomes the watcher.

**Rationale**: FR-013 requires all three completion paths through ONE seam, and the paths do not converge in TypeScript: sidebar and viewer route through `setStatus`, but the Companion terminal step writes `completed` from `write-context.py` — Python never enters the TS writer. The context file is the one artifact every path mutates, and its watcher is already the funnel all writes flow through. Cache-based diffing also makes double-completion structurally impossible (second write finds cached `completed`), covering the spec's two-paths-race edge case, and the two watchers that can route the same file (`.claude` + per-pattern) are de-duplicated by the same cache.

**Alternatives considered**: Emitting inside `setStatus` plus a watcher just for the Python path — rejected: two emit sites needing cross-de-duplication is the exact shape FR-013 forbids. A Python-side emit from `write-context.py` — rejected: telemetry gating, switches, and identity all live in the extension; duplicating them in Python doubles the privacy surface. Known limit accepted: a completion landing while VS Code is closed goes unobserved — today that path emits nothing at all, and the per-session cache is still strictly better than two of three paths being blind.

## R10 — FR-016 adopted: preamble-persisted id makes watcher-created de-dupe reliable

**Decision**: Adopt the optional watcher-based `spec.created`. Mechanism: the creation preamble (promptPreamble.ts:424, which already seeds `"workflow"`) additionally seeds the form's minted `telemetryInstanceId` into the new spec's record. The watcher's `onDidCreate` then emits `spec.created` with `source: 'watcher'` ONLY for a context file that has no `telemetryInstanceId` and no `sampleSpec` marker (R3) — i.e. a spec no form created — minting and persisting the id through the existing back-fill machinery. Form-created specs carry the id, so they are never double-counted.

**Rationale**: The spec's informed default was "adopt only if de-duplicable reliably", and the persisted id provides exactly that discriminator. It also fixes a load-bearing pre-existing defect the dashboard depends on: today the form's `spec.created`/`phase.dispatched` carry a minted `specInstanceId` that is *never persisted* (the spec dir doesn't exist yet), while every later event mints a *different* persisted id — so created→completed cannot be joined per spec. Seeding the id through the preamble (the same trusted mechanism as workflow seeding) closes both FR-016 and the funnel join FR-017 needs.

**Alternatives considered**: Keeping the documented blind spot — rejected once the id mechanism fell out of the attribution work, since the marginal cost is one preamble line and one watcher condition. Residual risk accepted: an AI that ignores the preamble line yields one duplicate created event with a fresh id (`source: 'watcher'` lets the dashboard quantify exactly this).

## R11 — `extension.installed` and `panel.opened`

**Decision**: `extension.installed`: in `activate()`, next to the existing activation-event block, check a new catalogued `GlobalStateKeys.installedEventSent`; if unset, send, and persist the marker ONLY when `sendTelemetryEvent` returns `true` (the existing claim-slot-only-after-send rule, which `sendEventOncePerKey` already encodes for session Sets). A wiped globalState legitimately reads as a new install (spec assumption). `panel.opened`: the specs view is the repo's only real `TreeView` handle and `onDidChangeVisibility` is unused everywhere — subscribe on it, plus an initial `specsTreeView.visible` check at creation (the sidebar may already be open at activation), de-duped per session via the `sendEventOncePerKey` pattern. `tests/__mocks__/vscode.ts` gains a `createTreeView` fake with a drivable visibility event.

**Rationale**: Both follow proven in-repo patterns (globalState get/update pairs; the #506 unsent-events-burn-no-slot rule is FR-014 verbatim). The visibility seam costs one listener on an object the extension already holds.

**Alternatives considered**: A version-stamped marker (store the version, fire on change) — rejected: that measures updates, not installs; the update checker already tracks versions separately. Treating first `extension.activated` as installed dashboard-side — rejected: activation fires per session forever; the once-ever rung must be a distinct event to make the funnel's top honest.

## R12 — Dashboard split: PostHog owns the tiles, the repo owns events + disclosure + parity record

**Decision**: Repo-side FR-017/018/019 work is: (a) `docs/telemetry.md`'s "Reading these in PostHog" section gains the five-stage funnel recipe in the pinned order (installed → panel opened → spec created → phase dispatched → completed); (b) the retired `profile` property stops being attached to `phase.dispatched` (`profileTelemetryId` and the two attach sites removed, disclosure updated) so nothing feeds the dead dimension again; (c) the specify-vs-plan parity check runs against fresh post-fix PostHog data during implementation and its result is recorded in `docs/telemetry.md` beside the funnel recipe. Building the funnel view and deleting the profile/turbo tile happen in the PostHog dashboard itself.

**Rationale**: The spec's Assumptions place dashboard construction in the analytics tool; the repo's honest contribution is making the events exist, documenting them, and killing the dead dimension at the source. The `profile` field was declared legacy at the workflow-choice collapse; continuing to attach it invites new dead tiles.

**Alternatives considered**: Keeping `profile` flowing for old specs' sake — rejected: the dimension is retired, no consumer remains, and FR-018 exists precisely because it produced a tile that can never return meaningful data.

## R13 — Content: one new clip from existing captures; placeholders resolved by rendering what exists

**Decision**: (a) FR-020's run-in-flight clip is a new HyperFrames composition `media/feature-clips/run-in-flight/`, built from the `step-rail` composition's tracked running-state captures (live rail, "Live percent while it runs") plus the per-phase-timing beat from `overview` — no existing clip shows both, and `step-rail` is the only composition whose captures are tracked in git. Rendered through the established recipe (mp4 → palettegen/gifsicle, 960 px / 14 fps, representative frame zero, seamless loop), promoted to `docs/screenshots/generated/run-in-flight.gif`. (b) FR-022's three README placeholders are resolved by rendering the three *existing* compositions (`spec-viewer`, `inline-comments`, `specs-sidebar`) and swapping the stills for the promoted GIFs — additive files; the referenced PNGs stay in place untouched (published-listing 404 rule). (c) FR-021's make-it-yours asset is a fourth composition `media/feature-clips/make-it-yours/` covering workflow swap → command shaping → provider pick.

**Rationale**: The clip pipeline, encode recipe, and promotion location are all established in `docs/visual-assets.md`; the spec requires producing content *through* that pipeline. Reusing `step-rail`'s captures is the cheapest honest path to "a run in flight" — they are real captured UI, satisfying the review-checklist rule against invented UI.

**Alternatives considered**: One long walkthrough video — already ruled out by the standing README decision (per-section GIFs replace the walkthrough). Screen-recording a live run — rejected: non-deterministic, off-pipeline, and unreproducible next time the UI shifts.

## R14 — Marketplace listing and carousel

**Decision**: (a) `package.json` `description` rewritten benefit-led with the leaner-specs stat; `keywords` gain the provider/audience terms (`copilot`, `gemini`, `codex`, `cursor`); `galleryBanner.color` moves to the brand `#0F0F13`. (b) README above the fold: the stat joins the opening bold value paragraph (line 13) — its only stable citation is `docs/configuration.md#workflow-choice`, which stays the change-it-there-first source of truth. (c) The carousel lives at `assets/social/carousel-copilot/` (excluded from the `.vsix` alongside `assets/mascot/**`): slide PNGs plus a regeneration prompt sheet derived from `speckit-extension/assets/HERO-PROMPT.md` (the brand art-direction source: dark `#0F0F13`, blueprint grid, blue glow, one yellow accent, no purple), messaging aimed at Copilot users in the US and India, composed only from real captured UI.

**Rationale**: The Marketplace serves the last-published README against current `main`, so all image work is additive/overwrite-in-place; `description` is the one listing string rendered above every fold (search results included). HERO-PROMPT.md is the repo's only codified art direction, and reusing it keeps the carousel on-brand and regenerable.

**Alternatives considered**: Putting the stat in the H1 — rejected: the headline sells the outcome ("see and steer everything your AI builds"); a number in an H1 reads as noise and the stat lands harder as the first proof line under it. A docs/-hosted carousel — rejected: `docs/` ships context for users; marketing collateral belongs with the other non-packaged art under `assets/`.

## Pre-existing defects this plan fixes in passing

- The funnel's created→completed join is broken today (unpersisted form-minted `specInstanceId`) — fixed by R10.
- `spec.created` misattributes every custom workflow as `speckit` — fixed by R8.
- `docs/telemetry.md` documents `workflow.selected`, which nothing can emit — fixed by R7.
- `docs/configuration.md:40` claims Create Spec shows no picker when Companion isn't installed — false since the install-to-enable change; corrected alongside R6.
