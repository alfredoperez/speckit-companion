/**
 * Refine input popover UI
 */
import type { VSCodeApi } from '../types';

let activeRefinePopover: HTMLElement | null = null;

export function showRefineInput(
    lineNum: string,
    lineContent: string,
    buttonEl: HTMLElement,
    vscode: VSCodeApi
): void {
    // Remove any existing popover
    if (activeRefinePopover) {
        activeRefinePopover.remove();
        activeRefinePopover = null;
    }

    // Create popover
    const popover = document.createElement('div');
    popover.className = 'refine-popover';
    popover.innerHTML = `
        <div class="refine-popover-header">What should be refined?</div>
        <input type="text" class="refine-input" placeholder="e.g., Make more specific, Add acceptance criteria...">
        <div class="refine-popover-actions">
            <button class="refine-cancel">Cancel</button>
            <button class="refine-submit">Refine</button>
        </div>
    `;

    // Position near the button
    const rect = buttonEl.getBoundingClientRect();
    popover.style.top = `${rect.bottom + 4}px`;
    popover.style.left = `${rect.left}px`;

    document.body.appendChild(popover);
    activeRefinePopover = popover;

    const input = popover.querySelector('.refine-input') as HTMLInputElement;
    input.focus();

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
        popover.remove();
        activeRefinePopover = null;
    };

    // Handle cancel
    const cancel = () => {
        popover.remove();
        activeRefinePopover = null;
    };

    input.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') cancel();
    });

    popover.querySelector('.refine-submit')?.addEventListener('click', submit);
    popover.querySelector('.refine-cancel')?.addEventListener('click', cancel);

    // Close on outside click
    setTimeout(() => {
        const closePopover = (e: Event) => {
            if (!popover.contains(e.target as Node) && e.target !== buttonEl) {
                cancel();
                document.removeEventListener('click', closePopover);
            }
        };
        document.addEventListener('click', closePopover);
    }, 0);
}
