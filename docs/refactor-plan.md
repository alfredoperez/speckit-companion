# Structural Refactor Plan

> **Status (final pass):** 15 phases shipped on branch `refactor/structural-cleanup`. The remaining 4 phases (19 Toast queue, 21 Badge consolidation, 5c InlineEditor wrappers, 5d MarkdownContent) touch live UI behaviour where Jest tests can't catch visual regressions and Storybook is not in `npm test`. They're deferred to a session with visual verification available. The Jest+Preact test infrastructure landed in Phase 5a means future webview component changes have a regression net — the cost of deferring is one-time, not compounding.
> Origin: thermo-nuclear code quality review (2026-05). One commit per phase on one branch.

## Shipped phases (final)

| # | Phase | Status | Commit |
|---|---|---|---|
| 0 | Docs match reality + `check-docs.ts` prevention test | ✅ | `6a8f40e` |
| 1 | `CliTerminalProvider` base class | ✅ | `c4fd5dc` |
| 2 | `ProviderRegistry` validation at module load | ✅ | `3d7c544` |
| 3 | `PanelStateComputer` pure derivation extract | ✅ | `38911cf` |
| 4 | Typed dispatch map + CommentMutationQueue | ✅ | `e610043` |
| 9 | Break specs↔spec-viewer coupling | ✅ | `d0acb2f` |
| 10 | `TypedDispatcher` → `core/utils/` + `customCommandConfig` extract | ✅ | `81498a7` |
| 11 | Documented `specContextManager.ts` as compatibility shim | ✅ | `6122db1` |
| 12 | `PanelRegistry` extracted from `specViewerProvider` | ✅ | `59c1cd3` |
| 13 | `useDispatch()` hook (webview reusability) | ✅ | `267e2f2` |
| 14 | `ContextKeyManager` consolidating 10 setContext writers | ✅ | `2d837de` |
| 15 | Canonical `getSpecStatus()` + `isTerminalStatus()` | ✅ | `be68533` |
| 16 | `SpecsSidebarState` facade + missed `sortActive` key | ✅ | `90928bc` |
| 17 | Webview state-init guard + `lastFeatureCtx` invalidation | ✅ | `117b20b` |
| 18 | Button `destructive` variant + StaleBanner migration | ✅ | `5a6ad4f` |
| 20 | `Card` + `Tooltip` + `EmptyState` shared primitives | ✅ | `7e5522d` |
| 22 | Component-library catalogue + JSDoc polish | ✅ | `8c0f8df` |
| 5a | FooterActions split + Jest+Preact test infrastructure | ✅ | `e6c9b5c` |
| 5b | Deleted orphan `modal.ts` + hardcoded refine HTML | ✅ | `5582da0` |

## Patterns-review polish (post-Phase-5b)

A clear-mind patterns review after Phase 5b surfaced a 7-item polish list. Outcomes:

| Item | Outcome |
|---|---|
| Wrap ActivityPanel cards in `<Card>` | **Deferred.** Adds `.card` classes alongside existing `.activity-card` rules; CSS cascade interaction needs visual verification. |
| Replace ActivityPanel empty `<div>` with `<EmptyState>` | **Deferred.** `.activity-empty` has a dashed border that `.empty-state` doesn't — replacement is a visible visual change. |
| Migrate `title=""` attrs to `<Tooltip>` | **Deferred.** Wrapping in an extra `<span>` can shift inline layouts subtly. |
| Add stories for Card / Tooltip / EmptyState / UndoToast / GeneratingFooter / CatalogFooter | ✅ Shipped — four primitive stories added (commit `7c0d6af`). GeneratingFooter / CatalogFooter still test-only. |
| Wrap `phaseCalculation.ts` in a typed inputs interface | **Skipped — and that's right.** Functions are already pure with clean signatures; boxing args would be ceremony. The honest pattern application was adding Jest coverage (27 new tests; commit `3765d39`). |
| Delete `utils.ts` re-export shim | ✅ Shipped — documentScanner imports directly from `core/utils/fileNaming` now (commit `5dbd279`). |
| Strip Phase-N references from inline comments | ✅ Shipped — semantic descriptions instead of phase numbers (commit `5dbd279`). |

