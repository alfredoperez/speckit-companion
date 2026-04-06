/**
 * SpecKit Companion - Spec Viewer DOM Elements
 * Minimal accessor for non-componentized elements.
 * Navigation, footer, and header are now managed by components.
 */

export interface ViewerElements {
    contentArea: HTMLElement;
    markdownContent: HTMLElement | null;
    loadingOverlay: HTMLElement;
    // Refine modal (still server-rendered)
    refineBackdrop: HTMLElement;
    refinePopover: HTMLElement;
    refineOriginalText: HTMLElement;
    refineInput: HTMLInputElement;
    refineCancel: HTMLButtonElement;
    refineSubmit: HTMLButtonElement;
}

/**
 * Get DOM elements used by the spec viewer (non-componentized only)
 */
export function getElements(): ViewerElements {
    return {
        contentArea: document.getElementById('content-area') as HTMLElement,
        markdownContent: document.getElementById('markdown-content') as HTMLElement | null,
        loadingOverlay: document.getElementById('loading-overlay') as HTMLElement,
        // Refine modal
        refineBackdrop: document.getElementById('refine-backdrop') as HTMLElement,
        refinePopover: document.getElementById('refine-popover') as HTMLElement,
        refineOriginalText: document.getElementById('refine-original-text') as HTMLElement,
        refineInput: document.getElementById('refine-input') as HTMLInputElement,
        refineCancel: document.getElementById('refine-cancel') as HTMLButtonElement,
        refineSubmit: document.getElementById('refine-submit') as HTMLButtonElement,
    };
}
