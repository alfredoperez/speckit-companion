import { navState } from '../signals';
import { installBannerFrame } from '../../../../src/protocol/installBannerBody';

/**
 * The viewer install banner, rendered INSIDE the Activity panel (#255 — it used
 * to be injected full-width above #app-root in `html/generator.ts`). Markup,
 * id, classes and `data-action` buttons mirror the server-rendered
 * `installBanner.ts` so the existing document-delegated click handler still
 * resolves `installSpecKitExtension` / `openReadme`. Shown when the extension
 * is missing or behind this build (`navState.installPrompt`).
 */
export function InstallBanner() {
    const prompt = navState.value?.installPrompt;
    if (!prompt) return null;
    const { className, ariaLabel, body, data } = installBannerFrame(prompt);
    return (
        <div
            class={className}
            id="install-banner"
            role="region"
            aria-label={ariaLabel}
            {...data}
            dangerouslySetInnerHTML={{ __html: body }}
        />
    );
}
