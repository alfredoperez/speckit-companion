/**
 * Server-rendered install banner shared by the Create-Spec and Activity panels.
 *
 * Both webviews build their outer HTML server-side, so the banner is a framework-free
 * HTML string injected into the body — the smallest, most testable surface (the
 * visibility decision is the unit-tested `shouldShowInstallPrompt`; this is just the
 * markup). The buttons carry `data-action` attributes; each webview's script posts the
 * matching message to the extension, which runs the install, opens the README, or
 * dismisses the banner for good (a global-state flag re-checked before rendering).
 */

/** Slim single-row banner: glyph + one line + Install + Learn more + dismiss. */
const BANNER_BODY = `
    <span class="install-banner__icon codicon codicon-rocket" aria-hidden="true"></span>
    <span class="install-banner__text">Install the spec-kit extension for the leaner <code>/speckit.companion.*</code> pipeline and capture.</span>
    <button class="install-banner__btn install-banner__btn--primary" data-action="installSpecKitExtension">Install</button>
    <button class="install-banner__btn install-banner__btn--link" data-action="openReadme">Learn more</button>
    <button class="install-banner__dismiss codicon codicon-close" data-action="dismissInstallBanner" aria-label="Dismiss install prompt"></button>`;

/**
 * Render the install banner, or an empty string when it must not appear. Pass the
 * already-computed visibility (`shouldShowInstallPrompt(mode, installed)`) so this
 * function stays pure markup with no I/O.
 */
export function renderInstallBannerHtml(visible: boolean): string {
    if (!visible) {
        return '';
    }
    return `<div class="install-banner" id="install-banner" role="region" aria-label="Install spec-kit extension">${BANNER_BODY}</div>`;
}
