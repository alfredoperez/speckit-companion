import * as vscode from 'vscode';
import { SpecsFilterState } from '../specsFilterState';
import { ConfigKeys } from '../../../core/constants';

const KEY = ConfigKeys.workspaceState.specsFilterQuery;
const CONTEXT_KEY = 'speckit.specs.filterActive';

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

describe('SpecsFilterState', () => {
    beforeEach(() => {
        (vscode.commands.executeCommand as jest.Mock).mockClear();
    });

    it('returns empty string when no query is persisted', () => {
        const ctx = makeContext();
        const onChange = jest.fn();
        const state = new SpecsFilterState(ctx, onChange);

        expect(state.getQuery()).toBe('');
    });

    it('persists the query, sets the filterActive context key, and calls onChange', async () => {
        const ctx = makeContext();
        const onChange = jest.fn();
        const state = new SpecsFilterState(ctx, onChange);

        await state.setQuery('tree');

        expect(ctx.workspaceState.update).toHaveBeenCalledWith(KEY, 'tree');
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', CONTEXT_KEY, true);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(state.getQuery()).toBe('tree');
    });

    it('trims whitespace before persisting', async () => {
        const ctx = makeContext();
        const state = new SpecsFilterState(ctx, jest.fn());

        await state.setQuery('   tree   ');

        expect(ctx.workspaceState.update).toHaveBeenCalledWith(KEY, 'tree');
    });

    it('treats a blank query as clear()', async () => {
        const ctx = makeContext();
        const onChange = jest.fn();
        const state = new SpecsFilterState(ctx, onChange);

        await state.setQuery('tree');
        (ctx.workspaceState.update as jest.Mock).mockClear();
        onChange.mockClear();

        await state.setQuery('   ');

        expect(ctx.workspaceState.update).toHaveBeenCalledWith(KEY, undefined);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', CONTEXT_KEY, false);
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('clear() removes the persisted value and unsets the context key', async () => {
        const ctx = makeContext();
        const onChange = jest.fn();
        const state = new SpecsFilterState(ctx, onChange);

        await state.setQuery('tree');
        (vscode.commands.executeCommand as jest.Mock).mockClear();
        onChange.mockClear();

        await state.clear();

        expect(ctx.workspaceState.update).toHaveBeenCalledWith(KEY, undefined);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', CONTEXT_KEY, false);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(state.getQuery()).toBe('');
    });

    it('initialize() syncs the context key from persisted state', async () => {
        const ctx = makeContext();
        (ctx.workspaceState.get as jest.Mock).mockImplementation((key: string) => key === KEY ? 'tree' : undefined);

        const state = new SpecsFilterState(ctx, jest.fn());
        await state.initialize();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', CONTEXT_KEY, true);
    });

    it('initialize() sets filterActive=false when no persisted query', async () => {
        const ctx = makeContext();
        const state = new SpecsFilterState(ctx, jest.fn());

        await state.initialize();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', CONTEXT_KEY, false);
    });
});
