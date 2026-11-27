/**
 * @jest-environment jsdom
 */
import { act } from 'preact/test-utils';
import { BuildBar } from '../BuildBar';
import type {
    BuildReport, PipelineBuildKind, PipelineGraph, PipelineHook, PipelineStatus,
} from '../../../../src/protocol/pipeline';
import { NO_CHANGES, flush, graph, mount, node, step } from './support';

afterEach(() => { document.body.innerHTML = ''; jest.useRealTimers(); });

const REPORT: BuildReport = {
    ok: true, at: '14:02', commands: 5, changed: [], dryRun: false,
    output: '[build] built 5 commands', warnings: [],
};

const missing: PipelineHook = {
    when: 'before', type: 'skill', summary: 'house-check', anchor: 'resolve-dir',
    index: 0, note: '', problem: 'No skill named house-check',
};

interface Options {
    g?: PipelineGraph;
    state?: PipelineBuildKind;
    busy?: boolean;
    report?: BuildReport | null;
    status?: PipelineStatus | null;
}

function bar(o: Options = {}) {
    const calls: string[] = [];
    const host = mount(
        <BuildBar graph={o.g ?? graph()} buildState={o.state ?? 'stale'} busy={o.busy ?? false}
            report={o.report ?? null} status={o.status ?? null}
            onBuild={() => calls.push('build')}
            onPreview={() => calls.push('preview')}
            onUndo={token => calls.push(`undo:${token}`)}
            onDismissStatus={() => calls.push('dismiss')}
            onEditHook={(s, h) => calls.push(`edit:${s}/${h.anchor}/${h.index}`)}
            onRemoveHook={(s, h) => calls.push(`remove:${s}/${h.anchor}/${h.index}`)}
            onShowStep={s => calls.push(`show:${s}`)} />);
    const button = (name: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
        .find(el => el.textContent?.trim() === name);
    return { host, calls, button };
}

const withProblem = () => graph({
    steps: [step({
        changes: { ...NO_CHANGES, hooks: 1 },
        phases: [{ name: 'gather', hooks: [missing], nodes: [node({ hooks: [missing] })] }],
    })],
});

describe('the build bar appears when there is something to build', () => {
    it('says changes are not built and offers Review and the one filled Build (FR-003)', () => {
        const { host, button } = bar({
            g: graph({ steps: [step({ changes: { ...NO_CHANGES, hooks: 2 } }), step({ name: 'plan' })] }),
        });
        expect(host.querySelector('.builder-bar-headline')?.textContent).toBe('Changes not built');
        expect(host.querySelector('.builder-bar-detail')?.textContent)
            .toBe('The assistant still reads the old commands');
        expect(button('Review')?.className).not.toContain('primary');
        expect(button('Build')?.className).toContain('builder-action--primary');
        expect(host.querySelectorAll('.builder-action--primary')).toHaveLength(1);
    });

    it('states no count of unbuilt steps from what differs from shipped', () => {
        const { host } = bar({
            g: graph({ steps: [step({ changes: { ...NO_CHANGES, hooks: 2 } }),
                step({ name: 'plan', changes: { ...NO_CHANGES, reordered: true } })] }),
        });
        expect(host.querySelector('.builder-bar-headline')?.textContent).toBe('Changes not built');
    });

    it('counts the changes on a project never built, since all of them wait', () => {
        const { host } = bar({
            state: 'never-built',
            g: graph({ steps: [step({ changes: { ...NO_CHANGES, hooks: 2, reordered: true } })] }),
        });
        expect(host.querySelector('.builder-bar-headline')?.textContent).toBe('3 changes not built');
    });

    it('is not there when the build is current and nothing ran', () => {
        const { host } = bar({ state: 'current' });
        expect(host.querySelector('.builder-bar')).toBeNull();
    });

    it('builds from the bar', async () => {
        const { button, calls } = bar();
        button('Build')!.click();
        await flush();
        expect(calls).toEqual(['build']);
    });

    it('cannot be pressed twice while a build runs', () => {
        const { button } = bar({ busy: true });
        const build = button('Building…')!;
        expect(build.disabled).toBe(true);
    });
});

describe('Review opens the list of changes', () => {
    it('opens upward, becomes Hide, and asks for a preview when none is held (FR-004)', async () => {
        const { host, button, calls } = bar();
        const review = button('Review')!;
        expect(review.getAttribute('aria-expanded')).toBe('false');
        review.click();
        await flush();
        expect(host.querySelector('.builder-bar-review')).not.toBeNull();
        expect(button('Hide')!.getAttribute('aria-expanded')).toBe('true');
        expect(calls).toEqual(['preview']);

        button('Hide')!.click();
        await flush();
        expect(host.querySelector('.builder-bar-review')).toBeNull();
    });

    it('does not preview again when a fresh preview is held', async () => {
        const { button, calls } = bar({
            report: { ...REPORT, dryRun: true, changed: ['specify'] },
        });
        button('Review')!.click();
        await flush();
        expect(calls).toEqual([]);
    });

    it('closes on Escape', async () => {
        const { host, button } = bar();
        button('Review')!.click();
        await flush();
        host.querySelector('.builder-bar')!.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await flush();
        expect(host.querySelector('.builder-bar-review')).toBeNull();
    });

    it('offers Undo on the last write when the host holds one (FR-005)', async () => {
        const { host, button, calls } = bar({
            status: { tone: 'done', text: 'Hook added before draft-spec', undo: { token: 'remove:x' } },
        });
        expect(host.querySelector('.builder-bar-status')?.textContent)
            .toContain('Hook added before draft-spec');
        button('Undo')!.click();
        await flush();
        expect(calls).toEqual(['undo:remove:x']);
    });

    it('offers no Undo when the write cannot be taken back', () => {
        const { button } = bar({ status: { tone: 'done', text: 'Hook added' } });
        expect(button('Undo')).toBeUndefined();
    });

    it('lists a problem hook once, with its reason and its fixes (FR-006)', async () => {
        const { host, button, calls } = bar({ g: withProblem() });
        expect(host.querySelector('.builder-bar-detail')?.textContent)
            .toBe('Fix 1 problem first. That hook would do nothing.');
        button('Review')!.click();
        await flush();
        const problems = host.querySelectorAll('.builder-bar-row--problem');
        expect(problems).toHaveLength(1);
        expect(problems[0].textContent).toContain('No skill named house-check');
        button('Edit hook')!.click();
        button('Remove hook')!.click();
        await flush();
        expect(calls).toEqual(['preview', 'edit:specify/resolve-dir/0', 'remove:specify/resolve-dir/0']);
    });

    it('lists a build warning a hook problem has not already said (FR-007)', async () => {
        const { host, button } = bar({
            g: withProblem(),
            report: {
                ...REPORT, dryRun: true,
                warnings: ['specify: skill hook before resolve-dir: No skill named house-check',
                    'plan: hook anchor nope skipped'],
            },
        });
        button('Review')!.click();
        await flush();
        const text = host.querySelector('.builder-bar-review')!.textContent!;
        expect(text.match(/No skill named house-check/g)).toHaveLength(1);
        expect(text).toContain('plan: hook anchor nope skipped');
    });

    it('takes the reader to a changed step and names the commands (FR-008)', async () => {
        const { host, button, calls } = bar({
            g: graph({ steps: [step({ changes: { ...NO_CHANGES, reordered: true } })] }),
            report: { ...REPORT, dryRun: true, changed: ['specify', 'implement'] },
        });
        button('Review')!.click();
        await flush();
        expect(host.textContent).toContain('reordered');
        expect(host.querySelector('.builder-bar-row--label')?.textContent?.trim())
            .toBe('Differs from what Companion ships');
        expect(host.textContent).toContain('Rewrites the specify and implement commands. 3 others stay as they are.');
        host.querySelector<HTMLButtonElement>('[aria-label="Show specify on the board"]')!.click();
        await flush();
        expect(calls).toEqual(['show:specify']);
    });
});

describe('after a build', () => {
    it('says it built, then leaves (FR-009)', async () => {
        jest.useFakeTimers();
        let host!: HTMLElement;
        act(() => { host = bar({ state: 'current', report: REPORT }).host; });
        expect(host.querySelector('.builder-bar--built')?.textContent)
            .toContain('5 command files written');
        act(() => { jest.advanceTimersByTime(4100); });
        expect(host.querySelector('.builder-bar')).toBeNull();
    });

    it('does not say Built again when it comes back after a sheet closed', async () => {
        jest.useFakeTimers();
        const report = { ...REPORT };
        let first!: HTMLElement;
        act(() => { first = bar({ state: 'current', report }).host; });
        act(() => { jest.advanceTimersByTime(4100); });
        expect(first.querySelector('.builder-bar')).toBeNull();
        document.body.innerHTML = '';
        let again!: HTMLElement;
        act(() => { again = bar({ state: 'current', report }).host; });
        expect(again.querySelector('.builder-bar')).toBeNull();
    });

    it('leaves four seconds after it first showed, however often it comes back', async () => {
        jest.useFakeTimers();
        const report = { ...REPORT };
        act(() => { bar({ state: 'current', report }); });
        act(() => { jest.advanceTimersByTime(3000); });
        document.body.innerHTML = '';
        let again!: HTMLElement;
        act(() => { again = bar({ state: 'current', report }).host; });
        expect(again.querySelector('.builder-bar--built')).not.toBeNull();
        act(() => { jest.advanceTimersByTime(1100); });
        expect(again.querySelector('.builder-bar')).toBeNull();
    });

    it('stays open in a warning state when it failed, saying nothing was written (FR-010)', async () => {
        const { host, button, calls } = bar({
            report: { ...REPORT, ok: false, warnings: ['specify: unknown node nope'] },
        });
        const failed = host.querySelector('.builder-bar--failed')!;
        expect(failed.textContent).toContain('Nothing was written');
        expect(failed.textContent).toContain('specify: unknown node nope');
        button('Try again')!.click();
        button('Review')!.click();
        await flush();
        expect(host.querySelector('.builder-report-log')?.textContent).toContain('[build] built 5');
        expect(button('Hide the log')).toBeDefined();
        expect(calls).toEqual(['build', 'preview']);
    });

    it('shows a preview run from the menu, and closes it on request', async () => {
        const { host, button } = bar({
            state: 'current', report: { ...REPORT, dryRun: true, changed: [] },
        });
        expect(host.querySelector('.builder-bar-detail')?.textContent)
            .toBe('Nothing would change in 5 commands.');
        button('Close')!.click();
        await flush();
        expect(host.querySelector('.builder-bar')).toBeNull();
    });
});

describe('the bar is reachable by keyboard and by name (FR-013)', () => {
    it('names its region and its dismiss control', () => {
        const { host } = bar({ status: { tone: 'done', text: 'Hook added' } });
        expect(host.querySelector('section.builder-bar')?.getAttribute('aria-label')).toBe('Build');
        expect(host.querySelector('.builder-bar-close')?.getAttribute('aria-label')).toBe('Dismiss');
    });
});
