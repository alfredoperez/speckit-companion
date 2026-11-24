/**
 * @jest-environment jsdom
 */
import { Inspector } from '../Inspector';
import { Attachment } from '../AttachForm';
import { HookModal } from '../HookModal';
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
        const open = host.querySelector('.pb-side-head .pb-inspector-open') as HTMLButtonElement;
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
            // The legend is a picture of every kind, not one of this node's
            // facts; the two moves are an action sitting on the sentence.
            for (const aside of Array.from(
                host.querySelectorAll('.pb-facts-note, .pb-kind-legend, .pb-order-move'))) {
                aside.remove();
            }
            return Array.from(host.querySelectorAll('.pb-facts dd'))
                .map(el => (el.textContent ?? '').trim());
        };

        const shipped = fragments({});
        expect(shipped).toContain('free to move');
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

    // The padlock on the card said nothing; the where line says the word.
    it('says a held node is held, in the line under its name', () => {
        const host = mount(
            <Inspector node={node({ pinned: 'draft-spec has to run after it' })} step="specify"
                body="x" parts={[]} {...actions} />);
        const where = host.querySelector('.pb-side-where')!;
        const chip = where.querySelector('.pb-node-gate')!;
        expect(chip.textContent).toBe('held');
        // The padlock this replaced carried the reason; the word has to too.
        expect(chip.getAttribute('title')).toBe('draft-spec has to run after it');
    });

    it('leaves the word off a node that is free to move', () => {
        const host = mount(
            <Inspector node={node()} step="specify" body="x" parts={[]} {...actions} />);
        expect(host.querySelector('.pb-node-gate')).toBeNull();
    });
});

