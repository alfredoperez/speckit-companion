/**
 * @jest-environment jsdom
 */
import { Header } from '../Header';
import type { PipelineGraph, PipelineHook } from '../../../../src/protocol/pipeline';
import { NO_CHANGES, flush, graph, mount, step } from './support';

afterEach(() => { document.body.innerHTML = ''; });

/** Found the way a reader finds it — by the word on it. */
function buildButton(host: HTMLElement): HTMLButtonElement {
    return Array.from(host.querySelectorAll<HTMLButtonElement>('.builder-action'))
        .find(el => /Build/.test(el.textContent ?? ''))!;
}

describe('the header says what this pipeline is', () => {
    const noop = () => undefined;
    const HEAD = {
        onBuild: noop, onPreview: noop, onOpenConfig: noop,
        onSelectWorkflow: noop, onNewWorkflow: noop,
    };

    it('reads as no changes when nothing was changed', () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-chip')?.textContent).toContain('No changes');
    });

    it('counts the steps this project changed', () => {
        const two = graph({
            steps: [
                step({ name: 'specify', changes: { ...NO_CHANGES, hooks: 2 } }),
                step({ name: 'plan' }),
                step({ name: 'implement', changes: { ...NO_CHANGES, replaced: ['draft-spec'] } }),
            ],
        });
        const host = mount(
            <Header graph={two} buildState="current" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-chip')?.textContent).toContain('2 steps differ from shipped');
    });

    it('ignores a graph that claims changes its steps do not have', () => {
        const lying = graph({ customised: true, steps: [step()] });
        const host = mount(
            <Header graph={lying} buildState="current" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-chip')?.textContent).toContain('No changes');
        expect(host.querySelector('.builder-chip')?.className)
            .not.toContain('builder-chip--customised');
    });

    it('ignores a graph that claims nothing changed when a step did', () => {
        const lying = graph({
            customised: false,
            steps: [step({ changes: { ...NO_CHANGES, hooks: 1 } })],
        });
        const host = mount(
            <Header graph={lying} buildState="current" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-chip')?.textContent).toContain('1 step differs from shipped');
    });

    // The board already draws every one of these lines, lane by lane. Printing
    // them again under the header said the whole thing twice and took nobody
    // anywhere; the chip is a way to the lane now, not a second copy of it.
    it('lists nothing, because the board is the list', async () => {
        const customised = graph({
            customised: true,
            steps: [step({ changes: { ...NO_CHANGES, removed: ['quality-checklist'], hooks: 2 } })],
        });
        const host = mount(
            <Header graph={customised} buildState="current" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-chip')?.textContent).toContain('1 step differs from shipped');

        (host.querySelector('.builder-chip') as HTMLButtonElement).click();
        await flush();
        expect(host.querySelector('.builder-changes')).toBeNull();
        expect(host.textContent).not.toContain('quality-checklist');
    });

    it('takes the reader to the first changed step', async () => {
        const shown: string[] = [];
        const two = graph({
            steps: [
                step({ name: 'specify' }),
                step({ name: 'plan', changes: { ...NO_CHANGES, reordered: true } }),
                step({ name: 'tasks', changes: { ...NO_CHANGES, hooks: 1 } }),
            ],
        });
        const host = mount(
            <Header graph={two} buildState="current" busy={false} {...HEAD}
                onShowChanged={name => shown.push(name)} />);
        (host.querySelector('.builder-chip') as HTMLButtonElement).click();
        await flush();
        expect(shown).toEqual(['plan']);
    });

    it('points forward rather than down, because it moves you', () => {
        const host = mount(
            <Header graph={graph({ steps: [step({ changes: { ...NO_CHANGES, hooks: 1 } })] })}
                buildState="current" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-chip-caret')?.textContent).toBe('›');
        expect(host.querySelector('.builder-chip')?.getAttribute('aria-expanded')).toBeNull();
    });

    it('says plainly when the built commands are behind the configuration', () => {
        const host = mount(
            <Header graph={graph()} buildState="stale" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-notice')?.textContent)
            .toContain('still reading the old commands');
    });

    it('says nothing about staleness when the build is current', () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-notice')).toBeNull();
    });

    it('disables the actions while a build is running', () => {
        const host = mount(<Header graph={graph()} buildState="current" busy {...HEAD} />);
        const build = buildButton(host);
        expect(build.disabled).toBe(true);
        expect(build.textContent).toContain('Building');
    });

    it('surfaces a warning the build reported', () => {
        const host = mount(
            <Header graph={graph({ warnings: ['hook anchor nope not in active recipe — skipped'] })}
                buildState="current" busy={false} {...HEAD} />);
        expect(host.textContent).toContain('not in active recipe');
    });
});

describe('switching workflows', () => {
    const noop = () => undefined;

    function header(g: PipelineGraph) {
        const picked: string[] = [];
        let created = 0;
        const host = mount(
            <Header graph={g} buildState="current" busy={false}
                onBuild={noop} onPreview={noop} onOpenConfig={noop}
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

    it('lists every workflow, with shipped explained', async () => {
        const { host } = header(graph({
            workflows: { available: ['shipped', 'bugfix', 'client'], active: '' },
        }));
        (host.querySelector('.builder-workflow-current') as HTMLButtonElement).click();
        await new Promise(resolve => setTimeout(resolve, 0));

        const options = Array.from(host.querySelectorAll('.pb-menu-option'));
        expect(options.map(el => el.textContent)).toEqual([
            'As shippedCompanion with nothing changed', 'bugfix', 'client',
            'New workflow…Starts from the one in force',
        ]);
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

    it('says which dropdown picks the workflow', () => {
        const { host } = header(graph());
        expect(host.querySelector('.builder-workflow-label')?.textContent).toBe('Workflow');
    });

    it('marks the one actually in force, which a menu cannot show by weight', async () => {
        const { host } = header(graph({
            workflows: { available: ['shipped', 'bugfix'], active: 'bugfix' },
        }));
        (host.querySelector('.builder-workflow-current') as HTMLButtonElement).click();
        await flush();
        const options = Array.from(host.querySelectorAll('.pb-menu-option'));
        expect(options[1].textContent).toBe('bugfixIn force');
    });

    describe('running the pipeline as it ships', () => {
        const shipped = (hooks = 2) => graph({
            configured: false,
            workflows: {
                available: ['', 'shipped'], active: 'shipped',
                parked: { file: '.specify/companion.yml', hooks, unplaceable: 0 },
            },
        });

        it('says so, and says what is parked', () => {
            const { host } = header(shipped());
            const notice = host.querySelector('.builder-notice--warning')!;
            expect(notice.textContent).toContain('as it ships');
            expect(notice.textContent).toContain('.specify/companion.yml');
            expect(notice.textContent).toContain('2 hooks of yours');
        });

        it('offers the way back even when nothing resolved as parked', () => {
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
            expect(Array.from(host.querySelectorAll('.builder-action'))
                .some(el => el.textContent?.includes('Open companion.yml'))).toBe(true);
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
                    parked: { file: '.specify/companion.yml', hooks: 1, unplaceable: 2 },
                },
            });
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
                'This projectWhatever .specify/companion.yml says',
                'As shippedCompanion with nothing changed · In force',
                'New workflow…Starts from the one in force',
            ]);
        });

        it('does not tally a parked hook as one that runs', async () => {
            const g = shipped();
            g.steps[0].phases[0].nodes[0].hooks = [{
                when: 'before', type: 'prompt', summary: 'check it',
                anchor: '', index: 0, note: '', parked: true,
            }];
            const { host } = header(g);
            expect(host.querySelector('.builder-tally')?.textContent)
                .toContain('no hooks running');

            (host.querySelector('.builder-tally') as HTMLButtonElement).click();
            await flush();
            expect(Array.from(host.querySelectorAll('.pb-menu-option'))
                .map(el => el.textContent)).toContain('1 hook parked'
                    + 'Written by this project, kept, and not running while the '
                    + 'pipeline is the shipped one');
        });

        it('still offers the parked file to open', () => {
            const { host } = header(shipped());
            expect(Array.from(host.querySelectorAll('.builder-action'))
                .map(el => el.textContent)).toContain('Open companion.yml');
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
            onBuild={noop} onPreview={noop} onOpenConfig={noop}
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
                onBuild={noop} onPreview={noop} onOpenConfig={noop}
                onSelectWorkflow={noop} onNewWorkflow={noop} />);
        const trigger = host.querySelector('.builder-workflow-current') as HTMLButtonElement;
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flush();
        expect(host.querySelector('.pb-menu-list')).not.toBeNull();
    });
});

describe('what a build or a preview did', () => {
    const noop = () => undefined;
    const HEAD = {
        onBuild: noop, onPreview: noop, onOpenConfig: noop,
        onSelectWorkflow: noop, onNewWorkflow: noop,
    };
    const REPORT = {
        ok: true, at: '14:02', commands: 5, changed: [], dryRun: false,
        output: '[build] built 5 commands from .specify/companion.yml',
    };

    it('says nothing until one has run', () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-report')).toBeNull();
    });

    it('reports a build in the panel that asked for it', () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false}
                report={REPORT} {...HEAD} />);
        expect(host.querySelector('.builder-report-line')?.textContent)
            .toBe('Built 14:02 · 5 commands written');
    });

    it('names the commands a preview would change', () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false}
                report={{ ...REPORT, dryRun: true, changed: ['specify', 'implement'] }}
                {...HEAD} />);
        expect(host.querySelector('.builder-report-line')?.textContent)
            .toBe('Preview: 2 of 5 commands would change, specify and implement');
    });

    it('says a preview would change nothing rather than showing an empty list', () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false}
                report={{ ...REPORT, dryRun: true }} {...HEAD} />);
        expect(host.querySelector('.builder-report-line')?.textContent)
            .toBe('Preview: nothing would change in 5 commands');
    });

    it('keeps the whole log one click away', async () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false}
                report={REPORT} {...HEAD} />);
        expect(host.querySelector('.builder-report-log')).toBeNull();
        (host.querySelector('.builder-report .builder-link') as HTMLButtonElement).click();
        await flush();
        expect(host.querySelector('.builder-report-log')?.textContent).toContain('[build] built 5');
    });

    it('replaces the stale line rather than stacking a warning over its own answer', () => {
        const host = mount(
            <Header graph={graph({ steps: [step({ changes: { ...NO_CHANGES, hooks: 1 } })] })}
                buildState="stale" busy={false}
                report={{ ...REPORT, dryRun: true, changed: ['specify'] }} {...HEAD} />);
        expect(host.textContent).not.toContain('not built yet');
        expect(host.querySelector('.builder-report-line')?.textContent).toContain('Preview');
    });

    it('offers no log when the run said nothing', () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false}
                report={{ ...REPORT, output: '' }} {...HEAD} />);
        expect(host.querySelector('.builder-report .builder-link')).toBeNull();
    });

    it('says a failed build wrote nothing', () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false}
                report={{ ...REPORT, ok: false }} {...HEAD} />);
        expect(host.querySelector('.builder-report-line')?.textContent)
            .toContain('nothing was written');
    });
});

