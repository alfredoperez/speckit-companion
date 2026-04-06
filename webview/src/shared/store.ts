/**
 * Generic observable state store.
 * Provides key-based subscriptions and batched updates.
 */

type Listener<T> = (value: T, prev: T) => void;

export class Store<TState extends object> {
    private state: TState;
    private keyListeners = new Map<keyof TState, Set<Listener<unknown>>>();
    private anyListeners = new Set<Listener<TState>>();
    private batching = false;
    private changedKeys = new Set<keyof TState>();

    constructor(initial: TState) {
        this.state = { ...initial };
    }

    get<K extends keyof TState>(key: K): TState[K] {
        return this.state[key];
    }

    set<K extends keyof TState>(key: K, value: TState[K]): void {
        const prev = this.state[key];
        if (prev === value) return;
        this.state[key] = value;

        if (this.batching) {
            this.changedKeys.add(key);
        } else {
            this.notifyKey(key, value, prev);
            this.notifyAny();
        }
    }

    /** Batch multiple updates — listeners fire once at end. */
    batch(updater: (store: Store<TState>) => void): void {
        this.batching = true;
        this.changedKeys.clear();
        try {
            updater(this);
        } finally {
            this.batching = false;
            if (this.changedKeys.size > 0) {
                for (const key of this.changedKeys) {
                    const listeners = this.keyListeners.get(key);
                    if (listeners) {
                        for (const fn of listeners) {
                            fn(this.state[key], undefined);
                        }
                    }
                }
                this.notifyAny();
                this.changedKeys.clear();
            }
        }
    }

    /** Subscribe to changes on a specific key. Returns unsubscribe function. */
    on<K extends keyof TState>(key: K, listener: Listener<TState[K]>): () => void {
        let set = this.keyListeners.get(key);
        if (!set) {
            set = new Set();
            this.keyListeners.set(key, set);
        }
        set.add(listener as Listener<unknown>);
        return () => { set!.delete(listener as Listener<unknown>); };
    }

    /** Subscribe to any change. Returns unsubscribe function. */
    onAny(listener: Listener<TState>): () => void {
        this.anyListeners.add(listener);
        return () => { this.anyListeners.delete(listener); };
    }

    /** Read-only snapshot of current state. */
    getSnapshot(): Readonly<TState> {
        return this.state;
    }

    private notifyKey<K extends keyof TState>(key: K, value: TState[K], prev: TState[K]): void {
        const listeners = this.keyListeners.get(key);
        if (listeners) {
            for (const fn of listeners) {
                fn(value, prev);
            }
        }
    }

    private notifyAny(): void {
        for (const fn of this.anyListeners) {
            fn(this.state, undefined as unknown as TState);
        }
    }
}
