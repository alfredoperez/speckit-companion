/** New bug and New idea, modelled on the Create Spec screen and drawn with its stylesheet. */

export interface CreateProcessProps {
    heading: string;
    intro: string;
    mainLabel: string;
    mainPlaceholder: string;
    mainValue: string;
    extraLabel: string;
    extraPlaceholder: string;
    extraValue?: string;
    slugRoot: string;
    slug: string;
    assistants?: string[];
    next: string;
    submitLabel: string;
}

const ASSISTANTS = ['Claude Code', 'GitHub Copilot CLI', 'Codex CLI', 'Gemini CLI'];

export function CreateProcessMock({
    heading,
    intro,
    mainLabel,
    mainPlaceholder,
    mainValue,
    extraLabel,
    extraPlaceholder,
    extraValue = '',
    slugRoot,
    slug,
    assistants = ASSISTANTS,
    next,
    submitLabel,
}: CreateProcessProps) {
    const canSubmit = mainValue.trim().length > 0;
    return (
        <div class="spec-editor pp-create">
            <main class="spec-editor-column">
                <header class="spec-editor-header">
                    <h1>{heading}</h1>
                    <p>{intro}</p>
                </header>

                <div class="spec-editor-content">
                    <div class="editor-container">
                        <label class="editor-label" for="pp-main">
                            {mainLabel}
                        </label>
                        <textarea id="pp-main" class="spec-editor-textarea" placeholder={mainPlaceholder} value={mainValue} readOnly />
                    </div>

                    <div class="pp-field">
                        <label class="editor-label" for="pp-extra">
                            {extraLabel} <span class="pp-optional">optional</span>
                        </label>
                        <textarea id="pp-extra" class="spec-editor-textarea pp-short" placeholder={extraPlaceholder} value={extraValue} readOnly />
                    </div>

                    <div class="pp-field-row">
                        <div class="pp-field">
                            <label class="editor-label" for="pp-slug">
                                Slug
                            </label>
                            <div class="pp-slug">
                                <span class="pp-slug__root">{slugRoot}</span>
                                <input id="pp-slug" class="pp-input" type="text" value={slug} readOnly />
                            </div>
                        </div>
                        <div class="pp-field">
                            <label class="editor-label" for="pp-assistant">
                                Send to
                            </label>
                            <select id="pp-assistant" class="workflow-select pp-select" value={assistants[0]}>
                                {assistants.map((name) => (
                                    <option value={name} key={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div class="workflow-pitch">
                        <span class="codicon codicon-info pp-next__glyph" aria-hidden="true" />
                        <div class="workflow-pitch__body">
                            <span class="workflow-pitch__text">{next}</span>
                        </div>
                    </div>
                </div>

                <footer class="spec-editor-actions">
                    <div class="keyboard-hints">
                        <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to submit • <kbd>Esc</kbd> to cancel
                    </div>
                    <div class="action-spacer" />
                    <button class="btn-cancel" type="button">
                        Cancel
                    </button>
                    <button class="btn-primary" type="button" disabled={!canSubmit}>
                        {submitLabel}
                    </button>
                </footer>
            </main>
        </div>
    );
}
