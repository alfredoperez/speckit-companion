/**
 * SpecKit Companion - Spec Editor Webview
 * Main entry point for the spec editor webview
 */

import type {
    VSCodeApi,
    SpecEditorToExtensionMessage,
    ExtensionToSpecEditorMessage,
    SpecEditorWebviewState,
    AttachedImageUI
} from './types';
import { canSubmit, isOverLimit, shouldShowCharCount, isMacPlatform, MAX_CHARS } from './submitGate';

// Get VS Code API
declare const vscode: VSCodeApi;

const SUBMIT_MODIFIER = isMacPlatform(navigator.platform, navigator.userAgent) ? 'Cmd' : 'Ctrl';

function keyboardHintsHtml(): string {
    return `<kbd>${SUBMIT_MODIFIER}</kbd>+<kbd>Enter</kbd> to submit • <kbd>Esc</kbd> to cancel`;
}

// State
let attachedImages: AttachedImageUI[] = [];
let isSubmitting = false;
let workflowList: WorkflowDefinition[] = [];

// ============================================
// DOM Elements
// ============================================

function getElements() {
    return {
        textarea: document.getElementById('specContent') as HTMLTextAreaElement,
        charCount: document.getElementById('charCount') as HTMLElement,
        errorContainer: document.getElementById('error-container') as HTMLElement,
        thumbnails: document.getElementById('thumbnails') as HTMLElement,
        sizeInfo: document.getElementById('sizeInfo') as HTMLElement,
        loadingOverlay: document.getElementById('loadingOverlay') as HTMLElement,
        submitBtn: document.getElementById('submitBtn') as HTMLButtonElement,
        cancelBtn: document.getElementById('cancelBtn') as HTMLButtonElement,
        attachImageBtn: document.getElementById('attachImageBtn') as HTMLButtonElement,
        workflowSelector: document.getElementById('workflowSelector') as HTMLElement,
        workflowSelect: document.getElementById('workflowSelect') as HTMLSelectElement,
        commandButtonsContainer: document.getElementById('commandButtons') as HTMLElement,
        keyboardHints: document.getElementById('keyboardHints') as HTMLElement,
        srStatus: document.getElementById('sr-status') as HTMLElement
    };
}

function announce(message: string): void {
    const { srStatus } = getElements();
    if (srStatus) {
        srStatus.textContent = message;
    }
}

// Get selected workflow
function getSelectedWorkflow(): string {
    const { workflowSelect } = getElements();
    return workflowSelect?.value || 'default';
}

// ============================================
// Character Count
// ============================================

