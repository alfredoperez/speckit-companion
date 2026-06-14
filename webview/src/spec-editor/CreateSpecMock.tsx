/**
 * Static Preact mock of the Create New Spec form.
 *
 * The real spec editor at `src/features/spec-editor/specEditorProvider.ts`
 * is a vanilla-DOM webview, so this mock exists only to give Storybook a
 * faithful visual reference of the layout. Used by:
 *   - SpecEditor/CreateSpec stories (standalone view).
 *   - Viewer/Transitions/CreateSpec (the lifecycle "phase zero" entry).
 *
 * Auto Mode lives here, next to Create Spec — by design it is the canonical
 * first-time entry point for the spec pipeline, NOT a viewer-footer button.
 */

export interface CreateSpecMockProps {
    initialContent?: string;
    submitting?: boolean;
    overLimit?: boolean;
}

const MAX_CHARS = 50_000;

const PLACEHOLDER_TEXT =
    'Describe your feature or task in detail — or just paste a link below and skip the description entirely.\n\n' +
    'What helps:\n' +
    '- What is the feature about?\n' +
    '- What problem does it solve?\n' +
    '- Who is it for?\n' +
    '- Key requirements, constraints, or dependencies?\n\n' +
    'Or paste a reference link on its own:\n' +
    '- Jira:  https://your-org.atlassian.net/browse/PROJ-1234\n' +
    '- GitHub:  https://github.com/your-org/your-repo/issues/42';

export function CreateSpecMock({
    initialContent = '',
    submitting = false,
    overLimit = false,
}: CreateSpecMockProps) {
    const charCount = overLimit ? MAX_CHARS + 1200 : initialContent.length;
    const isEmpty = initialContent.trim().length === 0;
    const canSubmit = !isEmpty && !overLimit && !submitting;
    // Counter is hidden until ~90% of the limit, then shows in warning/over-limit color.
    const showCount = charCount >= MAX_CHARS * 0.9;

    return (
        <div
            style={`
                background: var(--vscode-editor-background, #0a0512);
                color: var(--vscode-foreground, #c8c8c8);
                font-family: var(--vscode-font-family, system-ui, -apple-system, sans-serif);
                padding: 32px;
                min-height: 100vh;
                box-sizing: border-box;
            `}
        >
            <main style="max-width: 800px; margin: 0 auto;">
                <header style="margin-bottom: 24px;">
                    <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 6px; color: var(--vscode-foreground, #fff);">
                        Create New Spec
                    </h1>
                    <p style="font-size: 15px; margin: 0; color: var(--vscode-foreground, #c8c8c8);">
                        Describe your feature — or just paste a link — and the AI will generate the spec, plan, and tasks for it.
                    </p>
                </header>

                <div style="display: flex; justify-content: flex-end; align-items: center; gap: 12px; font-size: 15px; margin-bottom: 8px;">
                    <span>Workflow</span>
                    <button
                        type="button"
                        style="
                            background: var(--vscode-button-secondaryBackground, #1f1828);
                            color: var(--vscode-button-secondaryForeground, #ddd);
                            border: 1px solid var(--vscode-widget-border, #303030);
                            padding: 6px 12px;
                            border-radius: 4px;
                            font-size: 15px;
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

                <section style="margin-bottom: 20px;">
                    <div
                        style={`
                            background: var(--vscode-input-background, #0c0814);
                            border: 1px solid var(--vscode-widget-border, #2a2a2a);
                            border-radius: 6px;
                            padding: 16px;
                            font-family: var(--vscode-font-family, system-ui, sans-serif);
                            font-size: 15px;
                            line-height: 1.6;
                            min-height: 280px;
                            white-space: pre-wrap;
                            color: ${isEmpty ? 'rgba(200, 200, 200, 0.85)' : 'var(--vscode-input-foreground, #ddd)'};
                        `}
                    >
                        {initialContent || PLACEHOLDER_TEXT}
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px;">
                        <button
                            type="button"
                            aria-label="Attach image (or paste an image to attach)"
                            style="
                                background: transparent;
                                color: var(--vscode-button-secondaryForeground, #ddd);
                                border: 1px solid var(--vscode-widget-border, #303030);
                                padding: 4px 10px;
                                font-size: 12px;
                                border-radius: 4px;
                                cursor: pointer;
                                display: inline-flex;
                                align-items: center;
                                gap: 6px;
                            "
                        >
                            <span aria-hidden="true">🖼</span>
                            Attach image
                        </button>
                        {showCount && (
                            <span
                                style={`font-size: 12px; color: ${overLimit ? 'var(--vscode-editorError-foreground, #f14c4c)' : 'var(--vscode-editorWarning-foreground, #cca700)'};`}
                            >
                                {overLimit
                                    ? `Over limit — ${charCount.toLocaleString()} / ${MAX_CHARS.toLocaleString()} (remove ${(charCount - MAX_CHARS).toLocaleString()} characters)`
                                    : `${charCount.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`}
                            </span>
                        )}
                    </div>
                </section>

                <footer style="padding-top: 16px; display: flex; align-items: center; gap: 12px;">
                    <p style="margin: 0; font-size: 11px; color: var(--vscode-foreground, #c8c8c8);">
                        <kbd style="background: var(--vscode-keybindingLabel-background, #2a2a2a); padding: 1px 6px; border-radius: 3px; border: 1px solid var(--vscode-widget-border, #303030);">Ctrl/Cmd</kbd>
                        {' + '}
                        <kbd style="background: var(--vscode-keybindingLabel-background, #2a2a2a); padding: 1px 6px; border-radius: 3px; border: 1px solid var(--vscode-widget-border, #303030);">Enter</kbd>
                        {' to submit · '}
                        <kbd style="background: var(--vscode-keybindingLabel-background, #2a2a2a); padding: 1px 6px; border-radius: 3px; border: 1px solid var(--vscode-widget-border, #303030);">Esc</kbd>
                        {' to cancel'}
                    </p>
                    <div style="flex: 1;" />
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
                        disabled={!canSubmit}
                        style={`
                            background: ${canSubmit ? 'var(--vscode-button-background, #3c3c3c)' : 'var(--vscode-button-secondaryBackground, #2a2a2a)'};
                            color: var(--vscode-button-foreground, #fff);
                            border: 1px solid var(--vscode-widget-border, #303030);
                            padding: 8px 22px;
                            border-radius: 4px;
                            font-size: 13px;
                            font-weight: 600;
                            cursor: ${canSubmit ? 'pointer' : 'not-allowed'};
                            opacity: ${canSubmit ? 1 : 0.5};
                        `}
                    >
                        {submitting ? 'Creating…' : 'Create Spec'}
                    </button>
                </footer>
            </main>
        </div>
    );
}
