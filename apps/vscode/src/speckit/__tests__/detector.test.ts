import * as vscode from 'vscode';
import { promisify } from 'util';
import { SpecKitDetector } from '../detector';
import { _resetSpecifyVersionForTests } from '../specKitUpgrade';

// Mock child_process and fs since detector uses them
jest.mock('child_process', () => {
    const exec: any = jest.fn();
    exec[require('util').promisify.custom] = jest.fn();
    return { exec };
});

jest.mock('fs', () => {
    const existsSync = jest.fn().mockReturnValue(false);
    return {
        existsSync,
        statSync: jest.fn((target: string) => {
            if (!existsSync(target)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
            return {};
        }),
        readFileSync: jest.fn(),
    };
});

const mockWindow = vscode.window as jest.Mocked<typeof vscode.window>;
const mockExecAsync = (require('child_process').exec as any)[promisify.custom] as jest.Mock;

const INTEGRATION_HELP = '--here  --force\n--integration  <str>  AI coding agent integration';
const LEGACY_HELP = '--here  --force\n--ai  <str>  AI assistant to use';

beforeEach(() => {
    jest.clearAllMocks();
    mockExecAsync.mockResolvedValue({ stdout: INTEGRATION_HELP, stderr: '' });
    // Reset singleton for isolation
    (SpecKitDetector as any).instance = undefined;
    _resetSpecifyVersionForTests();
});

describe('SpecKitDetector', () => {
    describe('createSpec', () => {
        it('shows input box directly without checking initialization state', async () => {
            const detector = SpecKitDetector.getInstance();

            // Ensure _isInitialized is false to prove the guard is gone
            (detector as any)._isInitialized = false;

            mockWindow.showInputBox.mockResolvedValue('Add OAuth support');

            await detector.createSpec();

            expect(mockWindow.showInputBox).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Create New Spec',
                    prompt: 'What feature do you want to build?',
                })
            );
        });

        it('shows input box when workspace is initialized too', async () => {
            const detector = SpecKitDetector.getInstance();
            (detector as any)._isInitialized = true;

            mockWindow.showInputBox.mockResolvedValue('some feature');

            await detector.createSpec();

            expect(mockWindow.showInputBox).toHaveBeenCalled();
        });

        it('returns early when user cancels the input box', async () => {
            const detector = SpecKitDetector.getInstance();
            mockWindow.showInputBox.mockResolvedValue(undefined);

            await detector.createSpec();

            expect(mockWindow.showInputBox).toHaveBeenCalled();
        });

        it('does not show error message or init prompt regardless of initialization state', async () => {
            const detector = SpecKitDetector.getInstance();
            (detector as any)._isInitialized = false;

            mockWindow.showInputBox.mockResolvedValue('Build a dashboard');

            await detector.createSpec();

            expect(mockWindow.showErrorMessage).not.toHaveBeenCalled();
            expect(mockWindow.showWarningMessage).not.toHaveBeenCalled();
        });
    });

    describe('singleton', () => {
        it('returns the same instance', () => {
            const a = SpecKitDetector.getInstance();
            const b = SpecKitDetector.getInstance();
            expect(a).toBe(b);
        });
    });

    describe('upgrade dispatch (agent resolution)', () => {
        const getConfig = vscode.workspace.getConfiguration as jest.Mock;

        function mockProvider(value: string | undefined): void {
            getConfig.mockReturnValue({ get: jest.fn().mockReturnValue(value) });
        }

        function lastSentText(): string {
            const results = mockWindow.createTerminal.mock.results;
            const commands: string[] = results[results.length - 1].value.__commands();
            return commands[commands.length - 1];
        }

        beforeEach(() => {
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/tmp/ws' } }];
        });

        afterEach(() => {
            (vscode.workspace as any).workspaceFolders = undefined;
        });

        describe('initializeWorkspace', () => {
            it('initializes for the configured agent with --integration', async () => {
                mockProvider('codex');
                await SpecKitDetector.getInstance().initializeWorkspace();
                expect(lastSentText()).toBe('specify init . --integration codex');
            });

            it('falls back to --ai for a CLI that only lists --ai', async () => {
                mockProvider('codex');
                mockExecAsync.mockResolvedValue({ stdout: LEGACY_HELP, stderr: '' });
                await SpecKitDetector.getInstance().initializeWorkspace();
                expect(lastSentText()).toBe('specify init . --ai codex');
            });

            it('uses --integration when the CLI help cannot be read', async () => {
                mockProvider('claude');
                mockExecAsync.mockRejectedValue(new Error('spawn failed'));
                await SpecKitDetector.getInstance().initializeWorkspace();
                expect(lastSentText()).toBe('specify init . --integration claude');
            });

            it('prefers --integration on a CLI that lists both flags', async () => {
                mockProvider('codex');
                mockExecAsync.mockResolvedValue({ stdout: `${INTEGRATION_HELP}\n${LEGACY_HELP}`, stderr: '' });
                await SpecKitDetector.getInstance().initializeWorkspace();
                expect(lastSentText()).toBe('specify init . --integration codex');
            });

            it('names the same agent Upgrade Project does', async () => {
                mockProvider('gemini');
                await SpecKitDetector.getInstance().initializeWorkspace();
                const initAgent = lastSentText().match(/--integration (\S+)/)?.[1];
                await SpecKitDetector.getInstance().upgradeProject();
                expect(lastSentText().match(/--integration (\S+)/)?.[1]).toBe(initAgent);
            });
        });

        describe('IDE Chat on Windsurf', () => {
            const env = vscode.env as { uriScheme?: string; appName?: string };
            let saved: { uriScheme?: string; appName?: string };

            beforeEach(() => {
                saved = { uriScheme: env.uriScheme, appName: env.appName };
                env.uriScheme = 'windsurf';
                env.appName = 'Windsurf';
                mockProvider('ide-chat');
            });

            afterEach(() => {
                env.uriScheme = saved.uriScheme;
                env.appName = saved.appName;
            });

            it('passes --ai windsurf on a CLI that still lists --ai', async () => {
                mockExecAsync.mockResolvedValue({ stdout: LEGACY_HELP, stderr: '' });
                const detector = SpecKitDetector.getInstance();
                await detector.initializeWorkspace();
                expect(lastSentText()).toBe('specify init . --ai windsurf');
                await detector.upgradeProject();
                expect(lastSentText()).toBe('specify init --here --force --ai windsurf');
            });

            it('runs init with no agent flag on a CLI that lists both flags', async () => {
                mockExecAsync.mockResolvedValue({ stdout: `${INTEGRATION_HELP}\n${LEGACY_HELP}`, stderr: '' });
                await SpecKitDetector.getInstance().initializeWorkspace();
                expect(lastSentText()).toBe('specify init .');
            });

            it('runs init with no agent flag on a CLI that only takes --integration', async () => {
                const detector = SpecKitDetector.getInstance();
                await detector.initializeWorkspace();
                expect(lastSentText()).toBe('specify init .');
                await detector.upgradeProject();
                expect(lastSentText()).toBe('specify init --here --force');
            });

            it('runs Upgrade All with no agent flag after reinstalling the CLI', async () => {
                await SpecKitDetector.getInstance().upgradeAll();
                const sent = lastSentText();
                expect(sent.endsWith('&& specify integration upgrade')).toBe(true);
                expect(sent).not.toContain('windsurf');
            });
        });

        describe('upgradeProject', () => {
            it('dispatches the configured non-Claude agent, never claude-code (US1)', async () => {
                mockProvider('codex');
                await SpecKitDetector.getInstance().upgradeProject();
                const sent = lastSentText();
                expect(sent).toContain('--integration codex');
                expect(sent).not.toContain('claude-code');
            });

            it('dispatches --ai claude for the default provider (US2)', async () => {
                mockProvider('claude');
                await SpecKitDetector.getInstance().upgradeProject();
                const sent = lastSentText();
                expect(sent).toContain('--integration claude');
                expect(sent).not.toContain('claude-code');
            });

            it('falls back to --ai for a CLI that only lists --ai', async () => {
                mockProvider('codex');
                mockExecAsync.mockResolvedValue({ stdout: LEGACY_HELP, stderr: '' });
                await SpecKitDetector.getInstance().upgradeProject();
                const sent = lastSentText();
                expect(sent).toContain('--ai codex');
                expect(sent).not.toContain('--integration');
            });

            it('uses --integration when the CLI help cannot be read', async () => {
                mockProvider('claude');
                mockExecAsync.mockRejectedValue(new Error('spawn failed'));
                await SpecKitDetector.getInstance().upgradeProject();
                expect(lastSentText()).toContain('--integration claude');
            });
        });

        describe('the documented upgrade', () => {
            const disk = jest.requireMock('fs') as { existsSync: jest.Mock; readFileSync: jest.Mock };
            const VERSION_JSON = JSON.stringify({ cli_version: '1.2.7', features: { integration_upgrade_command: true } });

            beforeEach(() => {
                mockExecAsync.mockImplementation(async (cmd: string) => ({
                    stdout: cmd.startsWith('specify version') ? VERSION_JSON : INTEGRATION_HELP,
                    stderr: '',
                }));
                disk.readFileSync.mockReturnValue(JSON.stringify({ installed_integrations: ['claude', 'copilot'] }));
            });

            afterEach(() => {
                disk.readFileSync.mockReset();
                disk.existsSync.mockReset().mockReturnValue(false);
            });

            it('upgrades each recorded agent instead of re-running init', async () => {
                mockProvider('claude');
                await SpecKitDetector.getInstance().upgradeProject();
                expect(lastSentText()).toBe('specify integration upgrade claude && specify integration upgrade copilot');
            });

            it('re-adds Companion after the agents when it is installed', async () => {
                disk.existsSync.mockImplementation((target: string) => target.endsWith('.specify/extensions/companion'));
                await SpecKitDetector.getInstance().upgradeProject();
                expect(lastSentText()).toMatch(/specify integration upgrade copilot && specify extension add companion.* --force$/);
            });

            it('runs Upgrade All as self upgrade, the uv fallback, then each agent', async () => {
                await SpecKitDetector.getInstance().upgradeAll();
                expect(lastSentText()).toBe(
                    'specify self upgrade || uv tool install specify-cli --force --from git+https://github.com/github/spec-kit.git' +
                    ' && specify integration upgrade claude && specify integration upgrade copilot'
                );
            });

            it('never passes an agent key that is not a plain name to the shell', async () => {
                disk.readFileSync.mockReturnValue(JSON.stringify({ installed_integrations: ['claude', 'x; rm -rf ~'] }));
                await SpecKitDetector.getInstance().upgradeProject();
                expect(lastSentText()).toBe('specify integration upgrade claude');
            });
        });

        it('starts in the folder that holds the Spec Kit files, not the first one', async () => {
            (vscode.workspace as any).workspaceFolders = [
                { uri: { fsPath: '/tmp/source' }, name: 'source' },
                { uri: { fsPath: '/tmp/kit' }, name: 'kit' },
            ];
            const disk = jest.requireMock('fs') as { existsSync: jest.Mock };
            disk.existsSync.mockImplementation((target: string) => target.startsWith('/tmp/kit'));
            mockProvider('claude');

            expect(await SpecKitDetector.getInstance().checkWorkspaceInitialized()).toBe(true);
            await SpecKitDetector.getInstance().upgradeProject();

            const calls = mockWindow.createTerminal.mock.calls as unknown as [{ cwd?: { fsPath: string } }][];
            expect(calls[calls.length - 1][0].cwd?.fsPath).toBe('/tmp/kit');
            disk.existsSync.mockReset().mockReturnValue(false);
        });

        it('never pastes the workspace path into the command text', async () => {
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/tmp/a"$(touch x)' } }];
            mockProvider('claude');
            const detector = SpecKitDetector.getInstance();
            for (const run of [() => detector.initializeWorkspace(), () => detector.upgradeProject(), () => detector.upgradeAll()]) {
                await run();
                expect(lastSentText()).not.toContain('$(touch x)');
                const calls = mockWindow.createTerminal.mock.calls as unknown as [{ cwd?: unknown }][];
                const opts = calls[calls.length - 1][0];
                expect((opts.cwd as { fsPath: string }).fsPath).toBe('/tmp/a"$(touch x)');
            }
        });
    });
});

