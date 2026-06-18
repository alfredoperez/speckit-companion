# Implementation Plan: Slim, dismissible install banner

**Feature**: `353-install-banner-slim` · **Issue**: #353

## Summary

Slim the install-prompt banner to a single compact row and make it permanently dismissible. The banner renders on two surfaces through two code paths: the Create-Spec view builds it server-side as an HTML string (`renderInstallBannerHtml` in `src/features/spec-editor/installBanner.ts`), and the spec-viewer Activity panel builds it as a Preact component (`InstallBanner` in `webview/src/spec-viewer/components/ActivityPanel.tsx`). Both share the same `install-banner` CSS and the same `data-action` click contract, so the markup change is mirrored across both. The dismiss decision is stored in the extension's `globalState` under a new key; each provider already computes the banner's visibility, so each gains an extra `&& !dismissed` term reading that flag, plus a new `dismissInstallBanner` webview→extension message that sets the flag and re-renders.

## Project Structure

```
src/
├── core/constants.ts                                    # add globalState.installBannerDismissed key
├── features/spec-editor/
│   ├── installBanner.ts                                 # slim markup + dismiss button (Create-Spec)
│   ├── types.ts                                         # add dismissInstallBanner message type
│   └── specEditorProvider.ts                            # gate on dismissed flag; handle dismiss msg
├── features/spec-viewer/
│   ├── types.ts                                         # add dismissInstallBanner message type
│   ├── messageHandlers.ts                               # handle dismiss msg → set flag → refresh
│   └── specViewerProvider.ts                            # gate computeShowInstallPrompt on dismissed
webview/
├── src/spec-editor/
│   ├── index.ts                                         # post dismiss msg on × click
│   └── types.ts                                         # add dismissInstallBanner message type
├── src/spec-viewer/
│   ├── components/ActivityPanel.tsx                     # slim Preact banner + dismiss button
│   ├── components/ActivityPanel.stories.tsx             # cover slim + dismissed states
│   └── html/generator.ts                                # delegate × click → post dismiss msg
└── styles/spec-viewer/_install-banner.css               # restyle to single compact row + × button
CHANGELOG.md                                             # user-facing entry
```

**Structure Decision**: No new files. The change threads a single `dismissed` boolean from `globalState` (read in each provider) through the existing visibility gate, and adds one new message type across the existing spec-editor and spec-viewer message unions. Banner markup is edited in the two existing renderers; CSS is restyled in place.

## Constitution Check

No `.specify/memory/constitution.md` is present in this project, so there is no formal constitution gate. The change is held to the repo conventions in `CLAUDE.md` and `.claude/review-checklist.md` instead:

| Principle | Assessment |
|-----------|------------|
| Webview invariants (aria-label, `e.target instanceof Element` guard, design tokens) | PASS — dismiss button gets `aria-label`; both click delegations guard `e.target`; colors via VS Code theme tokens |
| Extension isolation (no `.claude/**` / `.specify/**` edits) | PASS — all behavior lives in `src/` and `webview/` |
| globalState (not workspaceState) for cross-workspace persistence | PASS — flag stored in `context.globalState` |
| Stories stay in sync | PASS — `ActivityPanel.stories.tsx` updated for slim + dismissed |
| No version bump in feature PR | PASS — `package.json` untouched |

## Key Decisions

- **Decision**: Store one global boolean `speckit.installBannerDismissed`. **Rationale**: Issue requires "stays dismissed everywhere," which is exactly `globalState` (machine-wide) vs `workspaceState` (per-folder). A single boolean is the smallest sufficient state; no per-surface or per-version dismissal is in scope. **Alternatives**: per-workspace dismissal (rejected — issue explicitly wants global); a settings.json entry (rejected — this is a transient UI choice, not user configuration, and globalState is the established pattern for `initSuggestionDismissed`).
- **Decision**: Add the dismissed term to each provider's existing visibility computation rather than to the shared pure `shouldShowInstallPrompt`. **Rationale**: `shouldShowInstallPrompt(enabled, installed)` is unit-tested and stays a pure two-input predicate; the dismissed flag is I/O (a `globalState` read) that belongs in the provider, consistent with how `installed` is already read there. **Alternatives**: widen `shouldShowInstallPrompt` to three args (rejected — pushes I/O into the pure helper and rewrites its tests for no gain).
- **Decision**: Reuse the existing `data-action` click-delegation contract; add `data-action="dismissInstallBanner"` to the × button. **Rationale**: Both surfaces already delegate clicks on `#install-banner [data-action]`; the dismiss button slots into that exact path. Both delegation handlers already guard `e.target instanceof Element` (spec-editor `index.ts`) / use `.closest()` after a guard — verify and keep the guard. **Alternatives**: a dedicated `id`-based listener (rejected — duplicates the working delegation).
