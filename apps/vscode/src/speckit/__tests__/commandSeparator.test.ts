import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { projectCommandFormat } from '../commandSeparator';

let root = '';
jest.mock('../../core/projectRoot', () => ({ getProjectRoot: () => root }));

import { formatCommandForProvider } from '../../ai-providers/aiProvider';

function project(files: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmd-sep-'));
    for (const [rel, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), text);
    }
    return dir;
}

const copilot125 = {
    '.specify/integration.json': JSON.stringify({
        installed_integrations: ['copilot'],
        integration_settings: { copilot: { script: 'sh', invoke_separator: '-' } },
        default_integration: 'copilot',
    }),
    '.github/skills/speckit-specify/SKILL.md': '---\nname: speckit-specify\n---\n',
};

describe('how a project spells its commands', () => {
    it('takes the separator spec-kit recorded for the agent', () => {
        expect(projectCommandFormat(project(copilot125), 'copilot')).toBe('dash');
        expect(projectCommandFormat(project({ '.specify/integration.json': JSON.stringify({ integration_settings: { gemini: { invoke_separator: '.' } } }) }), 'gemini')).toBe('dot');
    });

    it('falls back to the skills on disk when spec-kit recorded nothing', () => {
        expect(projectCommandFormat(project({ '.github/skills/speckit-specify/SKILL.md': '' }), 'copilot')).toBe('dash');
        expect(projectCommandFormat(project({ '.agents/skills/speckit.specify/SKILL.md': '' }), 'codex', '.agents/skills')).toBe('dot');
    });

    it('gives IDE chat the dash skills of a Claude-only project, which Copilot in VS Code reads too', () => {
        const claudeOnly = {
            '.specify/integration.json': JSON.stringify({ installed_integrations: ['claude'], integration_settings: { claude: { invoke_separator: '-' } } }),
            '.claude/skills/speckit-specify/SKILL.md': '',
        };
        expect(projectCommandFormat(project(claudeOnly), 'copilot')).toBe('dash');
    });

    it('ignores settings left behind for an agent that is no longer installed', () => {
        const stale = { '.specify/integration.json': JSON.stringify({ installed_integrations: ['claude'], integration_settings: { copilot: { invoke_separator: '-' } } }) };
        expect(projectCommandFormat(project(stale), 'copilot')).toBeUndefined();
    });

    it('says nothing for a bare project, an unreadable record or another agent', () => {
        expect(projectCommandFormat(project({}), 'copilot')).toBeUndefined();
        expect(projectCommandFormat(project({ '.specify/integration.json': '{ not json' }), 'copilot')).toBeUndefined();
        expect(projectCommandFormat(project(copilot125), 'claude')).toBeUndefined();
        expect(projectCommandFormat(undefined, 'copilot')).toBeUndefined();
    });
});

describe('formatCommandForProvider in auto mode', () => {
    const setting = (value: string) => (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: (key: string, fallback: unknown) => (key === 'commandFormat' ? value : fallback),
    });

    afterEach(() => (vscode.workspace.getConfiguration as jest.Mock).mockReset());

    it('gives a v1.2.5 Copilot project the dash command it has', () => {
        root = project(copilot125);
        setting('auto');
        expect(formatCommandForProvider('speckit.plan', 'copilot')).toBe('speckit-plan');
    });

    it('keeps the provider table for a project spec-kit did not record', () => {
        root = project({});
        setting('auto');
        expect(formatCommandForProvider('speckit.plan', 'copilot')).toBe('speckit.plan');
    });

    it('sends dots to a dash provider whose project recorded dots', () => {
        root = project({ '.specify/integration.json': JSON.stringify({ integration_settings: { claude: { invoke_separator: '.' } } }) });
        setting('auto');
        expect(formatCommandForProvider('speckit.plan', 'claude')).toBe('speckit.plan');
    });

    it('lets an explicit setting win over the record', () => {
        root = project(copilot125);
        setting('dot');
        expect(formatCommandForProvider('speckit.plan', 'copilot')).toBe('speckit.plan');
    });
});