function updateCharCount(): void {
    const { textarea, charCount } = getElements();
    const count = textarea.value.length;
    const over = isOverLimit(textarea.value, MAX_CHARS);

    charCount.hidden = !shouldShowCharCount(count, MAX_CHARS);
    charCount.classList.remove('warning', 'error');

    if (over) {
        charCount.classList.add('error');
        charCount.textContent = `Over limit — ${count.toLocaleString()} / ${MAX_CHARS.toLocaleString()} (remove ${(count - MAX_CHARS).toLocaleString()} characters)`;
    } else {
        charCount.classList.add('warning');
        charCount.textContent = `${count.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;
    }
}

function updateSubmitState(): void {
    const { textarea, submitBtn } = getElements();
    if (submitBtn) {
        submitBtn.disabled = isSubmitting || !canSubmit(textarea.value, MAX_CHARS);
    }
}

// ============================================
// Error Display
// ============================================

function showError(message: string): void {
    const { errorContainer } = getElements();
    errorContainer.innerHTML = `
        <div class="error-message">
            <button class="close-btn" type="button" aria-label="Dismiss error">×</button>
            ${escapeHtml(message)}
        </div>
    `;
    const closeBtn = errorContainer.querySelector('.close-btn') as HTMLButtonElement | null;
    if (closeBtn) {
        closeBtn.addEventListener('click', () => clearError());
        closeBtn.focus();
    }
}

function clearError(): void {
    const { errorContainer } = getElements();
    errorContainer.innerHTML = '';
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Loading State
// ============================================

function setLoading(loading: boolean): void {
    const { loadingOverlay, commandButtonsContainer } = getElements();
    isSubmitting = loading;

    loadingOverlay.style.display = loading ? 'flex' : 'none';
    loadingOverlay.setAttribute('aria-hidden', loading ? 'false' : 'true');
    loadingOverlay.setAttribute('aria-busy', loading ? 'true' : 'false');
    if (loading) {
        announce('Creating your spec…');
    }
    updateSubmitState();
    if (commandButtonsContainer) {
        commandButtonsContainer.querySelectorAll('button').forEach(btn => {
            (btn as HTMLButtonElement).disabled = loading;
        });
    }
}

// ============================================
// Image Attachments
// ============================================

function updateThumbnails(): void {
    const { thumbnails } = getElements();

    if (attachedImages.length === 0) {
        thumbnails.innerHTML = '';
        return;
    }

    thumbnails.innerHTML = attachedImages.map(img => `
        <div class="image-thumbnail" data-id="${img.id}">
            <img src="${img.thumbnailUri}" alt="${escapeHtml(img.originalName)}">
            <span class="image-name">${escapeHtml(img.originalName)}</span>
            <button class="remove-btn" type="button" data-id="${img.id}" aria-label="Remove image ${escapeHtml(img.originalName)}">×</button>
        </div>
    `).join('');

    // Add remove button handlers
    thumbnails.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = (btn as HTMLElement).dataset.id;
            if (id) {
                removeImage(id);
            }
        });
    });
}

function removeImage(id: string): void {
    vscode.postMessage({ type: 'removeImage', imageId: id });
}

function handleImageFile(file: File): void {
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showError(`Unsupported image format: ${file.type}. Use PNG, JPG, GIF, or WebP.`);
        return;
    }

    // Validate size (2MB limit)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
        showError(`Image too large: ${(file.size / (1024 * 1024)).toFixed(1)}MB. Maximum is 2MB.`);
        return;
    }

    // Read and send to extension
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        if (dataUri) {
            vscode.postMessage({
                type: 'attachImage',
                name: file.name,
                size: file.size,
                dataUri
            });
        }
    };
    reader.onerror = () => {
        showError('Failed to read image file');
    };
    reader.readAsDataURL(file);
}

// ============================================
// Draft Persistence
// ============================================

let saveTimeout: number | undefined;

function saveDraft(): void {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    saveTimeout = window.setTimeout(() => {
        const { textarea } = getElements();
        const state: SpecEditorWebviewState = {
            content: textarea.value,
            cursorPosition: textarea.selectionStart,
            attachedImageIds: attachedImages.map(img => img.id),
            lastSaved: Date.now()
        };
        vscode.setState(state);
    }, 300); // Debounce 300ms
}

function restoreDraft(): void {
    const state = vscode.getState<SpecEditorWebviewState>();
    if (state?.content) {
        const { textarea } = getElements();
        textarea.value = state.content;

        // Restore cursor position
        if (state.cursorPosition !== undefined) {
            textarea.selectionStart = state.cursorPosition;
            textarea.selectionEnd = state.cursorPosition;
        }

        updateCharCount();
    }
}

function cancelWithConfirm(): void {
    const { textarea } = getElements();
    const hasContent = textarea.value.trim().length > 0;
    if (hasContent && !window.confirm('Discard this spec? Your typed content will be lost.')) {
        return;
    }
    vscode.postMessage({ type: 'cancel' });
}

// ============================================
// Event Handlers
// ============================================

function setupEventListeners(): void {
    const elements = getElements();

    // Text input
    elements.textarea.addEventListener('input', () => {
        updateCharCount();
        updateSubmitState();
        saveDraft();
    });

    // Submit button
    elements.submitBtn.addEventListener('click', () => {
        if (isSubmitting || !canSubmit(elements.textarea.value, MAX_CHARS)) return;
        clearError();
        vscode.postMessage({
            type: 'submit',
            content: elements.textarea.value,
            images: attachedImages.map(img => img.id),
            workflow: getSelectedWorkflow()
        });
    });

    // Cancel button
    elements.cancelBtn.addEventListener('click', () => {
        cancelWithConfirm();
    });

    // Install banner actions (server-rendered, present only when the spec-kit
    // extension is missing). data-action → the matching webview→extension message.
    const installBanner = document.getElementById('install-banner');
    if (installBanner) {
        installBanner.addEventListener('click', (e) => {
            if (!(e.target instanceof Element)) { return; }
            const action = e.target.closest('[data-action]')?.getAttribute('data-action');
            if (action === 'installSpecKitExtension') {
                vscode.postMessage({ type: 'installSpecKitExtension' });
            } else if (action === 'openReadme') {
                vscode.postMessage({ type: 'openReadme' });
            }
        });
    }

    // Attach image button
    elements.attachImageBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/gif,image/webp';
        input.multiple = true;
        input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) {
                Array.from(files).forEach(handleImageFile);
            }
        };
        input.click();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to submit
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (!isSubmitting && canSubmit(elements.textarea.value, MAX_CHARS)) {
                clearError();
                vscode.postMessage({
                    type: 'submit',
                    content: elements.textarea.value,
                    images: attachedImages.map(img => img.id),
                    workflow: getSelectedWorkflow()
                });
            }
        }

        // Escape to cancel
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelWithConfirm();
        }
    });

    // Clipboard paste for images
    document.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    handleImageFile(file);
                }
                break;
            }
        }
    });
}

// ============================================
// Workflow Selector
// ============================================

interface WorkflowDefinition {
    name: string;
    displayName: string;
    description?: string;
    specifyCommands?: Array<{ name: string; title: string; command: string; tooltip?: string }>;
}

function initWorkflows(workflows: WorkflowDefinition[], defaultWorkflow?: string): void {
    const { workflowSelector, workflowSelect } = getElements();

    // Store for later lookup
    workflowList = workflows;

    // Only show selector if there are custom workflows (more than just default)
    if (workflows.length <= 1) {
        workflowSelector.style.display = 'none';
        updateCommandButtons(workflows[0]?.name || 'default');
        return;
    }

    // Populate dropdown
    workflowSelect.innerHTML = workflows.map(wf =>
        `<option value="${wf.name}" title="${wf.description || ''}">${wf.displayName}</option>`
    ).join('');

    // Pre-select the default workflow
    if (defaultWorkflow) {
        workflowSelect.value = defaultWorkflow;
    }

    workflowSelector.style.display = 'flex';

    // Update command buttons for initial selection
    updateCommandButtons(workflowSelect.value);

    // Update on workflow change
    workflowSelect.addEventListener('change', () => {
        updateCommandButtons(workflowSelect.value);
    });
}

function sendCommand(command: string): void {
    if (isSubmitting) return;
    const elements = getElements();
    clearError();
    vscode.postMessage({
        type: 'submitCommand',
        content: elements.textarea.value,
        images: attachedImages.map(img => img.id),
        workflow: getSelectedWorkflow(),
        command
    } as any);
}

function updateCommandButtons(workflowName: string): void {
    const { commandButtonsContainer, keyboardHints } = getElements();
    const workflow = workflowList.find(wf => wf.name === workflowName);
    const commands = workflow?.specifyCommands || [];

    if (!commandButtonsContainer) return;

    // Clear existing buttons
    commandButtonsContainer.innerHTML = '';

    if (commands.length === 0) {
        commandButtonsContainer.style.display = 'none';
        if (keyboardHints) {
            keyboardHints.innerHTML = keyboardHintsHtml();
        }
        return;
    }

    commandButtonsContainer.style.display = '';
    for (const cmd of commands) {
        const btn = document.createElement('button');
        btn.className = 'btn-secondary';
        btn.textContent = cmd.title;
        btn.disabled = isSubmitting;
        if (cmd.tooltip) {
            btn.title = cmd.tooltip;
        }
        btn.addEventListener('click', () => sendCommand(cmd.command));
        commandButtonsContainer.appendChild(btn);
    }

    if (keyboardHints) {
        keyboardHints.innerHTML = keyboardHintsHtml();
    }
}

// ============================================
// Message Handler
// ============================================

function handleMessage(event: MessageEvent): void {
    const message = event.data as ExtensionToSpecEditorMessage;

    switch (message.type) {
        case 'init':
            initWorkflows(message.workflows, message.defaultWorkflow);
            break;

        case 'imageSaved':
            attachedImages.push({
                id: message.imageId,
                thumbnailUri: message.thumbnailUri,
                originalName: message.originalName
            });
            updateThumbnails();
            announce(`Image ${message.originalName} attached.`);
            saveDraft();
            break;

        case 'imageRemoved': {
            const removed = attachedImages.find(img => img.id === message.imageId);
            attachedImages = attachedImages.filter(img => img.id !== message.imageId);
            updateThumbnails();
            announce(removed ? `Image ${removed.originalName} removed.` : 'Image removed.');
            saveDraft();
            break;
        }

        case 'submissionStarted':
            setLoading(true);
            break;

        case 'submissionComplete':
            setLoading(false);
            break;

        case 'error':
            setLoading(false);
            showError(message.message);
            break;

        case 'restoreImages':
            attachedImages = message.images;
            updateThumbnails();
            break;
    }
}

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const { keyboardHints } = getElements();
    if (keyboardHints) {
        keyboardHints.innerHTML = keyboardHintsHtml();
    }
    setupEventListeners();
    restoreDraft();
    updateCharCount();
    updateSubmitState();

    // Listen for messages from extension
    window.addEventListener('message', handleMessage);

    // Signal ready to receive workflows
    vscode.postMessage({ type: 'ready' });
});