describe('the first time a project opens the board', () => {
    const noop = () => undefined;
    const HEAD = {
        onBuild: noop, onPreview: noop, onOpenConfig: noop,
        onSelectWorkflow: noop, onNewWorkflow: noop,
    };

    it('offers no way to open a companion.yml the project does not have', () => {
        const host = mount(
            <Header graph={graph({ configured: false })} buildState="unconfigured"
                busy={false} {...HEAD} />);
        expect(host.textContent).not.toContain('Open companion.yml');
    });

    it('offers it once the project has one', () => {
        const host = mount(
            <Header graph={graph({ configured: true })} buildState="current"
                busy={false} {...HEAD} />);
        expect(host.textContent).toContain('Open companion.yml');
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

    // Editing a node writes `.specify/companion/nodes/...` and no configuration
    // at all, so the board could say "1 step differs from shipped" with a line under it
    // saying this is the pipeline as it ships.
    it('stops saying it once a node has been rewritten, configuration or not', () => {
        const host = mount(
            <Header
                graph={graph({
                    firstRun: true,
                    configured: false,
                    steps: [step({ changes: { ...NO_CHANGES, replaced: ['draft-spec'] } })],
                })}
                buildState="unconfigured" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-chip')?.textContent).toContain('1 step differs from shipped');
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

describe('what the pipeline holds', () => {
    const noop = () => undefined;
    const HEAD = {
        onBuild: noop, onPreview: noop, onOpenConfig: noop,
        onSelectWorkflow: noop, onNewWorkflow: noop,
    };

    const hook = (overrides: Partial<PipelineHook> = {}): PipelineHook => ({
        when: 'before', type: 'skill', summary: 'house-check', anchor: 'specify',
        index: 0, note: '', ...overrides,
    });

    function opened(g = graph()) {
        const host = mount(<Header graph={g} buildState="current" busy={false} {...HEAD} />);
        (host.querySelector('.builder-tally') as HTMLButtonElement).click();
        return host;
    }

    it('says how many hooks are attached, which is the fact you cannot count by eye', () => {
        const host = mount(
            <Header graph={graph({ steps: [step({ hooks: [hook(), hook({ index: 1 })] })] })}
                buildState="current" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-tally')?.textContent).toContain('2 hooks');
    });

    it('says so plainly when there are none', () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-tally')?.textContent).toContain('no hooks');
    });

    // A native `title` on grey mono text is where these went to die.
    it('opens onto the counts the board cannot be asked for', async () => {
        const host = opened();
        await flush();
        const options = Array.from(host.querySelectorAll('.pb-menu-option'));
        expect(options[0].textContent).toBe('1 step · 2 phases · 2 nodes');
    });

    it('separates the project\'s own hooks from the ones extensions registered', async () => {
        const host = opened(graph({
            steps: [step({
                hooks: [hook()],
                stockHooks: [{
                    when: 'after', extension: 'speckit', command: 'speckit-lint',
                    description: 'lints the spec', optional: false, conditional: false,
                }],
            })],
        }));
        await flush();
        const said = Array.from(host.querySelectorAll('.pb-menu-option')).map(el => el.textContent);
        expect(said[1]).toContain('1 hook yours');
        expect(said[2]).toContain('1 hook from extensions');
        expect(said[2]).toContain('shows but does not edit');
    });

    // Three focusable rows that close the sheet and do nothing are a control
    // that fires and changes nothing. These are facts.
    it('offers the counts as facts, not as choices', async () => {
        const host = opened();
        await flush();
        const rows = Array.from(host.querySelectorAll('.pb-menu-option'));
        expect(rows.map(el => el.getAttribute('aria-disabled'))).toEqual(['true']);
    });

    it('leaves out a count nobody has', async () => {
        const host = opened();
        await flush();
        expect(host.textContent).not.toContain('yours');
        expect(host.textContent).not.toContain('from extensions');
    });
});

describe('adding a step', () => {
    const noop = () => undefined;
    const HEAD = {
        onBuild: noop, onPreview: noop, onOpenConfig: noop,
        onSelectWorkflow: noop, onNewWorkflow: noop,
    };

    // It used to be parked past the last lane, behind a horizontal scroll.
    it('offers the way in from the band, not from the far end of the board', async () => {
        let started = 0;
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false} {...HEAD}
                onNewStep={() => { started += 1; }} />);
        const add = host.querySelector('.builder-action--add') as HTMLButtonElement;
        expect(add.textContent).toContain('Add step');
        add.click();
        await flush();
        expect(started).toBe(1);
    });
});

describe('Build earns its fill', () => {
    const noop = () => undefined;
    const HEAD = {
        onBuild: noop, onPreview: noop, onOpenConfig: noop,
        onSelectWorkflow: noop, onNewWorkflow: noop,
    };

    const filled = (host: HTMLElement) =>
        buildButton(host).className.includes('builder-action--primary');

    // A filled, disabled Build was the loudest thing on a fresh project's
    // screen, over a first-run line that is the actual entry point.
    it('stays outlined when there is nothing to build', () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false} {...HEAD} />);
        expect(filled(host)).toBe(false);
    });

    // Every edit here writes to disk and turns the state stale by itself, so a
    // changed step on a current build means the changes ARE built. Keying the
    // fill on divergence left it accented forever on any project that had used
    // the panel — the same false urgency, one state over.
    it('stays outlined when the changes are already built', () => {
        const host = mount(
            <Header graph={graph({ steps: [step({ changes: { ...NO_CHANGES, hooks: 1 } })] })}
                buildState="current" busy={false} {...HEAD} />);
        expect(filled(host)).toBe(false);
    });

    it('stays outlined on a project that has never configured one', () => {
        const host = mount(
            <Header graph={graph()} buildState="unconfigured" busy={false} {...HEAD} />);
        expect(filled(host)).toBe(false);
    });

    it('fills when the built commands are behind', () => {
        const host = mount(
            <Header graph={graph()} buildState="stale" busy={false} {...HEAD} />);
        expect(filled(host)).toBe(true);
    });

    it('fills when nothing has ever been built', () => {
        const host = mount(
            <Header graph={graph()} buildState="never-built" busy={false} {...HEAD} />);
        expect(filled(host)).toBe(true);
    });
});

describe('the header at a docked width', () => {
    const noop = () => undefined;
    const HEAD = {
        onBuild: noop, onPreview: noop, onOpenConfig: noop,
        onSelectWorkflow: noop, onNewWorkflow: noop,
    };

    async function overflow(g = graph({ configured: true })) {
        const host = mount(<Header graph={g} buildState="current" busy={false} {...HEAD} />);
        (host.querySelector('.builder-overflow button') as HTMLButtonElement).click();
        await flush();
        return host;
    }

    it('folds the actions row two cannot hold into one menu', async () => {
        const host = await overflow();
        const said = Array.from(host.querySelectorAll('.pb-menu-option')).map(el => el.textContent);
        expect(said).toEqual(['Add step', 'Open companion.yml', 'Preview build']);
    });

    it('offers no companion.yml the project does not have', async () => {
        const host = await overflow(graph({ configured: false }));
        const said = Array.from(host.querySelectorAll('.pb-menu-option')).map(el => el.textContent);
        expect(said).toEqual(['Add step', 'Preview build']);
    });

    it('names the fold for a screen reader, since it is drawn as a mark', () => {
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-overflow button')?.getAttribute('aria-label'))
            .toBe('More pipeline actions');
    });

    it('runs the same actions the row does', async () => {
        let previewed = 0;
        let started = 0;
        const host = mount(
            <Header graph={graph()} buildState="current" busy={false} {...HEAD}
                onPreview={() => { previewed += 1; }}
                onNewStep={() => { started += 1; }} />);
        const open = async () => {
            (host.querySelector('.builder-overflow button') as HTMLButtonElement).click();
            await flush();
        };
        await open();
        (host.querySelectorAll('.pb-menu-option')[0] as HTMLButtonElement).click();
        await flush();
        await open();
        (host.querySelectorAll('.pb-menu-option')[1] as HTMLButtonElement).click();

        expect([started, previewed]).toEqual([1, 1]);
    });
});

describe('a build that is behind says how much of the work is not in it', () => {
    const noop = () => undefined;
    const HEAD = {
        onBuild: noop, onPreview: noop, onOpenConfig: noop,
        onSelectWorkflow: noop, onNewWorkflow: noop,
    };

    it('counts the changed steps the assistant is not reading', () => {
        const behind = graph({
            steps: [
                step({ name: 'specify', changes: { ...NO_CHANGES, hooks: 2 } }),
                step({ name: 'plan', changes: { ...NO_CHANGES, reordered: true } }),
                step({ name: 'tasks' }),
            ],
        });
        const host = mount(
            <Header graph={behind} buildState="stale" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-notice')?.textContent)
            .toContain('2 changed steps not built yet');
    });
});
