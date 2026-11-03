import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { IDEAS_DIR, IDEA_SET, ideasDir, readIdeaReports, resolveIdeasDir } from '../ideaReports';
import { ideasPaneConfig, ideasViewDescription } from '../ideasPane';

const setSetting = (value: unknown) =>
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn((key: string, fallback?: unknown) => (key === 'speckit.assessmentsDirectory' ? value : fallback)),
    });

function projectWithIdea(folder: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ideas-folder-'));
    const dir = path.join(root, folder, 'dark-mode');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'intake.md'), '# Idea Intake: Dark mode\n');
    return root;
}

describe('the assessments folder setting', () => {
    afterEach(() => {
        (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = undefined;
    });

    it('reads .specify/assessments when the setting is not set', () => {
        setSetting(undefined);
        const root = projectWithIdea('.specify/assessments');
        expect(ideasDir(root)).toBe(IDEAS_DIR);
        expect(readIdeaReports(root).map(idea => idea.slug)).toEqual(['dark-mode']);
        expect(ideasPaneConfig.settingNote?.(root)).toBeUndefined();
    });

    it('lists the packets under docs/assessments when the setting points there', () => {
        setSetting('docs/assessments');
        const root = projectWithIdea('docs/assessments');
        expect(readIdeaReports(root).map(idea => idea.slug)).toEqual(['dark-mode']);
        expect(ideasViewDescription(root)).toBe('docs/assessments');
    });

    it('does not list the default folder while the setting points elsewhere', () => {
        setSetting('docs/assessments');
        expect(readIdeaReports(projectWithIdea('.specify/assessments'))).toEqual([]);
    });

    it.each(['../outside', 'docs/../../outside', '/etc/assessments', '..', '.', '', '   ', 42])(
        'falls back to the default for %p',
        value => {
            expect(resolveIdeasDir('/work/project', value)).toBe(IDEAS_DIR);
        },
    );

    it('accepts an absolute path that stays inside the project', () => {
        expect(resolveIdeasDir('/work/project', '/work/project/docs/assessments')).toBe(path.join('docs', 'assessments'));
    });

    it('lets the document paths follow the setting', () => {
        setSetting('docs/assessments');
        (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [{ uri: { fsPath: '/work/project' }, name: 'p' }];
        expect(IDEA_SET.dir).toBe(path.join('docs', 'assessments'));
    });

    it('explains a moved folder in a row that opens the setting', () => {
        setSetting('docs/assessments');
        const note = ideasPaneConfig.settingNote?.('/work/project');
        expect(note?.label).toBe('Reading docs/assessments');
        expect(note?.tooltip).toContain('still write to .specify/assessments');
        expect(note?.setting).toBe('speckit.assessmentsDirectory');
    });
});
