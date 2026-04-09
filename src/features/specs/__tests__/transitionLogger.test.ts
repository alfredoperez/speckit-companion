import {
    buildTransitionEntry,
    TransitionCache,
    detectExternalTransition,
    transitionCache,
} from '../transitionLogger';

describe('transitionLogger', () => {
    describe('buildTransitionEntry', () => {
        it('should create a transition entry with all fields', () => {
            const from = { step: 'specify', substep: null };
            const entry = buildTransitionEntry(from, 'plan', null, 'extension');

            expect(entry.step).toBe('plan');
            expect(entry.substep).toBeNull();
            expect(entry.from).toEqual({ step: 'specify', substep: null });
            expect(entry.by).toBe('extension');
            expect(entry.at).toBeDefined();
            expect(new Date(entry.at).toISOString()).toBe(entry.at);
        });

        it('should handle null from for initial creation', () => {
            const entry = buildTransitionEntry(null, 'specify', null, 'extension');

            expect(entry.from).toBeNull();
            expect(entry.step).toBe('specify');
        });

        it('should include substep when provided', () => {
            const from = { step: 'specify', substep: 'draft' };
            const entry = buildTransitionEntry(from, 'specify', 'review', 'sdd');

            expect(entry.from!.substep).toBe('draft');
            expect(entry.substep).toBe('review');
            expect(entry.by).toBe('sdd');
        });
    });

    describe('TransitionCache', () => {
        let cache: TransitionCache;

        beforeEach(() => {
            cache = new TransitionCache();
        });

        it('should return undefined for unknown spec dir', () => {
            expect(cache.get('/unknown')).toBeUndefined();
        });

        it('should store and retrieve cached state', () => {
            cache.set('/specs/feat', 'plan', null);
            expect(cache.get('/specs/feat')).toEqual({ step: 'plan', substep: null });
        });

        it('should report has correctly', () => {
            expect(cache.has('/specs/feat')).toBe(false);
            cache.set('/specs/feat', 'specify', null);
            expect(cache.has('/specs/feat')).toBe(true);
        });

        it('should delete cached state', () => {
            cache.set('/specs/feat', 'plan', null);
            cache.delete('/specs/feat');
            expect(cache.has('/specs/feat')).toBe(false);
            expect(cache.get('/specs/feat')).toBeUndefined();
        });

        it('should overwrite cached state on set', () => {
            cache.set('/specs/feat', 'specify', null);
            cache.set('/specs/feat', 'plan', 'draft');
            expect(cache.get('/specs/feat')).toEqual({ step: 'plan', substep: 'draft' });
        });
    });

    describe('detectExternalTransition', () => {
        const specDir = '/workspace/specs/my-feature';

        beforeEach(() => {
            // Reset the singleton cache
            transitionCache.delete(specDir);
        });

        it('should return null and cache on first call (no prior state)', () => {
            const result = detectExternalTransition(specDir, 'specify', null, []);
            expect(result).toBeNull();
            expect(transitionCache.get(specDir)).toEqual({ step: 'specify', substep: null });
        });

        it('should return null when step has not changed', () => {
            transitionCache.set(specDir, 'plan', null);

            const result = detectExternalTransition(specDir, 'plan', null, []);
            expect(result).toBeNull();
        });

        it('should return null when step changed but no transitions array', () => {
            transitionCache.set(specDir, 'specify', null);

            const result = detectExternalTransition(specDir, 'plan', null, undefined);
            expect(result).toBeNull();
        });

        it('should return null when step changed but transitions array is empty', () => {
            transitionCache.set(specDir, 'specify', null);

            const result = detectExternalTransition(specDir, 'plan', null, []);
            expect(result).toBeNull();
        });

        it('should return null when latest transition is by extension', () => {
            transitionCache.set(specDir, 'specify', null);

            const transitions = [{
                step: 'plan',
                substep: null,
                from: { step: 'specify', substep: null },
                by: 'extension',
                at: new Date().toISOString(),
            }];

            const result = detectExternalTransition(specDir, 'plan', null, transitions);
            expect(result).toBeNull();
        });

        it('should return log message when external transition detected', () => {
            transitionCache.set(specDir, 'specify', null);

            const transitions = [{
                step: 'plan',
                substep: null,
                from: { step: 'specify', substep: null },
                by: 'sdd',
                at: new Date().toISOString(),
            }];

            const result = detectExternalTransition(specDir, 'plan', null, transitions);
            expect(result).toBe('[SpecKit] Transition detected: specify -> plan (by: sdd)');
        });

        it('should update cache after detection', () => {
            transitionCache.set(specDir, 'specify', null);

            const transitions = [{
                step: 'plan',
                substep: null,
                from: { step: 'specify', substep: null },
                by: 'sdd',
                at: new Date().toISOString(),
            }];

            detectExternalTransition(specDir, 'plan', null, transitions);
            expect(transitionCache.get(specDir)).toEqual({ step: 'plan', substep: null });
        });

        it('should detect substep changes as transitions', () => {
            transitionCache.set(specDir, 'specify', 'draft');

            const transitions = [{
                step: 'specify',
                substep: 'review',
                from: { step: 'specify', substep: 'draft' },
                by: 'sdd',
                at: new Date().toISOString(),
            }];

            const result = detectExternalTransition(specDir, 'specify', 'review', transitions);
            expect(result).toBe('[SpecKit] Transition detected: specify -> specify (by: sdd)');
        });

        it('should handle cached step being undefined', () => {
            transitionCache.set(specDir, undefined, null);

            const transitions = [{
                step: 'specify',
                substep: null,
                from: null,
                by: 'sdd',
                at: new Date().toISOString(),
            }];

            const result = detectExternalTransition(specDir, 'specify', null, transitions);
            expect(result).toBe('[SpecKit] Transition detected: (none) -> specify (by: sdd)');
        });
    });
});
