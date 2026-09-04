/**
 * @jest-environment jsdom
 */
import { Inspector } from '../Inspector';
import { AttachForm, Attachment, NewStepForm, NewWorkflowForm } from '../AttachForm';
import { TemplateForm } from '../TemplateForm';
import type { PipelineNode } from '../../../../src/protocol/pipeline';
import { readFileSync } from 'fs';
import { join } from 'path';
import { flush, mount, node, step } from './support';

afterEach(() => { document.body.innerHTML = ''; });

/** Open the inspector's More menu and read back what it offers. */
async function moreOptions(host: HTMLElement): Promise<string[]> {
    const trigger = Array.from(host.querySelectorAll('.pb-more .pb-menu-trigger'))
        .find(el => el.tagName === 'BUTTON') as HTMLButtonElement | undefined;
    if (!trigger) { return []; }
    trigger.click();
    await flush();
    return Array.from(host.querySelectorAll('.pb-more .pb-menu-label'))
        .map(el => el.textContent ?? '');
}

describe('the inspector reads a node here', () => {
    const noop = () => undefined;
    const actions = {
        onClose: noop, onOpenFile: noop, onSave: noop, onRestore: noop, onAttach: noop,
        onUseVariant: noop, onRemove: noop, onMove: noop,
        editable: 'the stored text',
    };

    it('renders the instructions instead of the raw file', () => {
        const host = mount(
            <Inspector node={node({ name: 'Draft the spec' })} step="specify"
                body={'## Write it\n\n- Load `spec-template.md`\n- Keep every section'}
                parts={[]} {...actions} />,
        );
        expect(host.querySelector('.pb-doc-heading')?.textContent).toBe('Write it');
        expect(host.querySelectorAll('.pb-doc-list li')).toHaveLength(2);
        expect(host.querySelector('.pb-doc-inline')?.textContent).toBe('spec-template.md');
    });

    it('names the shared blocks rather than showing the fences', () => {
        const host = mount(
            <Inspector node={node()} step="specify" body="" parts={['timing', 'self-advance']}
                {...actions} />,
        );
        expect(host.querySelector('.pb-doc-parts')?.textContent).toContain('timing, self-advance');
        expect(host.textContent).toContain('no instructions of its own');
    });

    // The board drew a node's optional files and this pane did not, so the same
    // node read as writing less here than on the card beside it.
    it('lists the files it writes only sometimes, the way the board does', () => {
        const host = mount(
            <Inspector step="plan" body="x" parts={[]} {...actions}
                node={node({
                    writes: ['plan.md'],
                    mayWrite: ['data-model.md', 'contracts/api.md'],
                })} />,
        );
        const facts = Array.from(host.querySelectorAll('dt')).map(el => el.textContent);
        expect(facts).toContain('Writes sometimes');
        expect(host.textContent).toContain('data-model.md, contracts/api.md');
    });

    it('says why a node is held in place', () => {
        const host = mount(
            <Inspector node={node({ pinned: 'quality-checklist has to run after it' })}
                step="specify" body="x" parts={[]} {...actions} />,
        );
        expect(host.textContent).toContain('quality-checklist has to run after it');
    });

    // Editing a node is what makes it yours, so there is no separate step to
    // press first. Only a node already yours offers the way back.
    it('offers to edit either node, and to hand a replaced one back', async () => {
        const shipped = mount(
            <Inspector node={node()} step="specify" body="x" parts={[]} {...actions} />);
        expect(shipped.textContent).toContain('Edit');
        expect(shipped.textContent).not.toContain('Make it mine');
        expect(await moreOptions(shipped)).not.toContain('Use the shipped node');

        document.body.innerHTML = '';
        const ours = mount(
            <Inspector node={node({ replaced: true, shipped: true })} step="specify" body="x"
                parts={[]} {...actions} />);
        expect(ours.textContent).toContain('Edit');
        expect(await moreOptions(ours)).toContain('Use the shipped node');
    });

    it('draws Edit as a plain button, keeping purple for what is actually yours', () => {
        const host = mount(
            <Inspector node={node()} step="specify" body="x" parts={[]} {...actions} />);
        const edit = Array.from(host.querySelectorAll('.pb-inspector-action'))
            .find(el => el.textContent === 'Edit')!;
        expect(edit.className).not.toContain('--yours');
    });

    it('opens the file from the header, beside the id it opens', () => {
        const opened: string[] = [];
        const host = mount(
            <Inspector node={node({ id: 'draft-spec' })} step="specify" body="x" parts={[]}
                {...actions} onOpenFile={() => opened.push('yes')} />);
        const open = host.querySelector('.pb-inspector-head .pb-inspector-open') as HTMLButtonElement;
        expect(open.textContent).toBe('Open the file');
        open.click();
        expect(opened).toHaveLength(1);
    });

    // The tick on a node card is a colour; this row is where it is explained.
    it('reads the kind as a phrase, with the card\'s mark beside it', () => {
        const host = mount(
            <Inspector node={node({ kind: 'author' })} step="specify" body="x" parts={[]}
                {...actions} />);
        const kind = host.querySelectorAll('.pb-facts dd')[0];
        expect(kind.querySelector('.pb-kind-tick--author')).not.toBeNull();
        expect(kind.textContent).toContain('author · writes a deliverable');
        expect(kind.querySelector('.pb-facts-note')?.textContent)
            .toContain('marks each kind');

        // Four rows, so a mark is read against the other three rather than alone.
        const rows = Array.from(kind.querySelectorAll('.pb-kind-legend li'));
        expect(rows.map(el => el.querySelector('.pb-kind-legend-name')?.textContent))
            .toEqual(['author', 'gate', 'investigate', 'control']);
        for (const [i, k] of ['author', 'gate', 'investigate', 'control'].entries()) {
            expect(rows[i].querySelector(`.pb-kind-tick--${k}`)).not.toBeNull();
        }
        // The chip belongs to the gate row and to no other.
        expect(kind.querySelectorAll('.pb-kind-chip')).toHaveLength(1);
        expect(rows[1].querySelector('.pb-kind-chip')?.textContent).toBe('gate');
    });

    // Every other row is a fragment; Order was the one full sentence among them.
    // Source has two states, and both have to read the same way.
    it('holds one grammar across every row, in both states of Source', () => {
        const fragments = (over: Partial<PipelineNode>) => {
            document.body.innerHTML = '';
            const host = mount(
                <Inspector node={node({ writes: ['spec.md'], reads: ['resolve-dir'], ...over })}
                    step="specify" body="x" parts={[]} {...actions} />);
            // The legend is a picture of every kind, not one of this node's facts.
            for (const aside of Array.from(
                host.querySelectorAll('.pb-facts-note, .pb-kind-legend'))) {
                aside.remove();
            }
            return Array.from(host.querySelectorAll('.pb-facts dd'))
                .map(el => (el.textContent ?? '').trim());
        };

        const shipped = fragments({});
        expect(shipped).toContain('free to move, into another phase too');
        expect(shipped).toContain('as shipped');
        expect(fragments({ replaced: true })).toContain('yours this project replaced it');
        expect(fragments({ pinned: 'draft-spec has to run after it' }))
            .toContain('held in place: draft-spec has to run after it');

        for (const rows of [shipped, fragments({ replaced: true })]) {
            for (const row of rows) {
                expect(row).toBe(row[0].toLowerCase() + row.slice(1));
                expect(row.endsWith('.')).toBe(false);
            }
        }
    });

    it('edits in place, and saves the stored text rather than the rendered text', async () => {
        const saved: string[] = [];
        const host = mount(
            <Inspector node={node()} step="specify"
                body={'Load `spec-template.md`'} parts={['timing']} {...actions}
                editable={'Load `spec-template.md`\n<!-- speckit-companion:part timing -->'}
                onSave={(text: string) => saved.push(text)} />);

        (Array.from(host.querySelectorAll('.pb-inspector-action'))
            .find(el => el.textContent === 'Edit') as HTMLButtonElement).click();
        await flush();

        const box = host.querySelector('.pb-doc-edit') as HTMLTextAreaElement;
        // The fences come with it: they are where the shared blocks land, and
        // saving the rendered text back would delete every one of them.
        expect(box.value).toContain('speckit-companion:part timing');

        (Array.from(host.querySelectorAll('.pb-inspector-action'))
            .find(el => el.textContent === 'Save') as HTMLButtonElement).click();
        expect(saved).toHaveLength(1);
        expect(saved[0]).toContain('speckit-companion:part timing');
    });

    it('says that saving a shipped node writes your own copy', async () => {
        const host = mount(
            <Inspector node={node()} step="specify" body="x" parts={[]} {...actions} />);
        (Array.from(host.querySelectorAll('.pb-inspector-action'))
            .find(el => el.textContent === 'Edit') as HTMLButtonElement).click();
        await flush();
        expect(host.textContent).toContain('writes your own copy');
        expect(host.textContent).toContain('shipped one is left alone');
    });

    it('waits visibly rather than showing an empty body', () => {
        const host = mount(
            <Inspector node={node()} step="specify" body={null} parts={[]} {...actions} />);
        expect(host.querySelector('.pb-doc-waiting')?.textContent).toBe('Reading…');
    });
});

