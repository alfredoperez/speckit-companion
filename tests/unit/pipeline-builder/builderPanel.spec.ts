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

    it('redraws when the configuration changes on disk', async () => {
        const watchers = (vscode.workspace.createFileSystemWatcher as jest.Mock)
            .mock.results.map(r => r.value);
        expect(watchers).toHaveLength(2);
        const before = panel.__posted.length;
        await watchers[0].fireChange(vscode.Uri.file('x'));
        expect(panel.__posted.length).toBeGreaterThan(before);
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
            .toHaveBeenCalledWith('speckit.companion.buildPipeline');
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
    it('drops the project\'s copy and redraws', async () => {
        const own = ownNode('specify', 'draft');
        fs.mkdirSync(path.dirname(own), { recursive: true });
        fs.writeFileSync(own, 'ours', 'utf8');

        await panel.__receive({ type: 'restoreNode', command: 'specify', nodeId: 'draft' });

        expect(fs.existsSync(own)).toBe(false);
        expect(panel.__lastPosted('graph')).toBeDefined();
    });

    it('does nothing when there was no copy to give back', async () => {
        await panel.__receive({ type: 'restoreNode', command: 'specify', nodeId: 'draft' });
        expect(panel.__lastPosted('graph')).toBeUndefined();
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
