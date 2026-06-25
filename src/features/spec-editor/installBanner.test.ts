import { renderInstallBannerHtml } from './installBanner';
import { shouldShowInstallPrompt } from '../../speckit/specKitExtensionInstall';

describe('renderInstallBannerHtml — gated banner visibility', () => {
    it('renders the banner with both action buttons when visible', () => {
        const html = renderInstallBannerHtml(true);
        expect(html).toContain('id="install-banner"');
        expect(html).toContain('data-action="installSpecKitExtension"');
        expect(html).toContain('data-action="openReadme"');
    });

    it('renders a dismiss control with an accessible label when visible', () => {
        const html = renderInstallBannerHtml(true);
        expect(html).toContain('data-action="dismissInstallBanner"');
        expect(html).toContain('aria-label="Dismiss install prompt"');
    });

    it('renders nothing when not visible — no banner for installed projects', () => {
        expect(renderInstallBannerHtml(false)).toBe('');
    });

    it('is driven by shouldShowInstallPrompt: installed → empty, missing+enabled → banner', () => {
        // Installed project: no banner whether enabled or not (zero regression).
        expect(renderInstallBannerHtml(shouldShowInstallPrompt(true, true))).toBe('');
        // Missing extension + prompt enabled: banner shows.
        expect(renderInstallBannerHtml(shouldShowInstallPrompt(true, false))).toContain('install-banner');
        // Missing extension but explicitly disabled: no banner.
        expect(renderInstallBannerHtml(shouldShowInstallPrompt(false, false))).toBe('');
    });

    it('shows when the extension is missing even with the Companion beta off — visibility never reads the beta setting', () => {
        // The banner is gated only on its own prompt preference + the extension being
        // missing. `shouldShowInstallPrompt` takes no beta input at all, so a beta-off
        // user with a missing extension and the prompt enabled still gets the banner.
        const enabled = true; // readInstallPromptEnabled() default, independent of beta
        const installed = false; // extension missing
        expect(renderInstallBannerHtml(shouldShowInstallPrompt(enabled, installed))).toContain('install-banner');
    });
});