describe('giving a node back to the shipped one', () => {
    const noop = () => undefined;

    function inspect(over: Partial<PipelineNode>) {
        const host = mount(
            <Inspector node={node(over)} step="specify" body="Words." editable="Words."
                parts={[]} onClose={noop} onOpenFile={noop} onSave={noop}
                onRestore={noop} onAttach={noop} onUseVariant={noop}
                onRemove={noop} onMove={noop} />,
        );
        return moreOptions(host);
    }

    it('offers it for a node this project rewrote', async () => {
        expect(await inspect({ replaced: true, shipped: true }))
            .toContain('Use the shipped node');
    });

    // The bug this exists for: a step handed to one document, or a node someone
    // wrote, is `replaced` and ships nowhere. Giving it "back" deleted the only
    // copy while the configuration still ordered it, and the pipeline read as
    // broken with no way out from inside the panel.
    it('does not offer it for a node that ships nowhere', async () => {
        expect(await inspect({ id: 'specify-ours', replaced: true, shipped: false }))
            .not.toContain('Use the shipped node');
    });

    it('does not offer it for a node the project never touched', async () => {
        expect(await inspect({ replaced: false, shipped: true }))
            .not.toContain('Use the shipped node');
    });

    it('asks for it through the same handler the board used to', async () => {
        const restored: string[] = [];
        const host = mount(
            <Inspector node={node({ replaced: true, shipped: true })} step="specify"
                body="Words." editable="Words." parts={[]} onClose={noop} onOpenFile={noop}
                onSave={noop} onRestore={() => restored.push('yes')} onAttach={noop}
                onUseVariant={noop} onRemove={noop} onMove={noop} />,
        );
        await moreOptions(host);
        (Array.from(host.querySelectorAll('.pb-more .pb-menu-option'))
            .find(el => el.textContent?.startsWith('Use the shipped node')) as HTMLButtonElement)
            .click();
        expect(restored).toHaveLength(1);
    });
});

