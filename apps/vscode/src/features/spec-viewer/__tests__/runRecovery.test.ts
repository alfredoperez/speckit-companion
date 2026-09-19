import { computeRunRecovery, formatQuiet, quietThresholdMinutes } from '../runRecovery';

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
        expect(r.mode).toBe('stalled');
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

describe('formatQuiet (issue #452)', () => {
    it('reads as minutes under an hour', () => {
        expect(formatQuiet(45)).toBe('45m');
        expect(formatQuiet(59)).toBe('59m');
    });

    it('escalates to hours from one hour to two days', () => {
        expect(formatQuiet(60)).toBe('1h');
        expect(formatQuiet(3 * 60 + 20)).toBe('3h');
        expect(formatQuiet(47 * 60)).toBe('47h');
    });

    it('escalates to days from two days to two weeks', () => {
        expect(formatQuiet(48 * 60)).toBe('2d');
        expect(formatQuiet(5 * 24 * 60)).toBe('5d');
        expect(formatQuiet(13 * 24 * 60)).toBe('13d');
    });

    it('escalates to weeks past a fortnight', () => {
        expect(formatQuiet(14 * 24 * 60)).toBe('2w');
        expect(formatQuiet(52_633)).toBe('5w'); // the reported 36.5-day case
    });
});

describe('computeRunRecovery long-horizon mode (issue #452)', () => {
    it('still asks "still running?" just past the step threshold', () => {
        const r = computeRunRecovery({
            currentStep: 'implement', status: 'implementing',
            newestActivityMs: minsAgo(26), nowMs: NOW,
        });
        expect(r.mode).toBe('stalled');
        expect(r.message).toContain('still running?');
    });

    it('stays in "still running?" mode up to the 3-day horizon', () => {
        const r = computeRunRecovery({
            currentStep: 'implement', status: 'implementing',
            newestActivityMs: minsAgo(2 * 24 * 60), nowMs: NOW,
        });
        expect(r.mode).toBe('stalled');
        expect(r.message).toContain('2d');
    });

    it('switches to the stale framing well past the horizon', () => {
        const r = computeRunRecovery({
            currentStep: 'implement', status: 'implementing',
            newestActivityMs: minsAgo(52_633), nowMs: NOW,
        });
        expect(r.show).toBe(true);
        expect(r.mode).toBe('stale');
        expect(r.message).toContain('5w');
        expect(r.message).not.toContain('still running?');
        expect(r.message).toContain('abandoned');
    });

    it('treats a 100%-complete in-flight step as done-but-unmarked at any age', () => {
        const r = computeRunRecovery({
            currentStep: 'implement', status: 'implementing',
            newestActivityMs: minsAgo(40), nowMs: NOW,
            taskCompletionPercent: 100,
        });
        expect(r.mode).toBe('stale');
        expect(r.message).toContain('mark it complete?');
    });

    it('does not nag about a 100%-complete step under the threshold', () => {
        expect(computeRunRecovery({
            currentStep: 'implement', status: 'implementing',
            newestActivityMs: minsAgo(5), nowMs: NOW,
            taskCompletionPercent: 100,
        }).show).toBe(false);
    });
});
