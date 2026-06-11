import { renderInstallBannerHtml } from './installBanner';
import { shouldShowInstallPrompt } from '../../speckit/specKitExtensionInstall';

describe('renderInstallBannerHtml — gated banner visibility', () => {
    it('renders the banner with both action buttons when visible', () => {
        const html = renderInstallBannerHtml(true);
        expect(html).toContain('id="install-banner"');
        expect(html).toContain('data-action="installSpecKitExtension"');
        expect(html).toContain('data-action="openReadme"');
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
});
