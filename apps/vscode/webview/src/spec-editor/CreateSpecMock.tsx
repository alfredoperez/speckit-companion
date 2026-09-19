/** Production-class Storybook fixture for the vanilla-DOM Create Spec webview. */

export interface MockWorkflowChoice {
    name: string;
    displayName: string;
    description: string;
    installed: boolean;
}

export interface CreateSpecMockProps {
    initialContent?: string;
    submitting?: boolean;
    overLimit?: boolean;
    showAuto?: boolean;
    attachments?: string[];
    narrow?: boolean;
    workflows?: MockWorkflowChoice[];
    selectedWorkflow?: string;
}

const MAX_CHARS = 50_000;
const PLACEHOLDER = 'Describe the problem, audience, and desired outcome — or paste a Jira/GitHub link.';

export const MOCK_WORKFLOWS: MockWorkflowChoice[] = [
    { name: 'speckit', displayName: 'SpecKit', description: 'Standard SpecKit workflow', installed: true },
    { name: 'companion', displayName: 'SpecKit Companion', description: 'specs 60–68% leaner, same correctness', installed: true },
];

const isCustomWorkflow = (name: string) => name !== 'speckit' && name !== 'companion';

export function CreateSpecMock({
    initialContent = '',
    submitting = false,
    overLimit = false,
    showAuto = true,
    attachments = [],
    narrow = false,
    workflows = MOCK_WORKFLOWS,
    selectedWorkflow = 'speckit',
}: CreateSpecMockProps) {
    const count = overLimit ? MAX_CHARS + 1200 : initialContent.length;
    const canSubmit = initialContent.trim().length > 0 && !overLimit && !submitting;
    const showCount = count >= MAX_CHARS * 0.9;

    const selected = workflows.find(wf => wf.name === selectedWorkflow) ?? workflows[0];
    const companion = workflows.find(wf => wf.name === 'companion');
    const needsInstall = selected?.installed === false;

    // The banner pitches Companion whenever it is missing, and otherwise carries a
    // project-defined workflow's own description. Both installed and nothing custom
    // selected means there is nothing to say, and the space goes back to the form.
    const pitchCompanion = companion?.installed === false;
    const pitchCustom =
        !pitchCompanion && !!selected && isCustomWorkflow(selected.name) && !!selected.description;

    return (
        <div class="spec-editor" id="app" aria-busy={submitting ? 'true' : 'false'}>
            <main class="spec-editor-column" style={narrow ? 'max-width: 440px' : undefined}>
                <header class="spec-editor-header">
                    <h1>Create New Spec</h1>
                    <p>Describe your feature — or just paste a link — and the AI will generate the spec, plan, and tasks for it.</p>
                </header>

                <div class="spec-editor-content">
                    <div class="workflow-row">
                        {workflows.length > 1 && (
                            <div class="workflow-selector">
                                <label class="workflow-selector-label" for="story-workflow">Workflow</label>
                                <select class="workflow-select" id="story-workflow" value={selected?.name}>
                                    {workflows.map(wf => (
                                        <option value={wf.name} key={wf.name}>
                                            {wf.installed === false ? `${wf.displayName} — install to enable` : wf.displayName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    {(pitchCompanion || pitchCustom) && (
                        <div class="workflow-pitch">
                            {pitchCompanion && (
                                <span class="codicon codicon-rocket workflow-pitch__glyph" aria-hidden="true" />
                            )}
                            <div class="workflow-pitch__body">
                                {pitchCompanion ? (
                                    <>
                                        {companion?.description && (
                                            <span class="workflow-pitch__text">{companion.description}</span>
                                        )}
                                        <span class="workflow-card-badge">Install to enable</span>
                                        {selectedWorkflow !== 'companion' && (
                                            <button type="button" class="workflow-card-trial">Try Companion for this spec</button>
                                        )}
                                    </>
                                ) : (
                                    <span class="workflow-pitch__text">{selected?.description}</span>
                                )}
                            </div>
                        </div>
                    )}

                    <div class="editor-container">
                        <label class="editor-label" for="story-brief">Feature Brief</label>
                        <p class="sr-only">Include the problem, who it affects, key requirements, and constraints. A Jira or GitHub link also works on its own.</p>
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
                    <div class="keyboard-hints"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> to submit • <kbd>Esc</kbd> to cancel</div>
                    <div class="action-spacer" />
                    <button class="btn-cancel" type="button">Cancel</button>
                    {showAuto && !needsInstall && <button class="btn-secondary" type="button" disabled={!canSubmit}>Auto</button>}
                    <button class="btn-primary" type="button" disabled={!needsInstall && !canSubmit}>
                        {needsInstall
                            ? `Install ${selected?.displayName ?? 'workflow'}`
                            : submitting ? 'Creating…' : 'Create Spec'}
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