// Five panes shared the slot and two of them kept their own copy of the same
// chrome, styled to nearly match.
describe('every side pane wears one shell', () => {
    const noop = () => undefined;
    const INSPECT = {
        onClose: noop, onOpenFile: noop, onSave: noop, onRestore: noop, onAttach: noop,
        onUseVariant: noop, onRemove: noop, onMove: noop, editable: 'x',
    };
    const CHOICES = { skills: [], nodes: [], commands: [], fragments: [], presets: [] };
    const panes: Array<[string, preact.VNode, string]> = [
        ['the inspector',
            <Inspector node={node()} step="specify" body="x" parts={[]} {...INSPECT} />,
            'Resolve the spec folder'],
    ];

    it.each(panes)('draws %s in it', (_name, pane, title) => {
        const host = mount(pane);
        const aside = host.querySelector('aside.pb-side')!;
        expect(aside).not.toBeNull();
        expect(aside.getAttribute('aria-label')).toBeTruthy();
        expect(aside.querySelector('.pb-side-head .pb-side-title')?.textContent).toBe(title);
        expect(aside.querySelector('.pb-side-head .pb-side-close')).not.toBeNull();
    });

    it('names the close button rather than leaving it a bare mark', () => {
        const host = mount(
            <Inspector node={node()} step="specify" body="x" parts={[]} {...INSPECT} />);
        const close = host.querySelector('.pb-side-close')!;
        expect(close.getAttribute('aria-label')).toBeTruthy();
    });

    it('lets the inspector keep its own rows on the shared aside', () => {
        const host = mount(
            <Inspector node={node()} step="specify" body="x" parts={[]} {...INSPECT} />);
        const aside = host.querySelector('aside')!;
        expect(aside.className.split(' ')).toEqual(['pb-side', 'pb-inspector']);
    });

    it('keeps no second copy of the head anywhere', () => {
        const sheet = readFileSync(
            join(__dirname, '../../../styles/pipeline-builder.css'), 'utf8');
        expect(sheet).not.toContain('.pb-inspector-head');
        expect(sheet).not.toContain('.pb-inspector-title');
        expect(sheet).not.toContain('.pb-inspector-close');
        expect(sheet).not.toContain('.pb-inspector-where');
        expect(sheet.match(/^\.pb-side-head \{/gm)).toHaveLength(1);
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

    // Dragging is pointer-only, so the row that says a node is free to move is
    // the whole keyboard and touch story for moving it.
    it('moves a node from the row that claims it can move, and says aloud what the write said', async () => {
        const moves: string[] = [];
        const host = mount(
            <Inspector node={node({ name: 'Draft the spec' })} step="specify" body="x"
                parts={[]} {...actions} onMove={(d: 'up' | 'down') => moves.push(d)} />);
        const said = mount(
            <Inspector node={node({ name: 'Draft the spec' })} step="specify" body="x"
                parts={[]} {...actions} announce="draft-spec moved in specify" />);
        expect(said.querySelector('[aria-live="polite"]')!.textContent)
            .toBe('draft-spec moved in specify');
        const order = Array.from(host.querySelectorAll('.pb-facts dd'))
            .find(el => el.textContent?.startsWith('free to move'))!;
        const buttons = Array.from(order.querySelectorAll('button'));
        expect(buttons.map(el => el.textContent)).toEqual(['Move up', 'Move down']);
        expect(buttons.every(el => el.tagName === 'BUTTON')).toBe(true);

        buttons[0].click();
        await flush();
        expect(moves).toEqual(['up']);
        const live = host.querySelector('[aria-live="polite"]')!;
        expect(live.textContent).toBe('');

        buttons[1].click();
        await flush();
        expect(moves).toEqual(['up', 'down']);
    });

    // A node held in place refuses the move, so it keeps the reason instead.
    it('gives a held node its reason and no buttons', async () => {
        const host = mount(
            <Inspector node={node({ pinned: 'draft-spec has to run after it' })} step="specify"
                body="x" parts={[]} {...actions} />);
        const order = Array.from(host.querySelectorAll('.pb-facts dd'))
            .find(el => el.textContent?.startsWith('held in place'))!;
        expect(order.querySelectorAll('button')).toHaveLength(0);
        expect(host.querySelectorAll('.pb-order-move')).toHaveLength(0);
        expect(await moreOptions(host)).not.toContain('Move up');
    });

    // Three things, and every one of them costs something.
    it('keeps More to what a node cannot take back on its own', async () => {
        const host = mount(
            <Inspector node={node({ id: '_frame', replaced: true, shipped: true })}
                step="specify" body="x" parts={[]} {...actions} onReplaceStep={() => undefined} />);
        expect(await moreOptions(host))
            .toEqual(['Replace the whole step', 'Use the shipped node']);
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

describe('the hook modal keeps the placement it was opened with', () => {
    const noop = () => undefined;
    const CHOICES = {
        skills: ['create-pr', 'verify-code-review'], nodes: [], commands: [], fragments: [], presets: [],
    };

    function form(anchor = 'draft-spec', when?: 'before' | 'after') {
        const made: Attachment[] = [];
        const host = mount(
            <HookModal step={step()} anchor={anchor} when={when} choices={CHOICES}
                onCancel={noop} onAttach={a => made.push(a)} />,
        );
        return { host, made };
    }

    const whenShown = (host: HTMLElement) =>
        (host.querySelectorAll('.pb-modal-runs .pb-trigger-text')[0].textContent ?? '').trim();

    const open = async (host: HTMLElement, which: number) => {
        (host.querySelectorAll('.pb-modal-runs .pb-menu-trigger')[which] as HTMLButtonElement).click();
        await flush();
    };

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

    const typeIn = async (el: HTMLInputElement, text: string) => {
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await flush();
    };

    const kind = (host: HTMLElement, label: string) =>
        Array.from(host.querySelectorAll('.pb-modal-kind'))
            .find(el => el.getAttribute('aria-label') === label) as HTMLButtonElement;

    it('opens on the side of the anchor the button was pressed on', () => {
        expect(whenShown(form('draft-spec', 'after').host)).toBe('after');
        expect(whenShown(form('draft-spec', 'before').host)).toBe('before');
        expect(whenShown(form().host)).toBe('before');
    });

    it('names the anchor rather than showing its id, in the panel\'s own menu', async () => {
        const { host } = form();
        expect((host.querySelectorAll('.pb-modal-runs .pb-trigger-text')[1].textContent ?? '').trim())
            .toBe('Draft the spec');
        await open(host, 1);
        expect(Array.from(host.querySelectorAll('.pb-menu-label')).map(el => el.textContent))
            .toEqual(['the gather phase', 'Resolve the spec folder', 'the author phase',
                'Draft the spec']);
    });

    it('changes when it runs from the same line, and the title follows', async () => {
        const { host, made } = form();
        await open(host, 0);
        await choose(host, 'after');
        expect(host.querySelector('.pb-modal-title')?.textContent).toBe('Add after Draft the spec');
        await typeIn(host.querySelector('.pb-modal-search input') as HTMLInputElement, 'create-pr');
        await send(host);
        expect(made[0].when).toBe('after');
    });

    it('walks the kinds with arrows, on one tab stop', async () => {
        const { host } = form();
        const kinds = () => Array.from(host.querySelectorAll('.pb-modal-kind'));
        const stops = () => kinds().map(el => el.getAttribute('tabindex'));
        expect(stops()).toEqual(['0', '-1', '-1', '-1']);
        kinds()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await flush();
        expect(host.querySelector('.pb-modal-kind--on')?.getAttribute('aria-label')).toBe('Instruction');
        expect(stops()).toEqual(['-1', '0', '-1', '-1']);
        kinds()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        await flush();
        expect(host.querySelector('.pb-modal-kind--on')?.getAttribute('aria-label')).toBe('Node file');
        kinds()[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await flush();
        expect(host.querySelector('.pb-modal-kind--on')?.getAttribute('aria-label')).toBe('Skill');
    });

    it('asks for a note only where one is rendered', async () => {
        const { host } = form();
        expect(host.querySelector('.pb-modal-note')).not.toBeNull();
        for (const label of ['Instruction', 'Shell command', 'Node file']) {
            kind(host, label).click();
            await flush();
            expect(host.querySelector('.pb-modal-note')).toBeNull();
        }
        kind(host, 'Skill').click();
        await flush();
        const note = host.querySelector('.pb-modal-note') as HTMLInputElement;
        expect(note.getAttribute('aria-label')).toBe('Note to the assistant (optional)');
    });

    it('drops a note typed under Skill when the kind changes', async () => {
        const { host, made } = form();
        await typeIn(host.querySelector('.pb-modal-note') as HTMLInputElement, 'read the changelog first');
        kind(host, 'Node file').click();
        await flush();
        await typeIn(host.querySelector('.pb-modal-search input') as HTMLInputElement, 'review');
        await send(host);
        expect(made).toHaveLength(1);
        expect(made[0].note).toBe('');
    });

    const editing = {
        when: 'before' as const, type: 'skill' as const, summary: 'create-pr',
        anchor: 'draft-spec', index: 1, note: '',
    };

    function editForm(anchor = 'draft-spec') {
        const made: Attachment[] = [];
        const host = mount(
            <HookModal step={step()} anchor={anchor} choices={CHOICES} editing={editing}
                onCancel={noop} onAttach={a => made.push(a)} />,
        );
        return { host, made };
    }

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
        expect(made).toHaveLength(1);
        expect(made[0]).toMatchObject({
            anchor: 'resolve-dir', boundary: 'node', editIndex: undefined,
            movedFrom: { anchor: 'draft-spec', when: 'before', index: 1 },
            hookType: 'skill', value: 'create-pr',
        });
    });

    it('does not carry the old index across a change of side', async () => {
        const { host, made } = editForm();
        await open(host, 0);
        await choose(host, 'after');
        await send(host);
        expect(made).toHaveLength(1);
        expect(made[0]).toMatchObject({
            when: 'after', editIndex: undefined, anchor: 'draft-spec', boundary: 'node', value: 'create-pr',
        });
        expect(made[0].movedFrom?.when).toBe('before');
    });
});
