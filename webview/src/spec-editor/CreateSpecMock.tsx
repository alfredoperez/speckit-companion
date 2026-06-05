/**
 * Static Preact mock of the Create New Spec form.
 *
 * The real spec editor at `src/features/spec-editor/specEditorProvider.ts`
 * is a vanilla-DOM webview, so this mock exists only to give Storybook a
 * faithful visual reference of the layout. Used by:
 *   - SpecEditor/CreateSpec stories (standalone view).
 *   - Viewer/Transitions/CreateSpec (the lifecycle "phase zero" entry).
 *
 * Auto Mode lives here, next to Submit — by design it is the canonical
 * first-time entry point for the spec pipeline, NOT a viewer-footer button.
 */

export interface CreateSpecMockProps {
    initialContent?: string;
    submitting?: boolean;
}

export function CreateSpecMock({ initialContent = '', submitting = false }: CreateSpecMockProps) {
    const placeholder =
        'Describe your feature or task in detail...\n\n' +
        'Example:\n' +
        '- What is the feature about?\n' +
        '- What problem does it solve?\n' +
        '- Who are the target users?\n' +
        '- What are the key requirements?\n' +
        '- Are there any constraints or dependencies?';

    const charCount = initialContent.length;
    const maxChars = 50_000;

    return (
        <div
            style={`
                background: var(--vscode-editor-background, #0a0512);
                color: var(--vscode-foreground, #c8c8c8);
                font-family: var(--vscode-font-family, system-ui, -apple-system, sans-serif);
                padding: 32px;
                min-height: 100vh;
                box-sizing: border-box;
                max-width: 760px;
                margin: 0 auto;
            `}
        >
            <header style="margin-bottom: 28px;">
                <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 6px; color: var(--vscode-foreground, #fff);">
                    Create New Spec
                </h1>
                <p style="font-size: 13px; opacity: 0.7; margin: 0;">
                    Write a detailed specification for your feature or task
                </p>
            </header>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <button
                    type="button"
                    style="
                        background: var(--vscode-button-secondaryBackground, #1f1828);
                        color: var(--vscode-button-secondaryForeground, #ddd);
                        border: 1px solid var(--vscode-widget-border, #303030);
                        padding: 8px 14px;
                        border-radius: 4px;
                        font-size: 13px;
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                    "
                >
                    <span style="opacity: 0.7;">📄</span>
                    Load Template
                </button>
                <div style="display: flex; align-items: center; gap: 12px; font-size: 13px;">
                    <span style="opacity: 0.7;">Workflow</span>
                    <button
                        type="button"
                        style="
                            background: var(--vscode-button-secondaryBackground, #1f1828);
                            color: var(--vscode-button-secondaryForeground, #ddd);
                            border: 1px solid var(--vscode-widget-border, #303030);
                            padding: 8px 14px;
                            border-radius: 4px;
                            font-size: 13px;
                            cursor: pointer;
                            display: inline-flex;
                            align-items: center;
                            gap: 8px;
                            min-width: 120px;
                            justify-content: space-between;
                        "
                    >
                        SpecKit
                        <span style="opacity: 0.5;">▾</span>
                    </button>
                </div>
            </div>

            <section style="margin-bottom: 20px;">
                <h2 style="font-size: 14px; font-weight: 600; margin: 0 0 10px;">
                    Specification
                </h2>
                <div
                    style={`
                        background: var(--vscode-input-background, #0c0814);
                        border: 1px solid var(--vscode-widget-border, #2a2a2a);
                        border-radius: 6px;
                        padding: 16px;
                        font-family: var(--vscode-editor-font-family, monospace);
                        font-size: 13px;
                        line-height: 1.6;
                        min-height: 320px;
                        white-space: pre-wrap;
                        color: ${initialContent ? 'var(--vscode-input-foreground, #ddd)' : 'rgba(190, 175, 230, 0.7)'};
                    `}
                >
                    {initialContent || placeholder}
                </div>
                <div style="text-align: right; margin-top: 6px; font-size: 12px; opacity: 0.6;">
                    {charCount.toLocaleString()} / {maxChars.toLocaleString()}
                </div>
            </section>

            <section style="border-top: 1px solid var(--vscode-widget-border, #2a2a2a); padding-top: 16px; margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h2 style="font-size: 14px; font-weight: 600; margin: 0;">Attachments</h2>
                    <button
                        type="button"
                        style="
                            background: transparent;
                            color: var(--vscode-foreground, #ddd);
                            border: none;
                            padding: 4px 0;
                            font-size: 13px;
                            cursor: pointer;
                            display: inline-flex;
                            align-items: center;
                            gap: 8px;
                        "
                    >
                        <span style="opacity: 0.7;">🖼</span>
                        Attach Image
                    </button>
                </div>
                <p style="font-size: 12px; opacity: 0.55; margin: 0; font-style: italic;">
                    Use the button above or paste (Ctrl+V / Cmd+V) to attach images
                </p>
            </section>

            <footer style="border-top: 1px solid var(--vscode-widget-border, #2a2a2a); padding-top: 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                <button
                    type="button"
                    style="
                        background: transparent;
                        color: var(--vscode-foreground, #ddd);
                        border: 1px solid var(--vscode-widget-border, #303030);
                        padding: 8px 18px;
                        border-radius: 4px;
                        font-size: 13px;
                        cursor: pointer;
                    "
                >
                    Cancel
                </button>
                <div style="display: flex; gap: 10px;">
                    <button
                        type="button"
                        title="Run the full spec pipeline automatically (specify → plan → tasks → implement)"
                        style="
                            background: var(--vscode-button-secondaryBackground, #1f1828);
                            color: var(--vscode-button-secondaryForeground, #ddd);
                            border: 1px solid var(--vscode-widget-border, #303030);
                            padding: 8px 18px;
                            border-radius: 4px;
                            font-size: 13px;
                            cursor: pointer;
                            font-weight: 500;
                        "
                    >
                        Auto Mode
                    </button>
                    <button
                        type="button"
                        disabled={submitting}
                        style={`
                            background: ${submitting ? 'var(--vscode-button-secondaryBackground, #2a2a2a)' : 'var(--vscode-button-background, #3c3c3c)'};
                            color: var(--vscode-button-foreground, #fff);
                            border: 1px solid var(--vscode-widget-border, #303030);
                            padding: 8px 22px;
                            border-radius: 4px;
                            font-size: 13px;
                            font-weight: 600;
                            cursor: ${submitting ? 'wait' : 'pointer'};
                            opacity: ${submitting ? 0.6 : 1};
                        `}
                    >
                        {submitting ? 'Submitting…' : 'Submit'}
                    </button>
                </div>
            </footer>

            <p style="margin-top: 14px; font-size: 11px; opacity: 0.55; text-align: left;">
                <kbd style="background: var(--vscode-keybindingLabel-background, #2a2a2a); padding: 1px 6px; border-radius: 3px; border: 1px solid var(--vscode-widget-border, #303030);">Ctrl</kbd>
                {' + '}
                <kbd style="background: var(--vscode-keybindingLabel-background, #2a2a2a); padding: 1px 6px; border-radius: 3px; border: 1px solid var(--vscode-widget-border, #303030);">Enter</kbd>
                {' to submit · '}
                <kbd style="background: var(--vscode-keybindingLabel-background, #2a2a2a); padding: 1px 6px; border-radius: 3px; border: 1px solid var(--vscode-widget-border, #303030);">Esc</kbd>
                {' to cancel'}
            </p>
        </div>
    );
}
