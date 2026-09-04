/**
 * @jest-environment jsdom
 */
import { Header } from '../Header';
import type { PipelineGraph } from '../../../../src/protocol/pipeline';
import { NO_CHANGES, flush, graph, mount, step } from './support';

afterEach(() => { document.body.innerHTML = ''; });

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
        expect(host.querySelector('.builder-chip')?.textContent).toContain('Changed · 2 steps');
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
        expect(host.querySelector('.builder-chip')?.textContent).toContain('Changed · 1 step');
    });

    it('expands to say what changed', async () => {
        const customised = graph({
            customised: true,
            steps: [step({ changes: { ...NO_CHANGES, removed: ['quality-checklist'], hooks: 2 } })],
        });
        const host = mount(
            <Header graph={customised} buildState="current" busy={false} {...HEAD} />);
        expect(host.querySelector('.builder-chip')?.textContent).toContain('Changed · 1 step');
        expect(host.querySelector('.builder-changes')).toBeNull();

        (host.querySelector('.builder-chip') as HTMLButtonElement).click();
        await new Promise(resolve => setTimeout(resolve, 0));
        const listed = host.querySelector('.builder-changes')?.textContent ?? '';
        expect(listed).toContain('quality-checklist');
        expect(listed).toContain('2 hooks');
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
        const primary = host.querySelector('.builder-action--primary') as HTMLButtonElement;
        expect(primary.disabled).toBe(true);
        expect(primary.textContent).toContain('Building');
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
    // at all, so the board could say "Changed · 1 step" with a line under it
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
        expect(host.querySelector('.builder-chip')?.textContent).toContain('Changed · 1 step');
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
