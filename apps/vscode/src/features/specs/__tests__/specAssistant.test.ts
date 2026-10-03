import { noteSpecDispatch, recordSpecAssistant, resolveSpecAssistant } from '../specAssistant';
import { readSpecContextSyncSafe } from '../specContextReader';
import { updateSpecContext } from '../specContextWriter';
import { rememberSpecTerminal } from '../specTerminals';

jest.mock('../specContextReader', () => ({ readSpecContextSyncSafe: jest.fn() }));
jest.mock('../specContextWriter', () => ({ updateSpecContext: jest.fn(() => Promise.resolve()) }));
jest.mock('../specTerminals', () => ({ rememberSpecTerminal: jest.fn() }));

const read = readSpecContextSyncSafe as jest.Mock;
const update = updateSpecContext as jest.Mock;
const SPEC = '/ws/specs/001-x';

describe('the assistant shown for a spec', () => {
    it('is the display name of the recorded provider', () => {
        expect(resolveSpecAssistant({ assistant: 'claude' })).toBe('Claude Code');
    });

    it('is nothing when no assistant was recorded', () => {
        expect(resolveSpecAssistant({})).toBeUndefined();
        expect(resolveSpecAssistant(null)).toBeUndefined();
    });

    it.each(['constructor', 'toString', '__proto__', 'Claude Code', 'claude-panel', ''])(
        'is nothing for the unknown value %p',
        value => {
            expect(resolveSpecAssistant({ assistant: value })).toBeUndefined();
        },
    );
});

describe('recording the assistant on a dispatch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        update.mockImplementation(() => Promise.resolve());
    });

    it('writes only the assistant key and keeps the rest of the context', () => {
        const ctx = { status: 'planning', history: [{ step: 'plan' }] };
        read.mockReturnValue(ctx);
        recordSpecAssistant(SPEC, 'gemini');
        const mutate = update.mock.calls[0][1];
        expect(mutate({ ...ctx })).toEqual({ ...ctx, assistant: 'gemini' });
    });

    it('refuses to publish its own stale snapshot when the re-read failed', () => {
        const ctx = { status: 'planning', history: [] };
        read.mockReturnValue(ctx);
        recordSpecAssistant(SPEC, 'gemini');
        const [, mutate, fallback] = update.mock.calls[0];
        expect(() => mutate(fallback)).toThrow();
    });

    it('writes nothing for a spec with no context file', () => {
        read.mockReturnValue(null);
        recordSpecAssistant(SPEC, 'gemini');
        expect(update).not.toHaveBeenCalled();
    });

    it('writes nothing when the same assistant is already recorded', () => {
        read.mockReturnValue({ assistant: 'gemini' });
        recordSpecAssistant(SPEC, 'gemini');
        expect(update).not.toHaveBeenCalled();
    });

    it('swallows a failed write', async () => {
        read.mockReturnValue({});
        update.mockImplementation(() => Promise.reject(new Error('read-only')));
        expect(() => recordSpecAssistant(SPEC, 'gemini')).not.toThrow();
        await Promise.resolve();
    });

    it('replaces an earlier assistant with the one the step went to', () => {
        read.mockReturnValue({ assistant: 'gemini' });
        recordSpecAssistant(SPEC, 'codex');
        expect(update.mock.calls[0][1]({})).toEqual({ assistant: 'codex' });
    });
});

describe('noting a dispatch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        read.mockReturnValue({});
    });

    it('remembers a returned terminal', () => {
        const terminal = { show: jest.fn() };
        noteSpecDispatch(SPEC, terminal, 'gemini');
        expect(rememberSpecTerminal).toHaveBeenCalledWith(SPEC, terminal);
        expect(update).toHaveBeenCalled();
    });

    it('never throws when the context cannot be read', () => {
        read.mockImplementation(() => {
            throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
        });
        expect(() => noteSpecDispatch(SPEC, undefined, 'gemini')).not.toThrow();
    });

    it('records the assistant without a terminal for a chat provider', () => {
        noteSpecDispatch(SPEC, undefined, 'gemini');
        expect(rememberSpecTerminal).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalled();
    });
});
