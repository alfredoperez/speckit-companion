/**
 * @jest-environment jsdom
 *
 * What a project without the Companion extension sees. The board is the only
 * thing telling it which half of this panel it has, so the three claims worth
 * pinning are: the steps are its own, Build cannot run, and the Companion-only
 * work is said to be Companion's exactly once.
 */
import { StockBoard } from '../StockBoard';
import type { StockWorkflowView } from '../../../../src/protocol/pipeline';
import { flush, mount } from './support';

function view(over: Partial<StockWorkflowView> = {}): StockWorkflowView {
    return {
        source: 'workflow',
        workflow: { id: 'speckit', name: 'Full SDD Cycle', description: 'specify then plan' },
        steps: [
            {
                id: 'specify', command: 'speckit.specify', kind: 'command',
                label: 'Write the spec', writes: ['spec.md'],
                hooks: [{
                    when: 'before', step: 'specify', index: 0, extension: 'git',
                    command: 'speckit.git.feature', description: 'Create feature branch',
                    enabled: true, optional: false, conditional: false,
                }],
            },
            {
                id: 'review', command: '', kind: 'gate',
                label: 'Review the spec before planning.', writes: [], hooks: [],
            },
        ],
        presets: [],
        registry: true,
        buildBlocked: 'Nothing here is built.',
        ...over,
    };
}

const noop = () => undefined;
const ACTIONS = { onSetHook: noop, onOpenFile: noop };

describe('the board on a stock Spec Kit project', () => {
    it('draws the project\'s own steps, with what each writes', () => {
        const host = mount(<StockBoard view={view()} status={null} {...ACTIONS} />);

        const steps = Array.from(host.querySelectorAll('.pb-stock-step-name'))
            .map(el => el.textContent);
        expect(steps).toEqual(['Write the spec', 'Review the spec before planning.']);
        expect(host.querySelector('.pb-stock-file')!.textContent).toBe('spec.md');
        expect(host.querySelector('.pb-stock-step--gate')).not.toBeNull();
    });

    it('offers no way to build, and says why once', () => {
        const host = mount(<StockBoard view={view()} status={null} {...ACTIONS} />);

        const build = Array.from(host.querySelectorAll('button'))
            .find(b => b.textContent === 'Build') as HTMLButtonElement;
        expect(build.disabled).toBe(true);
        expect(host.querySelector('#stock-build-reason')!.textContent)
            .toContain('Nothing here is built');
    });

    it('says what installing Companion would allow, once for the whole group', () => {
        const host = mount(<StockBoard view={view()} status={null} {...ACTIONS} />);

        const locked = Array.from(host.querySelectorAll('.pb-stock-locked-row'));
        expect(locked.length).toBeGreaterThan(1);
        expect(locked.every(row => row.getAttribute('aria-disabled') === 'true')).toBe(true);

        const said = Array.from(host.querySelectorAll('.pb-stock-prose'))
            .filter(el => el.textContent!.includes('Install the Companion'));
        expect(said).toHaveLength(1);
        expect(host.querySelector('#stock-locked-reason a')!.getAttribute('href'))
            .toContain('/docs/ide/install/');
    });

    it('asks for one hook to be switched off, by its address in the registry', async () => {
        const flips: unknown[] = [];
        const host = mount(
            <StockBoard view={view()} status={null}
                onSetHook={flip => flips.push(flip)} onOpenFile={noop} />);

        (host.querySelector('.pb-stock-switch') as HTMLInputElement).click();
        await flush();

        expect(flips).toEqual([
            { step: 'specify', when: 'before', index: 0, enabled: false },
        ]);
    });

    it('names the installed commands as the source when there is no workflow file', () => {
        const host = mount(
            <StockBoard view={view({ source: 'commands', workflow: null })}
                status={null} {...ACTIONS} />);

        expect(host.querySelector('.pb-stock-workflow')!.textContent)
            .toBe('The installed commands');
        expect(host.querySelector('#stock-build-reason')!.textContent)
            .toContain('no workflow file');
    });

    it('lists a preset that is applied to the project', () => {
        const host = mount(
            <StockBoard
                view={view({
                    presets: [{
                        id: 'companion-standard', name: 'Companion Standard',
                        description: 'Stock commands with timing capture',
                    }],
                })}
                status={null} {...ACTIONS} />);

        expect(host.querySelector('.pb-stock-preset-name')!.textContent)
            .toBe('Companion Standard');
    });
});
