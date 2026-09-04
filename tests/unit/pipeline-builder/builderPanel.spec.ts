/**
 * What the panel does when the webview asks it for something.
 *
 * Every action in the builder crosses this seam: the webview sends a message,
 * the panel writes a file or runs a script and draws the answer. Everything on
 * the far side of it was tested — the webview asserts it sent the message, the
 * Python asserts the write is refused correctly — and the receiving end was
 * not, so a handler that passed the wrong argument, or wrote nothing at all,
 * went through green.
 *
 * The workspace here is a real directory, because half of what these handlers
 * do is read and write real files. Only the two seams that shell out — the
 * graph reader and the configuration writer — are stood in for.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import type { PipelineGraphResult } from '../../../src/protocol/pipeline';

// The same module `vscode` maps to, imported by path for the stub factory,
// which is a testing affordance rather than part of the editor's API.
import { createMockWebviewPanel } from '../../__mocks__/vscode';
import * as graphModule from '../../../src/features/specs/pipelineGraph';
import {
    PipelineBuilderPanel,
    registerPipelineBuilderCommands,
} from '../../../src/features/pipeline-builder/builderPanel';

jest.mock('../../../src/features/specs/pipelineGraph');
jest.mock('../../../src/features/specs/pipelineBuild', () => {
    const actual = jest.requireActual('../../../src/features/specs/pipelineBuild');
    return { ...actual, readPipelineBuildState: () => ({ kind: 'current' }) };
});

const graph = graphModule as jest.Mocked<typeof graphModule>;

const WRITE_SCRIPT = '/ext/scripts/config_write.py';
const REPAIR_SCRIPT = '/ext/scripts/config_repair.py';
const GRAPH_SCRIPT = '/ext/scripts/pipeline-graph.py';

type Panel = ReturnType<typeof createMockWebviewPanel>;

let workspace: string;
let extensionPath: string;
let panel: Panel;

/** A node file as the extension ships it, fences and all. */
function shippedNode(command: string, id: string, body: string): string {
    const file = path.join(extensionPath, 'speckit-extension', 'nodes', command, `${id}.md`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body, 'utf8');
    return file;
}

/** Where this project's own copy of a node would live. */
function ownNode(command: string, id: string): string {
    return path.join(workspace, '.specify', 'companion', 'nodes', command, `${id}.md`);
}

/** Open the panel and hand back the webview stub it is talking to. */
function openPanel(): Panel {
    (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [
        { uri: vscode.Uri.file(workspace) },
    ];
    PipelineBuilderPanel.show(
        { extensionPath, subscriptions: [] } as unknown as vscode.ExtensionContext,
        vscode.window.createOutputChannel('test') as vscode.OutputChannel,
    );
    return (vscode.window.createWebviewPanel as jest.Mock).mock.results.at(-1)!.value as Panel;
}

beforeEach(() => {
    jest.clearAllMocks();
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'builder-ws-'));
    extensionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'builder-ext-'));

    graph.resolveConfigWriteScript.mockReturnValue(WRITE_SCRIPT);
    graph.resolveConfigRepairScript.mockReturnValue(REPAIR_SCRIPT);
    graph.resolveGraphScript.mockReturnValue(GRAPH_SCRIPT);
    graph.readPipelineGraph.mockResolvedValue({ error: 'stub' });
    for (const write of [
        graph.writeNodeOrder, graph.writePhases, graph.writeHook, graph.removeHook,
        graph.writeWorkflow, graph.createWorkflow, graph.createStep, graph.applyRepair,
        graph.writeTemplateSection,
    ]) {
        (write as jest.Mock).mockResolvedValue(null);
    }

    // The shared stub records the call and does nothing; these handlers write and
    // delete real files, so the delete has to actually happen for a test to mean it.
    (vscode.workspace.fs.delete as jest.Mock).mockImplementation(
        async (uri: { fsPath: string }) => { fs.rmSync(uri.fsPath, { force: true }); });

    (vscode.window.createWebviewPanel as jest.Mock).mockImplementation(
        createMockWebviewPanel);
    panel = openPanel();
});

afterEach(() => {
    panel.__fireDispose();
    fs.rmSync(workspace, { recursive: true, force: true });
    fs.rmSync(extensionPath, { recursive: true, force: true });
});

describe('a message the panel does not know', () => {
    it('is logged rather than thrown, so one bad message cannot kill the panel', async () => {
        await expect(panel.__receive({ type: 'nonsense' })).resolves.toBeUndefined();
    });
});

