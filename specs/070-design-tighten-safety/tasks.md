# Tasks: Design Tighten & Safety

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-20

---

## Phase 1: Core Implementation (Sequential)

### Bundle A — Tighten (Foundation: tokens + asset bundling)

- [x] **T001** Promote `_variables.css` to webview-root `tokens.css` with reduced-motion block — `webview/styles/tokens.css` | R001, R028
  - **Do**: Create `webview/styles/tokens.css` with every token currently in `webview/styles/spec-viewer/_variables.css` (colors, spacing, radii, typography). Append a global `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }` block at the end.
  - **Verify**: File exists; every var name from `_variables.css` is present; reduced-motion block is syntactically valid CSS.
  - **Leverage**: `webview/styles/spec-viewer/_variables.css` (copy token definitions verbatim).

- [x] **T002** Bundle Geist Variable font locally — `webview/fonts/geist-vf.woff2` | R018
  - **Do**: Download the Geist Variable woff2 currently referenced from `cdn.jsdelivr.net` in `src/features/spec-viewer/html/generator.ts` and save it to `webview/fonts/geist-vf.woff2`. Commit the binary.
  - **Verify**: `ls webview/fonts/geist-vf.woff2` returns the file; size is non-zero; `file webview/fonts/geist-vf.woff2` reports a Web Open Font Format 2 file.

- [x] **T003** Add `@vscode/codicons` dependency — `package.json` | R019
  - **Do**: Add `@vscode/codicons` to `dependencies` in `package.json`. Run `npm install`.
  - **Verify**: `node_modules/@vscode/codicons/dist/codicon.css` and `codicon.ttf` exist; `package-lock.json` is updated.

- [x] **T004** Copy fonts + codicons into `dist/webview/` on build *(depends on T002, T003)* — `webpack.config.js` | R020
  - **Do**: Add (or reuse) a `CopyPlugin` entry that copies `webview/fonts/*` → `dist/webview/fonts/` and `node_modules/@vscode/codicons/dist/codicon.{css,ttf}` → `dist/webview/codicons/`. Install `copy-webpack-plugin` if it's not already a devDependency.
  - **Verify**: `npm run compile` produces `dist/webview/fonts/geist-vf.woff2` and `dist/webview/codicons/codicon.css` + `codicon.ttf`.
  - **Leverage**: existing `CopyPlugin` patterns in `webpack.config.js` if any.

- [x] **T005** Ensure bundled assets ship in the `.vsix` *(depends on T004)* — `.vscodeignore` | R020
  - **Do**: Audit `.vscodeignore`; ensure no rule excludes `dist/webview/fonts/**` or `dist/webview/codicons/**`. Add explicit `!dist/webview/fonts/**` and `!dist/webview/codicons/**` whitelist entries if the current rules are broad.
  - **Verify**: `npm run package` produces a `.vsix`; `unzip -l *.vsix | grep -E '(geist-vf|codicon)'` lists all three files (woff2, css, ttf).

### Bundle A — CSP + webview asset loading

- [x] **T006** Load Geist + codicons via webview URIs in spec-viewer *(depends on T004)* — `src/features/spec-viewer/html/generator.ts` | R017, R018, R019
  - **Do**: Replace the `@font-face` CDN `src: url(https://cdn.jsdelivr.net/...)` with `webview.asWebviewUri(Uri.joinPath(extensionUri, 'dist/webview/fonts/geist-vf.woff2'))`. Add a `<link rel="stylesheet">` for `dist/webview/codicons/codicon.css` via `webview.asWebviewUri(...)`. Update the CSP `font-src` to just `${webview.cspSource}` (drop `https://cdn.jsdelivr.net`); leave `style-src` / `script-src` allowances for highlight.js/mermaid intact.
  - **Verify**: `npm run compile` succeeds; open a spec in the dev host with the devtools Network tab — no request to `cdn.jsdelivr.net` for fonts; the Geist and codicon files load from `vscode-webview://...`.

