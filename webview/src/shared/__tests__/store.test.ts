import { Store } from '../store';

interface TestState {
    count: number;
    name: string;
    items: string[];
}

function createStore(overrides?: Partial<TestState>) {
    return new Store<TestState>({
        count: 0,
        name: '',
        items: [],
        ...overrides,
    });
}

describe('Store', () => {
    it('gets initial values', () => {
        const store = createStore({ count: 5, name: 'test' });
        expect(store.get('count')).toBe(5);
        expect(store.get('name')).toBe('test');
    });

    it('sets and gets values', () => {
        const store = createStore();
        store.set('count', 42);
        expect(store.get('count')).toBe(42);
    });

    it('notifies key listeners on set', () => {
        const store = createStore();
        const listener = jest.fn();
        store.on('count', listener);

        store.set('count', 10);
        expect(listener).toHaveBeenCalledWith(10, 0);
    });

    it('does not notify when value is the same reference', () => {
        const store = createStore({ count: 5 });
        const listener = jest.fn();
        store.on('count', listener);

        store.set('count', 5);
        expect(listener).not.toHaveBeenCalled();
    });

    it('unsubscribes key listeners', () => {
        const store = createStore();
        const listener = jest.fn();
        const unsub = store.on('count', listener);

        unsub();
        store.set('count', 10);
        expect(listener).not.toHaveBeenCalled();
    });

    it('notifies onAny listeners on any key change', () => {
        const store = createStore();
        const listener = jest.fn();
        store.onAny(listener);

        store.set('count', 1);
        store.set('name', 'hello');
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('unsubscribes onAny listeners', () => {
        const store = createStore();
        const listener = jest.fn();
        const unsub = store.onAny(listener);

        unsub();
        store.set('count', 1);
        expect(listener).not.toHaveBeenCalled();
    });

    it('batches updates and fires listeners once', () => {
        const store = createStore();
        const countListener = jest.fn();
        const nameListener = jest.fn();
        const anyListener = jest.fn();

        store.on('count', countListener);
        store.on('name', nameListener);
        store.onAny(anyListener);

        store.batch((s) => {
            s.set('count', 1);
            s.set('count', 2);
            s.set('name', 'batch');
        });

        // Key listeners fire once per key at end of batch
        expect(countListener).toHaveBeenCalledTimes(1);
        expect(countListener).toHaveBeenCalledWith(2, undefined);
        expect(nameListener).toHaveBeenCalledTimes(1);
        // onAny fires once for the whole batch
        expect(anyListener).toHaveBeenCalledTimes(1);
    });

    it('getSnapshot returns current state', () => {
        const store = createStore({ count: 7, name: 'snap' });
        const snap = store.getSnapshot();
        expect(snap.count).toBe(7);
        expect(snap.name).toBe('snap');
    });

    it('handles array values correctly', () => {
        const store = createStore({ items: ['a'] });
        const listener = jest.fn();
        store.on('items', listener);

        const newItems = ['a', 'b'];
        store.set('items', newItems);
        expect(store.get('items')).toEqual(['a', 'b']);
        expect(listener).toHaveBeenCalledWith(newItems, ['a']);
    });
});