describe('drawing the pipeline', () => {
    it('answers the first message with the graph and the build state', async () => {
        await panel.__receive({ type: 'ready' });
        const sent = panel.__lastPosted('graph');
        expect(sent.graph).toEqual({ error: 'stub' });
        expect(sent.buildState).toBe('current');
    });

    it('says what is missing when the spec-kit half is not installed', async () => {
        graph.resolveGraphScript.mockReturnValue(null);
        await panel.__receive({ type: 'refresh' });
        expect(panel.__lastPosted('graph').graph).toEqual({
            error: 'The pipeline builder needs the companion spec-kit extension.',
        });
        expect(graph.readPipelineGraph).not.toHaveBeenCalled();
    });

    // Every input a build reads, not only `companion.yml`: a rewritten node, a
    // named workflow the panel is writing to instead, a fragment, a template.
    it('redraws when any build input changes on disk', async () => {
        const watched = (vscode.workspace.createFileSystemWatcher as jest.Mock)
            .mock.calls.map(([pattern]) => pattern.pattern ?? String(pattern));
        expect(watched).toEqual(expect.arrayContaining([
            expect.stringContaining('companion.yml'),
            expect.stringContaining('nodes'),
            expect.stringContaining('workflows'),
        ]));

        const watchers = (vscode.workspace.createFileSystemWatcher as jest.Mock)
            .mock.results.map(r => r.value);
        for (const watcher of watchers) {
            const before = panel.__posted.length;
            await watcher.fireChange(vscode.Uri.file('x'));
            expect(panel.__posted.length).toBeGreaterThan(before);
        }
    });

    it('watches the project\'s own nodes, not only the configuration file', () => {
        const globs = (vscode.workspace.createFileSystemWatcher as jest.Mock)
            .mock.calls.map(([pattern]) => pattern.pattern);
        expect(globs).toContain('.specify/companion.yml');
        expect(globs).toContain('.specify/companion/nodes/**/*.md');
    });
});

describe('building', () => {
    it('runs the same command the palette runs', async () => {
        await panel.__receive({ type: 'build' });
        expect(vscode.commands.executeCommand)
            .toHaveBeenCalledWith('speckit.companion.buildPipeline', { quiet: true });
    });

    it('asks the command to keep quiet, since the panel reports the result itself', async () => {
        await panel.__receive({ type: 'preview' });
        expect(vscode.commands.executeCommand)
            .toHaveBeenCalledWith('speckit.companion.previewPipelineBuild', { quiet: true });
    });

    it('marks the panel busy while it runs, and free again after', async () => {
        await panel.__receive({ type: 'build' });
        const busy = panel.__posted.filter((m: { type: string }) => m.type === 'busy');
        expect(busy.map((m: { busy: boolean }) => m.busy)).toEqual([true, false]);
    });

    it('frees the panel even when the build throws', async () => {
        (vscode.commands.executeCommand as jest.Mock)
            .mockRejectedValueOnce(new Error('build blew up'));
        await panel.__receive({ type: 'preview' });
        const busy = panel.__posted.filter((m: { type: string }) => m.type === 'busy');
        expect(busy.at(-1)).toEqual({ type: 'busy', busy: false });
    });

    it('reports what the build did, in the panel that asked for it', async () => {
        const report = {
            ok: true, at: '14:02', commands: 5, changed: [], dryRun: false, output: '[build] ok',
        };
        (vscode.commands.executeCommand as jest.Mock).mockResolvedValueOnce(report);
        await panel.__receive({ type: 'build' });
        expect(panel.__lastPosted('buildReport').report).toEqual(report);
    });

    it('drops the report once the pipeline moves under it', async () => {
        (vscode.commands.executeCommand as jest.Mock).mockResolvedValueOnce({
            ok: true, at: '14:02', commands: 5, changed: [], dryRun: false, output: 'x',
        });
        await panel.__receive({ type: 'build' });
        await panel.__receive({ type: 'selectWorkflow', name: 'bugfix' });
        expect(panel.__lastPosted('buildReport').report).toBeNull();
    });

    it('drops it for a change made outside the panel too', async () => {
        (vscode.commands.executeCommand as jest.Mock).mockResolvedValueOnce({
            ok: true, at: '14:02', commands: 5, changed: [], dryRun: false, output: 'x',
        });
        await panel.__receive({ type: 'build' });
        const watchers = (vscode.workspace.createFileSystemWatcher as jest.Mock)
            .mock.results.map(r => r.value);
        await watchers[0].fireChange(vscode.Uri.file('companion.yml'));
        expect(panel.__lastPosted('buildReport').report).toBeNull();
    });

    it('leaves the header saying nothing when the command had nothing to report', async () => {
        (vscode.commands.executeCommand as jest.Mock).mockResolvedValueOnce(null);
        await panel.__receive({ type: 'preview' });
        expect(panel.__lastPosted('buildReport').report).toBeNull();
    });

    it('reports after the redraw, so the redraw does not wipe what it just said', async () => {
        (vscode.commands.executeCommand as jest.Mock).mockResolvedValueOnce({
            ok: true, at: '14:02', commands: 5, changed: [], dryRun: false, output: 'x',
        });
        await panel.__receive({ type: 'build' });
        expect(panel.__lastPosted('buildReport').report).not.toBeNull();
    });

    it('logs a failed action rather than losing it to an unhandled rejection', async () => {
        const channel = (vscode.window.createOutputChannel as jest.Mock)
            .mock.results.at(-1)!.value;
        (vscode.commands.executeCommand as jest.Mock)
            .mockRejectedValueOnce(new Error('build blew up'));
        await panel.__receive({ type: 'build' });
        expect(channel.appendLine).toHaveBeenCalledWith(
            expect.stringContaining('build blew up'));
    });
});

