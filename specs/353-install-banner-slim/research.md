# Research: Slim, dismissible install banner (#353)

## Decision 1 — persistence: `globalState`, key `speckit.installBannerDismissed`

- **Decision**: Store a single boolean in `context.globalState` under a new key added to `ConfigKeys.globalState` in `src/core/constants.ts` (e.g. `installBannerDismissed: 'speckit.installBannerDismissed'`).
- **Rationale**: The issue requires the dismissal to "stay dismissed everywhere." `globalState` is machine-wide; `workspaceState` is per-folder. The repo already uses `globalState` for an equivalent one-time-dismiss affordance (`initSuggestionDismissed`, read in `extension.ts`), so this matches the established pattern.
- **Alternatives**: `workspaceState` (rejected — per-workspace, the opposite of the requirement); a `settings.json` config entry (rejected — a transient UI dismissal is not user configuration).

## Decision 2 — visibility gate lives in the providers, not the pure helper

- **Decision**: Keep `shouldShowInstallPrompt(enabled, installed)` a pure two-arg predicate. Add the `&& !dismissed` term where each provider already computes visibility: `specEditorProvider` (the `renderInstallBannerHtml(...)` call site) and `specViewerProvider.computeShowInstallPrompt()`.
- **Rationale**: `installed` is already read from disk in the provider, and `dismissed` is the same kind of I/O (a `globalState` read). Both providers hold `this.context`, so the read is local. Leaving the pure helper untouched preserves its unit tests.
- **Alternatives**: Widen `shouldShowInstallPrompt` to a third `dismissed` arg (rejected — moves I/O concerns into the pure helper and forces a test rewrite for no benefit).

## Decision 3 — dismiss wiring reuses the existing `data-action` delegation

- **Decision**: Render the × button with `data-action="dismissInstallBanner"` and `aria-label="Dismiss install prompt"`. Both surfaces already delegate clicks on `#install-banner [data-action]` and both already guard `e.target instanceof Element` before `.closest()` (verified: `webview/src/spec-editor/index.ts` and the inline script in `src/features/spec-viewer/html/generator.ts`). Add a `dismissInstallBanner` branch to each that posts `{ type: 'dismissInstallBanner' }`.
- **Rationale**: The dismiss action is one more `data-action`; it slots into the working delegation without a new listener. The instanceof guard is already in place, satisfying the webview invariant.
- **Alternatives**: A dedicated id-bound listener (rejected — duplicates the existing delegation and risks the not-yet-mounted-banner pitfall the viewer comment already documents).

## Decision 4 — extension-side handlers set the flag, then re-render

- **Decision**: Add a `dismissInstallBanner` case to `specEditorProvider.handleMessage` and to the spec-viewer `messageHandlers` map. Each sets `context.globalState.update(ConfigKeys.globalState.installBannerDismissed, true)` then re-renders its surface (Create-Spec re-runs `handleReady`/refresh; the viewer refreshes the active panel so `computeShowInstallPrompt()` now returns false and the Preact banner unmounts).
- **Rationale**: Re-rendering after the write is what makes the banner vanish without a manual reload, satisfying FR-002 and FR-008. The viewer already has a refresh path that recomputes `showInstallPrompt` and posts a fresh `navState`.
- **Alternatives**: Optimistic client-side hide only (rejected — would not persist and would re-appear on the next render).

## Decision 5 — CSS: single compact row + dismiss button

- **Decision**: Restyle `.install-banner` to a single-row flex layout (glyph + one line of text + Install + Learn more + ×) and add a `.install-banner__dismiss` button styled with theme tokens (`--vscode-foreground`, transparent background, hover state). Drop the `flex-wrap`/multi-line text block; collapse the heading+paragraph into one short line.
- **Rationale**: "Smaller footprint" → one row. The existing tokens already drive the banner; the dismiss button reuses them for theme-correctness.
- **Alternatives**: A collapse-to-one-liner-after-first-view (mentioned as optional in the issue; rejected for scope — permanent dismissal already removes the friction).
