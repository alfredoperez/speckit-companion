import { hookStatus, problemWord, runSource } from '../hookStatus';
import type { HookRun, HookRunsAnswer, PipelineHook } from '../../../../src/protocol/pipeline';

const hook = (over: Partial<PipelineHook> = {}): PipelineHook => ({
    when: 'after', type: 'skill', summary: 'house-check', anchor: 'draft-spec', index: 0,
    note: '', ...over,
});

const run = (over: Partial<HookRun> = {}): HookRun => ({
    key: 'specify/after/draft-spec/0', step: 'specify', when: 'after', anchor: 'draft-spec',
    index: 0, type: 'skill', ref: 'house-check', outcome: 'ran', at: '2026-11-20T10:00:00Z',
    ...over,
});

const record = (runs: HookRun[]): HookRunsAnswer => ({
    spec: { name: '684-x', path: '/specs/684-x' }, runAt: '2026-11-20T10:00:00Z', runs,
});

describe('what a hook row says about its last run', () => {
    it('says nothing when the project has no run on record', () => {
        expect(hookStatus('specify', hook(), null)).toBeNull();
        expect(hookStatus('specify', hook(), { spec: null, runAt: null, runs: [] })).toBeNull();
    });

    it('puts the problem first, whatever the run says', () => {
        const status = hookStatus('specify', hook({ problem: 'No skill named "house-check" in this project.' }),
            record([run()]));
        expect(status).toEqual(expect.objectContaining({ word: 'not installed', tone: 'problem' }));
        expect(status?.reason).toContain('No skill named');
    });

    it('says the problem even with no run at all', () => {
        expect(hookStatus('specify', hook({ problem: 'x is turned off in Claude Code settings' }), null)?.word)
            .toBe('plugin off');
    });

    it('reads ran and skipped from the entry under its own address', () => {
        expect(hookStatus('specify', hook(), record([run()]))?.word).toBe('ran');
        const skipped = hookStatus('specify', hook(),
            record([run({ outcome: 'skipped', reason: 'The assistant read it and chose not to.' })]));
        expect(skipped).toEqual({
            word: 'skipped', tone: 'skipped', reason: 'The assistant read it and chose not to.',
        });
    });

    it('says not seen when the run has no entry for it', () => {
        expect(hookStatus('specify', hook({ index: 1 }), record([run()])))
            .toEqual(expect.objectContaining({ word: 'not seen', tone: 'unseen' }));
    });

    it('says not seen, and why, when the hook changed since that run', () => {
        const status = hookStatus('specify', hook({ summary: 'pr-template' }), record([run()]));
        expect(status?.word).toBe('not seen');
        expect(status?.reason).toMatch(/Changed since/);
        expect(hookStatus('specify', hook({ type: 'prompt', summary: 'Ask first' }), record([run()]))?.word)
            .toBe('not seen');
    });

    it('matches a command hook by its address, since a command carries no ref', () => {
        expect(hookStatus('specify', hook({ type: 'command', summary: 'npm run lint' }),
            record([run({ type: 'command', ref: '' })]))?.word).toBe('ran');
    });

    it('says nothing about a hook on a step the run has not reached', () => {
        expect(hookStatus('plan', hook(), record([run()]))).toBeNull();
    });
});

describe('which run the statuses come from', () => {
    it('names the spec and how long ago it ran', () => {
        expect(runSource(record([]), new Date('2026-11-20T12:00:00Z'))).toBe('Last run: 684-x, 2h ago');
    });

    it('says nothing when there is no run', () => {
        expect(runSource(null)).toBe('');
        expect(runSource({ spec: null, runAt: null, runs: [] })).toBe('');
    });
});

describe('a problem in a few words', () => {
    it('names each reason the build gives', () => {
        expect(problemWord('"x" is marked disable-model-invocation, so the assistant cannot call it')).toBe("can't call");
        expect(problemWord('"x" could not be checked: the plugin list could not be read.')).toBe('unchecked');
        expect(problemWord('No skill named "x" in this project')).toBe('not installed');
    });
});