describe('the line that explains the board', () => {
    /** A readable graph, so the panel has something to stamp `firstRun` onto. */
    const READABLE = { steps: [], warnings: [] } as unknown as PipelineGraphResult;

    /** A panel whose workspace can actually remember, which the shared one cannot. */
    function openWithMemory(store: Map<string, unknown>): Panel {
        panel.__fireDispose();
        (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [
            { uri: vscode.Uri.file(workspace) },
        ];
        PipelineBuilderPanel.show(
            {
                extensionPath,
                subscriptions: [],
                workspaceState: {
                    get: (key: string) => store.get(key),
                    update: async (key: string, value: unknown) => { store.set(key, value); },
                },
            } as unknown as vscode.ExtensionContext,
            vscode.window.createOutputChannel('test') as vscode.OutputChannel,
        );
        return (vscode.window.createWebviewPanel as jest.Mock)
            .mock.results.at(-1)!.value as Panel;
    }

    it('is offered to a workspace that has never read it', async () => {
        graph.readPipelineGraph.mockResolvedValue(READABLE);
        panel = openWithMemory(new Map());
        await panel.__receive({ type: 'ready' });
        expect(panel.__lastPosted('graph').graph.firstRun).toBe(true);
    });

    it('is not offered again once it has been read', async () => {
        graph.readPipelineGraph.mockResolvedValue(READABLE);
        panel = openWithMemory(new Map());
        await panel.__receive({ type: 'dismissFirstRun' });
        expect(panel.__lastPosted('graph').graph.firstRun).toBe(false);
    });

    it('does not fall over in a workspace with nothing to remember with', async () => {
        await expect(panel.__receive({ type: 'dismissFirstRun' })).resolves.toBeUndefined();
        expect(panel.__lastPosted('graph')).toBeDefined();
    });
});

describe('reading a node', () => {
    it('sends the instructions with the fences named rather than shown', async () => {
        shippedNode('specify', 'draft', [
            '---', 'id: draft', 'kind: author', '---', '',
            'Write the spec.', '',
            '<!-- speckit-companion:part quality -->',
            '<!-- /speckit-companion:part quality -->', '',
        ].join('\n'));

        await panel.__receive({ type: 'readNode', command: 'specify', nodeId: 'draft' });
        const sent = panel.__lastPosted('nodeBody');
        expect(sent.body).toBe('Write the spec.');
        expect(sent.parts).toEqual(['quality']);
        expect(sent.editable).toContain('speckit-companion:part quality');
    });

    it('says nothing at all for a node that is not anywhere', async () => {
        await panel.__receive({ type: 'readNode', command: 'specify', nodeId: 'ghost' });
        expect(panel.__lastPosted('nodeBody')).toBeUndefined();
    });

    it('reads a step\'s own preamble through the same path', async () => {
        shippedNode('plan', '_frame', '---\nid: _frame\n---\n\nHow planning works.\n');
        await panel.__receive({ type: 'readFrame', command: 'plan' });
        expect(panel.__lastPosted('nodeBody')).toMatchObject({
            nodeId: '_frame', body: 'How planning works.',
        });
    });

    it('prefers the project\'s copy over the shipped one', async () => {
        shippedNode('specify', 'draft', '---\nid: draft\n---\n\nTheirs.\n');
        const own = ownNode('specify', 'draft');
        fs.mkdirSync(path.dirname(own), { recursive: true });
        fs.writeFileSync(own, '---\nid: draft\n---\n\nOurs.\n', 'utf8');

        await panel.__receive({ type: 'readNode', command: 'specify', nodeId: 'draft' });
        expect(panel.__lastPosted('nodeBody').body).toBe('Ours.');
    });
});

describe('saving a node is what makes it yours', () => {
    beforeEach(() => {
        shippedNode('specify', 'draft', [
            '---', 'id: draft', 'kind: author', 'reads: []', '---', '',
            'Write the spec.', '',
        ].join('\n'));
    });

    it('writes the project\'s own copy, leaving the shipped node alone', async () => {
        const shipped = path.join(
            extensionPath, 'speckit-extension', 'nodes', 'specify', 'draft.md');
        const before = fs.readFileSync(shipped, 'utf8');

        await panel.__receive({
            type: 'saveNode', command: 'specify', nodeId: 'draft', body: 'Write it our way.',
        });

        expect(fs.readFileSync(ownNode('specify', 'draft'), 'utf8'))
            .toContain('Write it our way.');
        expect(fs.readFileSync(shipped, 'utf8')).toBe(before);
    });

    it('carries the build\'s metadata across rather than losing it to the edit', async () => {
        await panel.__receive({
            type: 'saveNode', command: 'specify', nodeId: 'draft', body: 'Write it our way.',
        });
        const saved = fs.readFileSync(ownNode('specify', 'draft'), 'utf8');
        expect(saved).toContain('id: draft');
        expect(saved).toContain('kind: author');
        expect(saved).toContain('reads: []');
    });

    it('redraws and re-reads, so the canvas and the inspector both catch up', async () => {
        await panel.__receive({
            type: 'saveNode', command: 'specify', nodeId: 'draft', body: 'Ours now.',
        });
        expect(panel.__lastPosted('graph')).toBeDefined();
        expect(panel.__lastPosted('nodeBody').body).toBe('Ours now.');
    });

    it('says so rather than writing a node it cannot find', async () => {
        await panel.__receive({
            type: 'saveNode', command: 'specify', nodeId: 'ghost', body: 'anything',
        });
        expect(panel.__lastPosted('notice').text).toContain('ghost');
        expect(fs.existsSync(ownNode('specify', 'ghost'))).toBe(false);
    });
});

describe('giving a node back', () => {
    // This used to stand up the project's copy and nothing else, and assert the
    // delete happened — which is the bug in miniature. "Give it back" only means
    // something when there is something to give it back TO.
    beforeEach(() => {
        shippedNode('specify', 'draft', '---\nid: draft\n---\n\nWrite the spec.\n');
    });

    /** A project's own copy of the shipped `draft` node, on disk. */
    function ourCopy(): string {
        const own = ownNode('specify', 'draft');
        fs.mkdirSync(path.dirname(own), { recursive: true });
        fs.writeFileSync(own, 'ours', 'utf8');
        return own;
    }

    it('drops the project\'s copy and redraws', async () => {
        const own = ourCopy();

        await panel.__receive({ type: 'restoreNode', command: 'specify', nodeId: 'draft' });

        expect(fs.existsSync(own)).toBe(false);
        expect(panel.__lastPosted('graph')).toBeDefined();
    });

    it('does nothing when there was no copy to give back', async () => {
        await panel.__receive({ type: 'restoreNode', command: 'specify', nodeId: 'draft' });
        expect(panel.__lastPosted('graph')).toBeUndefined();
    });

    it('says what it did, in the panel', async () => {
        ourCopy();
        await panel.__receive({ type: 'restoreNode', command: 'specify', nodeId: 'draft' });

        const status = panel.__lastPosted('status').status;
        expect(status.text).toBe('draft runs the shipped node again');
        expect(status.detail).toBe('Your copy went to the trash');
        expect(status.undo.token).toBe('restore:specify:draft');
    });

    // The panel forgets the held copy on close; the trash outlives that.
    it('deletes through the editor, into the trash, not straight off the disk', async () => {
        ourCopy();
        await panel.__receive({ type: 'restoreNode', command: 'specify', nodeId: 'draft' });

        const [uri, options] = (vscode.workspace.fs.delete as jest.Mock).mock.calls.at(-1)!;
        expect(uri.fsPath).toBe(ownNode('specify', 'draft'));
        expect(options).toEqual({ useTrash: true });
    });

    it('puts the deleted copy back, contents and all, when Undo is pressed', async () => {
        const own = ourCopy();
        await panel.__receive({ type: 'restoreNode', command: 'specify', nodeId: 'draft' });
        expect(fs.existsSync(own)).toBe(false);

        await panel.__receive({ type: 'undo', token: 'restore:specify:draft' });

        expect(fs.readFileSync(own, 'utf8')).toBe('ours');
        expect(panel.__lastPosted('status').status).toBeNull();
    });

    // The way back holds the only copy, so a failed restore must not spend it.
    it('keeps the way back when the restore fails, and says so', async () => {
        const own = ourCopy();
        await panel.__receive({ type: 'restoreNode', command: 'specify', nodeId: 'draft' });

        // A file standing where the node's directory has to go, so the restore
        // cannot make the folder and throws.
        const dir = path.dirname(own);
        fs.rmSync(dir, { recursive: true, force: true });
        fs.writeFileSync(dir, 'in the way', 'utf8');

        await panel.__receive({ type: 'undo', token: 'restore:specify:draft' });
        expect(panel.__lastPosted('notice').text).toContain('Could not take that back');

        // Still on offer, so the second press succeeds where the first failed.
        fs.rmSync(dir, { force: true });
        await panel.__receive({ type: 'undo', token: 'restore:specify:draft' });
        expect(fs.readFileSync(own, 'utf8')).toBe('ours');
    });

    it('refuses a node that ships nowhere, naming an action the panel can do', async () => {
        const own = ownNode('specify', 'invented');
        fs.mkdirSync(path.dirname(own), { recursive: true });
        fs.writeFileSync(own, 'ours', 'utf8');

        await panel.__receive({ type: 'restoreNode', command: 'specify', nodeId: 'invented' });

        expect(panel.__lastPosted('notice').text).toContain('Remove from the run');
        expect(fs.existsSync(own)).toBe(true);
    });
});

describe('a write that the configuration refuses', () => {
    it('tells the panel the reason, in the panel', async () => {
        graph.writeNodeOrder.mockResolvedValue('handoff has to run last.');
        await panel.__receive({
            type: 'reorderNodes', command: 'specify', order: ['handoff', 'draft'],
        });
        expect(panel.__lastPosted('notice').text).toBe('handoff has to run last.');
    });

    it('redraws from disk, so the refused drag undoes itself', async () => {
        graph.writeNodeOrder.mockResolvedValue('no.');
        await panel.__receive({ type: 'reorderNodes', command: 'specify', order: ['a'] });
        expect(panel.__lastPosted('graph')).toBeDefined();
    });

    it('names what was being done when the spec-kit half is missing', async () => {
        graph.resolveConfigWriteScript.mockReturnValue(null);
        await panel.__receive({ type: 'reorderNodes', command: 'specify', order: ['a'] });
        expect(panel.__lastPosted('notice').text)
            .toBe('Reordering needs the companion spec-kit extension.');
        expect(graph.writeNodeOrder).not.toHaveBeenCalled();
    });
});

describe('each action reaches its own writer', () => {
    it('sends a reorder as the step\'s whole order', async () => {
        await panel.__receive({
            type: 'reorderNodes', command: 'plan', order: ['a', 'b'],
        });
        expect(graph.writeNodeOrder)
            .toHaveBeenCalledWith(WRITE_SCRIPT, workspace, 'plan', ['a', 'b']);
    });

    it('sends a regrouping with the rename, so the hooks follow the phase', async () => {
        const phases = [{ name: 'gather', nodes: ['a'] }];
        await panel.__receive({
            type: 'setPhases', command: 'plan', phases, renamed: { from: 'x', to: 'gather' },
        });
        expect(graph.writePhases).toHaveBeenCalledWith(
            WRITE_SCRIPT, workspace, 'plan', phases, { from: 'x', to: 'gather' });
    });

    it('sends a hook removal by its address', async () => {
        await panel.__receive({
            type: 'removeHook', command: 'plan', anchor: 'draft', when: 'after', index: 1,
        });
        expect(graph.removeHook)
            .toHaveBeenCalledWith(WRITE_SCRIPT, workspace, 'plan', 'after', 'draft', 1);
    });

    it('switches the whole configuration by name', async () => {
        await panel.__receive({ type: 'selectWorkflow', name: 'shipped' });
        expect(graph.writeWorkflow).toHaveBeenCalledWith(WRITE_SCRIPT, workspace, 'shipped');
    });
});

describe('attaching work', () => {
    it('sends a shell hook as something to run', async () => {
        await panel.__receive({
            type: 'addHook', command: 'plan', anchor: 'draft', when: 'after',
            hookType: 'command', value: './check.sh',
        });
        expect(graph.writeHook).toHaveBeenCalledWith(
            WRITE_SCRIPT, workspace, 'plan',
            expect.objectContaining({ type: 'command', run: './check.sh' }));
    });

    it('sends a skill hook as a reference, with its extra line', async () => {
        await panel.__receive({
            type: 'addHook', command: 'plan', anchor: 'draft', when: 'before',
            hookType: 'skill', value: 'house-check', note: 'only on big specs',
        });
        expect(graph.writeHook).toHaveBeenCalledWith(
            WRITE_SCRIPT, workspace, 'plan',
            expect.objectContaining({
                type: 'skill', ref: 'house-check', text: 'only on big specs',
            }));
    });

    it('leaves the extra line off a hook that has none', async () => {
        await panel.__receive({
            type: 'addHook', command: 'plan', anchor: 'draft', when: 'before',
            hookType: 'node', value: 'review',
        });
        expect((graph.writeHook.mock.calls[0][3] as { text?: string }).text).toBeUndefined();
    });

    it('sends a prompt hook as the instruction itself', async () => {
        await panel.__receive({
            type: 'addHook', command: 'plan', anchor: 'draft', when: 'after',
            hookType: 'prompt', value: 'Check the budget.',
        });
        expect(graph.writeHook).toHaveBeenCalledWith(
            WRITE_SCRIPT, workspace, 'plan',
            expect.objectContaining({ type: 'prompt', text: 'Check the budget.' }));
    });

    it('carries the index through, so an edit replaces rather than adds', async () => {
        await panel.__receive({
            type: 'addHook', command: 'plan', anchor: 'draft', when: 'after',
            hookType: 'prompt', value: 'Changed.', editIndex: 2,
        });
        expect((graph.writeHook.mock.calls[0][3] as { editIndex?: number }).editIndex).toBe(2);
    });
});

describe('putting a dropped node back', () => {
    const message = {
        type: 'addNode', command: 'plan', nodeId: 'research', phase: 'gather',
        order: ['research', 'draft'],
        phases: [{ name: 'gather', nodes: ['research', 'draft'] }],
    };

    it('sends where it sits and when it runs in one write', async () => {
        await panel.__receive(message);
        expect(graph.writePhases).toHaveBeenCalledWith(
            WRITE_SCRIPT, workspace, 'plan',
            [{ name: 'gather', nodes: ['research', 'draft'] }],
            undefined, ['research', 'draft']);
        expect(graph.writeNodeOrder).not.toHaveBeenCalled();
    });

    it('reports a refusal in the panel, with nothing written', async () => {
        graph.writePhases.mockResolvedValue('that phase does not exist.');
        await panel.__receive(message);
        expect(panel.__lastPosted('notice').text).toBe('that phase does not exist.');
    });
});

describe('running a different block in a node\'s place', () => {
    const message = {
        type: 'useVariant', command: 'specify',
        replaces: 'draft-spec', variant: 'draft-spec-ears',
        order: ['resolve-dir', 'draft-spec-ears', 'handoff'],
        phases: [{ name: 'author', nodes: ['resolve-dir', 'draft-spec-ears', 'handoff'] }],
    };

    // A swap is an add and a drop at once, and each half is checked against the
    // other as it currently stands — so whichever went first was refused for
    // disagreeing with the half that had not moved. Replace never worked from
    // the panel; only the tests, which sent both halves together, ever saw it.
    it('sends both halves in one write, so neither is checked against a stale other', async () => {
        await panel.__receive(message);
        expect(graph.writePhases).toHaveBeenCalledWith(
            WRITE_SCRIPT, workspace, 'specify',
            [{ name: 'author', nodes: ['resolve-dir', 'draft-spec-ears', 'handoff'] }],
            { from: 'draft-spec', to: 'draft-spec-ears' },
            ['resolve-dir', 'draft-spec-ears', 'handoff']);
        expect(graph.writeNodeOrder).not.toHaveBeenCalled();
    });

    // A node id is a hook anchor, so the swap renames one. Without the carry,
    // work attached to the block you replaced is warned about and skipped —
    // the same silent detachment a phase rename used to cause.
    it('carries the hooks that were on the block it replaced', async () => {
        await panel.__receive(message);
        expect(graph.writePhases.mock.calls[0][4])
            .toEqual({ from: 'draft-spec', to: 'draft-spec-ears' });
    });

    it('reports a refusal in the panel, with nothing written', async () => {
        graph.writePhases.mockResolvedValue('that node has no phase.');
        await panel.__receive(message);
        expect(panel.__lastPosted('notice').text).toBe('that node has no phase.');
    });
});

describe('changing the shape of a step\'s document', () => {
    it('points one section at a fragment', async () => {
        await panel.__receive({
            type: 'setTemplateSection', command: 'specify',
            heading: 'User Scenarios & Testing', fragment: 'outcomes',
        });
        expect(graph.writeTemplateSection).toHaveBeenCalledWith(
            WRITE_SCRIPT, workspace, 'specify', 'User Scenarios & Testing', 'outcomes');
    });

    it('an empty fragment is how a section goes back to the shipped one', async () => {
        await panel.__receive({
            type: 'setTemplateSection', command: 'specify',
            heading: 'User Scenarios & Testing', fragment: '',
        });
        expect(graph.writeTemplateSection).toHaveBeenCalledWith(
            WRITE_SCRIPT, workspace, 'specify', 'User Scenarios & Testing', '');
    });

    it('reports a refusal in the panel rather than swallowing it', async () => {
        graph.writeTemplateSection.mockResolvedValue('no fragment called nope.');
        await panel.__receive({
            type: 'setTemplateSection', command: 'specify',
            heading: 'User Scenarios & Testing', fragment: 'nope',
        });
        expect(panel.__lastPosted('notice').text).toBe('no fragment called nope.');
    });
});

describe('handing a step to a document of your own', () => {
    beforeEach(() => {
        shippedNode('plan', '_frame', '---\nid: _frame\n---\n\nHow planning works.\n');
        shippedNode('plan', 'research', '---\nid: research\n---\n\nGo and read.\n');
        shippedNode('plan', 'draft', '---\nid: draft\n---\n\nWrite it down.\n');
    });

    it('seeds the file from what the step says today', async () => {
        await panel.__receive({ type: 'replaceStep', command: 'plan' });
        const seeded = fs.readFileSync(ownNode('plan', 'plan-ours'), 'utf8');
        expect(seeded).toContain('How planning works.');
        expect(seeded).toContain('Go and read.');
        expect(seeded).toContain('Write it down.');
    });

    it('leaves the step running that one document and nothing else', async () => {
        await panel.__receive({ type: 'replaceStep', command: 'plan' });
        expect(graph.writePhases).toHaveBeenCalledWith(
            WRITE_SCRIPT, workspace, 'plan',
            [{ name: 'our plan', nodes: ['plan-ours'] }],
            undefined, ['plan-ours']);
        expect(graph.writeNodeOrder).not.toHaveBeenCalled();
    });

    it('opens nothing when the write was refused', async () => {
        graph.writePhases.mockResolvedValue('plan-ours reads something it cannot.');
        await panel.__receive({ type: 'replaceStep', command: 'plan' });
        expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
        expect(panel.__lastPosted('notice').text).toBe('plan-ours reads something it cannot.');
    });

    it('opens it, because the point is to adapt it', async () => {
        await panel.__receive({ type: 'replaceStep', command: 'plan' });
        expect(vscode.window.showTextDocument).toHaveBeenCalled();
    });

    it('does not overwrite the document on a second run', async () => {
        await panel.__receive({ type: 'replaceStep', command: 'plan' });
        fs.writeFileSync(ownNode('plan', 'plan-ours'), 'my own words', 'utf8');
        await panel.__receive({ type: 'replaceStep', command: 'plan' });
        expect(fs.readFileSync(ownNode('plan', 'plan-ours'), 'utf8')).toBe('my own words');
    });
});

describe('recovering a configuration that cannot be read', () => {
    it('applies the repair someone picked, then redraws', async () => {
        await panel.__receive({ type: 'repair', repairId: 'drop-empty-phases:tasks' });
        expect(graph.applyRepair)
            .toHaveBeenCalledWith(REPAIR_SCRIPT, workspace, 'drop-empty-phases:tasks');
        expect(panel.__lastPosted('graph')).toBeDefined();
    });

    it('reports a repair that did not work the way a refused edit is reported', async () => {
        graph.applyRepair.mockResolvedValue('There was nothing to drop.');
        await panel.__receive({ type: 'repair', repairId: 'drop-empty-phases:tasks' });
        expect(panel.__lastPosted('notice').text).toBe('There was nothing to drop.');
    });

    it('says what is missing rather than failing silently', async () => {
        graph.resolveConfigRepairScript.mockReturnValue(null);
        await panel.__receive({ type: 'repair', repairId: 'reset-all' });
        expect(panel.__lastPosted('notice').text)
            .toBe('Repairing needs the companion spec-kit extension.');
        expect(graph.applyRepair).not.toHaveBeenCalled();
    });
});

describe('opening the configuration file', () => {
    it('opens it when the project has one', async () => {
        const config = path.join(workspace, '.specify', 'companion.yml');
        fs.mkdirSync(path.dirname(config), { recursive: true });
        fs.writeFileSync(config, 'workflow: shipped\n', 'utf8');

        await panel.__receive({ type: 'openConfig' });
        expect(vscode.window.showTextDocument).toHaveBeenCalled();
    });

    it('explains rather than opening nothing when there is no file', async () => {
        await panel.__receive({ type: 'openConfig' });
        expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
        expect(panel.__lastPosted('notice').text).toContain('no companion.yml');
    });
});

describe('opening a node in the editor', () => {
    it('opens the node file when there is one', async () => {
        shippedNode('specify', 'draft', '---\nid: draft\n---\n\nWrite it.\n');
        await panel.__receive({ type: 'openNode', command: 'specify', nodeId: 'draft' });
        expect(vscode.window.showTextDocument).toHaveBeenCalled();
    });

    it('falls back to the built command, at the node\'s own marker', async () => {
        const built = path.join(workspace, '.specify', 'extensions', 'companion',
            'commands', 'speckit.companion.specify.md');
        fs.mkdirSync(path.dirname(built), { recursive: true });
        fs.writeFileSync(built, 'intro\n<!-- speckit-companion:node draft -->\nbody\n', 'utf8');

        const editor = { revealRange: jest.fn(), selection: undefined };
        const doc = {
            getText: () => fs.readFileSync(built, 'utf8'),
            positionAt: (offset: number) => new vscode.Position(0, offset),
        };
        (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValueOnce(doc);
        (vscode.window.showTextDocument as jest.Mock).mockResolvedValueOnce(editor);

        await panel.__receive({ type: 'openNode', command: 'specify', nodeId: 'draft' });

        expect(editor.revealRange).toHaveBeenCalled();
        expect(editor.selection).toBeDefined();
    });

    it('says to build first when there is nothing to open at all', async () => {
        await panel.__receive({ type: 'openNode', command: 'specify', nodeId: 'draft' });
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            expect.stringContaining('Build the pipeline'));
    });
});

describe('starting a new workflow', () => {
    it('creates it and opens it', async () => {
        await panel.__receive({ type: 'newWorkflow', from: 'shipped', name: 'ours' });
        expect(graph.createWorkflow)
            .toHaveBeenCalledWith(WRITE_SCRIPT, workspace, 'ours', 'shipped');
        expect(vscode.window.showTextDocument).toHaveBeenCalled();
    });

    it('opens nothing when it was not created', async () => {
        graph.createWorkflow.mockResolvedValue('a workflow called ours already exists.');
        await panel.__receive({ type: 'newWorkflow', from: 'shipped', name: 'ours' });
        expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
    });
});

describe('a node that ships nowhere cannot be given back', () => {
    // A step handed to one document, or a node someone wrote, exists nowhere
    // else. Deleting it left the configuration ordering a file that was gone —
    // the pipeline read as broken, with no way back from inside the panel.
    it('refuses, and says what to do instead', async () => {
        fs.mkdirSync(path.dirname(ownNode('specify', 'specify-ours')), { recursive: true });
        fs.writeFileSync(ownNode('specify', 'specify-ours'), 'Ours.', 'utf8');

        await panel.__receive({
            type: 'restoreNode', command: 'specify', nodeId: 'specify-ours',
        });

        expect(fs.existsSync(ownNode('specify', 'specify-ours'))).toBe(true);
        expect(panel.__lastPosted('notice').text)
            .toContain('not a node Companion ships');
    });
});

describe('adding a step of the project\'s own', () => {
    const ADD = {
        type: 'newStep' as const, name: 'review', label: 'Review the change',
        after: 'implement', writes: 'review.md',
    };

    it('hands every field to the writer', async () => {
        await panel.__receive(ADD);
        expect(graph.createStep).toHaveBeenCalledWith(
            WRITE_SCRIPT, workspace, 'review', 'Review the change', 'implement', 'review.md');
    });

    // A seeded step says "replace this" and nothing else, so a panel that
    // created it and stopped leaves a lane that does nothing.
    it('opens the node there is to edit', async () => {
        await panel.__receive(ADD);
        const opened = (vscode.window.showTextDocument as jest.Mock).mock.calls[0][0];
        expect(String(opened.fsPath ?? opened.path)).toContain(
            path.join('.specify', 'companion', 'nodes', 'review', 'review-work.md'));
    });

    it('opens nothing when the writer refused', async () => {
        graph.createStep.mockResolvedValue("a step called 'review' already exists");
        await panel.__receive(ADD);
        expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
    });

    it('tells the panel why it was refused, not the editor', async () => {
        graph.createStep.mockResolvedValue("a step called 'review' already exists");
        await panel.__receive(ADD);
        expect(panel.__posted.some((m: { type: string; text?: string }) =>
            m.type === 'notice' && String(m.text).includes('already exists'))).toBe(true);
    });

    it('redraws afterwards, so the new lane appears without reopening', async () => {
        graph.readPipelineGraph.mockClear();
        await panel.__receive(ADD);
        expect(graph.readPipelineGraph).toHaveBeenCalled();
    });
});

describe('the panel is one panel', () => {
    it('reveals and refreshes the open one instead of opening a second', () => {
        const before = (vscode.window.createWebviewPanel as jest.Mock).mock.calls.length;
        openPanel();
        expect((vscode.window.createWebviewPanel as jest.Mock).mock.calls.length).toBe(before);
        expect(panel.reveal).toHaveBeenCalled();
    });

    it('opens a fresh one after the first is closed', () => {
        panel.__fireDispose();
        const reopened = openPanel();
        expect(reopened).not.toBe(panel);
        panel = reopened;
    });

    it('refuses to open with no folder open, and says why', () => {
        (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = undefined;
        const before = (vscode.window.createWebviewPanel as jest.Mock).mock.calls.length;
        PipelineBuilderPanel.show(
            { extensionPath, subscriptions: [] } as unknown as vscode.ExtensionContext,
            vscode.window.createOutputChannel('test') as vscode.OutputChannel,
        );
        expect((vscode.window.createWebviewPanel as jest.Mock).mock.calls.length).toBe(before);
        expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    });
});

describe('reaching the panel from the palette', () => {
    it('registers the command the manifest promises, under that exact name', () => {
        const subscriptions: unknown[] = [];
        registerPipelineBuilderCommands(
            { extensionPath, subscriptions } as unknown as vscode.ExtensionContext,
            vscode.window.createOutputChannel('test') as vscode.OutputChannel,
        );
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            'speckit.companion.openPipelineBuilder', expect.any(Function));
        expect(subscriptions).toHaveLength(1);
    });

    it('opens the panel when the command runs', () => {
        panel.__fireDispose();
        registerPipelineBuilderCommands(
            { extensionPath, subscriptions: [] } as unknown as vscode.ExtensionContext,
            vscode.window.createOutputChannel('test') as vscode.OutputChannel,
        );
        const [, run] = (vscode.commands.registerCommand as jest.Mock).mock.calls[0];
        const before = (vscode.window.createWebviewPanel as jest.Mock).mock.calls.length;
        run();
        expect((vscode.window.createWebviewPanel as jest.Mock).mock.calls.length)
            .toBe(before + 1);
        panel = (vscode.window.createWebviewPanel as jest.Mock)
            .mock.results.at(-1)!.value as Panel;
    });
});

describe('taking a node out of the run', () => {
    /** The step as the graph reader would report it, so an undo has a shape to restore. */
    function shaped(): void {
        graph.readPipelineGraph.mockResolvedValue({
            steps: [{
                name: 'specify',
                phases: [
                    { name: 'gather', nodes: [{ id: 'resolve-dir' }] },
                    { name: 'author', nodes: [{ id: 'draft' }] },
                ],
            }],
        } as never);
    }

    it('writes the order and the grouping together, and says what it did', async () => {
        shaped();
        await panel.__receive({
            type: 'removeNode', command: 'specify', nodeId: 'draft',
            order: ['resolve-dir'], phases: [{ name: 'gather', nodes: ['resolve-dir'] }],
        });

        const [, , command, phases, , order] = graph.writePhases.mock.calls.at(-1)!;
        expect(command).toBe('specify');
        expect(phases).toEqual([{ name: 'gather', nodes: ['resolve-dir'] }]);
        expect(order).toEqual(['resolve-dir']);
        expect(panel.__lastPosted('status').status.text)
            .toBe('draft no longer runs in specify');
    });

    it('puts the node back where it was when Undo is pressed', async () => {
        shaped();
        await panel.__receive({
            type: 'removeNode', command: 'specify', nodeId: 'draft',
            order: ['resolve-dir'], phases: [{ name: 'gather', nodes: ['resolve-dir'] }],
        });
        await panel.__receive({ type: 'undo', token: 'remove:specify:draft' });

        const [, , , phases, , order] = graph.writePhases.mock.calls.at(-1)!;
        expect(order).toEqual(['resolve-dir', 'draft']);
        expect(phases).toEqual([
            { name: 'gather', nodes: ['resolve-dir'] },
            { name: 'author', nodes: ['draft'] },
        ]);
    });

    // A promised Undo the panel cannot honour is worse than none offered.
    it('offers no Undo when the shape to go back to could not be read', async () => {
        await panel.__receive({
            type: 'removeNode', command: 'specify', nodeId: 'draft',
            order: ['resolve-dir'], phases: [{ name: 'gather', nodes: ['resolve-dir'] }],
        });
        expect(panel.__lastPosted('status').status.undo).toBeUndefined();
    });

    it('writes nothing and says the reason when the configuration refuses', async () => {
        shaped();
        graph.writePhases.mockResolvedValue('draft has to run last.');
        await panel.__receive({
            type: 'removeNode', command: 'specify', nodeId: 'draft',
            order: ['resolve-dir'], phases: [{ name: 'gather', nodes: ['resolve-dir'] }],
        });
        expect(panel.__lastPosted('notice').text).toBe('draft has to run last.');
        expect(panel.__lastPosted('status')).toBeUndefined();
    });
});

describe('moving a node without dragging it', () => {
    it('sends the whole step\'s shape, and says which node moved', async () => {
        await panel.__receive({
            type: 'moveNode', command: 'specify', nodeId: 'draft',
            order: ['draft', 'resolve-dir'],
            phases: [{ name: 'gather', nodes: ['draft', 'resolve-dir'] }],
        });

        const [, , command, phases, , order] = graph.writePhases.mock.calls.at(-1)!;
        expect(command).toBe('specify');
        expect(order).toEqual(['draft', 'resolve-dir']);
        expect(phases).toEqual([{ name: 'gather', nodes: ['draft', 'resolve-dir'] }]);
        expect(panel.__lastPosted('status').status.text).toBe('draft moved in specify');
    });
});

describe('the page the panel serves', () => {
    it('locks scripts to a nonce, and allows nothing else by default', () => {
        expect(panel.webview.html).toContain("default-src 'none'");
        expect(panel.webview.html).toMatch(/script-src 'nonce-[A-Za-z0-9]{32}'/);
    });

    it('gives each panel its own nonce', () => {
        const first = /nonce-([A-Za-z0-9]{32})/.exec(panel.webview.html)![1];
        panel.__fireDispose();
        panel = openPanel();
        const second = /nonce-([A-Za-z0-9]{32})/.exec(panel.webview.html)![1];
        expect(second).not.toBe(first);
    });
});
