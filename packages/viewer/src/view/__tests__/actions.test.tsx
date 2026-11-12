/**
 * @jest-environment jsdom
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render } from 'preact';
import { NavigationBar } from '../components/NavigationBar';
import { navState } from '../signals';
import { onAction, setActionHandler } from '../host';
import type { NavState, ReportSummary, SpecDocument, ViewerAction } from '../../contract';

const doc = (type: string, label: string): SpecDocument => ({
    type, label, fileName: `${type}.md`, filePath: `/x/${type}.md`, exists: true, isCore: true, category: 'core',
});

function viewFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === '__tests__' ? [] : viewFiles(path);
        return /\.tsx?$/.test(name) ? [path] : [];
    });
}

describe('the view talks to its host through onAction only', () => {
    afterEach(() => setActionHandler(null));

    it('has no VS Code API call in any view module', () => {
        const offenders = viewFiles(join(__dirname, '..')).filter((file) => /vscode\.postMessage|acquireVsCodeApi|declare const vscode/.test(readFileSync(file, 'utf8')));
        expect(offenders).toEqual([]);
    });

    it('sends a rail click to the handler the host set', () => {
        const seen: ViewerAction[] = [];
        setActionHandler((action) => seen.push(action));
        navState.value = {
            coreDocs: [doc('spec', 'Specification'), doc('plan', 'Plan')],
            relatedDocs: [],
            currentDoc: 'spec',
            workflowPhase: 'plan',
            taskCompletionPercent: 0,
            isViewingRelatedDoc: false,
        } as unknown as NavState<ReportSummary>;
        const root = document.createElement('div');
        document.body.appendChild(root);
        render(<NavigationBar />, root);

        root.querySelector<HTMLButtonElement>('.step-tab[data-phase="plan"]')!.click();

        expect(seen).toContainEqual({ type: 'stepperClick', phase: 'plan' });
        render(null, root);
    });

    it('drops an action when no host listens', () => {
        expect(() => onAction({ type: 'overviewChosen' })).not.toThrow();
    });
});
