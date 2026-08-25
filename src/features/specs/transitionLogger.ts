import type { TransitionEntry, TransitionFrom } from '../workflows/types';

/**
 * Build a TransitionEntry for a workflow step change.
 */
export function buildTransitionEntry(
    from: TransitionFrom | null,
    step: string,
    substep: string | null,
    by: string
): TransitionEntry {
    return {
        step,
        substep,
        from,
        by,
        at: new Date().toISOString(),
    };
}

/**
 * Cached last-known step/substep — and, separately, status — per spec
 * directory. Used by the file watcher to detect external transitions and to
 * own the single "entered completed" detection every completion path flows
 * through.
 */
export class TransitionCache {
    private cache = new Map<string, { step: string | undefined; substep: string | null | undefined }>();
    private statusCache = new Map<string, string | undefined>();

    /**
     * Get cached state for a spec directory.
     */
    get(specDir: string): { step: string | undefined; substep: string | null | undefined } | undefined {
        return this.cache.get(specDir);
    }

    /**
     * Set cached state for a spec directory.
     */
    set(specDir: string, step: string | undefined, substep: string | null | undefined): void {
        this.cache.set(specDir, { step, substep });
    }

    /**
     * Check if a spec directory has cached state.
     */
    has(specDir: string): boolean {
        return this.cache.has(specDir);
    }

    /**
     * Diff a spec's status against the cached one, updating the cache. First
     * sight seeds silently (returns false), so an already-completed spec first
     * observed never reads as a fresh completion. Returns true only for a real
     * transition into `completed` — a re-write of `completed` finds it cached
     * and returns false, which is what makes double-fires structurally
     * impossible even when two watchers route the same file.
     */
    diffStatus(specDir: string, newStatus: string | undefined): boolean {
        const seen = this.statusCache.has(specDir);
        const oldStatus = this.statusCache.get(specDir);
        this.statusCache.set(specDir, newStatus);
        if (!seen) {
            return false;
        }
        return oldStatus !== 'completed' && newStatus === 'completed';
    }

    /**
     * Seed a spec's status without diffing — for the activation-time initial
     * scan and watcher `onDidCreate`, where the current state is a baseline,
     * never an event.
     */
    seedStatus(specDir: string, status: string | undefined): void {
        this.statusCache.set(specDir, status);
    }

    /**
     * Remove cached state for a spec directory.
     */
    delete(specDir: string): void {
        this.cache.delete(specDir);
        this.statusCache.delete(specDir);
    }

    /**
     * Drop all cached state (used by tests).
     */
    clear(): void {
        this.cache.clear();
        this.statusCache.clear();
    }
}

/** Singleton cache instance for external transition detection */
export const transitionCache = new TransitionCache();

/**
 * Detect if an external (non-extension) transition occurred.
 * Returns a formatted log message if detected, or null otherwise.
 */
export function detectExternalTransition(
    specDir: string,
    newStep: string | undefined,
    newSubstep: string | null | undefined,
    transitions: TransitionEntry[] | undefined
): string | null {
    const cached = transitionCache.get(specDir);

    if (!cached) {
        // First time seeing this spec — cache and skip
        transitionCache.set(specDir, newStep, newSubstep);
        return null;
    }

    // Check if step/substep changed
    if (cached.step === newStep && cached.substep === newSubstep) {
        transitionCache.set(specDir, newStep, newSubstep);
        return null;
    }

    // Update cache
    transitionCache.set(specDir, newStep, newSubstep);

    // Check the latest transition entry
    if (!transitions || transitions.length === 0) {
        return null;
    }

    const latest = transitions[transitions.length - 1];
    if (latest.by === 'extension') {
        return null;
    }

    const fromStep = cached.step || '(none)';
    const toStep = newStep || '(none)';
    return `[SpecKit] Transition detected: ${fromStep} -> ${toStep} (by: ${latest.by})`;
}