The deferred items aren't impossible — they need a session with the viewer rendered to confirm the CSS / DOM layout doesn't shift. They're the same shape as the original Phase 5c/5d deferral.

## Outcomes for the originally-deferred phases

After the user pushed to "just tackle them," each of the four deferrals was investigated:

| # | Phase | Outcome | Why |
|---|---|---|---|
| 19 | Toast queue | **Closed without rewrite.** Documented intentional. | Investigation found exactly one production caller (`index.tsx:116`); the audit's "stacking queue" requirement was speculative. Attempted a declarative signal-driven replacement during the session and reverted — the imperative version's `.visible` → `.hiding` → `animationend` cleanup is non-trivial to match declaratively without timing regressions. Documented as deliberately imperative until a second caller wants stacking. Commit `eb6d1b1`. |
| 21 | Badge consolidation | **Shipped a structural step.** Added `Badge` variant `passthrough`; migrated 3 CSS-only badges to use it. | True visual consolidation (picking ONE canonical badge style) needs design review. The achievable refactor: route all badges through the shared component so they're grep-findable by component name, preserving existing pixel-tuned CSS via the `class` prop. A future visual pass migrates each from `passthrough` to a unified variant. Commit `9316d4a`. |
| 5c | Declarative InlineEditor/InlineComment wrappers | **Confirmed deferred — structurally blocked by 5d.** | Investigation showed `inlineEditor.ts` mounts Preact INTO DOM slots created by `renderer.ts`'s HTML-string output. Making the mount declarative requires the renderer to produce JSX (that's Phase 5d). The two phases are coupled. |
| 5d | `<MarkdownContent>` wrapping `renderer.ts` | **Confirmed deferred.** | Rewriting renderer.ts (494 LOC) from HTML-string-producer to JSX-tree-producer is the core of the webview migration. Highlighting/mermaid/TOC timing-sensitive. Needs Extension Development Host alongside the refactor for visual verification — no Jest assertion can catch a missing syntax highlight or a mis-ordered TOC. |

Phases 5c/5d remain the structural fire the original audit identified — but they're a coordinated rewrite of the markdown rendering pipeline that should land in a session with the viewer visible. The Phase 5a Jest+Preact infrastructure means the eventual landing has a regression net that didn't exist when the audit ran.

## What good looks like after 5c/5d land

A session with Extension Development Host alongside Storybook (or a Chromatic-style visual-regression CI) executes the keystone change:

1. Rewrite `renderer.ts` to return JSX (a tree of `<Line>` / `<Heading>` / etc. nodes) instead of an HTML string.
2. The new `<MarkdownContent>` consumes that JSX directly — no more `dangerouslySetInnerHTML`.
3. `<Line>` renders its own `.line-comment-slot` as a JSX child. The InlineEditor / InlineComment mounts become declarative children of that slot rather than `render(h(...), container)` calls.
4. Delete `editor/inlineEditor.ts` and `editor/refinements.ts` (their manual mount logic).
5. Highlighting / mermaid / TOC run as `useEffect` hooks on the new `<MarkdownContent>` — same effects, declarative dependency on the rendered HTML.

Estimated ~2 working days with a human watching the viewer. Net deletion ~800–1000 LOC. The result is one rendering system, not two fighting over the same DOM.

## Why this exists

A whole-repo review surfaced three structural issues and a documentation/reality gap:

1. **Provider duplication** — 8 providers, no shared base class. Each `*CliProvider.ts` independently reimplements temp-file write, shell escaping, terminal lifecycle, and cleanup. ~700–900 LOC of copy-paste.
2. **Two extension files over 1k LOC** — `specViewerProvider.ts` (1110) and `messageHandlers.ts` (1001). Both bypass the helper modules sitting next to them. `updateContent()` alone is 227 LOC of mixed I/O + derivation + UI dispatch.
3. **Half-finished Preact migration** — components mounted on top of a still-live imperative DOM-rendering pipeline. `signals.ts` exists mainly to paper over the seam. Three independent systems (`renderer.ts` HTML strings, manual `render(h(…), slot)` mounts, delegated `actions.ts` handlers) coordinate on the same DOM.
4. **Docs lie about the codebase** — `architecture.md` claims 5 providers (reality: 8), lists files that no longer exist (`navigation.ts`, `scratchpad.ts`, `state.ts`), and omits the Preact rewrite entirely.

