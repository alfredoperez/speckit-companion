import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProcessCreateProvider } from '../processCreateProvider';
import { PROCESS_TEXT_LIMIT } from '../../../protocol/processCreate';

const executeInTerminal = jest.fn();
const executeSlashCommand = jest.fn();

jest.mock('../../../extension', () => ({
    getAIProvider: () => ({ executeInTerminal, executeSlashCommand }),
}));

jest.mock('../../../ai-providers/aiProvider', () => ({
    formatCommandForProvider: (command: string) => command.replace(/\./g, '-'),
    getConfiguredProviderType: () => 'claude',
    getProviderDisplayName: () => 'Claude Code',
}));

interface Panel {
    reveal: jest.Mock;
    dispose: jest.Mock;
    __posted: Array<{ type: string; message?: string }>;
    __receive(message: unknown): Promise<void>;
    __fireDispose(): void;
    __lastPosted(type: string): { message: string };
}

let root: string;
let provider: ProcessCreateProvider;

function open(kind: 'bug' | 'idea'): Panel {
    provider.show(kind);
    const results = (vscode.window.createWebviewPanel as jest.Mock).mock.results;
    return results[results.length - 1].value;
}

function types(panel: Panel): string[] {
    return panel.__posted.map(message => message.type);
}

const STAGING = '.speckit-companion/process-create';

function storedFile(name: string): string {
    return path.join(root, '.speckit-companion', 'process-create', name);
}

const SAVE = { type: 'submit', text: 'Save does nothing', extra: '', slug: 'save' };

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    executeInTerminal.mockResolvedValue(undefined);
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'process-create-root-'));
    (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [{ uri: { fsPath: root }, name: 'ws' }];
    provider = new ProcessCreateProvider({
        subscriptions: [],
        extensionUri: vscode.Uri.file('/ext'),
    } as unknown as vscode.ExtensionContext);
});

afterEach(() => {
    jest.useRealTimers();
    (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = undefined;
    fs.rmSync(root, { recursive: true, force: true });
});

describe('opening the create screen', () => {
    it('titles each screen for its kind', () => {
        open('bug');
        open('idea');
        const titles = (vscode.window.createWebviewPanel as jest.Mock).mock.calls.map(call => call[1]);
        expect(titles).toEqual(['New Bug', 'New Idea']);
    });

    it('keeps the bug and the idea screen as separate panels', () => {
        const bug = open('bug');
        const idea = open('idea');
        expect(idea).not.toBe(bug);
        expect(bug.reveal).not.toHaveBeenCalled();

        provider.show('bug');
        expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
        expect(bug.reveal).toHaveBeenCalledTimes(1);
        expect(idea.reveal).not.toHaveBeenCalled();
    });

    it('opens a fresh screen after the last one was closed', () => {
        open('bug').__fireDispose();
        provider.show('bug');
        expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2);
    });

    it('answers ready with the kind, the assistant name and the slugs already taken', async () => {
        const taken = path.join(root, '.specify', 'bugs', 'login-loop');
        fs.mkdirSync(taken, { recursive: true });
        fs.writeFileSync(path.join(taken, 'assessment.md'), '# Login loop\n');

        const panel = open('bug');
        await panel.__receive({ type: 'ready' });

        expect(panel.__lastPosted('init')).toEqual({
            type: 'init',
            kind: 'bug',
            assistantName: 'Claude Code',
            existingSlugs: ['login-loop'],
        });
    });

    it('asks before closing when something was typed, and stays open unless Discard is chosen', async () => {
        const panel = open('bug');
        (vscode.window.showWarningMessage as jest.Mock).mockResolvedValueOnce(undefined);
        await panel.__receive({ type: 'cancel', typed: true });
        expect(panel.dispose).not.toHaveBeenCalled();

        (vscode.window.showWarningMessage as jest.Mock).mockResolvedValueOnce('Discard');
        await panel.__receive({ type: 'cancel', typed: true });
        expect(panel.dispose).toHaveBeenCalled();
    });

    it('closes on cancel and sends nothing', async () => {
        const panel = open('idea');
        await panel.__receive({ type: 'cancel' });
        expect(panel.dispose).toHaveBeenCalled();
        expect(executeInTerminal).not.toHaveBeenCalled();
    });
});

