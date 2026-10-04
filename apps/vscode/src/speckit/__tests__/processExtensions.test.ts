import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import {
    PROCESS_EXTENSION_IDS,
    coerceProcessExtensionId,
    processExtensionState,
    runSpecifyExtensionAdd,
    _resetForTests as resetInstalls,
} from '../processExtensions';
import { CLI_PREREQ_COMMAND } from '../specKitExtensionInstall';

const fs: typeof import('fs') = jest.requireActual('fs');

describe('processExtensions', () => {
    describe('coerceProcessExtensionId', () => {
        it('accepts the two process extensions', () => {
            expect(PROCESS_EXTENSION_IDS).toEqual(['bug', 'assess']);
            expect(coerceProcessExtensionId('bug')).toBe('bug');
            expect(coerceProcessExtensionId('assess')).toBe('assess');
        });

        it('rejects any other extension name', () => {
            expect(coerceProcessExtensionId('companion')).toBeUndefined();
            expect(coerceProcessExtensionId('bug; rm -rf ~')).toBeUndefined();
            expect(coerceProcessExtensionId('BUG')).toBeUndefined();
            expect(coerceProcessExtensionId('')).toBeUndefined();
        });

        it('rejects prototype keys', () => {
            expect(coerceProcessExtensionId('constructor')).toBeUndefined();
            expect(coerceProcessExtensionId('__proto__')).toBeUndefined();
            expect(coerceProcessExtensionId('toString')).toBeUndefined();
        });

        it('rejects values that are not strings', () => {
            expect(coerceProcessExtensionId(undefined)).toBeUndefined();
            expect(coerceProcessExtensionId(null)).toBeUndefined();
            expect(coerceProcessExtensionId(0)).toBeUndefined();
            expect(coerceProcessExtensionId(['bug'])).toBeUndefined();
            expect(coerceProcessExtensionId({ toString: () => 'bug' })).toBeUndefined();
        });
    });

    describe('processExtensionState', () => {
        let root: string;

        beforeEach(() => {
            root = fs.mkdtempSync(path.join(os.tmpdir(), 'process-ext-'));
        });

        afterEach(() => {
            jest.restoreAllMocks();
            fs.rmSync(root, { recursive: true, force: true });
        });

        it('reports present when the extension folder exists', () => {
            fs.mkdirSync(path.join(root, '.specify', 'extensions', 'bug'), { recursive: true });
            expect(processExtensionState(root, 'bug')).toBe('present');
        });

        it('reports absent when the extension folder is missing', () => {
            fs.mkdirSync(path.join(root, '.specify', 'extensions', 'bug'), { recursive: true });
            expect(processExtensionState(root, 'assess')).toBe('absent');
        });

        it('reports absent when the project has no .specify folder', () => {
            expect(processExtensionState(root, 'bug')).toBe('absent');
        });

        it('reports absent when a file sits where a parent folder should be', () => {
            fs.mkdirSync(path.join(root, '.specify'));
            fs.writeFileSync(path.join(root, '.specify', 'extensions'), '');
            expect(processExtensionState(root, 'bug')).toBe('absent');
        });

        it('reports absent when a file sits where the extension folder should be', () => {
            fs.mkdirSync(path.join(root, '.specify', 'extensions'), { recursive: true });
            fs.writeFileSync(path.join(root, '.specify', 'extensions', 'bug'), '');
            expect(processExtensionState(root, 'bug')).toBe('absent');
        });

        it.each(['EACCES', 'EPERM', 'EIO', 'ELOOP'])('reports unknown when the folder cannot be read (%s)', code => {
            jest.spyOn(fs, 'statSync').mockImplementation(() => {
                throw Object.assign(new Error(code), { code });
            });
            expect(processExtensionState(root, 'bug')).toBe('unknown');
        });

        it('reports unknown when the failure carries no error code', () => {
            jest.spyOn(fs, 'statSync').mockImplementation(() => {
                throw new Error('boom');
            });
            expect(processExtensionState(root, 'bug')).toBe('unknown');
        });
    });

    describe('runSpecifyExtensionAdd', () => {
        const createTerminal = vscode.window.createTerminal as jest.Mock;
        const { createMockTerminal } = vscode as unknown as { createMockTerminal: (o?: object) => unknown };
        const defaultCreateTerminal = createTerminal.getMockImplementation();

        beforeEach(() => resetInstalls());

        beforeEach(() => {
            createTerminal.mockClear();
            createTerminal.mockImplementation(() => createMockTerminal({ autoExitCode: 0 }));
        });

        afterEach(() => {
            createTerminal.mockImplementation(defaultCreateTerminal);
        });

        it('does nothing when there is no project folder', async () => {
            expect(await runSpecifyExtensionAdd('bug', undefined)).toBeUndefined();
            expect(await runSpecifyExtensionAdd('bug', '')).toBeUndefined();
            expect(createTerminal).not.toHaveBeenCalled();
        });

        it('opens a visible terminal in the project folder and returns it', async () => {
            const terminal = await runSpecifyExtensionAdd('bug', '/work/project');

            expect(createTerminal).toHaveBeenCalledTimes(1);
            expect(createTerminal).toHaveBeenCalledWith({ name: 'Install Spec Kit bug extension', cwd: '/work/project' });
            expect(terminal).toBe(createTerminal.mock.results[0].value);
            expect(terminal!.show).toHaveBeenCalled();
        });

        it.each(['bug', 'assess'] as const)('prints the CLI prerequisite, then runs the %s install', async id => {
            await runSpecifyExtensionAdd(id, '/work/project');

            const sent = createTerminal.mock.results[0].value.__commands() as string[];
            expect(sent).toEqual([
                `echo "Prerequisite (github-source spec-kit CLI): ${CLI_PREREQ_COMMAND}"`,
                `specify extension add ${id} --force`,
            ]);
        });

        it('keeps a project folder with shell metacharacters out of the command text', async () => {
            const root = '/tmp/a"$(touch x)';

            await runSpecifyExtensionAdd('assess', root);

            expect(createTerminal.mock.calls[0][0].cwd).toBe(root);
            const sent = createTerminal.mock.results[0].value.__commands() as string[];
            expect(sent[sent.length - 1]).toBe('specify extension add assess --force');
            for (const line of sent) {
                expect(line).not.toContain(root);
                expect(line).not.toContain('/tmp/a');
                expect(line).not.toContain('touch x');
                expect(line.startsWith('cd ')).toBe(false);
            }
        });

        it('runs a retry in the terminal still open from the last try, not in a new one', async () => {
            const first = await runSpecifyExtensionAdd('bug', '/ws');
            const created = (vscode.window.createTerminal as jest.Mock).mock.calls.length;

            const second = await runSpecifyExtensionAdd('bug', '/ws');

            expect(second).toBe(first);
            expect((vscode.window.createTerminal as jest.Mock).mock.calls.length).toBe(created);
            const sent: string[] = (first as unknown as { __commands(): string[] }).__commands();
            expect(sent.filter(command => command.startsWith('specify extension add bug'))).toHaveLength(2);
        });
    });
});