## Prevention strategy (Phase 0)

The real win isn't fixing the symptoms — it's structuring docs so they can't drift this way again.

- **Reduce surface area.** `architecture.md` stops enumerating files; it describes module responsibilities instead. Provider count lives in *one* place (the README provider matrix), with a `<!-- count must match package.json enum -->` marker.
- **Mechanize the checklist.** `scripts/check-docs.ts` asserts: (1) `package.json` aiProvider enum count == README matrix row count, (2) every `*Provider.ts` is named in `architecture.md`, (3) every doc-mentioned file path exists. Wired into `npm test`, so drift fails locally not just in CI.
- **Surface the CLAUDE.md checklist on relevant PRs** (future): a GitHub Action that nudges when `src/ai-providers/**`, `src/features/**`, or the aiProvider enum changes.

## Phases

| # | Phase | Status | LOC Δ (actual) | Risk | Commit |
|---|---|---|---|---|---|
| 0 | Docs match reality + restructure + `check-docs.ts` | ✅ shipped | +318 / −268 | none | `6a8f40e` |
| 1 | `CliTerminalProvider` base class | ✅ shipped | +454 / −833 | medium | `c4fd5dc` |
| 2 | `ProviderRegistry` (validated at module load) | ✅ shipped | +200 / −5 | low | `3d7c544` |
| 3 | `PanelStateComputer` (extract from specViewerProvider) | ✅ shipped | +646 / −307 | medium | `38911cf` |
| 4 | Typed dispatch map + queue class for messageHandlers | ✅ shipped | +215 / −222 | medium | `e610043` |
| 5 | Kill imperative webview layer | ⏸ deferred | est. −900 | med-high | (see note below) |
| 6 | `FooterActions` split | ⏸ deferred | est. −150 | low | (see note below) |
| 8 | Doc re-validation closeout | ✅ closed | small | none | this commit |

**Net so far:** +1833 / −1635 across 5 commits. The deletes outweigh the inserts when you exclude new tests (97 new tests added: 22 panelStateComputer, 9 providerRegistry, plus inline new cases in updated suites). Production code excluding tests is net-negative.

Phase 7 (watchlist drive-bys for `specExplorerProvider`, `steeringExplorerProvider`, `specCommands`, viewer `types.ts`) is **rolling** — opportunistic cleanup when an unrelated change opens the file, not scheduled.

**Sequencing:** 0 → 1 → 2 → (3 ∥ 4) → 5 → 6 → 8. Phases 3 and 4 can run in parallel (different files, no overlap). Total: ~7 working days.

**Net deletion:** ~2,700 LOC.

## Why Phases 5 and 6 are deferred

Both are frontend-only refactors of the spec viewer — the most-touched UI surface in the extension. The risk of subtle visual regression is real, and the existing automated coverage doesn't catch it:

- **Phase 5 (webview rewrite, est. −900 LOC):** the plan is to convert `markdown/renderer.ts` from "produces an HTML string" to "produces JSX," then delete `editor/inlineEditor.ts`, `editor/refinements.ts`, `actions.ts`, `modal.ts`, `toc.ts` (~1000 LOC of imperative DOM mutation) because every component currently mounted via manual `render(h(…), slot)` calls would now live in the proper component tree. That's a structural overhaul of the most-visible code in the extension. The only Jest coverage of the rendering pipeline is `webview/src/spec-viewer/markdown/renderer.test.ts` (160 LOC, tests the HTML-string output) — once the renderer returns JSX, that test has to be rewritten. Storybook stories cover individual components but aren't run in `npm test`. Safe completion needs a human to open the spec viewer against real spec content and confirm every visible state still renders correctly.
- **Phase 6 (`FooterActions.tsx` split):** the component has 18 Storybook stories covering its variants, but **no Jest unit test** (`tests/unit/spec-viewer/footerActions.spec.ts` tests the *extension-side* footer-action catalog, not the Preact component). Splitting `FooterActions.tsx` into `<LegacyFooter>` + `<CatalogFooter>` + `<GeneratingFooter>` would touch every step transition in the viewer, with zero automated guard against visual regression. Safe completion needs a Storybook visual diff or a human walkthrough of all 18 story variants.

