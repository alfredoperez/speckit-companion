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

    it('is driven by shouldShowInstallPrompt: installed → empty, missing+on → banner', () => {
        // Installed project: no banner regardless of mode (zero regression).
        expect(renderInstallBannerHtml(shouldShowInstallPrompt('on', true))).toBe('');
        // Missing extension + prompt on: banner shows.
        expect(renderInstallBannerHtml(shouldShowInstallPrompt('on', false))).toContain('install-banner');
        // Missing extension but explicitly off: no banner.
        expect(renderInstallBannerHtml(shouldShowInstallPrompt('off', false))).toBe('');
    });
});
