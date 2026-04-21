import { createInlineConfirm } from '../../../webview/src/shared/hooks/useInlineConfirm';

type ScheduledFn = { fn: () => void; ms: number; id: number };

function harness(action: () => void, opts: { window?: number; label?: string } = {}) {
    let nextId = 1;
    const scheduled = new Map<number, ScheduledFn>();
    const states: boolean[] = [];
    const notify = (armed: boolean) => {
        states.push(armed);
    };
    const setTimer = (fn: () => void, ms: number) => {
        const id = nextId++;
        scheduled.set(id, { fn, ms, id });
        return id;
    };
    const clearTimer = (id: number | undefined) => {
        if (id !== undefined) scheduled.delete(id);
    };
    const machine = createInlineConfirm(action, opts, notify, setTimer, clearTimer);
    const advance = (ms: number) => {
        for (const entry of [...scheduled.values()]) {
            if (entry.ms <= ms) {
                scheduled.delete(entry.id);
                entry.fn();
            }
        }
    };
    return { machine, scheduled, states, advance };
}

describe('useInlineConfirm state machine', () => {
    it('first click arms and emits label', () => {
        const action = jest.fn();
        const { machine, states } = harness(action);

        machine.onClick();

        expect(states).toEqual([true]);
        expect(action).not.toHaveBeenCalled();
    });

    it('reverts armed state after window elapses without firing action', () => {
        const action = jest.fn();
        const { machine, states, advance } = harness(action, { window: 3000 });

        machine.onClick();
        advance(3000);

        expect(states).toEqual([true, false]);
        expect(action).not.toHaveBeenCalled();
    });

    it('second click within window fires action exactly once', () => {
        const action = jest.fn();
        const { machine, states } = harness(action, { window: 3000 });

        machine.onClick();
        machine.onClick();

        expect(action).toHaveBeenCalledTimes(1);
        expect(states).toEqual([true, false]);
    });

    it('dispose clears the pending timer without firing action', () => {
        const action = jest.fn();
        const { machine, scheduled, advance } = harness(action);

        machine.onClick();
        expect(scheduled.size).toBe(1);

        machine.dispose();
        expect(scheduled.size).toBe(0);

        advance(5000);
        expect(action).not.toHaveBeenCalled();
    });
});