The audit findings remain valid; the structural improvements still belong in the plan. They just need a session with visual verification available — either a human running the Extension Development Host alongside the refactor, or a Storybook visual-regression CI step added first. Treat these two phases as `/ultrareview`-style follow-ups, not autonomous work.

## Stop conditions

Each phase is an independently shippable commit. Safe stop points:
- After Phase 2 → providers cleaned up, docs accurate. ~1.5d invested.
- After Phase 4 → extension side done. ~3.5d invested. **(current state)**
- After Phase 5 → webview done. ~6d invested.
- Phase 6+8 are polish.

## Phase 0 detailed scope

### 0a — Restructure docs

- `docs/architecture.md`:
  - Replace per-directory **file lists** with **responsibility paragraphs**. Files are knowable from `ls`; responsibilities aren't.
  - Bump "5 supported providers" → 8: `claude`, `claude-vscode`, `gemini`, `copilot`, `codex`, `qwen`, `opencode`, `ide-chat`.
  - Rewrite `webview/src/spec-viewer/` section to reflect Preact (`App.tsx`, `index.tsx`, `components/`, `signals.ts`, `timelineEvents.ts`, `elapsedFormat.ts`, `relativeTime.ts`); drop dead names (`navigation.ts`, `scratchpad.ts`, `state.ts`).
- `docs/how-it-works.md`:
  - Mermaid diagram + intro line + "Supported AI Providers" matrix → 8 providers.
- `CLAUDE.md`:
  - Stop hard-coding the 5-provider list at the top. Reference the README matrix.
- `README.md`:
  - "Six providers ship today" → 8. Verify matrix matches `package.json` enum.
  - Add the `<!-- count must match package.json enum -->` marker.

### 0b — `scripts/check-docs.ts`

Asserts on each `npm test` run:
1. `package.json` `speckit.aiProvider.enum` length == count of rows in the README "Supported AI Providers" matrix.
2. Every file matching `src/ai-providers/*Provider.ts` appears by name in `docs/architecture.md`.
3. Every directory and `*.ts` path mentioned in `docs/architecture.md`, `docs/how-it-works.md`, or `CLAUDE.md` exists on disk.

~50–80 LOC. Fail loud with the specific mismatched value.

### 0c — Wire into npm test

Add `"check:docs": "tsx scripts/check-docs.ts"` and chain it into `"test"`.

## Exit criteria summary

Phase 0 is done when:
- `npm test` passes, including the new docs check.
- Provider count is consistent across `CLAUDE.md`, `README.md`, `docs/architecture.md`, `docs/how-it-works.md`, and `package.json` enum.
- `docs/architecture.md` no longer lists individual files (except where genuinely structural, like entry points).

## Notes

- Branch: `refactor/structural-cleanup` (off `main`, not stacked on any feature branch).
- One commit per phase. Reviewers read it commit-by-commit.
- This document is updated as phases complete.

---

# Round 2 — Reusability, Architecture, and Safe Phase 5/6 Landing

After Phases 0–4 shipped, a second-pass review of the now-cleaner codebase surfaced different findings — fewer god-files, more "what's the right shape for the next thing." The user's framing: *reusable, easy to update, well-architected*. Two parallel agents (backend + webview) reviewed independently; their findings converged on the plan below.

## What the round-2 review found

**Backend (`src/`):** the big-file watchlist is mostly resolved. The biggest remaining wins are **architectural boundaries**, not file sizes:

- 🚨 `specs/` and `spec-viewer/` have **bidirectional imports**. `specExplorerProvider.ts` reaches into `spec-viewer/stateDerivation.ts` for `isStepCompleted`. That's a layer violation — the sidebar shouldn't depend on the viewer. Move `isStepCompleted` (and a couple of sibling pure queries) into `specs/`, make the import one-way.
- 🟡 `specCommands.ts` (834 LOC) still has a 15-function closure sharing `specExplorer`/`filterState`/`sortState`. Extract a `specCommandRegistry.ts` that owns the registration loop; keep `specCommands.ts` as the dispatcher entry point. Bonus: lift the typed-dispatch pattern out of `messageHandlers.ts` into `core/utils/dispatcher.ts` so workflow-editor + future surfaces can reuse it.
- 🟡 `specViewerProvider.ts` is at ~970 LOC after Phase 3. Extract `panelLifecycle.ts` (the `Map<specDir, PanelInstance>` + debounce + dispose dance) — shrinks the provider to orchestration only, makes panel state unit-testable.
- 🟡 The `.spec-context.json` layer has five files (`specContextReader`, `Writer`, `Manager`, `Backfill`, `Reconciler`). Check if `specContextManager.ts` (272 LOC, marked "legacy" in architecture.md) is still imported by anything. If only legacy callers remain, delete it.
- 🟢 `messageHandlers.ts` (994 LOC) and `CommentMutationQueue` — leave alone. Density is real logic, not flab.

