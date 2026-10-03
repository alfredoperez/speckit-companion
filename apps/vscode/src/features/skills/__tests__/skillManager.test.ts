import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SkillManager } from '../skillManager';

jest.mock('../../../ai-providers/aiProvider', () => ({
    getProviderPaths: jest.fn(),
}));

jest.mock('os', () => ({
    ...jest.requireActual('os'),
    homedir: jest.fn(),
}));

import { getProviderPaths } from '../../../ai-providers/aiProvider';

const mockGetProviderPaths = getProviderPaths as jest.MockedFunction<typeof getProviderPaths>;
const mockHomedir = os.homedir as jest.MockedFunction<typeof os.homedir>;

function setProviderSkillsDir(skillsDir: string, userSkillsDir: string = skillsDir): void {
    mockGetProviderPaths.mockReturnValue({ skillsDir, userSkillsDir } as ReturnType<typeof getProviderPaths>);
}

function writeSkill(root: string, skillsDir: string, name: string): void {
    const dir = path.join(root, skillsDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'SKILL.md'),
        `---\nname: ${name}\ndescription: ${name} description\n---\n\nBody.\n`,
        'utf8',
    );
}

function createManager(): SkillManager {
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    const outputChannel = { appendLine: jest.fn() } as unknown as vscode.OutputChannel;
    return new SkillManager(context, outputChannel);
}

describe('SkillManager', () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-manager-'));
        (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [
            { uri: vscode.Uri.file(workspaceRoot) },
        ];
        (vscode.workspace.fs.readDirectory as jest.Mock).mockImplementation(async (uri: vscode.Uri) =>
            fs
                .readdirSync(uri.fsPath, { withFileTypes: true })
                .map(entry => [
                    entry.name,
                    entry.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
                ]),
        );
    });

    afterEach(() => {
        fs.rmSync(workspaceRoot, { recursive: true, force: true });
        (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = undefined;
        jest.clearAllMocks();
    });

    describe('listing project skills', () => {
        it('reads the directory the active provider registers, not a hardcoded one', async () => {
            setProviderSkillsDir('.agents/skills');
            writeSkill(workspaceRoot, '.agents/skills', 'speckit-companion-specify');
            writeSkill(workspaceRoot, '.claude/skills', 'some-claude-skill');

            const skills = await createManager().getSkillList('project');

            expect(skills.map(s => s.name)).toEqual(['speckit-companion-specify']);
        });

        it('follows the provider when its skills directory differs', async () => {
            setProviderSkillsDir('.claude/skills');
            writeSkill(workspaceRoot, '.agents/skills', 'speckit-companion-specify');
            writeSkill(workspaceRoot, '.claude/skills', 'some-claude-skill');

            const skills = await createManager().getSkillList('project');

            expect(skills.map(s => s.name)).toEqual(['some-claude-skill']);
        });

        it('returns nothing for a provider with no skills support', async () => {
            setProviderSkillsDir('');
            writeSkill(workspaceRoot, '.claude/skills', 'some-claude-skill');

            expect(await createManager().getSkillList('project')).toEqual([]);
            expect(await createManager().getSkillList('user')).toEqual([]);
        });
    });

    describe('listing user skills', () => {
        it('uses the provider-specific user skills directory', async () => {
            const userRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-manager-user-'));
            mockHomedir.mockReturnValue(userRoot);
            try {
                setProviderSkillsDir('.omp/skills', '.omp/agent/skills');
                writeSkill(userRoot, '.omp/agent/skills', 'user-omp-skill');
                writeSkill(userRoot, '.omp/skills', 'wrong-omp-skill');

                await expect(createManager().getSkillList('user')).resolves.toEqual([
                    expect.objectContaining({ name: 'user-omp-skill', type: 'user' }),
                ]);
            } finally {
                mockHomedir.mockReset();
                fs.rmSync(userRoot, { recursive: true, force: true });
            }
        });
    });
});
