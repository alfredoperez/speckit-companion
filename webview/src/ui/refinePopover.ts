/**
 * Refine input popover UI
 */
import type { VSCodeApi } from '../types';

let activeRefinePopover: HTMLElement | null = null;
let activeBackdrop: HTMLElement | null = null;

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Checks if the browser supports CSS field-sizing property
 */
function supportsFieldSizing(): boolean {
    return CSS.supports('field-sizing', 'content');
}

/**
 * Measures the width of text using a hidden span element
 * Used as fallback when field-sizing is not supported
 */
function measureTextWidth(text: string, input: HTMLInputElement): number {
    const span = document.createElement('span');
    span.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: pre;
        font-family: ${getComputedStyle(input).fontFamily};
        font-size: ${getComputedStyle(input).fontSize};
        padding: 0 ${getComputedStyle(input).paddingLeft};
    `;
    span.textContent = text || input.placeholder;
    document.body.appendChild(span);
    const width = span.offsetWidth;
    document.body.removeChild(span);
    return width;
}

/**
 * Sets up fallback auto-sizing for input when field-sizing is not supported
 */
function setupFallbackAutoSizing(input: HTMLInputElement): void {
    if (supportsFieldSizing()) {
        return; // Native field-sizing is supported, no fallback needed
    }

    const updateWidth = () => {
        const measuredWidth = measureTextWidth(input.value, input);
        const minWidth = 200;
        const maxWidth = input.parentElement?.clientWidth || 400;
        const newWidth = Math.max(minWidth, Math.min(measuredWidth + 24, maxWidth));
        input.style.width = `${newWidth}px`;
    };

    input.addEventListener('input', updateWidth);
    // Initial sizing
    updateWidth();
}

export function showRefineInput(
    lineNum: string,
    lineContent: string,
    buttonEl: HTMLElement,
    vscode: VSCodeApi
): void {
    // Remove any existing popover and backdrop
    if (activeRefinePopover) {
        activeRefinePopover.remove();
        activeRefinePopover = null;
    }
    if (activeBackdrop) {
        activeBackdrop.remove();
        activeBackdrop = null;
    }

    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'refine-backdrop';
    document.body.appendChild(backdrop);
    activeBackdrop = backdrop;

    // Create popover
    const popover = document.createElement('div');
    popover.className = 'refine-popover';

    // Build original value section (conditionally rendered if lineContent is not empty)
    const originalValueSection = lineContent.trim()
        ? `<div class="original-value-reference" id="original-ref-${lineNum}" aria-label="Original content">
            <span class="original-value-label">Original</span>
            ${escapeHtml(lineContent)}
        </div>`
        : '';

    popover.innerHTML = `
        <div class="refine-popover-header">What should be refined?</div>
        <div class="edit-input-container">
            ${originalValueSection}
            <input
                type="text"
                class="refine-input"
                placeholder="e.g., Make more specific, Add acceptance criteria..."
                ${lineContent.trim() ? `aria-describedby="original-ref-${lineNum}"` : ''}
            >
        </div>
        <div class="refine-popover-actions">
            <button class="refine-cancel">Cancel</button>
            <button class="refine-submit">Refine</button>
        </div>
    `;

    // Modal is centered via CSS, no positioning needed
    document.body.appendChild(popover);
    activeRefinePopover = popover;

    const input = popover.querySelector('.refine-input') as HTMLInputElement;

    // Setup fallback auto-sizing for browsers that don't support field-sizing
    setupFallbackAutoSizing(input);

    input.focus();

    // Cleanup function to remove popover and backdrop
    const cleanup = () => {
        popover.remove();
        backdrop.remove();
        activeRefinePopover = null;
        activeBackdrop = null;
    };

    // Handle submit
    const submit = () => {
        if (input.value.trim()) {
            vscode.postMessage({
                type: 'refineLine',
                lineNum: parseInt(lineNum, 10),
                content: lineContent,
                instruction: input.value.trim()
            });
        }
        cleanup();
    };

    // Handle cancel
    const cancel = () => {
        cleanup();
    };

    input.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') cancel();
    });

    popover.querySelector('.refine-submit')?.addEventListener('click', submit);
    popover.querySelector('.refine-cancel')?.addEventListener('click', cancel);

    // Close on backdrop click
    backdrop.addEventListener('click', cancel);
}
