import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getAIProvider } from '../../extension';
import { formatCommandForProvider, getConfiguredProviderType, getProviderDisplayName } from '../../ai-providers/aiProvider';
import { getProjectRoot } from '../../core/projectRoot';
import { CACHE_ROOT, ensureCacheFolder } from '../../core/companionCache';
import { BUGS_DIR, readBugReports } from '../bugs/bugReports';
import { IDEAS_DIR, readIdeaReports } from '../ideas/ideaReports';
import { generateNonce } from '../spec-viewer/utils';
import {
    normaliseSlug,
    PROCESS_TEXT_LIMIT,
    type ExtensionToProcessCreate,
    type ProcessCreateKind,
    type ProcessCreateToExtension,
} from '../../protocol/processCreate';

const STAGING_FOLDER = 'process-create';
const CLOSE_DELAY_MS = 500;
const NO_PROJECT = 'Open a project folder first.';

interface KindCopy {
    title: string;
    noun: string;
    article: string;
    intro: string;
    mainLabel: string;
    mainPlaceholder: string;
    extraLabel: string;
    extraPlaceholder: string;
    extraIsTextarea: boolean;
    slugPrefix: string;
    next: string;
    button: string;
    command: string;
    directory: string;
    terminalTitle: string;
    existingSlugs: (root: string) => string[];
}

const KINDS: Record<ProcessCreateKind, KindCopy> = {
    bug: {
        title: 'New Bug',
        noun: 'bug report',
        article: 'A bug',
        intro: 'Describe what goes wrong and your assistant will assess it.',
        mainLabel: 'Symptom',
        mainPlaceholder: 'What happens, and what you expected instead.',
        extraLabel: 'Link or pasted error',
        extraPlaceholder: 'An issue link, a stack trace or a log line.',
        extraIsTextarea: true,
        slugPrefix: '.specify/bugs/',
        next: 'Your assistant assesses the bug and writes its report into this folder. The bug appears in the Bugs pane once the report is written.',
        button: 'Assess bug',
        command: 'speckit.bug.assess',
        directory: BUGS_DIR,
        terminalTitle: 'SpecKit - New Bug',
        existingSlugs: root => readBugReports(root).map(bug => bug.slug),
    },
    idea: {
        title: 'New Idea',
        noun: 'idea',
        article: 'An idea',
        intro: 'Write the idea in a sentence or two and your assistant will assess it.',
        mainLabel: 'The idea',
        mainPlaceholder: 'What you want to build, and why it matters.',
        extraLabel: 'Who it is for',
        extraPlaceholder: 'The people who would use it.',
        extraIsTextarea: false,
        slugPrefix: '.specify/assessments/',
        next: 'Your assistant takes the idea through intake and writes it into this folder. The idea appears in the Ideas pane once the intake is written.',
        button: 'Assess idea',
        command: 'speckit.assess.intake',
        directory: IDEAS_DIR,
        terminalTitle: 'SpecKit - New Idea',
        existingSlugs: root => readIdeaReports(root).map(idea => idea.slug),
    },
};

interface PanelState {
    disposed: boolean;
    submitting: boolean;
}

export class ProcessCreateProvider {
    private readonly panels = new Map<ProcessCreateKind, vscode.WebviewPanel>();

    constructor(private readonly context: vscode.ExtensionContext) {}

