/**
 * SpecKit Companion - Spec Editor Webview
 * Main entry point for the spec editor webview
 */

import type {
    VSCodeApi,
    SpecEditorToExtensionMessage,
    ExtensionToSpecEditorMessage,
    SpecEditorWebviewState,
    AttachedImageUI,
    SIZE_LIMITS
} from './types';

// Get VS Code API
declare const vscode: VSCodeApi;

// State
let attachedImages: AttachedImageUI[] = [];
let isSubmitting = false;

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
        dropZone: document.getElementById('dropZone') as HTMLElement,
        loadingOverlay: document.getElementById('loadingOverlay') as HTMLElement,
        submitBtn: document.getElementById('submitBtn') as HTMLButtonElement,
        previewBtn: document.getElementById('previewBtn') as HTMLButtonElement,
        cancelBtn: document.getElementById('cancelBtn') as HTMLButtonElement,
        attachImageBtn: document.getElementById('attachImageBtn') as HTMLButtonElement,
        loadTemplateBtn: document.getElementById('loadTemplateBtn') as HTMLButtonElement
    };
}

// ============================================
// Character Count
// ============================================

function updateCharCount(): void {
    const { textarea, charCount } = getElements();
    const count = textarea.value.length;
    const max = 50000;

    charCount.textContent = `${count.toLocaleString()} / ${max.toLocaleString()}`;
    charCount.classList.remove('warning', 'error');

    if (count > max) {
        charCount.classList.add('error');
    } else if (count > max * 0.9) {
        charCount.classList.add('warning');
    }
}

// ============================================
// Error Display
// ============================================

function showError(message: string): void {
    const { errorContainer } = getElements();
    errorContainer.innerHTML = `
        <div class="error-message">
            <button class="close-btn" onclick="this.parentElement.remove()">×</button>
            ${escapeHtml(message)}
        </div>
    `;
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
    const { loadingOverlay, submitBtn, previewBtn } = getElements();
    isSubmitting = loading;

    loadingOverlay.style.display = loading ? 'flex' : 'none';
    submitBtn.disabled = loading;
    previewBtn.disabled = loading;
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
            <button class="remove-btn" data-id="${img.id}">×</button>
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

// ============================================
// Event Handlers
// ============================================

function setupEventListeners(): void {
    const elements = getElements();

    // Text input
    elements.textarea.addEventListener('input', () => {
        updateCharCount();
        saveDraft();
    });

    // Submit button
    elements.submitBtn.addEventListener('click', () => {
        if (isSubmitting) return;
        clearError();
        vscode.postMessage({
            type: 'submit',
            content: elements.textarea.value,
            images: attachedImages.map(img => img.id)
        });
    });

    // Preview button
    elements.previewBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'preview' });
    });

    // Cancel button
    elements.cancelBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'cancel' });
    });

    // Load template button
    elements.loadTemplateBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'requestTemplateDialog' });
    });

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

    // Drag and drop
    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.classList.add('drag-over');
    });

    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.classList.remove('drag-over');
    });

    elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropZone.classList.remove('drag-over');

        const files = e.dataTransfer?.files;
        if (files) {
            Array.from(files).forEach(file => {
                if (file.type.startsWith('image/')) {
                    handleImageFile(file);
                }
            });
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to submit
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (!isSubmitting) {
                clearError();
                vscode.postMessage({
                    type: 'submit',
                    content: elements.textarea.value,
                    images: attachedImages.map(img => img.id)
                });
            }
        }

        // Escape to cancel
        if (e.key === 'Escape') {
            e.preventDefault();
            vscode.postMessage({ type: 'cancel' });
        }
    });
}

// ============================================
// Message Handler
// ============================================

function handleMessage(event: MessageEvent): void {
    const message = event.data as ExtensionToSpecEditorMessage;

    switch (message.type) {
        case 'imageSaved':
            attachedImages.push({
                id: message.imageId,
                thumbnailUri: message.thumbnailUri,
                originalName: message.originalName
            });
            updateThumbnails();
            saveDraft();
            break;

        case 'imageRemoved':
            attachedImages = attachedImages.filter(img => img.id !== message.imageId);
            updateThumbnails();
            saveDraft();
            break;

        case 'templateLoaded':
            const { textarea } = getElements();
            textarea.value = message.content;
            updateCharCount();
            saveDraft();
            break;

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
    setupEventListeners();
    restoreDraft();
    updateCharCount();

    // Listen for messages from extension
    window.addEventListener('message', handleMessage);
});