/**
 * `/speckit.constitution` writes a Sync Impact Report at the top of the file, an
 * HTML comment listing every placeholder it replaced. A finished constitution
 * therefore still contains the words `[PRINCIPLE_1_NAME]`, and the sidebar kept
 * offering Configure Constitution to projects that had already configured one.
 */
describe('constitution placeholder detection', () => {
    const fs = require('fs');

    const FINISHED = `<!--
Sync Impact Report
Modified principles: all five placeholders replaced with concrete project principles
  [PRINCIPLE_1_NAME] → I. Downward-Only Layer Dependencies
  [PRINCIPLE_2_NAME] → II. Slice File Naming
-->

# Conduit Constitution

## I. Downward-Only Layer Dependencies
An entity imports only from shared.
`;

    const UNFILLED = `# [PROJECT_NAME] Constitution

## [PRINCIPLE_1_NAME]
Describe it here.
`;

    beforeEach(() => {
        (vscode.workspace as { workspaceFolders?: unknown }).workspaceFolders = [
            { uri: { fsPath: '/repo' }, name: 'repo', index: 0 },
        ];
        (fs.existsSync as jest.Mock).mockReturnValue(true);
    });

    it('does not read the report of a replacement as the placeholder itself', async () => {
        (fs.readFileSync as jest.Mock).mockReturnValue(FINISHED);
        (SpecKitDetector as unknown as { instance?: unknown }).instance = undefined;
        expect(await SpecKitDetector.getInstance().checkConstitutionSetup()).toBe(false);
    });

    it('still catches a constitution nobody has filled in', async () => {
        (fs.readFileSync as jest.Mock).mockReturnValue(UNFILLED);
        (SpecKitDetector as unknown as { instance?: unknown }).instance = undefined;
        expect(await SpecKitDetector.getInstance().checkConstitutionSetup()).toBe(true);
    });
});
