/**
 * Reading a build's own words back into something the panel can say.
 *
 * The panel reports a build where it was asked for rather than in a channel
 * that steals the editor, and everything it says comes from parsing the script's
 * stdout. A parse that quietly returns nothing shows an empty line instead.
 */
import { readBuildReport } from '../pipelineBuildCommands';

const PREVIEW = [
    '[build] would build 5 commands from .specify/companion.yml',
    '[build] what would change:',
    '  implement: +12 −4 lines',
    '    +a line that changed',
    '    -a line that went',
    '  plan: unchanged',
    '  specify: new — 240 lines',
    '  and refresh 7 agent command files from them',
    '  and give an agent command to: tasks',
].join('\n');

describe('what a build reported', () => {
    it('counts the commands it wrote', () => {
        const report = readBuildReport(
            { ok: true, output: '[build] built 5 commands from .specify/companion.yml' }, false);
        expect(report.commands).toBe(5);
        expect(report.dryRun).toBe(false);
        expect(report.changed).toEqual([]);
    });

    it('says the time in a form the header can print', () => {
        const report = readBuildReport({ ok: true, output: '' }, false);
        expect(report.at).toMatch(/^\d{2}:\d{2}$/);
    });

    it('reports nothing rather than guessing when the script said nothing', () => {
        const report = readBuildReport({ ok: false, output: 'python3: no such file' }, false);
        expect(report.commands).toBe(0);
        expect(report.ok).toBe(false);
    });
});

describe('what a preview would change', () => {
    it('names the commands that differ and leaves out the ones that do not', () => {
        const report = readBuildReport({ ok: true, output: PREVIEW }, true);
        expect(report.commands).toBe(5);
        expect(report.changed).toEqual(['implement', 'specify']);
    });

    it('does not mistake the trailing notes for commands', () => {
        const report = readBuildReport({ ok: true, output: PREVIEW }, true);
        expect(report.changed).not.toContain('and');
    });

    it('keeps the whole log, which the output channel also holds', () => {
        const report = readBuildReport({ ok: true, output: PREVIEW }, true);
        expect(report.output).toBe(PREVIEW);
    });
});

describe('what a build warned about', () => {
    const MISSING = 'specify: skill hook before draft-spec: No skill named "no-such-skill" in this project or an installed plugin, so this hook does nothing in a run. Install it or pick another skill.';

    it('lists each warning printed before the summary, without its prefix', () => {
        const output = [`[build] ${MISSING}`, PREVIEW].join('\n');
        const report = readBuildReport({ ok: true, output }, true);
        expect(report.warnings).toEqual([MISSING]);
        expect(report.changed).toEqual(['implement', 'specify']);
    });

    it('reports none when the build said nothing but its summary', () => {
        expect(readBuildReport({ ok: true, output: PREVIEW }, true).warnings).toEqual([]);
    });

    it('does not read a refusal as a warning', () => {
        const output = '[build] cannot build — nothing was written\n  specify: names nodes that do not exist';
        expect(readBuildReport({ ok: false, output }, false).warnings).toEqual([]);
    });
});
