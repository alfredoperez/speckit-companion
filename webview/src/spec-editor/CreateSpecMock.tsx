/** Production-class Storybook fixture for the vanilla-DOM Create Spec webview. */

export interface CreateSpecMockProps {
    initialContent?: string;
    submitting?: boolean;
    overLimit?: boolean;
    showAuto?: boolean;
    attachments?: string[];
    narrow?: boolean;
}

const MAX_CHARS = 50_000;
const PLACEHOLDER = 'Describe the problem, audience, and desired outcome — or paste a Jira/GitHub link.';

export function CreateSpecMock({
    initialContent = '',
    submitting = false,
    overLimit = false,
    showAuto = true,
    attachments = [],
    narrow = false,
}: CreateSpecMockProps) {
    const count = overLimit ? MAX_CHARS + 1200 : initialContent.length;
    const canSubmit = initialContent.trim().length > 0 && !overLimit && !submitting;
    const showCount = count >= MAX_CHARS * 0.9;

    return (
        <div class="spec-editor" id="app" aria-busy={submitting ? 'true' : 'false'}>
            <main class="spec-editor-column" style={narrow ? 'max-width: 440px' : undefined}>
                <header class="spec-editor-header">
                    <h1>Create New Spec</h1>
                    <p>Describe your feature — or just paste a link — and the AI will generate the spec, plan, and tasks for it.</p>
                </header>

                <div class="spec-editor-content">
                    <div class="workflow-row">
                        <div class="workflow-selector">
                            <label for="story-workflow">Workflow</label>
                            <select id="story-workflow" aria-label="Workflow">
                                <option>SpecKit</option>
                            </select>
                        </div>
                    </div>

                    <div class="editor-container">
                        <label class="editor-label" for="story-brief">Feature Brief</label>
                        <details class="writing-tips">
                            <summary>Writing tips</summary>
                            <p>Include the problem, who it affects, key requirements, and constraints. A Jira or GitHub link also works on its own.</p>
                        </details>
                        <textarea
                            id="story-brief"
                            class="spec-editor-textarea"
                            placeholder={PLACEHOLDER}
                            value={initialContent}
                            readOnly
                        />
                        <div class="editor-footer-row">
                            <button class="attach-image-btn" type="button">
                                <span class="codicon codicon-file-media" aria-hidden="true" />
                                Attach image
                            </button>
                            {showCount && (
                                <div class={`char-count ${overLimit ? 'error' : 'warning'}`}>
                                    {overLimit
                                        ? `Over limit — ${count.toLocaleString()} / ${MAX_CHARS.toLocaleString()} (remove ${(count - MAX_CHARS).toLocaleString()} characters)`
                                        : `${count.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`}
                                </div>
                            )}
                        </div>
                        <div class="image-thumbnails">
                            {attachments.map((name, index) => (
                                <div class="image-thumbnail" key={name}>
                                    <div class="create-spec-fixture-image" aria-hidden="true">{index + 1}</div>
                                    <span class="image-name">{name}</span>
                                    <button class="remove-btn" type="button" aria-label={`Remove image ${name}`}>×</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <footer class="spec-editor-actions">
                    <div class="keyboard-hints"><kbd>Ctrl/Cmd</kbd>+<kbd>Enter</kbd> to submit • <kbd>Esc</kbd> to cancel</div>
                    <div class="action-spacer" />
                    <button class="btn-cancel" type="button">Cancel</button>
                    {showAuto && <button class="btn-secondary" type="button" disabled={!canSubmit}>Auto</button>}
                    <button class="btn-primary" type="button" disabled={!canSubmit}>
                        {submitting ? 'Creating…' : 'Create Spec'}
                    </button>
                </footer>
            </main>

            {submitting && (
                <div class="loading-overlay" role="status">
                    <div class="loading-spinner" aria-hidden="true" />
                    <p class="loading-text">Creating your spec…</p>
                </div>
            )}
        </div>
    );
}