- [x] **T007** Load codicons via webview URI in spec-editor *(depends on T004)* — `src/features/spec-editor/specEditorProvider.ts` | R017, R019
  - **Do**: Add a `<link rel="stylesheet">` to the bundled `dist/webview/codicons/codicon.css` via `webview.asWebviewUri(...)` in the HTML builder. Update the CSP `font-src` to allow `${webview.cspSource}` for the ttf; ensure no CDN refs remain in this provider's CSP.
  - **Verify**: Open the spec-editor; codicons render; devtools shows no CDN request; `compile` + `test` remain green.

### Bundle A — Stylesheets import shared tokens

- [x] **T008** Replace `_variables.css` with `tokens.css` import in spec-viewer *(depends on T001)* — `webview/styles/spec-viewer/index.css` | R001
  - **Do**: Replace the `@import './_variables.css'` line with `@import '../tokens.css'` in `webview/styles/spec-viewer/index.css`. Delete `webview/styles/spec-viewer/_variables.css`.
  - **Verify**: `grep -r _variables.css webview/` returns no hits; `npm run compile` succeeds; spec-viewer still themes correctly in dev host.

- [x] **T009** Rewrite `workflow.css` to consume shared tokens *(depends on T001)* — `webview/styles/workflow.css` | R002, R003, R004, R005, R013, R014, R016
  - **Do**: Delete the duplicate `:root` block and every `@media (prefers-color-scheme: …)` / `body.vscode-*` token override block (currently ~lines 10–141). Keep only the `*` and `body` resets. Add `@import './tokens.css'` at the top. Change step-indicator size from 40 px to 16 px. Replace every `var(--radius-md)` usage (lines ~957, ~1053) with `var(--radius-sm)`. Standardize button padding: `6px 14px` for secondary/enhancement, `8px 24px` for primary. Replace every `rgba(59, 130, 246, N)` literal with `color-mix(in srgb, var(--accent) M%, transparent)` where M matches the opacity. Collapse any multi-layer `box-shadow` halo on active step indicators to `box-shadow: 0 0 0 2px var(--accent)`. Swap the `🌱` emoji in the "SPEC COMPLETED" badge for `<span class="codicon codicon-sparkle"></span>` (or nearest semantic glyph) — note this is a CSS `content:` on a pseudo-element or an HTML swap depending on where it lives; prefer the HTML swap if the emoji is in markup.
  - **Verify**: `grep -nE "rgba\\(59,\\s*130,\\s*246" webview/styles/workflow.css` returns nothing; `grep -n "radius-md" webview/styles/workflow.css` returns nothing; `grep -n "🌱" webview/styles/workflow.css` returns nothing; step indicator in the workflow editor renders at 16 px in dev host.

- [x] **T010** Adopt shared tokens + codicon styling in spec-editor *(depends on T001)* — `webview/styles/spec-editor.css` | R006, R017
  - **Do**: Add `@import './tokens.css'` at the top. Replace `var(--vscode-editor-background)` / `var(--vscode-foreground)` / `var(--vscode-focusBorder)` / similar raw references with `var(--bg-primary)` / `var(--text-primary)` / `var(--accent)` / etc. wherever semantic equivalents exist. Add styling for bundled codicons (font-family, size baseline if needed).
  - **Verify**: `grep -nE "var\\(--vscode-(editor|foreground|focusBorder|textLink|button)" webview/styles/spec-editor.css` returns substantially fewer hits (only those without semantic equivalents); `npm run compile`; spec-editor still themes correctly in dev host.

- [x] **T011** Render markdown `<hr>` as a thin divider — `webview/styles/spec-viewer/_content.css` (or the file currently targeting `hr`) | R021
  - **Do**: Replace the `hr { display: none; }` rule with `hr { border: none; border-top: 1px solid var(--border); margin: var(--space-4) 0; }`.
  - **Verify**: `grep -n "^hr\\|[^a-z]hr\\s*{" webview/styles/spec-viewer/_content.css`; render a spec containing `---` and confirm a thin divider appears in dev host.

### Bundle A — StepTab canonical states + nav merge

