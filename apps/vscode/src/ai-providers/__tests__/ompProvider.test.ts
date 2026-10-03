import * as vscode from 'vscode';
import { MARKER_CLOSE, MARKER_OPEN } from '../promptPreamble';
import { OmpProvider } from '../ompProvider';
import { createTempFile } from '../../core/utils/tempFileUtils';

jest.mock('../../core/utils/tempFileUtils', () => ({
    createTempFile: jest.fn(),
}));

type OmpDispatchInternals = OmpProvider & {
    cliBinary: string;
    prepareDispatch(ctx: unknown): Promise<{ commandLine: string; tempFiles: string[] }>;
};

describe('OmpProvider', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string, defaultValue?: unknown) =>
                key === 'permissionMode' ? 'auto-approve' : defaultValue
            ),
        });
    });

    it('dispatches an interactive positional message and isolates the context preamble', async () => {
        (createTempFile as jest.Mock)
            .mockResolvedValueOnce('/tmp/prompt.md')
            .mockResolvedValueOnce('/tmp/system.md');
        const provider = new OmpProvider({} as any, {} as any) as OmpDispatchInternals;

        const plan = await provider.prepareDispatch({
            mode: 'terminal',
            prompt: `${MARKER_OPEN}\nKeep the run state current.\n${MARKER_CLOSE}\n/speckit.specify add OMP support`,
            slashCommand: null,
        });

        expect(provider.cliBinary).toBe('omp');
        expect(createTempFile).toHaveBeenNthCalledWith(1, expect.anything(), '/speckit.specify add OMP support', 'prompt', true);
        expect(createTempFile).toHaveBeenNthCalledWith(2, expect.anything(), `${MARKER_OPEN}\nKeep the run state current.\n${MARKER_CLOSE}`, 'system-prompt', true);
        expect(plan.commandLine).toBe('omp --append-system-prompt "$(cat "/tmp/system.md")" --auto-approve "$(cat "/tmp/prompt.md")"');
        expect(plan.commandLine).not.toContain(' -p ');
        expect(plan.tempFiles).toEqual(['/tmp/prompt.md', '/tmp/system.md']);
    });

    it('uses print mode for headless dispatch', async () => {
        (createTempFile as jest.Mock).mockResolvedValueOnce('/tmp/background-prompt.md');
        const provider = new OmpProvider({} as any, {} as any) as OmpDispatchInternals;

        const plan = await provider.prepareDispatch({
            mode: 'headless',
            prompt: '/speckit.tasks',
            slashCommand: null,
        });

        expect(plan.commandLine).toBe('omp --auto-approve -p "$(cat "/tmp/background-prompt.md")"');
    });
});
