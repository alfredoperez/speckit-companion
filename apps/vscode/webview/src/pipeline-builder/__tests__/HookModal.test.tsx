/**
 * @jest-environment jsdom
 *
 * Adding a hook from the modal: the place is in the title, the field has the
 * focus, the list narrows as you type and the keyboard alone can add one.
 */
import { HookModal } from '../HookModal';
import { Attachment } from '../AttachForm';
import type { OfferedEntry, PipelineChoices, SkillChoice } from '../../../../src/protocol/pipeline';
import { flush, mount, node, step } from './support';

const COMMANDS: OfferedEntry[] = [
    {
        id: 'speckit.git.commit', label: 'speckit.git.commit',
        note: 'Commits outstanding changes', from: 'git',
    },
    {
        id: 'speckit.companion.after-implement', label: 'speckit.companion.after-implement',
        note: 'Per-task journaling on implement', usually: 'after implement', from: 'companion',
    },
];

const CATALOG: SkillChoice[] = [
    {
        id: 'testing-library-patterns', name: 'testing-library-patterns', source: 'project',
        where: '.claude/skills', description: '', callable: true, enabled: true,
    },
    {
        id: 'superpowers:test-driven-development', name: 'test-driven-development',
        source: 'plugin', where: 'superpowers', description: '', callable: true, enabled: true,
    },
    {
        id: 'run-tests', name: 'run-tests', source: 'user', where: '~/.claude/skills',
        description: '', callable: false, enabled: true,
    },
    {
        id: 'other:test-off', name: 'test-off', source: 'plugin', where: 'other',
        description: '', callable: true, enabled: false,
    },
];

function choices(over: Partial<PipelineChoices> = {}): PipelineChoices {
    return { skills: [], nodes: [], commands: [], fragments: [], presets: [], ...over };
}

const noop = () => undefined;

type Attach = (a: Attachment, keepOpen: boolean) => void;

function modal(over: Partial<PipelineChoices> = {}, onAttach: Attach = noop,
    extra: { anchor?: string; when?: 'before' | 'after'; onCancel?: () => void } = {}) {
    return mount(
        <HookModal step={step()} anchor={extra.anchor ?? 'draft-spec'} when={extra.when}
            choices={choices(over)} onCancel={extra.onCancel ?? noop} onAttach={onAttach} />,
    );
}

function kind(host: HTMLElement, label: string): void {
    (Array.from(host.querySelectorAll('.pb-modal-kind'))
        .find(b => b.getAttribute('aria-label') === label) as HTMLButtonElement).click();
}

async function type(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
}

const search = (host: HTMLElement) => host.querySelector('.pb-modal-search input') as HTMLInputElement;
const key = (el: Element, k: string, shift = false) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey: shift, bubbles: true }));
const rows = (host: HTMLElement) => Array.from(host.querySelectorAll('.pb-modal-row')).map(el => ({
    name: el.querySelector('.pb-modal-row-name')?.textContent ?? '',
    note: el.querySelector('.pb-modal-row-note')?.textContent ?? '',
    warn: Boolean(el.querySelector('.pb-modal-row-note--warn')),
    on: el.getAttribute('aria-selected') === 'true',
}));

afterEach(() => { document.body.innerHTML = ''; });

describe('the modal names the place it opened from', () => {
    it('titles itself with the side and the node, and says the step', () => {
        const host = modal({}, noop, { when: 'after' });
        expect(host.querySelector('.pb-modal-title')?.textContent).toBe('Add after Draft the spec');
        expect(host.querySelector('.pb-modal-where')?.textContent).toBe('in specify');
        expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    });

    it('names a phase as the phase', () => {
        const host = modal({}, noop, { anchor: 'gather' });
        expect(host.querySelector('.pb-modal-title')?.textContent).toBe('Add before the gather phase');
    });

    it('puts the focus in the search field', () => {
        const host = modal();
        expect(document.activeElement).toBe(search(host));
    });

    it('offers the four kinds', () => {
        const host = modal();
        expect(Array.from(host.querySelectorAll('.pb-modal-kind'))
            .map(b => b.getAttribute('aria-label')))
            .toEqual(['Skill', 'Instruction', 'Shell command', 'Node file']);
    });
});

