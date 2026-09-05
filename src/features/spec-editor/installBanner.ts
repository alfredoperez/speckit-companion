/**
 * Server-rendered install banner shared by the Create-Spec and Activity panels.
 *
 * Both webviews build their outer HTML server-side, so the banner is a framework-free
 * HTML string injected into the body — the smallest, most testable surface (the
 * decision is the unit-tested `resolveInstallPrompt`; this is just the
 * markup). The buttons carry `data-action` attributes; each webview's script posts the
 * matching message to the extension, which runs the install, opens the README, or
 * dismisses the banner (a global-state flag re-checked before rendering).
 */

import { INSTALL_BANNER_BODY, installBannerFrame } from '../../protocol/installBannerBody';
import type { InstallPrompt } from '../../protocol/viewer';

export { INSTALL_BANNER_BODY };

/** Render the install or update banner, or an empty string when nothing should appear. Pure markup, no I/O. */
export function renderInstallBannerHtml(prompt: InstallPrompt | null): string {
    if (!prompt) {
        return '';
    }
    const { className, ariaLabel, body } = installBannerFrame(prompt);
    return `<div class="${className}" id="install-banner" role="region" aria-label="${ariaLabel}">${body}</div>`;
}
