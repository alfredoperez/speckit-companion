import { isStalenessRelevant, stalenessFrom } from '../staleness';

const doc = (type: string, label: string, mtime?: number, exists = true) => ({ type, label, exists, mtime });

describe('stalenessFrom', () => {
    it('marks a document stale when an earlier one is newer by more than a second', () => {
        const map = stalenessFrom([doc('spec', 'Spec', 10_000), doc('plan', 'Plan', 5_000)]);
        expect(map.plan.isStale).toBe(true);
        expect(map.plan.newerUpstream).toBe('Spec');
        expect(map.spec.isStale).toBe(false);
    });

    it('treats mtimes within a second as the same generation', () => {
        const map = stalenessFrom([doc('spec', 'Spec', 5_900), doc('plan', 'Plan', 5_000)]);
        expect(map.plan.isStale).toBe(false);
    });

    it('never marks a missing document stale', () => {
        const map = stalenessFrom([doc('spec', 'Spec', 10_000), doc('plan', 'Plan', undefined, false)]);
        expect(map.plan.isStale).toBe(false);
    });

    it('names the newest upstream document', () => {
        const map = stalenessFrom([doc('spec', 'Spec', 8_000), doc('plan', 'Plan', 9_000), doc('tasks', 'Tasks', 1_000)]);
        expect(map.tasks.newerUpstream).toBe('Plan');
    });
});

describe('isStalenessRelevant', () => {
    it('is false for settled specs only', () => {
        expect(isStalenessRelevant('completed')).toBe(false);
        expect(isStalenessRelevant('archived')).toBe(false);
        expect(isStalenessRelevant('active')).toBe(true);
        expect(isStalenessRelevant(undefined)).toBe(true);
    });
});
