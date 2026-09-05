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

import { INSTALL_BANNER_BODY } from '../../protocol/installBannerBody';

export { INSTALL_BANNER_BODY };

/**
 * Render the install banner, or an empty string when it must not appear. Pass the
 * already-computed visibility (`shouldShowInstallPrompt(mode, installed)`) so this
 * function stays pure markup with no I/O.
 */
export function renderInstallBannerHtml(visible: boolean): string {
    if (!visible) {
        return '';
    }
    return `<div class="install-banner" id="install-banner" role="region" aria-label="Install spec-kit extension">${INSTALL_BANNER_BODY}</div>`;
}
