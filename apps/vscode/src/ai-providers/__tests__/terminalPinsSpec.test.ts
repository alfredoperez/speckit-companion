import * as vscode from 'vscode';
import { QwenCliProvider } from '../qwenCliProvider';
import { ClaudeCodeProvider } from '../claudeCodeProvider';
import { specPinEnv } from '../cliTerminalProvider';

jest.mock('../../core/projectRoot', () => ({ getProjectRoot: () => '/repo' }));

jest.mock('../../core/utils/tempFileUtils', () => ({
    createTempFile: jest.fn().mockResolvedValue('/tmp/prompt.md'),
}));

const mock = vscode as unknown as {
    createMockTerminal: (o?: { name?: string; shellIntegration?: boolean }) => any;
};
const createTerminal = vscode.window.createTerminal as jest.Mock;
const defaultCreateTerminal = createTerminal.getMockImplementation();

describe('a terminal opened for a spec', () => {
    beforeEach(() => {
        createTerminal.mockClear();
        createTerminal.mockImplementation(() => mock.createMockTerminal({ shellIntegration: true }));
    });

    afterEach(() => {
        createTerminal.mockImplementation(defaultCreateTerminal);
    });

    const provider = () => new QwenCliProvider({} as vscode.ExtensionContext, { appendLine: jest.fn() } as unknown as vscode.OutputChannel);

    it('pins SPECIFY_FEATURE_DIRECTORY to that spec, so feature.json never decides the target', async () => {
        await provider().executeInTerminal('/speckit-plan', 'SpecKit - Plan', { specDir: '/repo/specs/012-login' });
        expect(createTerminal.mock.calls[0][0].env).toEqual({ SPECIFY_FEATURE_DIRECTORY: 'specs/012-login' });
    });

    it('pins the Claude Code slash path too, as Resume dispatches it', async () => {
        const claude = new ClaudeCodeProvider({ extensionPath: '/ext', globalStorageUri: { fsPath: '/tmp' } } as unknown as vscode.ExtensionContext, { appendLine: jest.fn() } as unknown as vscode.OutputChannel);
        await claude.executeSlashCommand('/speckit.companion.resume specs/012-login', 'SpecKit - Resume', false, { specDir: 'specs/012-login' });
        expect(createTerminal.mock.calls[0][0].env).toEqual({ SPECIFY_FEATURE_DIRECTORY: 'specs/012-login' });
    });

    it('turns an absolute folder under the project into a forward-slash relative one', () => {
        expect(specPinEnv('/repo/specs/012-login')).toEqual({ env: { SPECIFY_FEATURE_DIRECTORY: 'specs/012-login' } });
        expect(specPinEnv(undefined)).toEqual({});
        expect(specPinEnv('/elsewhere/specs/9-x')).toEqual({ env: { SPECIFY_FEATURE_DIRECTORY: '/elsewhere/specs/9-x' } });
        expect(specPinEnv('/repo')).toEqual({});
    });

    it('sets no pin when the dispatch names no spec', async () => {
        await provider().executeInTerminal('/speckit-constitution', 'SpecKit - Constitution');
        expect(createTerminal.mock.calls[0][0].env).toBeUndefined();
    });
});
