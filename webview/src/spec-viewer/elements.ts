/**
 * SpecKit Companion - Spec Viewer DOM Elements
 * Minimal accessor for non-componentized elements.
 * Navigation, footer, and header are now managed by components.
 *
 * The refine-modal fields (refineBackdrop / refinePopover / refineInput /
 * etc.) were removed when `modal.ts` and the hardcoded refine HTML in
 * `html/generator.ts` were deleted. The active refine flow lives in
 * `ui/refinePopover.ts`, which builds its popover dynamically — there's no
 * stable DOM element to reach for via `getElementById` anymore. Don't add
 * fields back here that point at HTML the renderer no longer emits.
 */

export interface ViewerElements {
    contentArea: HTMLElement;
    markdownContent: HTMLElement | null;
    loadingOverlay: HTMLElement;
}

/**
 * Get DOM elements used by the spec viewer (non-componentized only)
 */
export function getElements(): ViewerElements {
    return {
        contentArea: document.getElementById('content-area') as HTMLElement,
        markdownContent: document.getElementById('markdown-content') as HTMLElement | null,
        loadingOverlay: document.getElementById('loading-overlay') as HTMLElement,
    };
}