describe('sending a bug', () => {
    const hostile = 'It says "boom" and `rm -rf ~` then $(whoami)\nsecond line with $HOME';

    it('writes the typed text to a file inside the project and sends only the command, the slug and its relative path', async () => {
        const panel = open('bug');
        await panel.__receive({ type: 'submit', text: hostile, extra: 'https://example.test/issue/1', slug: 'Boom On Save' });

        const file = storedFile('bug-boom-on-save.md');
        const written = fs.readFileSync(file, 'utf8');
        expect(written).toContain(hostile);
        expect(written).toContain('## Link or pasted error');
        expect(written).toContain('https://example.test/issue/1');

        expect(executeInTerminal).toHaveBeenCalledTimes(1);
        const [prompt, title] = executeInTerminal.mock.calls[0];
        expect(prompt).toBe(
            `/speckit-bug-assess slug=boom-on-save Read the bug report in the file at ${STAGING}/bug-boom-on-save.md and treat that file as the text to assess.`,
        );
        expect(prompt).not.toContain(root);
        expect(path.relative(root, file).startsWith('..')).toBe(false);
        expect(title).toBe('SpecKit - New Bug');
        for (const fragment of ['boom"', '`', '$(', '$HOME', '\n', 'example.test']) {
            expect(prompt).not.toContain(fragment);
        }
        expect(executeSlashCommand).not.toHaveBeenCalled();
    });

    it('leaves the second heading out when the optional field is empty', async () => {
        const panel = open('bug');
        await panel.__receive({ type: 'submit', text: 'Save does nothing', extra: '  ', slug: 'save' });
        expect(fs.readFileSync(storedFile('bug-save.md'), 'utf8')).toBe('Save does nothing\n');
    });

    it('reports started then complete, and closes after a short delay', async () => {
        const panel = open('bug');
        await panel.__receive({ type: 'submit', text: 'Save does nothing', extra: '', slug: 'save' });

        expect(types(panel)).toEqual(['submissionStarted', 'submissionComplete']);
        expect(panel.dispose).not.toHaveBeenCalled();
        jest.advanceTimersByTime(500);
        expect(panel.dispose).toHaveBeenCalledTimes(1);
    });

    it('normalises a slug that tries to leave the folder', async () => {
        const panel = open('bug');
        await panel.__receive({ type: 'submit', text: 'Save does nothing', extra: '', slug: '../../x' });

        expect(fs.readdirSync(path.join(root, '.speckit-companion', 'process-create'))).toEqual(['bug-x.md']);
        const [prompt] = executeInTerminal.mock.calls[0];
        expect(prompt).toContain(' slug=x ');
        expect(prompt).not.toContain('..');
    });

    it.each([
        ['an empty symptom', { text: '   \n', slug: 'save' }],
        ['a symptom over the limit', { text: 'a'.repeat(PROCESS_TEXT_LIMIT + 1), slug: 'save' }],
        ['an empty slug', { text: 'Save does nothing', slug: '' }],
        ['a slug that normalises to nothing', { text: 'Save does nothing', slug: '/' }],
    ])('refuses %s and sends nothing', async (_name, fields) => {
        const panel = open('bug');
        await panel.__receive({ type: 'submit', extra: '', ...fields });

        expect(types(panel)).toEqual(['error']);
        expect(executeInTerminal).not.toHaveBeenCalled();
        expect(fs.existsSync(path.join(root, '.speckit-companion'))).toBe(false);
        expect(panel.dispose).not.toHaveBeenCalled();
    });

    it('refuses a slug whose folder already exists, however it was typed', async () => {
        fs.mkdirSync(path.join(root, '.specify', 'bugs', 'login-loop'), { recursive: true });
        const panel = open('bug');
        await panel.__receive({ type: 'submit', text: 'Login loops forever', extra: '', slug: 'Login Loop' });

        expect(panel.__lastPosted('error').message).toBe('A bug named login-loop already exists.');
        expect(types(panel)).toEqual(['error']);
        expect(executeInTerminal).not.toHaveBeenCalled();
    });

    it('says what went wrong and stays open when the dispatch fails', async () => {
        executeInTerminal.mockRejectedValue(new Error('no terminal'));
        const panel = open('bug');
        await panel.__receive({ type: 'submit', text: 'Save does nothing', extra: '', slug: 'save' });

        expect(types(panel)).toEqual(['submissionStarted', 'error']);
        expect(panel.__lastPosted('error').message).toContain('no terminal');
        jest.advanceTimersByTime(5000);
        expect(panel.dispose).not.toHaveBeenCalled();
    });

    it('keeps the staging folder out of git, and leaves an ignore file that is already there alone', async () => {
        const ignore = path.join(root, '.speckit-companion', '.gitignore');
        const panel = open('bug');
        await panel.__receive(SAVE);
        expect(fs.readFileSync(ignore, 'utf8')).toBe('*\n');

        panel.__fireDispose();
        fs.writeFileSync(ignore, '*\n!keep\n');
        await open('bug').__receive({ ...SAVE, slug: 'save-again' });
        expect(fs.readFileSync(ignore, 'utf8')).toBe('*\n!keep\n');
    });

    it('sends once when submit arrives twice in a row', async () => {
        const panel = open('bug');
        await Promise.all([panel.__receive(SAVE), panel.__receive(SAVE)]);
        await panel.__receive(SAVE);

        expect(executeInTerminal).toHaveBeenCalledTimes(1);
        expect(types(panel)).toEqual(['submissionStarted', 'submissionComplete']);
    });

    it('takes a second submit after the first one failed', async () => {
        executeInTerminal.mockRejectedValueOnce(new Error('no terminal'));
        const panel = open('bug');
        await panel.__receive(SAVE);
        await panel.__receive(SAVE);

        expect(executeInTerminal).toHaveBeenCalledTimes(2);
    });

    it('posts nothing and does not throw when the screen closes before the dispatch settles', async () => {
        let settle: () => void = () => undefined;
        const dispatched = new Promise<void>(called => {
            executeInTerminal.mockImplementation(() => {
                called();
                return new Promise<void>(resolve => { settle = resolve; });
            });
        });
        const panel = open('bug');
        const receiving = panel.__receive(SAVE);
        await dispatched;

        panel.__fireDispose();
        settle();
        await expect(receiving).resolves.toBeUndefined();
        jest.advanceTimersByTime(5000);

        expect(types(panel)).toEqual(['submissionStarted']);
        expect(panel.dispose).not.toHaveBeenCalled();
    });

    it('refuses to send when no project folder is open', async () => {
        (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = undefined;
        const panel = open('bug');
        await panel.__receive({ type: 'submit', text: 'Save does nothing', extra: '', slug: 'save' });

        expect(types(panel)).toEqual(['error']);
        expect(executeInTerminal).not.toHaveBeenCalled();
    });
});

describe('sending an idea', () => {
    it('sends the intake command with the slug and the file that holds the idea', async () => {
        const panel = open('idea');
        await panel.__receive({ type: 'submit', text: 'Review specs in the browser', extra: 'Product managers', slug: 'browser-review' });

        const file = storedFile('idea-browser-review.md');
        const written = fs.readFileSync(file, 'utf8');
        expect(written).toContain('Review specs in the browser');
        expect(written).toContain('## Who it is for');
        expect(written).toContain('Product managers');

        const [prompt, title] = executeInTerminal.mock.calls[0];
        expect(prompt).toBe(
            `/speckit-assess-intake slug=browser-review Read the idea in the file at ${STAGING}/idea-browser-review.md and treat that file as the text to assess.`,
        );
        expect(prompt).not.toContain('Review specs');
        expect(prompt).not.toContain('Product managers');
        expect(title).toBe('SpecKit - New Idea');
    });

    it('checks the slug against ideas, not bugs', async () => {
        fs.mkdirSync(path.join(root, '.specify', 'bugs', 'shared-name'), { recursive: true });
        const panel = open('idea');
        await panel.__receive({ type: 'submit', text: 'Review specs in the browser', extra: '', slug: 'shared-name' });
        expect(executeInTerminal).toHaveBeenCalledTimes(1);
        panel.__fireDispose();

        fs.mkdirSync(path.join(root, '.specify', 'assessments', 'taken'), { recursive: true });
        const second = open('idea');
        await second.__receive({ type: 'submit', text: 'Review specs in the browser', extra: '', slug: 'taken' });
        expect(executeInTerminal).toHaveBeenCalledTimes(1);
        expect(second.__lastPosted('error').message).toBe('An idea named taken already exists.');
    });
});
