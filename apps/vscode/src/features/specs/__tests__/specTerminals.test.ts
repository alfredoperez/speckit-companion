import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    rememberSpecTerminal,
    getSpecTerminal,
    registerSpecTerminals,
    _resetForTests,
} from '../specTerminals';

const { createMockTerminal, __fireCloseTerminal } = vscode as unknown as {
    createMockTerminal: (options?: { name?: string }) => vscode.Terminal;
    __fireCloseTerminal: (terminal: vscode.Terminal) => void;
};

const SPEC = '/workspace/specs/001-alpha';
const OTHER_SPEC = '/workspace/specs/002-beta';

describe('specTerminals', () => {
    let subscription: vscode.Disposable | undefined;

    beforeEach(() => {
        _resetForTests();
    });

    afterEach(() => {
        subscription?.dispose();
        subscription = undefined;
    });

    describe('remembering a terminal', () => {
        it('returns the terminal remembered for a spec', () => {
            const terminal = createMockTerminal();
            rememberSpecTerminal(SPEC, terminal);
            expect(getSpecTerminal(SPEC)).toBe(terminal);
        });

        it('returns nothing for a spec with no terminal', () => {
            rememberSpecTerminal(SPEC, createMockTerminal());
            expect(getSpecTerminal(OTHER_SPEC)).toBeUndefined();
        });

        it('ignores an undefined terminal', () => {
            const onChange = jest.fn();
            subscription = registerSpecTerminals(onChange);
            rememberSpecTerminal(SPEC, undefined);
            expect(getSpecTerminal(SPEC)).toBeUndefined();
            expect(onChange).not.toHaveBeenCalled();
        });

        it('replaces an earlier terminal with the newest one', () => {
            const older = createMockTerminal({ name: 'older' });
            const newer = createMockTerminal({ name: 'newer' });
            rememberSpecTerminal(SPEC, older);
            rememberSpecTerminal(SPEC, newer);
            expect(getSpecTerminal(SPEC)).toBe(newer);
        });

        it('finds the terminal through an unnormalised path to the same spec', () => {
            const terminal = createMockTerminal();
            rememberSpecTerminal(`${SPEC}/`, terminal);
            expect(getSpecTerminal(path.join(SPEC, '..', '001-alpha'))).toBe(terminal);
        });

        it('keeps a terminal whose process exited while its tab is still open', () => {
            const terminal = createMockTerminal();
            rememberSpecTerminal(SPEC, terminal);
            (terminal as { exitStatus: vscode.TerminalExitStatus | undefined }).exitStatus = {
                code: 1,
                reason: 1,
            };
            expect(getSpecTerminal(SPEC)).toBe(terminal);
        });

        it('notifies the listener when a terminal is remembered', () => {
            const onChange = jest.fn();
            subscription = registerSpecTerminals(onChange);
            rememberSpecTerminal(SPEC, createMockTerminal());
            expect(onChange).toHaveBeenCalledTimes(1);
        });
    });

    describe('closing a terminal', () => {
        it('forgets the spec whose terminal closed and notifies the listener', () => {
            const onChange = jest.fn();
            subscription = registerSpecTerminals(onChange);
            const terminal = createMockTerminal();
            rememberSpecTerminal(SPEC, terminal);
            onChange.mockClear();

            __fireCloseTerminal(terminal);

            expect(getSpecTerminal(SPEC)).toBeUndefined();
            expect(onChange).toHaveBeenCalledTimes(1);
        });

        it('forgets every spec pointing at the closed terminal with one notification', () => {
            const onChange = jest.fn();
            subscription = registerSpecTerminals(onChange);
            const terminal = createMockTerminal();
            rememberSpecTerminal(SPEC, terminal);
            rememberSpecTerminal(OTHER_SPEC, terminal);
            onChange.mockClear();

            __fireCloseTerminal(terminal);

            expect(getSpecTerminal(SPEC)).toBeUndefined();
            expect(getSpecTerminal(OTHER_SPEC)).toBeUndefined();
            expect(onChange).toHaveBeenCalledTimes(1);
        });

        it('keeps other specs and stays quiet when an unrelated terminal closes', () => {
            const onChange = jest.fn();
            subscription = registerSpecTerminals(onChange);
            const terminal = createMockTerminal();
            rememberSpecTerminal(SPEC, terminal);
            onChange.mockClear();

            __fireCloseTerminal(createMockTerminal({ name: 'unrelated' }));

            expect(getSpecTerminal(SPEC)).toBe(terminal);
            expect(onChange).not.toHaveBeenCalled();
        });

        it('keeps the newest terminal when the replaced one closes', () => {
            const onChange = jest.fn();
            subscription = registerSpecTerminals(onChange);
            const older = createMockTerminal({ name: 'older' });
            const newer = createMockTerminal({ name: 'newer' });
            rememberSpecTerminal(SPEC, older);
            rememberSpecTerminal(SPEC, newer);
            onChange.mockClear();

            __fireCloseTerminal(older);

            expect(getSpecTerminal(SPEC)).toBe(newer);
            expect(onChange).not.toHaveBeenCalled();
        });

        it('stops listening once the registration is disposed', () => {
            const onChange = jest.fn();
            const terminal = createMockTerminal();
            registerSpecTerminals(onChange).dispose();
            rememberSpecTerminal(SPEC, terminal);

            __fireCloseTerminal(terminal);

            expect(onChange).not.toHaveBeenCalled();
            expect(getSpecTerminal(SPEC)).toBe(terminal);
        });
    });

    describe('lifecycle isolation', () => {
        it('imports nothing that writes the spec context', () => {
            const source = fs.readFileSync(path.join(__dirname, '..', 'specTerminals.ts'), 'utf8');
            const imports = source.match(/from '([^']+)'/g) ?? [];
            expect(imports).toEqual(["from 'path'", "from 'vscode'"]);
        });
    });
});