**Webview (`webview/`):** the agent found the **keystone**: ship Phase 6 *first*, with Jest tests added at the same time. That gives every subsequent imperative-layer kill a regression guard. Sequence becomes 4 small safe PRs instead of one risky mega-PR.

## Plan

| # | Phase | LOC Δ (est.) | Risk | Effort | Depends on |
|---|---|---|---|---|---|
| 9 | Break specs↔spec-viewer coupling (move `isStepCompleted` and pure queries into `specs/`) | small | low | 2h | none |
| 10 | Extract `specCommandRegistry.ts` + lift `TypedDispatcher` to `core/utils/` | −250 | low | 0.5d | none |
| 11 | Investigate & maybe delete `specContextManager.ts` | −272 (if removable) | very low | 30min | none |
| 12 | Extract `panelLifecycle.ts` from `specViewerProvider.ts` | −200 | medium | 0.5d | none |
| 5a | **Split `FooterActions.tsx` + add Jest test (the safety net)** | small | medium | 4h | none |
| 5b | Replace `modal.ts` with signal-driven `<RefineModal>` | −69 | low | 2h | 5a |
| 5c | Wrap `InlineEditor` + `InlineComment` in declarative components; delete imperative `render(h(…))` mounts in `editor/inlineEditor.ts` and `editor/refinements.ts` | −250 | medium | 4-5h | 5a |
| 5d | Migrate `renderer.ts` post-effects to `<MarkdownContent>` component | small | medium-high | 3-4h | 5a, 5b, 5c |
| 13 | Add `useDispatch()` hook centralizing the 41 `vscode.postMessage` callsites | small | low | 1h | 5a |

**Total Round-2 estimate:** ~3 working days. Each phase is an independently shippable commit.

## Why Phase 5a (FooterActions + Jest) is the keystone

`FooterActions.tsx` has 18 Storybook stories but **zero Jest coverage**. Storybook isn't run in `npm test`. Without a Jest baseline:
- Splitting the component is invisible-regression risky.
- Every subsequent webview change (RefineModal, InlineEditor wrappers, MarkdownContent) inherits the same gap.

With Phase 5a done — component split into `<GeneratingFooter>` / `<CatalogFooter>` / `<LegacyFooter>` + a 3-suite Jest test using `preact-render-to-string` — every Phase 5b/5c/5d change has a regression guard. This is what makes 5b–5d safe to ship without manual visual verification of every state.

## Reusability extracts to land

Two patterns are duplicated and worth lifting:

- **`TypedDispatcher<MsgUnion>` utility** in `core/utils/dispatcher.ts`. `messageHandlers.ts` already proves the pattern; `workflow-editor`'s action handlers and `spec-editor`'s message routing both have the same shape. One canonical helper, three users.
- **`useDispatch()` hook** in `webview/src/shared/hooks/`. Wraps `vscode.postMessage` with typed args. 41 callsites today; with the hook, components stop touching the global `vscode` handle directly. Easier to mock in tests, easier to add cross-cutting concerns (logging, debouncing) later.

## What we're explicitly NOT doing

- ❌ Generalizing `CommentMutationQueue` to a generic `SerialQueue` in `core/`. One-off until a second use case appears.
- ❌ Deleting `BaseManager` / `BaseTreeDataProvider`. They're thin but harmless; deleting saves nothing.
- ❌ Refactoring `messageHandlers.ts` further. Phase 4 already made it as good as it needs to be.
- ❌ Converting `actions.ts` / `toc.ts` / `highlighting.ts` to components. They're idempotent side-effect utilities; declarative-ifying them adds complexity without value.
- ❌ Adopting CSS modules wholesale. Current feature-prefix scheme is working; convert only on new components.

