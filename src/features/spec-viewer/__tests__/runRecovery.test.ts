import { computeRunRecovery, quietThresholdMinutes } from '../runRecovery';

const NOW = 1_700_000_000_000; // fixed clock
const minsAgo = (m: number) => NOW - m * 60_000;

describe('computeRunRecovery (issue #418)', () => {
    it('hides when the status is not an in-progress form', () => {
        expect(computeRunRecovery({
            currentStep: 'implement', status: 'implemented',
            newestActivityMs: minsAgo(120), nowMs: NOW,
        }).show).toBe(false);
    });

    it('hides when the run is fresh (under the step threshold)', () => {
        // implement threshold is 25m
        expect(computeRunRecovery({
            currentStep: 'implement', status: 'implementing',
            newestActivityMs: minsAgo(10), nowMs: NOW,
        }).show).toBe(false);
    });

    it('shows when an implementing run has been quiet past its threshold', () => {
        const r = computeRunRecovery({
            currentStep: 'implement', status: 'implementing',
            newestActivityMs: minsAgo(40), nowMs: NOW,
        });
        expect(r.show).toBe(true);
        expect(r.minutesQuiet).toBe(40);
        expect(r.message).toContain('40m');
        expect(r.message).toContain('still running?');
    });

    it('uses a more generous threshold for specify than implement', () => {
        expect(quietThresholdMinutes('specify')).toBeGreaterThan(quietThresholdMinutes('implement'));
        // 40m quiet: past implement's 25m fuse, but under specify's 45m fuse
        expect(computeRunRecovery({
            currentStep: 'specify', status: 'specifying',
            newestActivityMs: minsAgo(40), nowMs: NOW,
        }).show).toBe(false);
        expect(computeRunRecovery({
            currentStep: 'specify', status: 'specifying',
            newestActivityMs: minsAgo(50), nowMs: NOW,
        }).show).toBe(true);
    });

    it('hides when there is no activity timestamp', () => {
        expect(computeRunRecovery({
            currentStep: 'implement', status: 'implementing',
            newestActivityMs: undefined, nowMs: NOW,
        }).show).toBe(false);
    });

    it('hides when the newest activity is in the future (clock skew)', () => {
        expect(computeRunRecovery({
            currentStep: 'implement', status: 'implementing',
            newestActivityMs: NOW + 60_000, nowMs: NOW,
        }).show).toBe(false);
    });

    it('never fires for a completed spec', () => {
        expect(computeRunRecovery({
            currentStep: 'implement', status: 'completed',
            newestActivityMs: minsAgo(600), nowMs: NOW,
        }).show).toBe(false);
    });
});
