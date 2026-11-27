import { latestRun, reportHolds } from '../latestRun';
import { BuildReport } from '../../../protocol/pipeline';

const report = (dryRun: boolean, ok = true): BuildReport => ({
    ok, at: '10:00', commands: 5, changed: ['specify'], warnings: [], dryRun, output: '',
});

describe('latestRun', () => {
    it('lets a lone run answer', () => {
        const runs = latestRun();
        const ticket = runs.start();
        expect(runs.isNewest(ticket)).toBe(true);
    });

    it('drops a preview that finishes after a build started behind it', async () => {
        const runs = latestRun();
        const answers: string[] = [];
        const run = async (name: string, ms: number) => {
            const ticket = runs.start();
            await new Promise(resolve => setTimeout(resolve, ms));
            if (runs.isNewest(ticket)) { answers.push(name); }
        };
        await Promise.all([run('preview', 30), run('build', 5)]);
        expect(answers).toEqual(['build']);
    });
});

describe('reportHolds', () => {
    it('keeps Built through the redraw its own writes cause', () => {
        expect(reportHolds(report(false), 'current')).toBe(true);
    });

    it('clears Built once the pipeline moved on', () => {
        expect(reportHolds(report(false), 'stale')).toBe(false);
    });

    it('clears a preview and a failed build on any redraw', () => {
        expect(reportHolds(report(true), 'current')).toBe(false);
        expect(reportHolds(report(false, false), 'current')).toBe(false);
        expect(reportHolds(null, 'current')).toBe(false);
    });
});
