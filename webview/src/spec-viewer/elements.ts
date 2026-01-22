/**
 * SpecKit Companion - Spec Viewer DOM Elements
 * Centralized DOM element accessor
 */

export interface ViewerElements {
    contentArea: HTMLElement;
    markdownContent: HTMLElement | null;
    editButton: HTMLButtonElement;
    loadingOverlay: HTMLElement;
    // Unified step-tabs
    stepTabs: NodeListOf<HTMLButtonElement>;
    relatedTabs: NodeListOf<HTMLButtonElement>;
    backLink: HTMLButtonElement | null;
    // Footer buttons
    enhanceButton: HTMLButtonElement | null;
    editSourceButton: HTMLButtonElement | null;
    regenerateButton: HTMLButtonElement | null;
    approveButton: HTMLButtonElement | null;
    // Refine modal
    refineBackdrop: HTMLElement;
    refinePopover: HTMLElement;
    refineOriginalText: HTMLElement;
    refineInput: HTMLInputElement;
    refineCancel: HTMLButtonElement;
    refineSubmit: HTMLButtonElement;
}

/**
 * Get all DOM elements used by the spec viewer
 */
export function getElements(): ViewerElements {
    return {
        contentArea: document.getElementById('content-area') as HTMLElement,
        markdownContent: document.getElementById('markdown-content') as HTMLElement | null,
        editButton: document.getElementById('edit-button') as HTMLButtonElement,
        loadingOverlay: document.getElementById('loading-overlay') as HTMLElement,
        // Unified step-tabs
        stepTabs: document.querySelectorAll('.step-tab') as NodeListOf<HTMLButtonElement>,
        relatedTabs: document.querySelectorAll('.related-tab') as NodeListOf<HTMLButtonElement>,
        backLink: document.querySelector('.back-link') as HTMLButtonElement | null,
        // Footer buttons
        enhanceButton: document.getElementById('enhance') as HTMLButtonElement | null,
        editSourceButton: document.getElementById('editSource') as HTMLButtonElement | null,
        regenerateButton: document.getElementById('regenerate') as HTMLButtonElement | null,
        approveButton: document.getElementById('approve') as HTMLButtonElement | null,
        // Refine modal
        refineBackdrop: document.getElementById('refine-backdrop') as HTMLElement,
        refinePopover: document.getElementById('refine-popover') as HTMLElement,
        refineOriginalText: document.getElementById('refine-original-text') as HTMLElement,
        refineInput: document.getElementById('refine-input') as HTMLInputElement,
        refineCancel: document.getElementById('refine-cancel') as HTMLButtonElement,
        refineSubmit: document.getElementById('refine-submit') as HTMLButtonElement
    };
}