    public show(kind: ProcessCreateKind): void {
        const open = this.panels.get(kind);
        if (open) {
            open.reveal();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            `speckit.processCreate.${kind}`,
            KINDS[kind].title,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: false,
                localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')],
            },
        );
        this.panels.set(kind, panel);
        const state: PanelState = { disposed: false, submitting: false };
        panel.webview.html = this.getWebviewHtml(panel.webview, kind);
        panel.webview.onDidReceiveMessage(
            (message: ProcessCreateToExtension) => this.handleMessage(kind, panel, state, message),
            undefined,
            this.context.subscriptions,
        );
        panel.onDidDispose(() => {
            state.disposed = true;
            if (this.panels.get(kind) === panel) {
                this.panels.delete(kind);
            }
        });
    }

    private async handleMessage(
        kind: ProcessCreateKind,
        panel: vscode.WebviewPanel,
        state: PanelState,
        message: ProcessCreateToExtension,
    ): Promise<void> {
        const post = (reply: ExtensionToProcessCreate) => {
            if (!state.disposed) {
                void panel.webview.postMessage(reply);
            }
        };
        switch (message.type) {
            case 'ready': {
                const root = getProjectRoot();
                post({
                    type: 'init',
                    kind,
                    assistantName: getProviderDisplayName(getConfiguredProviderType()),
                    existingSlugs: root ? KINDS[kind].existingSlugs(root) : [],
                });
                break;
            }
            case 'submit':
                if (state.submitting) {
                    break;
                }
                state.submitting = true;
                state.submitting = await this.handleSubmit(kind, panel, state, post, message);
                break;
            case 'cancel':
                // A webview cannot show its own confirm dialog, so the question is asked here.
                if (message.typed === true) {
                    const choice = await vscode.window.showWarningMessage(
                        'Discard what you typed?',
                        { modal: true },
                        'Discard',
                    );
                    if (choice !== 'Discard') break;
                }
                panel.dispose();
                break;
        }
    }

    private async handleSubmit(
        kind: ProcessCreateKind,
        panel: vscode.WebviewPanel,
        state: PanelState,
        post: (reply: ExtensionToProcessCreate) => void,
        message: Extract<ProcessCreateToExtension, { type: 'submit' }>,
    ): Promise<boolean> {
        const copy = KINDS[kind];
        const text = String(message.text ?? '');
        const extra = String(message.extra ?? '').trim();
        const slug = normaliseSlug(String(message.slug ?? ''));
        const root = getProjectRoot();

        const problem = !root ? NO_PROJECT
            : !text.trim() ? `${copy.mainLabel} cannot be empty.`
            : text.length > PROCESS_TEXT_LIMIT || extra.length > PROCESS_TEXT_LIMIT
                ? `That is too long. Keep each field under ${PROCESS_TEXT_LIMIT.toLocaleString('en-US')} characters.`
            : !slug ? 'The slug cannot be empty.'
            : fs.existsSync(path.join(root, copy.directory, slug)) ? `${copy.article} named ${slug} already exists.`
            : undefined;
        if (problem || !root) {
            post({ type: 'error', message: problem ?? NO_PROJECT });
            return false;
        }

        try {
            post({ type: 'submissionStarted' });
            const fileName = `${kind}-${slug}.md`;
            const relativePath = `${CACHE_ROOT}/${STAGING_FOLDER}/${fileName}`;
            const stagingFolder = ensureCacheFolder(root, STAGING_FOLDER);
            await fs.promises.writeFile(
                path.join(stagingFolder, fileName),
                extra ? `${text.trim()}\n\n## ${copy.extraLabel}\n\n${extra}\n` : `${text.trim()}\n`,
                'utf8',
            );

            const prompt = `/${formatCommandForProvider(copy.command)} slug=${slug} Read the ${copy.noun} in the file at ${relativePath} and treat that file as the text to assess.`;
            await getAIProvider().executeInTerminal(prompt, copy.terminalTitle);

            post({ type: 'submissionComplete' });
            setTimeout(() => {
                if (!state.disposed) {
                    panel.dispose();
                }
            }, CLOSE_DELAY_MS);
            return true;
        } catch (error) {
            post({
                type: 'error',
                message: `Could not send to your assistant: ${error instanceof Error ? error.message : String(error)}`,
            });
            return false;
        }
    }

    private getWebviewHtml(webview: vscode.Webview, kind: ProcessCreateKind): string {
        const copy = KINDS[kind];
        const dist = (file: string) =>
            webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', file));
        const nonce = generateNonce();
        const extraField = copy.extraIsTextarea
            ? `<textarea class="spec-editor-textarea process-textarea--short" id="extraText" placeholder="${copy.extraPlaceholder}"></textarea>`
            : `<input class="process-input" id="extraText" type="text" placeholder="${copy.extraPlaceholder}">`;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none';
                   style-src ${webview.cspSource} 'unsafe-inline';
                   script-src 'nonce-${nonce}';
                   font-src ${webview.cspSource};">
    <link href="${dist('spec-editor.css')}" rel="stylesheet">
    <title>${copy.title}</title>
</head>
<body>
    <div class="spec-editor" id="app" data-kind="${kind}" aria-busy="false">
        <main class="spec-editor-column">
            <header class="spec-editor-header">
                <h1>${copy.title}</h1>
                <p>${copy.intro}</p>
            </header>

            <div class="spec-editor-content">
                <div class="process-alert" id="error-container" role="alert" aria-live="assertive"></div>

                <div class="editor-container">
                    <label class="editor-label" for="mainText">${copy.mainLabel}</label>
                    <textarea class="spec-editor-textarea" id="mainText" aria-describedby="charCount" placeholder="${copy.mainPlaceholder}"></textarea>
                    <div class="editor-footer-row">
                        <span></span>
                        <div class="char-count sr-only" id="charCount"></div>
                    </div>
                </div>

                <div class="process-field">
                    <label class="editor-label" for="extraText">${copy.extraLabel} (optional)</label>
                    ${extraField}
                </div>

                <div class="process-field">
                    <label class="editor-label" for="slug">Slug</label>
                    <div class="process-slug-row">
                        <span class="process-slug-prefix">${copy.slugPrefix}</span>
                        <input class="process-input" id="slug" type="text" spellcheck="false" autocomplete="off" aria-describedby="slugMessage">
                    </div>
                    <p class="process-field-message" id="slugMessage" role="status" hidden></p>
                </div>

                <div>
                    <p class="process-note">Sends to <span id="assistantName">your assistant</span>.</p>
                    <p class="process-note">${copy.next}</p>
                </div>
            </div>

            <footer class="spec-editor-actions">
                <div class="keyboard-hints" id="keyboardHints"></div>
                <div class="action-spacer"></div>
                <button class="btn-cancel" id="cancelBtn" type="button">Cancel</button>
                <button class="btn-primary" id="submitBtn" type="button" disabled>${copy.button}</button>
            </footer>
        </main>

        <div class="sr-only" id="sr-status" role="status" aria-live="polite"></div>
    </div>

    <div class="loading-overlay" id="loadingOverlay" role="status" aria-live="polite" aria-hidden="true" style="display: none;">
        <div class="loading-spinner" aria-hidden="true"></div>
        <p class="loading-text">Sending to your assistant…</p>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
    </script>
    <script nonce="${nonce}" src="${dist('process-create.js')}"></script>
</body>
</html>`;
    }
}
