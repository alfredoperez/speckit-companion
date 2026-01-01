/**
 * Inline edit component for direct text editing
 */
import type { VSCodeApi } from '../types';

let activeInlineEdit: HTMLTextAreaElement | null = null;
let originalLineContent: HTMLElement | null = null;

/**
 * Extracts plain text from HTML content (strips tags)
 */
function extractPlainText(element: HTMLElement): string {
    return element.textContent || '';
}

/**
 * Checks if the browser supports CSS field-sizing property
 */
function supportsFieldSizing(): boolean {
    return CSS.supports('field-sizing', 'content');
}

/**
 * Auto-resize textarea to fit content
 */
function autoResizeTextarea(textarea: HTMLTextAreaElement): void {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight to fit content
    textarea.style.height = `${textarea.scrollHeight}px`;
}

/**
 * Shows an inline edit input for the given line
 */
export function showInlineEdit(
    lineNum: string,
    lineEl: HTMLElement,
    vscode: VSCodeApi
): void {
    // Cancel any existing inline edit
    if (activeInlineEdit && originalLineContent) {
        cancelInlineEdit();
    }

    // Find the line-content span
    const lineContent = lineEl.querySelector('.line-content') as HTMLElement;
    if (!lineContent) {
        console.error('No .line-content found in line element');
        return;
    }

    // Store original content
    originalLineContent = lineContent;
    const originalText = extractPlainText(lineContent);

    // Create textarea element
    const textarea = document.createElement('textarea');
    textarea.className = 'inline-edit-input';
    textarea.value = originalText;
    textarea.rows = 1;

    // Replace line content with textarea
    lineContent.style.display = 'none';
    lineContent.parentElement?.insertBefore(textarea, lineContent.nextSibling);
    activeInlineEdit = textarea;

    // Auto-resize on input
    autoResizeTextarea(textarea);
    textarea.addEventListener('input', () => autoResizeTextarea(textarea));

    // Focus and select all text
    textarea.focus();
    textarea.select();

    // Handle save
    const save = () => {
        const newText = textarea.value.trim();
        if (newText && newText !== originalText) {
            vscode.postMessage({
                type: 'editLine',
                lineNum: parseInt(lineNum, 10),
                newText: newText
            });
        }
        cleanup();
    };

    // Handle cancel
    const cancel = () => {
        cleanup();
    };

    // Cleanup function
    const cleanup = () => {
        if (originalLineContent) {
            originalLineContent.style.display = '';
        }
        textarea.remove();
        activeInlineEdit = null;
        originalLineContent = null;
    };

    // Event listeners
    textarea.addEventListener('keydown', (e: KeyboardEvent) => {
        // Cmd/Ctrl+Enter to save (allows regular Enter for newlines)
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
        }
    });

    textarea.addEventListener('blur', () => {
        // Small delay to allow click events to fire first
        setTimeout(() => {
            if (activeInlineEdit === textarea) {
                cancel();
            }
        }, 100);
    });
}

/**
 * Cancels the current inline edit if one is active
 */
export function cancelInlineEdit(): void {
    if (activeInlineEdit && originalLineContent) {
        originalLineContent.style.display = '';
        activeInlineEdit.remove();
        activeInlineEdit = null;
        originalLineContent = null;
    }
}
