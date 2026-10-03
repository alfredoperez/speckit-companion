import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    getProjectRoot,
    getProjectRootUri,
    hasSpecKitMarker,
    onDidChangeProjectRoot,
    watchProjectRoot,
} from '../projectRoot';

const { __fireWorkspaceFoldersChange, __fireConfigurationChange } = vscode as unknown as {
    __fireWorkspaceFoldersChange: () => void;
    __fireConfigurationChange: (...keys: string[]) => void;
};

let tmp: string;
let setting: unknown;
let specDirectories: unknown;

function folder(name: string, ...make: string[]): { uri: { fsPath: string }; name: string } {
    const root = path.join(tmp, name);
    fs.mkdirSync(root, { recursive: true });
    for (const entry of make) fs.mkdirSync(path.join(root, entry), { recursive: true });
    return { uri: { fsPath: root }, name };
}

function open(...folders: unknown[]): void {
    (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = folders.length ? folders : undefined;
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'project-root-'));
    setting = undefined;
    specDirectories = ['specs'];
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn((key: string) => (key === 'projectFolder' ? setting : specDirectories)),
        inspect: jest.fn(),
    });
});

afterEach(() => {
    open();
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('the project folder with no setting', () => {
    it('is undefined when no folder is open', () => {
        open();
        expect(getProjectRoot()).toBeUndefined();
        expect(getProjectRootUri()).toBeUndefined();
    });

    it('is the only folder, without reading the disk', () => {
        open({ uri: { fsPath: '/nowhere/on/disk' } });
        expect(getProjectRoot()).toBe('/nowhere/on/disk');
    });

    it('is the folder holding Spec Kit files, even when it is not first', () => {
        const source = folder('source');
        const specs = folder('specs-home', '.specify');
        open(source, specs, folder('deps'));
        expect(getProjectRoot()).toBe(specs.uri.fsPath);
        expect(getProjectRootUri()?.fsPath).toBe(specs.uri.fsPath);
    });

    it('is the first qualifying folder when several hold Spec Kit files', () => {
        const a = folder('a', '.specify');
        open(folder('plain'), a, folder('b', '.specify'));
        expect(getProjectRoot()).toBe(a.uri.fsPath);
    });

    it('prefers Spec Kit files over a bare specs directory', () => {
        const kit = folder('kit', '.specify');
        open(folder('bare', 'specs'), kit);
        expect(getProjectRoot()).toBe(kit.uri.fsPath);
    });

    it('falls back to a bare specs directory, then to the first folder', () => {
        const bare = folder('bare', 'specs');
        const first = folder('first');
        open(first, bare);
        expect(getProjectRoot()).toBe(bare.uri.fsPath);
        open(first, folder('second'));
        expect(getProjectRoot()).toBe(first.uri.fsPath);
    });

    it('counts a configured spec directory as a specs folder', () => {
        const changes = folder('changes-repo', 'openspec/changes');
        open(folder('app'), changes);
        specDirectories = ['openspec/changes/*'];
        expect(getProjectRoot()).toBe(changes.uri.fsPath);
    });

    it('hands back the workspace folder\'s own uri', () => {
        const kit = folder('kit', '.specify');
        open(folder('app'), kit);
        expect(getProjectRootUri()).toBe(kit.uri);
    });

    it('answers a burst of calls from one probe, even when the folders array is rebuilt', () => {
        const kit = folder('kit', '.specify');
        const app = folder('app');
        open(app, kit);
        expect(getProjectRoot()).toBe(kit.uri.fsPath);

        fs.mkdirSync(path.join(app.uri.fsPath, '.specify'));
        open({ ...app }, { ...kit });

        expect(getProjectRoot()).toBe(kit.uri.fsPath);
    });

    it('counts the Spec Kit agent files as a marker', () => {
        const agents = folder('agents', '.github/agents');
        fs.writeFileSync(path.join(agents.uri.fsPath, '.github/agents/speckit.plan.agent.md'), '');
        expect(hasSpecKitMarker(agents.uri.fsPath)).toBe(true);
        expect(hasSpecKitMarker(folder('plain').uri.fsPath)).toBe(false);
    });
});

describe('the project folder setting', () => {
    it('wins over detection when it names a workspace folder', () => {
        const b = folder('b', '.specify');
        open(folder('a', '.specify'), b);
        setting = 'b';
        expect(getProjectRoot()).toBe(b.uri.fsPath);
    });

    it('accepts the folder path', () => {
        const b = folder('b');
        open(folder('a', '.specify'), b);
        setting = b.uri.fsPath;
        expect(getProjectRoot()).toBe(b.uri.fsPath);
    });

    it('is honoured for a folder with no Spec Kit files', () => {
        const empty = folder('empty');
        open(folder('a', '.specify'), empty);
        setting = 'empty';
        expect(getProjectRoot()).toBe(empty.uri.fsPath);
    });

    it('falls back to detection when it names no workspace folder', () => {
        const a = folder('a', '.specify');
        open(folder('plain'), a);
        setting = 'gone';
        expect(getProjectRoot()).toBe(a.uri.fsPath);
    });

    it.each([['specs'], 42, null, '   '])('is ignored when its value is %p', value => {
        const a = folder('a', '.specify');
        open(folder('plain'), a);
        setting = value;
        expect(getProjectRoot()).toBe(a.uri.fsPath);
    });
});

describe('watching the project folder', () => {
    const channel = { appendLine: jest.fn() } as unknown as vscode.OutputChannel;
    const lines = (): string => (channel.appendLine as jest.Mock).mock.calls.map(c => c[0]).join('\n');
    let watch: vscode.Disposable;
    let heard: Array<string | undefined>;
    let listening: vscode.Disposable;

    beforeEach(() => {
        (channel.appendLine as jest.Mock).mockClear();
        heard = [];
        listening = onDidChangeProjectRoot(root => heard.push(root));
    });

    afterEach(() => {
        watch?.dispose();
        listening.dispose();
    });

    it('says which folder it picked and that others qualify', () => {
        const a = folder('a', '.specify');
        const b = folder('b', '.specify');
        open(a, b);
        watch = watchProjectRoot(channel);
        expect(lines()).toContain(`Project folder: ${a.uri.fsPath}`);
        expect(lines()).toContain(b.uri.fsPath);
        expect(lines()).toContain('speckit.projectFolder');
    });

    it('stays quiet in a one-folder workspace', () => {
        open(folder('only', '.specify'));
        watch = watchProjectRoot(channel);
        expect(channel.appendLine).not.toHaveBeenCalled();
    });

    it('reports a setting that names no workspace folder', () => {
        open(folder('a', '.specify'), folder('b'));
        setting = 'gone';
        watch = watchProjectRoot(channel);
        expect(lines()).toContain('"gone"');
    });

    it('fires when the setting moves the project', () => {
        const b = folder('b', '.specify');
        open(folder('a', '.specify'), b);
        watch = watchProjectRoot(channel);
        setting = 'b';
        __fireConfigurationChange('speckit.projectFolder');
        expect(heard).toEqual([b.uri.fsPath]);
    });

    it('fires when a workspace folder change moves the project', () => {
        const plain = folder('plain');
        open(plain, folder('other'));
        watch = watchProjectRoot(channel);
        const kit = folder('kit', '.specify');
        open(plain, kit);
        __fireWorkspaceFoldersChange();
        expect(heard).toEqual([kit.uri.fsPath]);
    });

    it('notices Spec Kit files created on disk with no event', async () => {
        const first = folder('first');
        const second = folder('second');
        open(first, second);
        watch = watchProjectRoot(channel);
        fs.mkdirSync(path.join(second.uri.fsPath, '.specify'));
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000);

        expect(getProjectRoot()).toBe(second.uri.fsPath);
        await Promise.resolve();

        expect(heard).toEqual([second.uri.fsPath]);
        jest.restoreAllMocks();
    });

    it('does not fire for an unrelated setting or an unchanged project', () => {
        open(folder('a', '.specify'), folder('b'));
        watch = watchProjectRoot(channel);
        __fireConfigurationChange('speckit.aiProvider');
        __fireWorkspaceFoldersChange();
        expect(heard).toEqual([]);
    });

    it('stops listening once disposed', () => {
        const b = folder('b', '.specify');
        open(folder('a', '.specify'), b);
        watchProjectRoot(channel).dispose();
        setting = 'b';
        __fireConfigurationChange('speckit.projectFolder');
        expect(heard).toEqual([]);
    });
});