- [x] **T012** Drop legacy pulse + pulse-glow animations — `webview/styles/spec-viewer/_animations.css` | R009, R015
  - **Do**: Delete the `.step-tab.pulse` rule and `@keyframes step-tab-pulse`. Delete `@keyframes pulse-glow` and the `.empty-state button { animation: pulse-glow ... infinite; }` rule. Leave the `working-pulse` animation used by `in-flight` step-tabs in place.
  - **Verify**: `grep -n "step-tab-pulse\\|pulse-glow" webview/styles/spec-viewer/_animations.css` returns nothing; `npm run compile`.

- [x] **T013** Drop legacy nav class variants + focus-ring suppression — `webview/styles/spec-viewer/_navigation.css` | R009, R010, R011, R029
  - **Do**: Delete the `.step-tab.reviewing` dashed-outline variant. Delete the `.step-tab:focus-visible { outline: none; }` rule. Remove `.related-bar` selectors entirely. Remove styles tied to the "Overview" related tab. Introduce a right-aligned slot inside `.nav-primary` (e.g., `.nav-primary > .related-tabs`) that hosts related tabs. Also remove any stray `outline: none` on focusable elements in this file unless paired with an equivalent visible focus indicator.
  - **Verify**: `grep -nE "reviewing|related-bar|related-tab.*overview" webview/styles/spec-viewer/_navigation.css` returns nothing; `grep -n "outline:\\s*none" webview/styles/spec-viewer/_navigation.css` returns only rules that are replaced with a visible focus indicator.

- [x] **T014** Audit global base styles for hidden focus rings — `webview/styles/spec-viewer/_base.css` | R029
  - **Do**: Confirm the global `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` rule is present. Remove any stray `outline: none` declarations on focusable elements that are not paired with an equivalent visible indicator.
  - **Verify**: `grep -n "outline:\\s*none" webview/styles/spec-viewer/_base.css` returns nothing (or only pairings covered by visible replacements); tab through every focusable element in dev host and confirm the 2 px accent outline is visible.

