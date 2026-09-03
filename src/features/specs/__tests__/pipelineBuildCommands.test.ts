/**
 * Running a build from the editor, and who gets told what.
 *
 * The Output channel used to take the screen on every run, so a build that
 * worked cost you the editor you were reading. It now holds the whole log and
 * only shows itself when there is a reason to look at it — the behaviour a
 * later edit is most likely to undo by accident, so it is pinned here.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { registerPipelineBuildCommands } from '../pipelineBuildCommands';

jest.mock('child_process', () => ({ execFile: jest.fn() }));

const { execFile } = require('child_process') as { execFile: jest.Mock };

let workspace: string;
let channel: { appendLine: jest.Mock; show: jest.Mock };

/** What `python3 build-pipeline.py` said, and whether it exited cleanly. */
function buildSays(output: string, ok = true): void {
    execFile.mockImplementation((_cmd, _args, _opts, done) =>
        done(ok ? null : new Error('exit 1'), output, ''));
}

/** The handler the palette would run. */
function command(name: string): (options?: { quiet?: boolean }) => Promise<unknown> {
    const registered = (vscode.commands.registerCommand as jest.Mock).mock.calls
        .find(([id]) => id === name);
    return registered[1];
}

beforeEach(() => {
    jest.clearAllMocks();
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'build-cmd-'));
    const script = path.join(
        workspace, '.specify', 'extensions', 'companion', 'scripts', 'build-pipeline.py');
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.writeFileSync(script, '', 'utf8');

    (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [
        { uri: vscode.Uri.file(workspace) },
    ];
    channel = { appendLine: jest.fn(), show: jest.fn() };
    registerPipelineBuildCommands(
        { extensionPath: workspace, subscriptions: [] } as unknown as vscode.ExtensionContext,
        channel as unknown as vscode.OutputChannel,
    );
    buildSays('[build] built 5 commands from .specify/companion.yml');
});

afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
});

describe('the output channel', () => {
    it('stays where it is when the build worked', async () => {
        await command('speckit.companion.buildPipeline')();
        expect(channel.show).not.toHaveBeenCalled();
    });

    it('stays where it is after a preview too', async () => {
        buildSays('[build] would build 5 commands from the shipped defaults');
        await command('speckit.companion.previewPipelineBuild')();
        expect(channel.show).not.toHaveBeenCalled();
    });

    it('shows itself when the build failed, which is when there is a reason to look', async () => {
        buildSays('[build] cannot build — nothing was written', false);
        await command('speckit.companion.buildPipeline')();
        expect(channel.show).toHaveBeenCalledWith(true);
    });

    it('keeps the whole log either way', async () => {
        await command('speckit.companion.buildPipeline')();
        expect(channel.appendLine)
            .toHaveBeenCalledWith('[build] built 5 commands from .specify/companion.yml');
    });
});

describe('who says a build worked', () => {
    it('tells the palette, which has no panel to report into', async () => {
        await command('speckit.companion.buildPipeline')();
        expect(vscode.window.showInformationMessage)
            .toHaveBeenCalledWith('Pipeline built from companion.yml.');
    });

    it('leaves it to the panel, which draws the result itself', async () => {
        await command('speckit.companion.buildPipeline')({ quiet: true });
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    it('reports the failure however it was asked', async () => {
        buildSays('[build] cannot build', false);
        await command('speckit.companion.buildPipeline')({ quiet: true });
        expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
});

describe('what it hands back', () => {
    it('answers with the report the panel draws', async () => {
        const report = await command('speckit.companion.buildPipeline')() as {
            ok: boolean; commands: number; dryRun: boolean;
        };
        expect(report).toMatchObject({ ok: true, commands: 5, dryRun: false });
    });

    it('answers with nothing when there is no workspace to build', async () => {
        (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = undefined;
        await expect(command('speckit.companion.buildPipeline')()).resolves.toBeNull();
    });
});
