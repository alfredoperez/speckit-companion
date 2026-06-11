/**
 * Server-rendered install banner shared by the Create-Spec and Activity panels.
 *
 * Both webviews build their outer HTML server-side, so the banner is a framework-free
 * HTML string injected into the body — the smallest, most testable surface (the
 * visibility decision is the unit-tested `shouldShowInstallPrompt`; this is just the
 * markup). The buttons carry `data-action` attributes; each webview's script posts the
 * matching message to the extension, which runs the install / opens the README.
 */

/** Banner copy + the two action buttons (install inline, README fallback link). */
const BANNER_BODY = `
    <div class="install-banner__icon"><span class="codicon codicon-rocket" aria-hidden="true"></span></div>
    <div class="install-banner__text">
        <strong>Install the spec-kit extension to unlock Turbo & Capture</strong>
        <span>The companion spec-kit extension adds the leaner <code>/speckit.companion.*</code> pipeline and lifecycle capture. It's a one-click install — no need to leave the editor.</span>
    </div>
    <div class="install-banner__actions">
        <button class="install-banner__btn install-banner__btn--primary" data-action="installSpecKitExtension">Install spec-kit extension</button>
        <button class="install-banner__btn install-banner__btn--link" data-action="openReadme">Learn more</button>
    </div>`;

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
