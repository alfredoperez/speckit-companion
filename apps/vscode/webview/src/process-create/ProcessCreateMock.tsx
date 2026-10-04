/** Production-class Storybook fixture for the vanilla-DOM New Bug / New Idea webview. */

import type { ProcessCreateKind } from '../../../src/protocol/processCreate';
import { canSend, slugProblem } from './gate';

export interface ProcessCreateMockProps {
    kind: ProcessCreateKind;
    text?: string;
    extra?: string;
    slug?: string;
    existingSlugs?: string[];
    assistantName?: string;
    submitting?: boolean;
    error?: string;
    narrow?: boolean;
}

const COPY = {
    bug: {
        title: 'New Bug',
        intro: 'Describe what goes wrong and your assistant will assess it.',
        mainLabel: 'Symptom',
        mainPlaceholder: 'What happens, and what you expected instead.',
        extraLabel: 'Link or pasted error',
        extraPlaceholder: 'An issue link, a stack trace or a log line.',
        slugPrefix: '.specify/bugs/',
        next: 'Your assistant assesses the bug and writes its report into this folder. The bug appears in the Bugs pane once the report is written.',
        button: 'Assess bug',
    },
    idea: {
        title: 'New Idea',
        intro: 'Write the idea in a sentence or two and your assistant will assess it.',
        mainLabel: 'The idea',
        mainPlaceholder: 'What you want to build, and why it matters.',
        extraLabel: 'Who it is for',
        extraPlaceholder: 'The people who would use it.',
        slugPrefix: '.specify/assessments/',
        next: 'Your assistant takes the idea through intake and writes it into this folder. The idea appears in the Ideas pane once the intake is written.',
        button: 'Assess idea',
    },
} as const;

export function ProcessCreateMock({
    kind,
    text = '',
    extra = '',
    slug = '',
    existingSlugs = [],
    assistantName = 'Claude Code',
    submitting = false,
    error,
    narrow = false,
}: ProcessCreateMockProps) {
    const copy = COPY[kind];
    const problem = text.trim() ? slugProblem(kind, slug, existingSlugs) : undefined;
    const enabled = canSend({ kind, text, extra, slug, existingSlugs }, submitting);

    return (
        <div class="spec-editor" id="app" aria-busy={submitting ? 'true' : 'false'}>
            <main class="spec-editor-column" style={narrow ? 'max-width: 440px' : undefined}>
                <header class="spec-editor-header">
                    <h1>{copy.title}</h1>
                    <p>{copy.intro}</p>
                </header>

                <div class="spec-editor-content">
                    <div class="process-alert" role="alert">
                        {error && (
                            <div class="error-message">
                                <button class="close-btn" type="button" aria-label="Dismiss error">×</button>
                                {error}
                            </div>
                        )}
                    </div>

                    <div class="editor-container">
                        <label class="editor-label" for="story-main">{copy.mainLabel}</label>
                        <textarea
                            id="story-main"
                            class="spec-editor-textarea"
                            placeholder={copy.mainPlaceholder}
                            value={text}
                            readOnly
                        />
                        <div class="editor-footer-row">
                            <span />
                            <div class="char-count sr-only" />
                        </div>
                    </div>

                    <div class="process-field">
                        <label class="editor-label" for="story-extra">{copy.extraLabel} (optional)</label>
                        {kind === 'bug' ? (
                            <textarea
                                id="story-extra"
                                class="spec-editor-textarea process-textarea--short"
                                placeholder={copy.extraPlaceholder}
                                value={extra}
                                readOnly
                            />
                        ) : (
                            <input
                                id="story-extra"
                                class="process-input"
                                type="text"
                                placeholder={copy.extraPlaceholder}
                                value={extra}
                                readOnly
                            />
                        )}
                    </div>

                    <div class="process-field">
                        <label class="editor-label" for="story-slug">Slug</label>
                        <div class="process-slug-row">
                            <span class="process-slug-prefix">{copy.slugPrefix}</span>
                            <input id="story-slug" class="process-input" type="text" value={slug} readOnly />
                        </div>
                        {problem && (
                            <p class="process-field-message" role="status">{problem}</p>
                        )}
                    </div>

                    <div>
                        <p class="process-note">Sends to {assistantName}.</p>
                        <p class="process-note">{copy.next}</p>
                    </div>
                </div>

                <footer class="spec-editor-actions">
                    <div class="keyboard-hints"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> to send • <kbd>Esc</kbd> to cancel</div>
                    <div class="action-spacer" />
                    <button class="btn-cancel" type="button">Cancel</button>
                    <button class="btn-primary" type="button" disabled={!enabled}>{copy.button}</button>
                </footer>
            </main>

            {submitting && (
                <div class="loading-overlay" role="status">
                    <div class="loading-spinner" aria-hidden="true" />
                    <p class="loading-text">Sending to your assistant…</p>
                </div>
            )}
        </div>
    );
}