describe('the skill list says where each skill comes from', () => {
    it('reads the catalog: this project, a plugin, yours', async () => {
        const host = modal({ skillCatalog: CATALOG, skills: ['ignored'] });
        await type(search(host), 'test');
        const listed = rows(host);
        expect(listed.map(r => r.name)).toEqual([
            'testing-library-patterns', 'test-driven-development', 'run-tests', 'test-off', 'test',
        ]);
        expect(listed[0].note).toBe('from this project');
        expect(listed[1].note).toBe('from superpowers');
        expect(listed[2].note).toBe('yours · a hook cannot call it');
        expect(listed[2].warn).toBe(true);
        expect(listed[3].note).toBe('from other · its plugin is turned off');
    });

    it('falls back to plain names when there is no catalog', async () => {
        const host = modal({ skills: ['create-pr', 'verify-code-review'] });
        await type(search(host), 'e');
        expect(rows(host).map(r => r.name)).toEqual(['create-pr', 'verify-code-review', 'e']);
        expect(rows(host)[0].note).toBe('');
    });

    it('still takes a name nobody installed, and says so', async () => {
        const made: Attachment[] = [];
        const host = modal({ skills: ['create-pr'] }, a => made.push(a));
        await type(search(host), 'house-check');
        expect(rows(host)).toEqual([
            { name: 'house-check', note: 'not installed', warn: true, on: true },
        ]);
        key(search(host), 'Enter');
        expect(made[0]).toMatchObject({ hookType: 'skill', value: 'house-check' });
    });

    it('writes the catalog id, which is what a plugin skill is called by', async () => {
        const made: Attachment[] = [];
        const host = modal({ skillCatalog: CATALOG }, a => made.push(a));
        await type(search(host), 'driven');
        key(search(host), 'Enter');
        expect(made[0].value).toBe('superpowers:test-driven-development');
    });

    it('says plugin skills are missing when the plugin list could not be read', () => {
        const host = modal({ skillCatalog: [], pluginsRead: false });
        expect(host.textContent).toContain('Plugin skills could not be read');
    });
});

describe('the keyboard adds without leaving the field', () => {
    it('moves with the arrows and adds the highlighted row on Enter', async () => {
        const made: Attachment[] = [];
        const host = modal({ skills: ['create-pr', 'verify-code-review'] }, a => made.push(a),
            { when: 'after' });
        await type(search(host), 'r');
        expect(rows(host).find(r => r.on)?.name).toBe('create-pr');
        key(search(host), 'ArrowDown');
        await flush();
        expect(rows(host).find(r => r.on)?.name).toBe('verify-code-review');
        expect(search(host).getAttribute('aria-activedescendant'))
            .toBe(host.querySelector('.pb-modal-row--on')?.id);
        key(search(host), 'ArrowUp');
        await flush();
        key(search(host), 'Enter');
        expect(made).toEqual([expect.objectContaining({
            anchor: 'draft-spec', boundary: 'node', when: 'after', hookType: 'skill', value: 'create-pr',
        })]);
    });

    it('adds nothing from an empty field', async () => {
        const made: Attachment[] = [];
        const host = modal({ skills: ['create-pr'] }, a => made.push(a));
        key(search(host), 'Enter');
        expect(made).toEqual([]);
        expect((host.querySelector('.pb-action--primary') as HTMLButtonElement).disabled).toBe(true);
    });

    it('closes on Escape and gives the focus back to the "+" that opened it', async () => {
        const plus = document.createElement('button');
        document.body.appendChild(plus);
        plus.focus();
        let closed = 0;
        const host = mount(<div />);
        const { render } = await import('preact');
        const draw = (open: boolean) => render(open ? (
            <HookModal step={step()} anchor="draft-spec" choices={choices()}
                onCancel={() => { closed += 1; draw(false); }} onAttach={noop} />
        ) : null, host);
        draw(true);
        expect(document.activeElement).toBe(search(host));
        key(document.body, 'Escape');
        await flush();
        expect(closed).toBe(1);
        expect(document.activeElement).toBe(plus);
    });

    it('closes on Escape while the result list shows skills', () => {
        let closed = 0;
        const host = modal({ skills: ['create-pr'] }, noop, { onCancel: () => { closed += 1; } });
        expect(search(host).getAttribute('aria-expanded')).toBe('true');
        key(search(host), 'Escape');
        expect(closed).toBe(1);
    });

    it('closes on Escape after text is typed', async () => {
        let closed = 0;
        const host = modal({}, noop, { onCancel: () => { closed += 1; } });
        await type(search(host), 'nothing-like-it');
        expect(search(host).getAttribute('aria-expanded')).toBe('true');
        key(search(host), 'Escape');
        expect(closed).toBe(1);
    });

    it('keeps the focus inside while open', () => {
        const host = modal({ skills: ['create-pr'] });
        const dialog = host.querySelector('[role="dialog"]')!;
        const stops = Array.from(dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])'));
        stops[stops.length - 1].focus();
        key(document.activeElement!, 'Tab');
        expect(document.activeElement).toBe(stops[0]);
        key(document.activeElement!, 'Tab', true);
        expect(document.activeElement).toBe(stops[stops.length - 1]);
    });
});