## Stop conditions (round 2)

- After Phase 9–12 (backend) → architectural coupling resolved, providers consistent. ~2d invested in round 2.
- After Phase 5a → safety net in place. Can stop here if energy runs out without leaving things broken.
- After Phase 5b–5d → webview migration done. The imperative layer is gone, signals are the sole source of truth.
- After Phase 13 → reusability extracts landed.

## What changes in this round vs. round 1

Round 1 was "delete the obvious sprawl." Round 2 is "shape what's left for the long run." Different mindset, smaller diffs, more architectural and less mechanical.

---

# Round 3 — State Handling

A focused state audit ran after the round-2 architecture review surfaced three concrete issues. State is mostly fine — derived values are computed not stored, spec context has a single canonical writer, the webview signal store is small — but four real fragilities remain.

## What the state audit found

🚨 **Context-key sprawl.** Eight context keys (`speckit.specs.filterActive`, `speckit.specs.noFilterMatch`, `speckit.specs.allCollapsed`, etc.) are written from **16 scattered call sites** with no coordination, no error handling on `setContext` failures, and no reset mechanism. Some get stuck — `allCollapsed` is set once at activation and never updated when the user expands. Two writers (filter state + tree provider) can race on the same key with no protection. This is the kind of bug surface that produces "menu item is greyed out and I don't know why" issues.

🚨 **Spec status is derived in three shapes.** Direct reads of `ctx.status`, ad-hoc `status === 'completed' || status === 'archived'` checks across `specExplorerProvider` and `stateDerivation`, and the `resolveSpecStatus()` priority ladder added in Phase 3. Callers have to know which branch to use. A new status (Phase-X "blocked") would need 6+ files touched and it's not obvious which.

🟡 **Webview signal/message ordering.** `viewerStateUpdated` does `{ ...navState.value, ...message.navState }` — if the message arrives before the initial `contentUpdated`, the spread is over `null` and the partial update is lost. `historyEntries` signal is stale until the next extension message arrives; the merge is shallow. Defensive null-checks downstream paper over it most of the time, but the gap is real.

🟡 **`lastFeatureCtx` cache never invalidated.** Used by the step-completion notifier to detect transitions. Survives file deletion and read failures. After a transient read fail, the notifier can fire on bogus deltas.

🟢 Most state is fine: spec context has a single sanctioned writer, derived values are computed not stored, `PanelInstance` is a clean single-owner map, signals are well-scoped.

## Plan (Round 3 phases)

| # | Phase | Effort | Risk |
|---|---|---|---|
| 14 | `ContextKeyManager` class — consolidate the 16 `setContext` writers | 4h | low |
| 15 | Single `getSpecStatus()` entry point — replace ad-hoc status checks | 3h | low |
| 16 | `SpecsSidebarState` class — unify filter + sort + collapse + their context keys | 0.5d | low |
| 17 | Webview state-init fix + `lastFeatureCtx` invalidation guards | 2h | low |

**Total Round-3 estimate:** ~1.5 working days. All low-risk because each phase consolidates already-working logic behind one entry point — no new behaviour, easier to verify than the webview migration.

## Why this matters for "ease of update"

The state audit ran three friction tests — what would it take to add a `blocked` status, a new sidebar filter mode, or a new field on `.spec-context.json`? Findings:

- **Add a status**: 6–8 files. Findable via grep, but several touch-points are non-obvious (resolveSpecStatus priority ladder, lifecycle handler, partition in tree provider).
- **Add a filter field**: 2–3 files. Reasonable, but the fuzzy-match indirection isn't obvious.
- **Add a `.spec-context.json` field**: 3–6 files. Backfill + derivation + webview integration are three separate touch-points.

Round 3 reduces all three numbers. With one `getSpecStatus()` and one `ContextKeyManager`, adding a status becomes "extend the union + add one handler" — every other call site picks it up for free.

## Updated full plan ordering

Backend first (lowest risk, lays groundwork), then state handling, then **component library** (builds the primitives the webview migration will use), then the webview migration (with safety net first):

