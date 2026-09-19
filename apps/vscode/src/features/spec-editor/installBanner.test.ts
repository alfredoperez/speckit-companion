import { renderInstallBannerHtml } from './installBanner';
import { updateBannerText } from '../../protocol/viewer';
import { shouldShowInstallPrompt } from '../../speckit/specKitExtensionInstall';

describe('renderInstallBannerHtml — gated banner visibility', () => {
    it('renders the banner with both action buttons when visible', () => {
        const html = renderInstallBannerHtml({ kind: 'install' });
        expect(html).toContain('id="install-banner"');
        expect(html).toContain('data-action="installSpecKitExtension"');
        expect(html).toContain('data-action="openReadme"');
    });

    it('renders a dismiss control with an accessible label when visible', () => {
        const html = renderInstallBannerHtml({ kind: 'install' });
        expect(html).toContain('data-action="dismissInstallBanner"');
        expect(html).toContain('aria-label="Dismiss install prompt"');
    });

    it('renders nothing when not visible — no banner for installed projects', () => {
        expect(renderInstallBannerHtml(null)).toBe('');
    });

    it('is driven by shouldShowInstallPrompt: current → empty, missing+enabled → banner', () => {
        expect(renderInstallBannerHtml(shouldShowInstallPrompt(true, { state: 'current' }))).toBe('');
        expect(renderInstallBannerHtml(shouldShowInstallPrompt(true, { state: 'missing' }))).toContain('install-banner');
        expect(renderInstallBannerHtml(shouldShowInstallPrompt(false, { state: 'missing' }))).toBe('');
    });

    it('renders the out-of-date variant naming both versions, with one Update button and no Learn more', () => {
        const html = renderInstallBannerHtml({ kind: 'update', installed: '0.20.2', expected: '0.21.0' });
        expect(html).toContain('install-banner--update');
        expect(html).toContain(updateBannerText('0.20.2', '0.21.0'));
        expect(html).toContain('commands are 0.20.2, this extension expects 0.21.0');
        expect(html).toContain('>Update</button>');
        expect(html).not.toContain('data-action="openReadme"');
        expect(html).toContain('data-action="dismissInstallBanner"');
    });
});
