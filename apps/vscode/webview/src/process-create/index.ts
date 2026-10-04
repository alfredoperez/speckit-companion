import {
    normaliseSlug,
    slugFromText,
    PROCESS_TEXT_LIMIT,
    type ExtensionToProcessCreate,
    type ProcessCreateKind,
    type ProcessCreateToExtension,
} from '../../../src/protocol/processCreate';
import { isMacPlatform } from '../spec-editor/submitGate';
import { canSend, hasTypedText, isOverLimit, slugCaret, slugProblem, typingSlug, type CreateForm } from './gate';

interface Draft {
    text: string;
    extra: string;
    slug: string;
    slugEdited: boolean;
}

declare const vscode: {
    postMessage(message: ProcessCreateToExtension): void;
    getState<T>(): T | undefined;
    setState<T>(state: T): void;
};

const LOADING_TEXT = 'Sending to your assistant…';

let kind: ProcessCreateKind = 'bug';
let existingSlugs: string[] = [];
let slugEdited = false;
let isSubmitting = false;

function getElements() {
    return {
        app: document.getElementById('app') as HTMLElement,
        mainText: document.getElementById('mainText') as HTMLTextAreaElement,
        extraText: document.getElementById('extraText') as HTMLTextAreaElement | HTMLInputElement,
        slug: document.getElementById('slug') as HTMLInputElement,
        slugMessage: document.getElementById('slugMessage') as HTMLElement,
        assistantName: document.getElementById('assistantName') as HTMLElement,
        charCount: document.getElementById('charCount') as HTMLElement,
        errorContainer: document.getElementById('error-container') as HTMLElement,
        loadingOverlay: document.getElementById('loadingOverlay') as HTMLElement,
        keyboardHints: document.getElementById('keyboardHints') as HTMLElement,
        submitBtn: document.getElementById('submitBtn') as HTMLButtonElement,
        cancelBtn: document.getElementById('cancelBtn') as HTMLButtonElement,
        srStatus: document.getElementById('sr-status') as HTMLElement,
    };
}

function readForm(): CreateForm {
    const { mainText, extraText, slug } = getElements();
    return { kind, text: mainText.value, extra: extraText.value, slug: normaliseSlug(slug.value), existingSlugs };
}

function update(): void {
    const { slugMessage, charCount, submitBtn, mainText } = getElements();
    const form = readForm();

    const problem = mainText.value.trim() || slugEdited ? slugProblem(kind, form.slug, existingSlugs) : undefined;
    slugMessage.textContent = problem ?? '';
    slugMessage.hidden = !problem;

    const over = isOverLimit(form);
    charCount.classList.toggle('sr-only', !over);
    charCount.classList.toggle('error', over);
    charCount.textContent = over
        ? `Over limit: keep each field under ${PROCESS_TEXT_LIMIT.toLocaleString()} characters`
        : '';

    submitBtn.disabled = !canSend(form, isSubmitting);
}

function saveDraft(): void {
    const form = readForm();
    vscode.setState<Draft>({ text: form.text, extra: form.extra, slug: form.slug, slugEdited });
}

function restoreDraft(): void {
    const draft = vscode.getState<Draft>();
    if (!draft) return;
    const { mainText, extraText, slug } = getElements();
    mainText.value = draft.text ?? '';
    extraText.value = draft.extra ?? '';
    slug.value = normaliseSlug(draft.slug ?? '');
    slugEdited = draft.slugEdited === true;
}

function clearError(): void {
    getElements().errorContainer.replaceChildren();
}

function showError(message: string): void {
    const { errorContainer } = getElements();
    const box = document.createElement('div');
    box.className = 'error-message';
    const close = document.createElement('button');
    close.className = 'close-btn';
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss error');
    close.textContent = '×';
    close.addEventListener('click', clearError);
    box.append(close, document.createTextNode(message));
    errorContainer.replaceChildren(box);
    close.focus();
}

function setLoading(loading: boolean): void {
    const { loadingOverlay, app, srStatus } = getElements();
    isSubmitting = loading;
    loadingOverlay.style.display = loading ? 'flex' : 'none';
    loadingOverlay.setAttribute('aria-hidden', loading ? 'false' : 'true');
    app.setAttribute('aria-busy', loading ? 'true' : 'false');
    if (loading) {
        srStatus.textContent = LOADING_TEXT;
    }
    update();
}

function submit(): void {
    const form = readForm();
    if (!canSend(form, isSubmitting)) return;
    clearError();
    isSubmitting = true;
    update();
    vscode.postMessage({ type: 'submit', text: form.text, extra: form.extra, slug: form.slug });
}

function cancelWithConfirm(): void {
    vscode.postMessage({ type: 'cancel', typed: hasTypedText(readForm()) });
}

function setupEventListeners(): void {
    const { mainText, extraText, slug, submitBtn, cancelBtn } = getElements();

    mainText.addEventListener('input', () => {
        if (!slugEdited) {
            slug.value = slugFromText(mainText.value);
        }
        update();
        saveDraft();
    });

    extraText.addEventListener('input', () => {
        update();
        saveDraft();
    });

    slug.addEventListener('input', () => {
        slugEdited = true;
        const typed = slug.value;
        const next = typingSlug(typed);
        if (next !== typed) {
            const caret = slugCaret(typed, slug.selectionStart ?? typed.length);
            slug.value = next;
            slug.setSelectionRange(caret, caret);
        }
        update();
        saveDraft();
    });

    slug.addEventListener('blur', () => {
        slug.value = normaliseSlug(slug.value);
        update();
        saveDraft();
    });

    submitBtn.addEventListener('click', submit);
    cancelBtn.addEventListener('click', cancelWithConfirm);

    document.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            submit();
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            if (!isSubmitting) {
                cancelWithConfirm();
            }
        }
    });
}

function handleMessage(event: MessageEvent): void {
    const message = event.data as ExtensionToProcessCreate;
    switch (message.type) {
        case 'init':
            kind = message.kind;
            existingSlugs = message.existingSlugs;
            getElements().assistantName.textContent = message.assistantName;
            update();
            break;
        case 'submissionStarted':
            setLoading(true);
            break;
        case 'submissionComplete':
            break;
        case 'error':
            setLoading(false);
            showError(message.message);
            break;
    }
}

function renderKeyboardHints(): void {
    const { keyboardHints } = getElements();
    const key = (label: string) => {
        const kbd = document.createElement('kbd');
        kbd.textContent = label;
        return kbd;
    };
    const modifier = isMacPlatform(navigator.platform, navigator.userAgent) ? 'Cmd' : 'Ctrl';
    keyboardHints.replaceChildren(key(modifier), '+', key('Enter'), ' to send • ', key('Esc'), ' to cancel');
}

document.addEventListener('DOMContentLoaded', () => {
    kind = getElements().app.dataset.kind === 'idea' ? 'idea' : 'bug';
    renderKeyboardHints();
    setupEventListeners();
    restoreDraft();
    update();
    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'ready' });
});