describe('keep open adds another', () => {
    it('writes, stays open, says what it added and empties the field', async () => {
        const made: Array<[Attachment, boolean]> = [];
        const host = modal({ skills: ['create-pr'] }, (a, keep) => made.push([a, keep]));
        (host.querySelector('.pb-modal-keep input') as HTMLInputElement).click();
        await flush();
        await type(search(host), 'create');
        key(search(host), 'Enter');
        await flush();
        expect(made).toEqual([[expect.objectContaining({ value: 'create-pr' }), true]]);
        expect(host.querySelector('.pb-modal-added')?.textContent).toBe('Added create-pr');
        expect(search(host).value).toBe('');
    });
});

describe('the other kinds', () => {
    it('offers this project\'s commands under Instruction and writes the sentence that runs one', async () => {
        const made: Attachment[] = [];
        const host = modal({ commands: COMMANDS }, a => made.push(a));
        kind(host, 'Instruction');
        await flush();
        (host.querySelector('.pb-pick-open') as HTMLButtonElement).click();
        await flush();
        const options = Array.from(host.querySelectorAll('.pb-menu-option'));
        expect(options.map(el => el.querySelector('.pb-menu-label')?.textContent))
            .toEqual(['speckit.git.commit', 'speckit.companion.after-implement']);
        expect(options[0].querySelector('.pb-menu-note')?.textContent).toContain('from git');
        (options[1] as HTMLButtonElement).click();
        await flush();
        (host.querySelector('.pb-action--primary') as HTMLButtonElement).click();
        expect(made[0]).toMatchObject({
            hookType: 'prompt', value: 'Run `/speckit.companion.after-implement` now.',
        });
    });

    it('takes a typed instruction', async () => {
        const made: Attachment[] = [];
        const host = modal({}, a => made.push(a));
        kind(host, 'Instruction');
        await flush();
        await type(host.querySelector('.pb-modal-area') as HTMLTextAreaElement,
            'Ask me before adding a new dependency.');
        (host.querySelector('.pb-action--primary') as HTMLButtonElement).click();
        expect(made[0]).toMatchObject({ hookType: 'prompt', value: 'Ask me before adding a new dependency.' });
    });

    it('takes a shell line and offers no command list there', async () => {
        const made: Attachment[] = [];
        const host = modal({ commands: COMMANDS }, a => made.push(a));
        kind(host, 'Shell command');
        await flush();
        expect(host.querySelector('.pb-pick-open')).toBeNull();
        await type(host.querySelector('.pb-modal-line') as HTMLInputElement, 'npm run lint-spec');
        (host.querySelector('.pb-action--primary') as HTMLButtonElement).click();
        expect(made[0]).toMatchObject({ hookType: 'command', value: 'npm run lint-spec' });
    });

    it('searches node files under Node file', async () => {
        const made: Attachment[] = [];
        const host = modal({ nodes: ['review', 'lint'], skills: ['create-pr'] }, a => made.push(a));
        kind(host, 'Node file');
        await flush();
        await type(search(host), 'rev');
        expect(rows(host).map(r => r.name)).toEqual(['review', 'rev']);
        key(search(host), 'Enter');
        expect(made[0]).toMatchObject({ hookType: 'node', value: 'review' });
    });

    it('does not carry a value across a kind change', async () => {
        const host = modal({ skills: ['create-pr'] });
        await type(search(host), 'create');
        kind(host, 'Node file');
        await flush();
        expect(search(host).value).toBe('');
    });
});

