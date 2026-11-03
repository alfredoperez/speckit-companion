import { bugBadge } from '../reportPanels';

describe('the header badge of a bug page', () => {
    it('says WAITING FOR YOUR REVIEW in the review tone for a bug paused at review', () => {
        expect(bugBadge({ state: 'in-review', outcome: 'valid', freshness: {} })).toEqual({
            badge: 'waiting for your review',
            badgeTone: 'review',
        });
    });

    it('says TO FIX for a re-assessed bug even though its old test said verified', () => {
        expect(bugBadge({ state: 'to-fix', outcome: 'verified', freshness: { fix: 'stale', test: 'stale' } })).toEqual({
            badge: 'to fix',
            badgeTone: 'to-fix',
        });
    });

    it('keeps the latest outcome for every other bug', () => {
        expect(bugBadge({ state: 'verified', outcome: 'verified', freshness: { fix: 'current' } })).toEqual({ badge: 'verified' });
        expect(bugBadge({ state: 'to-fix', outcome: 'failed', freshness: { test: 'current' } })).toEqual({ badge: 'failed' });
    });
});