describe('everything else a node can do, in one menu', () => {
    const noop = () => undefined;
    const actions = {
        onClose: noop, onOpenFile: noop, onSave: noop, onRestore: noop, onAttach: noop,
        onUseVariant: noop, onRemove: noop, onMove: noop, editable: 'x',
    };

    it('moves a node without a mouse, and says so where a reader will hear it', async () => {
        const moves: string[] = [];
        const host = mount(
            <Inspector node={node({ name: 'Draft the spec' })} step="specify" body="x"
                parts={[]} {...actions} onMove={(d: 'up' | 'down') => moves.push(d)} />);
        await moreOptions(host);
        (Array.from(host.querySelectorAll('.pb-more .pb-menu-option'))
            .find(el => el.textContent === 'Move up') as HTMLButtonElement).click();
        await flush();

        expect(moves).toEqual(['up']);
        const live = host.querySelector('[aria-live="polite"]')!;
        expect(live.textContent).toBe('Draft the spec moved up in specify.');
    });

    // A node held in place refuses the move, so offering it is a dead entry.
    it('leaves the moves out for a node that is held in place', async () => {
        const host = mount(
            <Inspector node={node({ pinned: 'draft-spec has to run after it' })} step="specify"
                body="x" parts={[]} {...actions} />);
        expect(await moreOptions(host)).not.toContain('Move up');
    });

    // The stylesheet paints the last entry purple, having no way to match one by
    // name, so the position is load-bearing rather than incidental.
    it('keeps Use the shipped node last, which is what the purple rule targets', async () => {
        const host = mount(
            <Inspector node={node({ replaced: true, shipped: true })} step="specify"
                body="x" parts={[]} {...actions} />);
        const offered = await moreOptions(host);
        expect(offered.at(-1)).toBe('Use the shipped node');
        expect(host.querySelector('.pb-more--restore')).not.toBeNull();
    });

    // Cross-phase movement is still drag-only; these two move within a phase.
    it('stops a node running without deleting it', async () => {
        const removed: string[] = [];
        const host = mount(
            <Inspector node={node()} step="specify" body="x" parts={[]} {...actions}
                onRemove={() => removed.push('yes')} />);
        await moreOptions(host);
        const entry = Array.from(host.querySelectorAll('.pb-more .pb-menu-option'))
            .find(el => el.textContent?.startsWith('Remove from the run'))!;
        expect(entry.textContent).toContain('Keeps the file');
        (entry as HTMLButtonElement).click();
        expect(removed).toHaveLength(1);
    });
});

