/**
 * The install banner's inner markup — one nudge, one source.
 *
 * It lives under `src/protocol/` because both ends render it: the extension
 * injects it server-side into the Create-Spec panel, and the viewer's Preact
 * Activity panel renders the same string. `src/protocol/` is one of the few
 * paths `tsconfig.webview.json` lets the webview reach, and that boundary is
 * deliberate — this file must stay free of `vscode` imports.
 *
 * The buttons carry `data-action` attributes; each webview's script posts the
 * matching message, so the markup is the only thing shared.
 */
export const INSTALL_BANNER_BODY = `
    <span class="install-banner__icon codicon codicon-rocket" aria-hidden="true"></span>
    <span class="install-banner__text">Install the spec-kit extension for the leaner <code>/speckit.companion.*</code> pipeline and capture.</span>
    <button type="button" class="install-banner__btn install-banner__btn--primary" data-action="installSpecKitExtension">Install</button>
    <button type="button" class="install-banner__btn install-banner__btn--link" data-action="openReadme">Learn more</button>
    <button type="button" class="install-banner__dismiss codicon codicon-close" data-action="dismissInstallBanner" aria-label="Dismiss install prompt"></button>`;