describe('a saved hook edits in the same modal', () => {
    const hook = (index: number) => ({
        when: 'after' as const, type: 'skill' as const, summary: 'create-pr',
        anchor: 'draft-spec', index, note: 'first',
    });

    function editing(index: number, count: number, made: Attachment[] = []) {
        const moves: Array<'up' | 'down'> = [];
        let removed = 0;
        const host = mount(
            <HookModal step={step()} anchor="draft-spec" choices={choices({ skills: ['create-pr', 'create-pr-x'] })}
                editing={hook(index)} count={count} onCancel={noop}
                onAttach={a => made.push(a)} onRemove={() => { removed += 1; }}
                onMove={direction => moves.push(direction)} />,
        );
        return { host, moves, removed: () => removed };
    }

    const button = (host: HTMLElement, label: string) =>
        Array.from(host.querySelectorAll<HTMLButtonElement>('.pb-order-move'))
            .find(el => el.textContent?.startsWith(label))!;

    it('opens prefilled, on its own entry, with Save', () => {
        const { host } = editing(1, 3);
        expect(host.querySelector('.pb-modal-title')?.textContent).toBe('Edit hook');
        expect(search(host).value).toBe('create-pr');
        expect(rows(host).find(r => r.on)?.name).toBe('create-pr');
        expect(host.querySelector('.pb-action--primary')?.textContent).toBe('Save');
        expect(host.querySelector('.pb-order-place')?.textContent).toBe('2 of 3 after Draft the spec');
    });

    it('saves in place', () => {
        const made: Attachment[] = [];
        const { host } = editing(1, 3, made);
        (host.querySelector('.pb-action--primary') as HTMLButtonElement).click();
        expect(made[0]).toMatchObject({ value: 'create-pr', editIndex: 1, note: 'first' });
        expect(made[0].movedFrom).toBeUndefined();
    });

    it('moves when its side changes, naming where it came from', async () => {
        const made: Attachment[] = [];
        const { host } = editing(1, 3, made);
        (host.querySelectorAll('.pb-modal-runs .pb-menu-trigger')[0] as HTMLButtonElement).click();
        await flush();
        Array.from(host.querySelectorAll<HTMLButtonElement>('.pb-menu-option'))
            .find(el => el.querySelector('.pb-menu-label')?.textContent === 'before')!.click();
        await flush();
        (host.querySelector('.pb-action--primary') as HTMLButtonElement).click();
        expect(made[0]).toMatchObject({
            when: 'before', editIndex: undefined,
            movedFrom: { anchor: 'draft-spec', when: 'after', index: 1 },
        });
    });

    it('keeps Move up focusable at the first place, says why, and does nothing', () => {
        const { host, moves } = editing(0, 2);
        const up = button(host, 'Move up');
        expect(up.getAttribute('aria-disabled')).toBe('true');
        expect(up.textContent).toBe('Move up, already first after Draft the spec');
        up.click();
        expect(moves).toEqual([]);
        button(host, 'Move down').click();
        expect(moves).toEqual(['down']);
    });

    it('removes', () => {
        const { host, removed } = editing(0, 1);
        (host.querySelector('.pb-action--remove') as HTMLButtonElement).click();
        expect(removed()).toBe(1);
        expect(host.querySelector('.pb-modal-keep')).toBeNull();
    });
});

describe('a phase and a node can share a name', () => {
    const shared = step({
        phases: [
            { name: 'gather', hooks: [], nodes: [node()] },
            { name: 'review', hooks: [], nodes: [node({ id: 'review', name: 'Review the work' })] },
        ],
    });

    async function attachTo(label: string): Promise<Attachment> {
        const made: Attachment[] = [];
        const host = mount(
            <HookModal step={shared} anchor="gather" choices={choices()}
                onCancel={noop} onAttach={a => made.push(a)} />,
        );
        (host.querySelectorAll('.pb-modal-runs .pb-menu-trigger')[1] as HTMLButtonElement).click();
        await flush();
        Array.from(host.querySelectorAll<HTMLButtonElement>('.pb-menu-option'))
            .find(el => el.querySelector('.pb-menu-label')?.textContent === label)!.click();
        await flush();
        await type(search(host), 'create-pr');
        key(search(host), 'Enter');
        return made[0];
    }

    it('reports the phase when the phase is picked', async () => {
        expect(await attachTo('the review phase')).toMatchObject({ anchor: 'review', boundary: 'phase' });
    });

    it('reports the node when the node is picked', async () => {
        expect(await attachTo('Review the work')).toMatchObject({ anchor: 'review', boundary: 'node' });
    });

    it('seeds a shared name as the node, the way the writer resolves it', () => {
        const host = mount(
            <HookModal step={shared} anchor="review" choices={choices()}
                onCancel={noop} onAttach={noop} />,
        );
        expect(host.querySelector('.pb-modal-title')?.textContent).toBe('Add before Review the work');
    });
});