// The action reads beside the instructions it would be replacing.
describe('replacing a whole step, from its frame', () => {
    const noop = () => undefined;
    const actions = {
        onClose: noop, onOpenFile: noop, onSave: noop, onRestore: noop, onAttach: noop,
        onUseVariant: noop, onRemove: noop, onMove: noop, editable: 'x',
    };
    const frame = node({
        id: '_frame', name: 'specify — the step\'s own instructions', kind: 'control',
        pinned: 'the frame always comes first',
    });

    it('offers it on the frame, with what it costs on the line beneath', async () => {
        const replaced: string[] = [];
        const host = mount(
            <Inspector node={frame} step="specify" body="x" parts={[]} {...actions}
                onReplaceStep={() => replaced.push('yes')} />);
        await moreOptions(host);
        const entry = Array.from(host.querySelectorAll('.pb-more .pb-menu-option'))
            .find(el => el.textContent?.startsWith('Replace the whole step'))!;
        expect(entry.textContent).toContain('Every node, phase and hook in it stops running');
        (entry as HTMLButtonElement).click();
        expect(replaced).toHaveLength(1);
    });

    it('never offers it on a node, which is not a step', async () => {
        const host = mount(
            <Inspector node={node()} step="specify" body="x" parts={[]} {...actions}
                onReplaceStep={noop} />);
        expect(await moreOptions(host)).not.toContain('Replace the whole step');
    });

    // A frame is the step, so there is nothing to take out of the run.
    it('does not offer to remove the frame from the run', async () => {
        const host = mount(
            <Inspector node={frame} step="specify" body="x" parts={[]} {...actions} />);
        expect(await moreOptions(host)).not.toContain('Remove from the run');
    });
});

