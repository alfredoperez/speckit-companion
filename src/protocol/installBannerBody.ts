import type { InstallPrompt } from './viewer';

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
 * matching message, so the markup is the only thing shared. The dismiss button
 * also carries the prompt it closes, so the extension writes the right flag
 * even if the on-disk gap has changed since the banner was drawn.
 */
export const INSTALL_BANNER_BODY = `
    <span class="install-banner__icon codicon codicon-rocket" aria-hidden="true"></span>
    <span class="install-banner__text">Install the spec-kit extension for the leaner <code>/speckit.companion.*</code> pipeline and capture.</span>
    <button type="button" class="install-banner__btn install-banner__btn--primary" data-action="installSpecKitExtension">Install</button>
    <button type="button" class="install-banner__btn install-banner__btn--link" data-action="openReadme">Learn more</button>
    <button type="button" class="install-banner__dismiss codicon codicon-close" data-action="dismissInstallBanner" aria-label="Dismiss install prompt"></button>`;

/** The out-of-date sentence, shared by every surface so they all say the same thing. */
export function updateBannerText(installed: string, expected: string): string {
    return `SpecKit commands are ${installed}, this extension expects ${expected}.`;
}

/** The update variant: one line naming both versions, Update, ×. */
export function updateBannerBody(installed: string, expected: string): string {
    return `
    <span class="install-banner__icon codicon codicon-arrow-circle-up" aria-hidden="true"></span>
    <span class="install-banner__text">${updateBannerText(installed, expected)}</span>
    <button type="button" class="install-banner__btn install-banner__btn--primary" data-action="installSpecKitExtension">Update</button>
    <button type="button" class="install-banner__dismiss codicon codicon-close" data-action="dismissInstallBanner" aria-label="Dismiss update prompt"></button>`;
}

/**
 * Everything the wrappers need for one prompt: the outer element's classes, label and
 * `data-*`, plus the body. The prompt rides on the root so a click reports the banner the
 * user actually saw — the extension's own view of the gap may have moved on since it rendered.
 * Versions are semver-validated upstream, so they are safe in attributes.
 */
export function installBannerFrame(prompt: InstallPrompt): {
    className: string;
    ariaLabel: string;
    body: string;
    data: Record<string, string>;
} {
    return prompt.kind === 'update'
        ? {
              className: 'install-banner install-banner--update',
              ariaLabel: 'Update spec-kit extension',
              body: updateBannerBody(prompt.installed, prompt.expected),
              data: { 'data-kind': 'update', 'data-installed': prompt.installed, 'data-expected': prompt.expected },
          }
        : {
              className: 'install-banner',
              ariaLabel: 'Install spec-kit extension',
              body: INSTALL_BANNER_BODY,
              data: { 'data-kind': 'install' },
          };
}

/** The prompt a banner root reports through its `data-*`, for a webview click handler. */
export function promptFromDataset(el: { getAttribute(name: string): string | null } | null | undefined): InstallPrompt {
    return el?.getAttribute('data-kind') === 'update'
        ? { kind: 'update', installed: el.getAttribute('data-installed') ?? '', expected: el.getAttribute('data-expected') ?? '' }
        : { kind: 'install' };
}
