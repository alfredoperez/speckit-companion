import * as vscode from 'vscode';
import { SpecsSortState } from '../specsSortState';
import { ConfigKeys } from '../../../core/constants';

const KEY = ConfigKeys.workspaceState.specsSortMode;
const CONTEXT_KEY = 'speckit.specs.sortActive';

function makeContext() {
    const store = new Map<string, unknown>();
    return {
        workspaceState: {
            get: jest.fn((key: string) => store.get(key)),
            update: jest.fn(async (key: string, value: unknown) => {
                if (value === undefined) store.delete(key);
                else store.set(key, value);
            }),
            keys: jest.fn(() => Array.from(store.keys())),
        },
    } as unknown as vscode.ExtensionContext;
}

describe('SpecsSortState', () => {
    beforeEach(() => {
        (vscode.commands.executeCommand as jest.Mock).mockClear();
    });

    it('returns the default mode when nothing is persisted', () => {
        const ctx = makeContext();
        const state = new SpecsSortState(ctx, jest.fn());

        expect(state.getMode()).toBe('number');
    });

    it('persists a non-default mode, sets sortActive=true, and fires onChange', async () => {
        const ctx = makeContext();
        const onChange = jest.fn();
        const state = new SpecsSortState(ctx, onChange);

        await state.setMode('name');

        expect(ctx.workspaceState.update).toHaveBeenCalledWith(KEY, 'name');
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', CONTEXT_KEY, true);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(state.getMode()).toBe('name');
    });

    it('treats setMode(default) as clear()', async () => {
        const ctx = makeContext();
        const onChange = jest.fn();
        const state = new SpecsSortState(ctx, onChange);

        await state.setMode('name');
        (ctx.workspaceState.update as jest.Mock).mockClear();
        (vscode.commands.executeCommand as jest.Mock).mockClear();
        onChange.mockClear();

        await state.setMode('number');

        expect(ctx.workspaceState.update).toHaveBeenCalledWith(KEY, undefined);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', CONTEXT_KEY, false);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(state.getMode()).toBe('number');
    });

    it('clear() removes the persisted value and unsets the context key', async () => {
        const ctx = makeContext();
        const onChange = jest.fn();
        const state = new SpecsSortState(ctx, onChange);

        await state.setMode('status');
        (vscode.commands.executeCommand as jest.Mock).mockClear();
        onChange.mockClear();

        await state.clear();

        expect(ctx.workspaceState.update).toHaveBeenCalledWith(KEY, undefined);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', CONTEXT_KEY, false);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(state.getMode()).toBe('number');
    });

    it('coerces an unknown persisted value back to default', () => {
        const ctx = makeContext();
        (ctx.workspaceState.get as jest.Mock).mockImplementation((k: string) =>
            k === KEY ? 'bogus' : undefined
        );

        const state = new SpecsSortState(ctx, jest.fn());

        expect(state.getMode()).toBe('number');
    });

    it('initialize() sets sortActive=true when a non-default mode is persisted', async () => {
        const ctx = makeContext();
        (ctx.workspaceState.get as jest.Mock).mockImplementation((k: string) =>
            k === KEY ? 'name' : undefined
        );

        const state = new SpecsSortState(ctx, jest.fn());
        await state.initialize();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', CONTEXT_KEY, true);
    });

    it('initialize() sets sortActive=false when no mode is persisted', async () => {
        const ctx = makeContext();
        const state = new SpecsSortState(ctx, jest.fn());

        await state.initialize();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', CONTEXT_KEY, false);
    });
});