- [x] **T015** Collapse StepTab to four canonical states + orthogonal `stale` *(depends on T012, T013)* — `webview/src/spec-viewer/components/StepTab.tsx` | R007, R008
  - **Do**: Rewrite the `classes` expression so each tab emits exactly one of `current` | `done` | `in-flight` | `locked` (plus optional `stale`). Remove every legacy class: `viewing`, `reviewing`, `workflow`, `working`, `in-progress`, `tasks-active`, `pulse`, `completed`, `exists`, `disabled`. Map the four canonical states to the visual spec in R008: `current` = 1 px accent outline + accent-colored label; `done` = green check in circle + secondary label; `in-flight` = accent % pill + single `working-pulse` animation; `locked` = 0.4 opacity, `cursor: not-allowed`, not clickable (`aria-disabled="true"`, no click handler).
  - **Verify**: Existing or new unit tests assert class output for each state; `grep -nE "'viewing'|'reviewing'|'workflow'|'working'|'in-progress'|'tasks-active'|'pulse'|'completed'|'exists'|'disabled'" webview/src/spec-viewer/components/StepTab.tsx` returns nothing; `npm test` passes.
  - **Leverage**: existing class-computation pattern in `StepTab.tsx` (replace, don't layer).

- [x] **T016** Update StepTab stories to four canonical states + stale variants *(depends on T015)* — `webview/src/spec-viewer/components/StepTab.stories.tsx` | R007, R008
  - **Do**: Regenerate stories to cover `current`, `done`, `in-flight`, `locked` and each of those with `stale`. Remove any stories referencing legacy class names.
  - **Verify**: Stories render each state visually in the storybook harness (if wired); `npm test` still green.

- [x] **T017** Sweep codebase for stale references to removed StepTab classes *(depends on T015)* — codebase-wide | R007
  - **Do**: `grep -rnE "\\b(viewing|reviewing|workflow|working|in-progress|tasks-active|pulse|completed|exists|disabled)\\b" webview/src webview/styles src | grep -v '\\.test\\.'` — audit every remaining hit; remove or rename any rule/test that keyed on the removed step-tab class names. Common-word matches (`disabled` as an attribute, `completed` on non-StepTab contexts) stay.
  - **Verify**: No CSS rule in `webview/styles/` still targets `.step-tab.viewing` / `.step-tab.reviewing` / etc.; `npm test` passes.

- [x] **T018** Delete `RelatedBar` component + stories — `webview/src/spec-viewer/components/RelatedBar.tsx` (+ stories) | R010
  - **Do**: Delete `RelatedBar.tsx` and `RelatedBar.stories.tsx`. Remove every import of `RelatedBar` from `NavigationBar.tsx` and elsewhere.
  - **Verify**: `grep -rn RelatedBar webview/src src` returns nothing; `npm run compile` passes.

- [x] **T019** Render related tabs in a right-aligned slot inside `.nav-primary` *(depends on T013, T018)* — `webview/src/spec-viewer/components/NavigationBar.tsx` | R010, R011
  - **Do**: Move the related-tabs markup into a right-aligned child of `.nav-primary` (matching the CSS slot introduced in T013). Remove the "Overview" related tab entirely (the parent step-tab already routes to overview).
  - **Verify**: In dev host the DOM shows `.compact-nav` → `.nav-primary` (step-tabs left, related-tabs right) → optional `.stale-banner` → single-row `.spec-header`, with no `.related-bar` element and no "Overview" related tab.

- [x] **T020** Collapse `SpecHeader` to single flex row — `webview/src/spec-viewer/components/SpecHeader.tsx` | R012
  - **Do**: Rewrite the render tree to a single flex row: `[badge] [title] [branch]`. Delete the `<hr class="spec-header-separator" />` and the `spec-header-row-1` / `spec-header-row-3` wrapper divs. Update or delete any CSS that keyed on those class names.
  - **Verify**: DOM shows a single flex `.spec-header` with three children and no internal `<hr>`; spec-viewer still renders correctly in dev host.

### Bundle A — Workflow theme-aware Mermaid + UI polish

- [x] **T021** Wire theme-aware Mermaid + MutationObserver — `webview/src/workflow.ts`, `src/features/workflow-editor/workflowEditorProvider.ts` | R022
  - **Do**: In `workflow.ts`, read `document.body.classList` on init to pick Mermaid theme variables: `vscode-light` → light, `vscode-dark` → dark, `vscode-high-contrast` → high-contrast. Set up a `MutationObserver` on `document.body` (attributeFilter: `['class']`) that debounces 200 ms and re-initializes Mermaid with matching theme variables. In `workflowEditorProvider.ts`, pass the initial theme class through the bootstrap HTML so the observer starts with correct values.
  - **Verify**: In dev host, toggle VS Code between Dark+, Light+, and a high-contrast theme with a workflow diagram open; the diagram re-renders with theme-appropriate colors within ~200 ms; no hard-coded blue leaks through.
  - **Leverage**: existing mermaid init in `webview/src/workflow.ts`.

- [x] **T022** Rename "Load Existing Spec" → "Load Template" + swap emoji chrome for codicons — `webview/src/spec-editor/` (Create New Spec page) | R016, R017, R023
  - **Do**: Rename the button label from "Load Existing Spec" to "Load Template" (message type `requestTemplateDialog` stays). Replace the `📄` on the Load Template button and `📎` on the Attach Image button with `<span class="codicon codicon-file"></span>` and `<span class="codicon codicon-file-media"></span>` (or closest semantic codicon).
  - **Verify**: `grep -rn "Load Existing Spec" webview/src src` returns nothing; `grep -rn "📄\\|📎" webview/src/spec-editor` returns nothing; buttons render with codicons in dev host.

### Bundle B — Safety (undo, confirm, focus, motion)

- [x] **T023** Add `useInlineConfirm` hook — `webview/src/shared/hooks/useInlineConfirm.ts` | R026
  - **Do**: Create a Preact hook `useInlineConfirm(action: () => void, { label = 'Confirm?', window = 3000 } = {})` returning `{ label, onClick }`. First click sets internal `armed` state and starts a 3 s timer that clears `armed`. Second click while `armed` fires `action()` and clears state. Clean up timer on unmount.
  - **Verify**: Unit tests cover: (a) first click arms + swaps label; (b) 3 s elapse reverts label without firing action; (c) second click within window fires action exactly once; (d) timer cleared on unmount; `npm test` passes.

- [x] **T024** Add `UndoToast` shared component *(depends on T023 for hook patterns)* — `webview/src/shared/components/UndoToast.tsx` (+ optional stories) | R024, R025, R030
  - **Do**: Create `UndoToast({ message, countdownMs = 5000, onElapse, onUndo })` as a Preact component. Render using `.action-toast` styling with a visible countdown progress indicator (linear bar or text) and an `[Undo]` button. Fire `onElapse` when the timer completes; fire `onUndo` and clear the timer on button click or Esc keydown. Gate appearance via a prop so the caller can suppress it when another run is in flight (R030). Add `UndoToast.stories.tsx` if other shared components already have stories.
  - **Verify**: Unit tests cover: counter decrements, Esc cancels, Undo button cancels, elapse fires once. Visual check in dev host: toast matches existing `.action-toast` styling; progress indicator is readable in light + dark + high-contrast.
  - **Leverage**: `.action-toast` styling in `webview/styles/spec-viewer/_footer.css`.

- [x] **T025** Tighten thumbnail remove button visibility — `webview/styles/spec-viewer/_footer.css` | R025, R027
  - **Do**: Verify `.action-toast` selector names match what `UndoToast` expects (adjust tokens if renamed in T001). Update `.image-thumbnail .remove-btn` rules: rest `opacity: 0.5`, `:hover` and `:focus-visible` `opacity: 1`. Remove any rule that hides the button until hover.
  - **Verify**: Attach an image in spec-editor dev host; remove button is visible at rest (opacity 0.5), opaque on hover, and opaque + focus-ring-visible when tabbed to.

- [x] **T026** Wire Regenerate through `UndoToast` *(depends on T024)* — `webview/src/spec-viewer/components/FooterActions.tsx` | R024, R030
  - **Do**: On Regenerate click, queue the backend message and render `<UndoToast message="Regenerating in 5s…" countdownMs={5000} onElapse={dispatchRegenerate} onUndo={cancel} />`. Respect the existing run-lock: do not show the toast if another step is already running (the Regenerate button stays `disabled` in that case). Dispatch the backend `regenerate` message only on elapse, not on click.
  - **Verify**: In dev host: clicking Regenerate shows the toast; Esc cancels; Undo button cancels; waiting 5 s dispatches the message exactly once; clicking Regenerate during an active run is blocked by the existing disabled state.

- [x] **T027** Two-click "Confirm?" for Archive / Complete / Reactivate *(depends on T023)* — `webview/src/spec-viewer/components/SpecHeader.tsx` (+ any Reactivate call-site) | R026
  - **Do**: Wrap Archive, Complete, and Reactivate handlers with `useInlineConfirm`. First click swaps the button label to "Confirm?" for 3 s; second click within the window fires the action; otherwise the label reverts silently.
  - **Verify**: In dev host, click each of Archive / Complete / Reactivate: label swaps to "Confirm?" and reverts after 3 s with no action taken; double-click within window fires the action; `npm test` passes.

### Docs

- [x] **T028** Document offline asset bundling + safety affordances — `README.md` | Bundle A + Bundle B
  - **Do**: Under the Features / Configuration section, note that Geist + codicons ship bundled so the extension runs fully offline. Under a Safety or Destructive Actions subsection, describe the 5 s Regenerate undo toast and the two-click "Confirm?" affordance for Archive / Complete / Reactivate. Match the README's existing tone.
  - **Verify**: `grep -nE "offline|Undo|Confirm" README.md` returns the new entries; the README still renders correctly on GitHub.

---

## Progress

- Phase 1: T001–T028 [x]