describe('starting a workflow from something', () => {
    const noop = () => undefined;

    function form(presets = PRESETS, from = '') {
        const made: Array<[string, string]> = [];
        const host = mount(
            <NewWorkflowForm from={from} taken={['shipped']} presets={presets}
                onCancel={noop} onCreate={(name, seed) => made.push([name, seed])} />,
        );
        return { host, made };
    }

    const PRESETS = [
        { name: 'classic', label: 'Classic spec-kit', summary: 'Stock shapes.' },
        { name: 'brownfield', label: 'Brownfield', summary: 'For an existing system.' },
    ];

    const type = (host: HTMLElement, value: string) => {
        const input = host.querySelector('.pb-input--mono') as HTMLInputElement;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    /** Every card's name, in the order they are offered. */
    const cards = (host: HTMLElement) =>
        Array.from(host.querySelectorAll('.pb-choice-label')).map(el => el.textContent);

    it('offers every shipped preset by its label, beside what you run now', () => {
        const { host } = form();
        expect(cards(host))
            .toEqual(['The pipeline as shipped', 'Classic spec-kit', 'Brownfield']);
    });

    // The default is what you are on. A picker that started at a preset would
    // quietly discard the configuration someone is already running.
    it('starts from the workflow in force', async () => {
        const { host, made } = form(PRESETS, 'bugfix');
        type(host, 'mine');
        await flush();
        (host.querySelector('form') as HTMLFormElement)
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(made).toEqual([['mine', 'bugfix']]);
    });

    it('sends the preset someone picked, prefixed so it is not read as a workflow', async () => {
        const { host, made } = form();
        type(host, 'mine');
        (host.querySelectorAll('.pb-choice input')[2] as HTMLInputElement).click();
        await flush();
        (host.querySelector('form') as HTMLFormElement)
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(made).toEqual([['mine', 'preset:brownfield']]);
    });

    it('says what every preset does before any of them is committed to', () => {
        const { host } = form();
        expect(Array.from(host.querySelectorAll('.pb-choice-help')).map(el => el.textContent))
            .toEqual([
                'Your nodes, hooks and templates as they are today.',
                'Stock shapes.',
                'For an existing system.',
            ]);
    });

    it('offers only what you run now when nothing else ships', () => {
        const { host } = form([]);
        expect(cards(host)).toEqual(['The pipeline as shipped']);
    });
});

describe('naming a new step', () => {
    const noop = () => undefined;
    const SEQUENCE = ['specify', 'plan', 'tasks', 'implement'];

    function form() {
        const made: Array<Record<string, string>> = [];
        const host = mount(
            <NewStepForm sequence={SEQUENCE} taken={[...SEQUENCE, 'auto']}
                onCancel={noop} onCreate={step => made.push(step)} />,
        );
        return { host, made };
    }

    const type = (host: HTMLElement, value: string) => {
        const input = host.querySelector('.pb-input--mono') as HTMLInputElement;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const submit = (host: HTMLElement) =>
        (host.querySelector('form') as HTMLFormElement)
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    it('places it after the last step in the run by default', async () => {
        const { host, made } = form();
        type(host, 'review');
        await flush();
        submit(host);
        expect(made[0].after).toBe('implement');
    });

    it('offers to leave it out of the run', () => {
        const { host } = form();
        const options = Array.from(host.querySelectorAll('select option'));
        expect(options[options.length - 1].textContent).toContain('I launch it myself');
    });

    // The name becomes a command, so a space or a capital produces something
    // nobody can type.
    it('refuses a name that cannot be a command', async () => {
        const { host } = form();
        type(host, 'Review This');
        await flush();
        expect(host.querySelector('.pb-field-problem')?.textContent)
            .toContain('it becomes a command');
        expect((host.querySelector('.pb-action--primary') as HTMLButtonElement).disabled)
            .toBe(true);
    });

    it('refuses a name a step already has', async () => {
        const { host } = form();
        type(host, 'plan');
        await flush();
        expect(host.querySelector('.pb-field-problem')?.textContent)
            .toContain('already a step called plan');
    });

    it('says what it will write and what the assistant will be able to run', async () => {
        const { host } = form();
        type(host, 'review');
        await flush();
        const preview = host.querySelector('.pb-form-preview')?.textContent ?? '';
        expect(preview).toContain('.specify/companion/nodes/review/');
        expect(preview).toContain('/speckit.companion.review');
    });

    it('names the display name, and derives it from the name', async () => {
        const { host, made } = form();
        type(host, 'review');
        await flush();
        const labels = Array.from(host.querySelectorAll('.pb-field-label'))
            .map(el => el.textContent);
        expect(labels).toContain('Display name');
        expect(labels).not.toContain('Reads as');
        expect((host.querySelectorAll('.pb-input')[1] as HTMLInputElement).placeholder)
            .toBe('Review');

        submit(host);
        expect(made[0].label).toBe('');
    });

    // A placeholder is an example; the instruction belongs under the field.
    it('gives Writes an example, and says how several files separate', () => {
        const { host } = form();
        const writes = Array.from(host.querySelectorAll('.pb-input--mono'))
            .at(-1) as HTMLInputElement;
        expect(writes.placeholder).toBe('review.md');
        const help = Array.from(host.querySelectorAll('.pb-field-note'))
            .map(el => el.textContent ?? '');
        expect(help.some(line => line.includes('[review.md, notes.md]'))).toBe(true);
        expect(help.some(line => line.includes('empty if the step writes nothing'))).toBe(true);
    });
});

// The tick is a mark on a board that already spends colour on build state, so it
// encodes by weight. Read from the stylesheet because jsdom resolves no cascade.
describe('the kind tick is three steps of one neutral', () => {
    const css = readFileSync(
        join(__dirname, '..', '..', '..', 'styles', 'pipeline-builder.css'), 'utf8');
    const rules = css.slice(css.indexOf('.pb-kind-tick'), css.indexOf('.pb-facts-note'));

    it('spends no hue, so nothing competes with the stale-build amber', () => {
        for (const hue of ['--info', '--warning', '--error', '--success', '--review',
            '--accent', '--purple', '--gray']) {
            expect(rules).not.toContain(hue);
        }
        expect(rules).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    });

    // The legend describes the card, so these are the board lane's tokens and
    // have to stay the board lane's tokens.
    it('gives the four kinds three weights, the ones the card paints', () => {
        const weight = (kind: string) =>
            new RegExp(`--${kind}[^}]*background:\\s*var\\((--[a-z-]+)\\)`).exec(rules)?.[1];
        expect(weight('author')).toBe('--text-body');
        expect(weight('gate')).toBe('--text-secondary');
        expect(weight('investigate')).toBe('--text-muted');
        expect(weight('control')).toBe('--text-muted');
        expect(rules).toMatch(/--investigate,\s*\n\.pb-kind-tick--control/);
    });

    // A chrome token is the colour of the thing behind the tick: `--border` sat at
    // 1.06:1 on a dark panel, under the 3:1 a non-text indicator has to clear.
    it('takes every weight off the foreground, never off the panel chrome', () => {
        expect(rules).not.toContain('var(--border)');
        expect(rules).not.toContain('var(--border-hover)');
    });

    // Two steps of grey at 3px is not a difference every eye makes.
    it('gives the kind that can stop a run a word as well as a weight', () => {
        expect(css).toContain('.pb-kind-chip');
    });
});

describe('the hook form asks for the placement first', () => {
    const noop = () => undefined;
    const CHOICES = {
        skills: ['create-pr', 'verify-code-review'], nodes: [], fragments: [], presets: [],
    };

    function form(anchor = 'draft-spec', when?: 'before' | 'after') {
        const made: Attachment[] = [];
        const host = mount(
            <AttachForm step={step()} anchor={anchor} when={when} choices={CHOICES}
                onCancel={noop} onAttach={a => made.push(a)} />,
        );
        return { host, made };
    }

    const whenShown = (host: HTMLElement) =>
        (host.querySelectorAll('.pb-runs .pb-trigger-text')[0].textContent ?? '').trim();

    const open = async (host: HTMLElement, which: number) => {
        (host.querySelectorAll('.pb-runs .pb-menu-trigger')[which] as HTMLButtonElement).click();
        await flush();
    };

    // The seam under a node and the seam above it opened the same form seeded
    // `before`, so attaching after something meant correcting the form first.
    it('opens on the side of the anchor the button was pressed on', () => {
        expect(whenShown(form('draft-spec', 'after').host)).toBe('after');
        expect(whenShown(form('draft-spec', 'before').host)).toBe('before');
        expect(whenShown(form().host)).toBe('before');
    });

    // "Runs before Draft the spec" is the sentence, so it is read in that order.
    it('puts Runs at the top, as when and where in one row', () => {
        const { host } = form();
        const fields = Array.from(host.querySelectorAll('.pb-field-label'))
            .map(el => el.textContent);
        expect(fields[0]).toBe('Runs');
        expect(host.querySelectorAll('.pb-runs .pb-menu-trigger')).toHaveLength(2);
    });

    it('names the anchor rather than showing its id, in the panel\'s own menu', async () => {
        const { host } = form();
        expect(host.querySelectorAll('.pb-runs select')).toHaveLength(0);
        expect((host.querySelectorAll('.pb-runs .pb-trigger-text')[1].textContent ?? '').trim())
            .toBe('Draft the spec');

        await open(host, 1);
        expect(Array.from(host.querySelectorAll('.pb-menu-label')).map(el => el.textContent))
            .toEqual(['the gather phase', 'Resolve the spec folder', 'the author phase',
                'Draft the spec']);
    });

    it('changes when it runs from the same row', async () => {
        const { host, made } = form();
        await open(host, 0);
        (Array.from(host.querySelectorAll('.pb-menu-option'))
            .find(el => el.textContent?.startsWith('after')) as HTMLButtonElement).click();
        await flush();

        const input = host.querySelector('.pb-input--mono') as HTMLInputElement;
        input.value = 'create-pr';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await flush();
        (host.querySelector('form') as HTMLFormElement)
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(made[0].when).toBe('after');
    });

    // Four help texts at once asked the reader to discard three of them.
    it('shows one help line, for the kind that is selected', async () => {
        const { host } = form();
        const segments = Array.from(host.querySelectorAll('.pb-segment'));
        expect(segments.map(el => el.textContent))
            .toEqual(['Skill', 'Instruction', 'Command', 'Node']);
        expect(host.querySelectorAll('.pb-kind .pb-field-note')).toHaveLength(1);
        expect(host.querySelector('.pb-kind .pb-field-note')?.textContent)
            .toContain('The instructions stay in the skill');

        (segments[2] as HTMLButtonElement).click();
        await flush();
        expect(host.querySelector('.pb-kind .pb-field-note')?.textContent)
            .toContain('needs a terminal');
        expect(host.querySelector('.pb-segment--on')?.textContent).toBe('Command');
    });

    // A radiogroup is one tab stop, and arrows move inside it.
    it('walks the kinds with arrows, on one tab stop', async () => {
        const { host } = form();
        const segments = () => Array.from(host.querySelectorAll('.pb-segment'));
        const stops = () => segments().map(el => el.getAttribute('tabindex'));
        expect(stops()).toEqual(['0', '-1', '-1', '-1']);

        segments()[0].dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await flush();
        expect(host.querySelector('.pb-segment--on')?.textContent).toBe('Instruction');
        expect(stops()).toEqual(['-1', '0', '-1', '-1']);

        segments()[1].dispatchEvent(
            new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        await flush();
        expect(host.querySelector('.pb-segment--on')?.textContent).toBe('Node');

        // Wraps, so the group has no dead end at either edge.
        segments()[3].dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await flush();
        expect(host.querySelector('.pb-segment--on')?.textContent).toBe('Skill');
    });

    // Only a skill hook renders its note; the other three drop it.
    it('asks for a note only where one is rendered', async () => {
        const { host } = form();
        expect(host.querySelector('.pb-note')).not.toBeNull();
        const segment = (label: string) =>
            Array.from(host.querySelectorAll('.pb-segment'))
                .find(el => el.textContent === label) as HTMLButtonElement;

        for (const label of ['Instruction', 'Command', 'Node']) {
            segment(label).click();
            await flush();
            expect(host.querySelector('.pb-note')).toBeNull();
        }
        segment('Skill').click();
        await flush();
        expect(host.querySelector('.pb-note')).not.toBeNull();
    });

    // The renderer reads a note only on a skill hook, so one left behind by a
    // switch shipped a `text:` key into companion.yml that nothing ever reads.
    it('drops a note typed under Skill when the kind changes', async () => {
        const { host, made } = form();
        const segment = (label: string) =>
            Array.from(host.querySelectorAll('.pb-segment'))
                .find(el => el.textContent === label) as HTMLButtonElement;

        const note = host.querySelector('.pb-note .pb-input') as HTMLInputElement;
        note.value = 'read the changelog first';
        note.dispatchEvent(new Event('input', { bubbles: true }));
        await flush();

        segment('Node').click();
        await flush();
        const value = host.querySelector('.pb-field .pb-input') as HTMLInputElement;
        value.value = 'review';
        value.dispatchEvent(new Event('input', { bubbles: true }));
        await flush();
        (host.querySelector('form') as HTMLFormElement)
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        expect(made).toHaveLength(1);
        expect(made[0].note).toBe('');
    });

    it('names the note for what it is, and marks it optional', () => {
        const { host } = form();
        const labels = Array.from(host.querySelectorAll('.pb-field-label'))
            .map(el => el.textContent);
        expect(labels).toContain('Note');
        expect(labels).not.toContain('Anything to add');
        const note = host.querySelector('.pb-note .pb-input') as HTMLInputElement;
        expect(note.placeholder).toBe('Anything the assistant should know first');
        expect(note.getAttribute('aria-label')).toBe('Note to the assistant (optional)');
        expect(host.querySelector('.pb-note .pb-field-help')?.textContent).toBe('optional');
    });

    // An index only means anything under the anchor it was read from. Keeping it
    // while moving the hook replaced whatever sat at that position under the new
    // anchor — destroying an unrelated hook and leaving the original in place.
    const editing = {
        when: 'before' as const, type: 'skill' as const, summary: 'create-pr',
        anchor: 'draft-spec', index: 1, note: '',
    };

    function editForm(anchor = 'draft-spec') {
        const made: Attachment[] = [];
        const host = mount(
            <AttachForm step={step()} anchor={anchor} choices={CHOICES} editing={editing}
                onCancel={noop} onAttach={a => made.push(a)} />,
        );
        return { host, made };
    }

    const send = async (host: HTMLElement) => {
        (host.querySelector('form') as HTMLFormElement)
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await flush();
    };

    const choose = async (host: HTMLElement, label: string) => {
        (Array.from(host.querySelectorAll('.pb-menu-option'))
            .find(el => el.textContent?.startsWith(label)) as HTMLButtonElement).click();
        await flush();
    };

    // A `<button>` in a form submits it unless it says otherwise, and the Runs
    // row is two menus inside the hook form. Picking an option attached the
    // hook there and then — invisible while adding, because an empty value is
    // refused, and live while editing, where the value arrives filled in.
    it('does not attach anything just because a menu was used', async () => {
        const { host, made } = editForm();
        await open(host, 0);
        await choose(host, 'after');
        expect(made).toHaveLength(0);
    });

    it('replaces in place when the hook has not moved', async () => {
        const { host, made } = editForm();
        await send(host);
        expect(made[0].editIndex).toBe(1);
        expect(made[0].movedFrom).toBeUndefined();
    });

    it('does not carry the old index to a new anchor', async () => {
        const { host, made } = editForm();
        await open(host, 1);
        await choose(host, 'Resolve the spec folder');
        await send(host);

        expect(made[0].anchor).toBe('resolve-dir');
        expect(made[0].editIndex).toBeUndefined();
        expect(made[0].movedFrom).toEqual({ anchor: 'draft-spec', when: 'before', index: 1 });
    });

    it('does not carry the old index across a change of side', async () => {
        const { host, made } = editForm();
        await open(host, 0);
        await choose(host, 'after');
        await send(host);

        expect(made[0].when).toBe('after');
        expect(made[0].editIndex).toBeUndefined();
        expect(made[0].movedFrom?.when).toBe('before');
    });
});

describe('the template picker shows what a fragment does', () => {
    const noop = () => undefined;
    const FRAGMENTS = [
        {
            name: 'ears', section: 'User Scenarios', for: '',
            summary: 'Numbered WHEN / THEN / SHALL.',
        },
        {
            name: 'outcomes', section: 'User Scenarios', for: '',
            summary: 'Observable outcomes.',
        },
    ];

    function form(chosen = '') {
        const picked: Array<[string, string]> = [];
        const host = mount(
            <TemplateForm
                step={step({
                    template: {
                        file: 'spec-template.md',
                        sections: chosen ? ['User Scenarios'] : [],
                        sectionsAvailable: ['User Scenarios', 'Requirements'],
                        chosenBy: chosen ? { 'User Scenarios': chosen } : {},
                    },
                })}
                fragments={FRAGMENTS}
                onCancel={noop} onPick={(h, f) => picked.push([h, f])} />,
        );
        return { host, picked };
    }

    it('picks from the panel\'s own menu, each fragment\'s summary on its row', async () => {
        const { host } = form();
        expect(host.querySelectorAll('select')).toHaveLength(0);
        (host.querySelector('.pb-template-pick .pb-menu-trigger') as HTMLButtonElement).click();
        await flush();
        expect(Array.from(host.querySelectorAll('.pb-menu-note')).map(el => el.textContent))
            .toEqual(['The section the way Companion writes it.',
                'Numbered WHEN / THEN / SHALL.', 'Observable outcomes.']);
    });

    it('shows the chosen fragment, and what it does, under the row', () => {
        const { host } = form('ears');
        expect((host.querySelector('.pb-trigger-text')?.textContent ?? '').trim()).toBe('ears');
        expect(host.querySelector('.pb-template-summary')?.textContent)
            .toBe('Numbered WHEN / THEN / SHALL.');
    });

    it('sends an empty fragment, which is how a section goes back to shipped', async () => {
        const { host, picked } = form('ears');
        (host.querySelector('.pb-template-pick .pb-menu-trigger') as HTMLButtonElement).click();
        await flush();
        (Array.from(host.querySelectorAll('.pb-menu-option'))
            .find(el => el.textContent?.startsWith('As shipped')) as HTMLButtonElement).click();
        expect(picked).toEqual([['User Scenarios', '']]);
    });

    it('says the shipped version is all there is, rather than apologising', () => {
        const { host } = form();
        const rows = Array.from(host.querySelectorAll('.pb-template-row'));
        expect(rows[1].querySelector('.pb-template-summary')?.textContent)
            .toBe('Only the shipped version exists for this section.');
        expect(rows[1].querySelector('.pb-menu-trigger--inert')).not.toBeNull();
    });
});