```
9  → 10 → 11 → 12       (backend architecture)
14 → 15 → 16 → 17       (state handling)
18 → 19 → 20 → 21 → 22  (component library — see Round 4 below)
5a → 5b → 5c → 5d       (webview migration, with 5a as the test safety net,
                          and 5b reusing the <Modal> primitive from Phase 20)
13                       (useDispatch hook)
```

Each block can stop independently. Backend block ships ~2d in. State block ships ~3.5d in. Component library block ships ~5d in. Webview block ships ~7d in.


---

# Round 4 — Component Library

A library audit asked one question: *"Does this repo have an easy-to-use and extendable component library?"* The honest answer is **partial**. The foundations are good (Button + UndoToast + useInlineConfirm hook, plus a comprehensive token system in `tokens.css`), but the layer is undermined by:

- **19+ raw `<button>` elements** scattered across components (StaleBanner, CommentsCard, InlineComment, FilesCard, TasksCard, CreateSpecMock) — each reinventing its own styling.
- **No destructive variant** on Button — delete actions use raw buttons because there is no red/danger variant to reach for.
- **Toast is imperative single-instance** — `showToast(id, msg, ms)` mutates the DOM directly; a second toast cancels the first; FooterActions has manual state-tracking just to prevent stacking.
- **No `<Modal>` primitive** — `RefineModal` is vanilla DOM with `getElementById` + `.style.display`. (Phase 5b extracts this; consume the shared primitive from Phase 20 rather than building a one-off.)
- **No `<Card>` primitive** — 7 ActivityPanel cards independently reinvent the header/body/footer layout.
- **No `<Tooltip>` / `<EmptyState>` / `<Spinner>` primitives** — `title="…"` attrs and ad-hoc divs everywhere.
- **Badge component exists but is bypassed** — CSS-only badges (`.activity-status-pill`, `.activity-actor-badge`, `.task-row__status`) reimplement what `<Badge>` already does.

Audit verdict: *"This is a library of files I extracted, not a coherent design system."*

## Why this comes BEFORE the webview migration

Phase 5b extracts `<RefineModal>` from `modal.ts`. Phase 5c extracts `<InlineEditor>` / `<InlineComment>` wrappers. If we run those before adding `<Modal>` / `<Card>` / `<Tooltip>` primitives, each one becomes a feature-specific one-off and we have to consolidate again later. The right order is: primitives first, then migration consumes them.

## Plan (Round 4 phases)

| # | Phase | Effort | Risk |
|---|---|---|---|
| 18 | Button: add `destructive` variant + replace 19+ raw `<button>` elements | 0.5d | low |
| 19 | Toast queue — context-based, supports stacking; refactor 5 callsites | 0.5d | low-medium |
| 20 | Extract `<Card>` + `<Tooltip>` + `<EmptyState>` shared primitives | 0.5d | low |
| 21 | Badge consolidation — replace `.activity-status-pill` & siblings with `<Badge>` | 2h | very low |
| 22 | Input variant clarification + JSDoc + complete story coverage | 2h | very low |

**Total Round-4 estimate:** ~2 working days. All low-risk because shared primitives are additive — the existing imperative paths keep working until each callsite migrates.

## What good looks like after Round 4

- Every interactive element is a shared component. No raw `<button>` in the webview. No inline `<div class="card">`. No `title="…"` attrs.
- `webview/src/shared/components/` lists the design system: Button, Input, Badge, Card, Modal, Toast, Tooltip, EmptyState, Spinner, UndoToast.
- Every primitive has a `.stories.tsx` covering default + variants + edge cases. New contributors can see what variants exist at a glance.
- Adding a new variant is one TS file + one CSS rule + one story. Adding a new primitive is ~50 LOC.
- Phase 5b/5c/5d webview migration can declaratively compose `<Modal>` + `<Button>` + `<Input>` instead of building one-offs.

## What we are NOT doing in Round 4

- ❌ CSS modules / styled-components / runtime CSS-in-JS. The token-driven CSS approach works; convert that contract on a future framework swap, not now.
- ❌ A standalone npm-published design system. This is internal-only.
- ❌ Theming beyond what `tokens.css` already does (VS Code theme variables are already wired in).
- ❌ Renaming existing components for "consistency." Button stays Button.
