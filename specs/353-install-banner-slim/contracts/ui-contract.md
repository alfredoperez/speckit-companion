# UI Contract: Slim, dismissible install banner

## DOM / markup contract (both surfaces)

The banner keeps its existing identifiers so the shared CSS and click delegation continue to resolve:

- Root: `<div class="install-banner" id="install-banner" role="region" aria-label="Install spec-kit extension">`
- Glyph: `codicon codicon-rocket`, `aria-hidden="true"`
- Install action: `button` with `data-action="installSpecKitExtension"`
- Learn more action: `button`/link with `data-action="openReadme"`
- **New** dismiss action: `button` with `data-action="dismissInstallBanner"` and `aria-label="Dismiss install prompt"`

All three actions are reached through the existing delegated handler on `#install-banner [data-action]`.

## Message contract (webview → extension)

New message added to **both** unions (`src/features/spec-editor/types.ts`, `src/features/spec-viewer/types.ts`, and the webview-side `webview/src/spec-editor/types.ts`):

```
{ type: 'dismissInstallBanner' }
```

Handled by:
- `specEditorProvider.handleMessage` — `case 'dismissInstallBanner'`
- spec-viewer `messageHandlers` — `dismissInstallBanner` entry

Handler effect: set `globalState[speckit.installBannerDismissed] = true`, then re-render the surface without the banner.

## State contract

- Global-state key: `speckit.installBannerDismissed` (boolean). Absent/`false` ⇒ may show; `true` ⇒ never show.
- Visibility, per surface: `shouldShowInstallPrompt(enabled, installed) && !dismissed`.
