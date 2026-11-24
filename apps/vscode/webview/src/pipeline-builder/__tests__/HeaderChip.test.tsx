/**
 * @jest-environment jsdom
 */
import { Header } from '../Header';
import type { PipelineGraph, PipelineHook } from '../../../../src/protocol/pipeline';
import { NO_CHANGES, flush, graph, mount, step } from './support';

afterEach(() => { document.body.innerHTML = ''; });

const noop = () => undefined;
const HEAD = {
    onPreview: noop, onOpenConfig: noop, onSelectWorkflow: noop, onNewWorkflow: noop,
};

/** Opens the header's one menu and reads its rows. */
async function menu(host: HTMLElement): Promise<string[]> {
    (host.querySelector('.builder-overflow button') as HTMLButtonElement).click();
    await flush();
    return Array.from(host.querySelectorAll('.builder-overflow .pb-menu-option'))
        .map(el => el.textContent ?? '');
}

describe('the header is the name and the workflow', () => {
    it('carries no Build: that is the bar at the foot (FR-001)', () => {
        const host = mount(<Header graph={graph()} buildState="stale" busy={false} {...HEAD} />);
        expect(Array.from(host.querySelectorAll('button'))
            .some(el => el.textContent?.trim() === 'Build')).toBe(false);
    });

    it('says the build is current when nothing waits (FR-002)', () => {
        const host = mount(<Header graph={graph()} buildState="current" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-state')?.textContent).toBe('Built, up to date');
    });

    it('says nothing about the build while something waits, since the bar does', () => {
        const host = mount(<Header graph={graph()} buildState="stale" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-state')).toBeNull();
    });

    it('says there is nothing to build on a project that has no configuration', () => {
        const host = mount(
            <Header graph={graph()} buildState="unconfigured" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-state')?.textContent).toBe('Nothing to build');
    });

    it('folds every other action into one menu', async () => {
        const host = mount(
            <Header graph={graph({ configured: true })} buildState="current" busy={false} {...HEAD} />);
        expect((await menu(host)).slice(0, 4))
            .toEqual(['Add step', 'Open companion.yml', 'Preview build', 'Spec Kit presets']);
    });

    it('offers no companion.yml the project does not have', async () => {
        const host = mount(
            <Header graph={graph({ configured: false })} buildState="unconfigured" busy={false} {...HEAD} />);
        expect(await menu(host)).not.toContain('Open companion.yml');
    });

    it('names the menu for a screen reader, since it is drawn as a mark', () => {
        const host = mount(<Header graph={graph()} buildState="current" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-overflow button')?.getAttribute('aria-label'))
            .toBe('More pipeline actions');
    });

    it('runs every action it lists', async () => {
        const fired: string[] = [];
        const host = mount(
            <Header graph={graph({ configured: true })} buildState="current" busy={false} {...HEAD}
                onNewStep={() => fired.push('step')}
                onOpenConfig={() => fired.push('open')}
                onPreview={() => fired.push('preview')}
                onOpenPresets={() => fired.push('presets')} />);
        for (const name of ['Add step', 'Open companion.yml', 'Preview build', 'Spec Kit presets']) {
            await menu(host);
            Array.from(host.querySelectorAll<HTMLButtonElement>('.pb-menu-option'))
                .find(el => el.textContent === name)!.click();
            await flush();
        }
        expect(fired).toEqual(['step', 'open', 'preview', 'presets']);
    });

    it('cannot preview while a build runs', async () => {
        const host = mount(<Header graph={graph()} buildState="current" busy {...HEAD} />);
        await menu(host);
        const preview = Array.from(host.querySelectorAll('.pb-menu-option'))
            .find(el => el.textContent === 'Preview build');
        expect(preview?.getAttribute('aria-disabled')).toBe('true');
    });

    it('surfaces a warning the graph reported', () => {
        const host = mount(
            <Header graph={graph({ warnings: ['hook anchor nope not in active recipe — skipped'] })}
                buildState="current" busy={false} {...HEAD} />);
        expect(host.textContent).toContain('not in active recipe');
    });
});

describe('what the pipeline holds, at the foot of the menu', () => {
    const hook = (overrides: Partial<PipelineHook> = {}): PipelineHook => ({
        when: 'before', type: 'skill', summary: 'house-check', anchor: 'specify',
        index: 0, note: '', ...overrides,
    });

    it('reads the shape and the hooks as one fact', async () => {
        const host = mount(
            <Header graph={graph({ steps: [step({ hooks: [hook(), hook({ index: 1 })] })] })}
                buildState="current" busy={false} {...HEAD} />);
        expect(await menu(host)).toContain('1 step · 2 phases · 2 nodes2 hooks');
    });

    it('separates the project\'s own hooks from the ones extensions registered', async () => {
        const host = mount(<Header graph={graph({
            steps: [step({
                hooks: [hook()],
                stockHooks: [{
                    when: 'after', extension: 'speckit', command: 'speckit-lint',
                    description: 'lints the spec', optional: false, conditional: false,
                }],
            })],
        })} buildState="current" busy={false} {...HEAD} />);
        const said = await menu(host);
        expect(said.some(line => line.startsWith('1 hook yours'))).toBe(true);
        expect(said.some(line => line.startsWith('1 hook from extensions'))).toBe(true);
    });

    it('offers the counts as facts, not as choices', async () => {
        const host = mount(<Header graph={graph()} buildState="current" busy={false} {...HEAD} />);
        await menu(host);
        const shape = Array.from(host.querySelectorAll('.pb-menu-option'))
            .find(el => el.textContent?.startsWith('1 step'));
        expect(shape?.getAttribute('aria-disabled')).toBe('true');
    });

    it('stops saying the first-run line once a node changed', () => {
        const host = mount(
            <Header graph={graph({
                firstRun: true, configured: false,
                steps: [step({ changes: { ...NO_CHANGES, replaced: ['draft-spec'] } })],
            })} buildState="unconfigured" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-notice--info')).toBeNull();
    });
});

describe('switching workflows', () => {
    const noop = () => undefined;

    function header(g: PipelineGraph) {
        const picked: string[] = [];
        let created = 0;
        const host = mount(
            <Header graph={g} buildState="current" busy={false}
                onPreview={noop} onOpenConfig={noop}
                onSelectWorkflow={name => picked.push(name)}
                onNewWorkflow={() => { created += 1; }} />,
        );
        return { host, picked, count: () => created };
    }

    it('names the workflow in force', () => {
        const { host } = header(graph({
            workflows: { available: ['shipped', 'bugfix'], active: 'bugfix' },
        }));
        expect(host.querySelector('.builder-workflow-current')?.textContent).toContain('bugfix');
    });

    it('calls an unnamed configuration what it is, not blank', () => {
        const { host } = header(graph());
        expect(host.querySelector('.builder-workflow-current')?.textContent)
            .toContain('This project');
    });

    it('lists every workflow, with shipped explained and the saved ones grouped (FR-008)', async () => {
        const { host } = header(graph({
            workflows: { available: ['shipped', 'bugfix', 'client'], active: '' },
        }));
        (host.querySelector('.builder-workflow-current') as HTMLButtonElement).click();
        await new Promise(resolve => setTimeout(resolve, 0));

        const options = Array.from(host.querySelectorAll('.pb-menu-option'));
        expect(options.map(el => el.textContent)).toEqual([
            'ShippedNothing changed', 'bugfix', 'client',
            'New workflow…Starts from Shipped, This project or a preset',
        ]);
        expect(host.querySelector('.pb-menu-group')?.textContent).toBe('Saved');
    });

    it('reports the one someone picked', async () => {
        const { host, picked } = header(graph({
            workflows: { available: ['shipped', 'bugfix'], active: '' },
        }));
        (host.querySelector('.builder-workflow-current') as HTMLButtonElement).click();
        await new Promise(resolve => setTimeout(resolve, 0));
        (host.querySelectorAll('.pb-menu-option')[1] as HTMLButtonElement).click();

        expect(picked).toEqual(['bugfix']);
    });

    it('offers to start a new one', async () => {
        const { host, count } = header(graph());
        (host.querySelector('.builder-workflow-current') as HTMLButtonElement).click();
        await new Promise(resolve => setTimeout(resolve, 0));
        const options = host.querySelectorAll('.pb-menu-option');
        (options[options.length - 1] as HTMLButtonElement).click();

        expect(count()).toBe(1);
    });

    it('sits beside the title that says what it picks', () => {
        const { host } = header(graph());
        expect(host.querySelector('.builder-title')?.textContent).toBe('Workflow');
    });

    it('marks the one actually in force, which a menu cannot show by weight', async () => {
        const { host } = header(graph({
            workflows: { available: ['shipped', 'bugfix'], active: 'bugfix' },
        }));
        (host.querySelector('.builder-workflow-current') as HTMLButtonElement).click();
        await flush();
        const options = Array.from(host.querySelectorAll('.pb-menu-option'));
        expect(options.map(el => el.getAttribute('aria-checked'))).toEqual(['false', 'true', null]);
        expect(options[1].getAttribute('role')).toBe('menuitemradio');
        expect(options[1].querySelector('.pb-menu-trail')?.textContent).toBe('built');
    });

    it('says a switched workflow is selected and not built (FR-009)', () => {
        const host = mount(
            <Header graph={graph({ workflows: { available: ['shipped', 'bugfix'], active: 'bugfix' } })}
                buildState="stale" busy={false} selectedNotBuilt {...HEAD} />);
        expect(host.querySelector('.builder-state--selected')?.textContent).toBe('Selected, not built');
        expect(host.textContent).not.toContain('Built, up to date');
    });

    it('says nothing about a selection when none was made here', () => {
        const host = mount(
            <Header graph={graph()} buildState="stale" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-state--selected')).toBeNull();
    });

    describe('running the pipeline as it ships', () => {
        // Parked hooks go on the board, because that is where the header now
        // counts them: one number, from the thing the reader is looking at.
        const shipped = (hooks = 2) => {
            const g = graph({
                configured: false,
                workflows: {
                    available: ['', 'shipped'], active: 'shipped',
                    parked: { file: '.specify/companion.yml', unplaceable: 0, warnings: [] },
                },
            });
            g.steps[0].phases[0].nodes[0].hooks = Array.from({ length: hooks }, (_, i) => ({
                when: 'before' as const, type: 'prompt' as const, summary: `parked ${i}`,
                anchor: '', index: i, note: '', parked: true,
            }));
            return g;
        };

        it('says so, and says what is parked', () => {
            const { host } = header(shipped());
            const notice = host.querySelector('.builder-notice--warning')!;
            expect(notice.textContent).toContain('as it ships');
            expect(notice.textContent).toContain('.specify/companion.yml');
            expect(notice.textContent).toContain('2 hooks of yours');
        });

        it('offers the way back even when nothing resolved as parked', async () => {
            // A config the builder could not read parks nothing, and that is the
            // project that most needs the way back and the way into the file.
            const g = graph({
                configured: false,
                workflows: {
                    available: ['', 'shipped'], active: 'shipped', parked: null,
                },
            });
            const { host, picked } = header(g);
            const back = Array.from(host.querySelectorAll('.builder-link'))
                .find(el => el.textContent?.includes('this project')) as HTMLButtonElement;
            expect(back).toBeTruthy();
            back.click();
            expect(picked).toEqual(['']);
            expect(await menu(host)).toContain('Open companion.yml');
        });

        it('the notice and the tally never disagree', () => {
            // A hook whose anchor names both a phase and a node is drawn twice
            // and was counted once, so the notice said one number and the menu
            // beside it said another.
            const g = shipped(0);
            const hook = {
                when: 'before' as const, type: 'prompt' as const, summary: 'both',
                anchor: '', index: 0, note: '', parked: true,
            };
            g.steps[0].phases[0].hooks = [hook];
            g.steps[0].phases[0].nodes[0].hooks = [hook];
            const notice = header(g).host.querySelector('.builder-notice--warning')!;
            expect(notice.textContent).toContain('2 hooks of yours');
        });

        it('says what the parked resolve could not work out at all', () => {
            const g = shipped(0);
            g.workflows.parked = {
                file: '.specify/companion.yml', unplaceable: 0,
                warnings: ["hook anchor 'plan-docc' for plan.after not in active recipe"],
            };
            const notice = header(g).host.querySelector('.builder-notice--warning')!;
            expect(notice.textContent).toContain('plan-docc');
        });

        it('does not claim a hook is parked when none is', () => {
            const { host } = header(graph({
                configured: false,
                workflows: {
                    available: ['', 'shipped'], active: 'shipped', parked: null,
                },
            }));
            const notice = host.querySelector('.builder-notice--warning')!;
            expect(notice.textContent).toContain('as it ships');
            expect(notice.textContent).not.toContain('parked');
        });

        it('says when a parked hook has nowhere on the board to go', () => {
            const g = graph({
                configured: false,
                workflows: {
                    available: ['', 'shipped'], active: 'shipped',
                    parked: { file: '.specify/companion.yml', unplaceable: 2, warnings: [] },
                },
            });
            g.steps[0].phases[0].nodes[0].hooks = [{
                when: 'before', type: 'prompt', summary: 'drawn one',
                anchor: '', index: 0, note: '', parked: true,
            }];
            const notice = header(g).host.querySelector('.builder-notice--warning')!;
            expect(notice.textContent).toContain('1 hook of yours');
            expect(notice.textContent).toContain('2 hooks');
            expect(notice.textContent).toContain('nowhere to draw');
        });

        it('switches back to the project in one click', () => {
            const { host, picked } = header(shipped());
            const back = Array.from(host.querySelectorAll('.builder-link'))
                .find(el => el.textContent?.includes('this project')) as HTMLButtonElement;
            back.click();
            expect(picked).toEqual(['']);
        });

        it('offers the project as a workflow so the switch can be undone', async () => {
            const { host } = header(shipped());
            (host.querySelector('.builder-workflow-current') as HTMLButtonElement).click();
            await flush();
            expect(Array.from(host.querySelectorAll('.pb-menu-option'))
                .map(el => el.textContent)).toEqual([
                'ShippedNothing changedbuilt',
                'This projectWhatever .specify/companion.yml says',
                'New workflow…Starts from Shipped, This project or a preset',
            ]);
        });

        it('does not tally a parked hook as one that runs', async () => {
            const { host } = header(shipped(1));
            const said = await menu(host);
            expect(said.some(line => line.endsWith('no hooks running'))).toBe(true);
            expect(said).toContain('1 hook parked'
                + 'Written by this project, kept, and not running while the '
                + 'pipeline is the shipped one');
        });

        it('still offers the parked file to open', async () => {
            const { host } = header(shipped());
            expect(await menu(host)).toContain('Open companion.yml');
        });

        it('says nothing about parking when the project runs its own pipeline', () => {
            const { host } = header(graph({ configured: true }));
            expect(host.querySelector('.builder-notice--warning')).toBeNull();
        });
    });

    it('names the switcher for a screen reader, not just on screen', () => {
        const { host } = header(graph({
            workflows: { available: ['shipped', 'bugfix'], active: 'bugfix' },
        }));
        expect(host.querySelector('.builder-workflow-current')?.getAttribute('aria-label'))
            .toBe('Workflow: bugfix');
    });
});

describe('the workflow menu answers the keyboard', () => {
    const noop = () => undefined;

    // Moving the focus happens in an effect, and preact runs effects after the
    // paint — which jsdom times to a frame rather than to the next tick.
    const painted = () => new Promise(resolve =>
        requestAnimationFrame(() => setTimeout(resolve, 0)));

    async function opened() {
        const host = mount(
            <Header graph={graph({
                workflows: { available: ['shipped', 'bugfix', 'client'], active: '' },
            })} buildState="current" busy={false}
            onPreview={noop} onOpenConfig={noop}
            onSelectWorkflow={noop} onNewWorkflow={noop} />,
        );
        const trigger = host.querySelector('.builder-workflow-current') as HTMLButtonElement;
        trigger.click();
        await painted();
        return {
            host, trigger,
            items: () => Array.from(host.querySelectorAll<HTMLButtonElement>('.pb-menu-option')),
            press: (key: string) => host.querySelector('.pb-menu-list')!.dispatchEvent(
                new KeyboardEvent('keydown', { key, bubbles: true })),
        };
    }

    it('puts the keyboard on the first entry when it opens', async () => {
        const { items } = await opened();
        expect(document.activeElement).toBe(items()[0]);
    });

    it('walks down and wraps round', async () => {
        const { items, press } = await opened();
        press('ArrowDown');
        expect(document.activeElement).toBe(items()[1]);
        press('ArrowUp');
        expect(document.activeElement).toBe(items()[0]);
        press('ArrowUp');
        expect(document.activeElement).toBe(items().at(-1));
    });

    it('jumps to either end', async () => {
        const { items, press } = await opened();
        press('End');
        expect(document.activeElement).toBe(items().at(-1));
        press('Home');
        expect(document.activeElement).toBe(items()[0]);
    });

    it('closes on Escape and hands the keyboard back to the trigger', async () => {
        const { host, trigger } = await opened();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await painted();
        expect(host.querySelector('.pb-menu-list')).toBeNull();
        expect(document.activeElement).toBe(trigger);
    });

    it('opens on the down arrow, so the keyboard never has to guess', async () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false}
                onPreview={noop} onOpenConfig={noop}
                onSelectWorkflow={noop} onNewWorkflow={noop} />);
        const trigger = host.querySelector('.builder-workflow-current') as HTMLButtonElement;
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flush();
        expect(host.querySelector('.pb-menu-list')).not.toBeNull();
    });
});

describe('the first time a project opens the board', () => {
    const noop = () => undefined;
    const HEAD = {
        onPreview: noop, onOpenConfig: noop,
        onSelectWorkflow: noop, onNewWorkflow: noop,
    };

    it('offers no way to open a companion.yml the project does not have', () => {
        const host = mount(
            <Header graph={graph({ configured: false })} buildState="unconfigured"
                busy={false} {...HEAD} />);
        expect(host.textContent).not.toContain('Open companion.yml');
    });

    it('offers it once the project has one', async () => {
        const host = mount(
            <Header graph={graph({ configured: true })} buildState="current"
                busy={false} {...HEAD} />);
        expect(await menu(host)).toContain('Open companion.yml');
    });

    it('says what the board is and what Build does with it', () => {
        const host = mount(
            <Header graph={graph({ firstRun: true })} buildState="unconfigured"
                busy={false} {...HEAD} />);
        const said = host.querySelector('.builder-notice--info')?.textContent ?? '';
        expect(said).toContain('This is the pipeline as it ships');
        expect(said).toContain('companion.yml');
    });

    it('says it once — not again after it has been read', () => {
        const host = mount(
            <Header graph={graph({ firstRun: false })} buildState="unconfigured"
                busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-notice--info')).toBeNull();
    });

    it('stops saying it once the project has a configuration of its own', () => {
        const host = mount(
            <Header graph={graph({ firstRun: true, configured: true })} buildState="current"
                busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-notice--info')).toBeNull();
    });

    it('reports the dismissal, so the panel can remember it', async () => {
        let dismissed = 0;
        const host = mount(
            <Header graph={graph({ firstRun: true })} buildState="unconfigured"
                busy={false} {...HEAD} onDismissFirstRun={() => { dismissed += 1; }} />);
        (host.querySelector('.builder-notice--info .builder-link') as HTMLButtonElement).click();
        await flush();
        expect(dismissed).toBe(1);
    });
});
