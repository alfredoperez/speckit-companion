/**
 * @jest-environment jsdom
 *
 * Attaching work is a choice from what this project has, not a command name you
 * had to already know. What is worth pinning is the cascade: which list each
 * kind offers, that a kind change does not carry a choice across, and that
 * typing one by hand still works for anything the list lacks.
 */
import { AttachForm, Attachment } from '../AttachForm';
import type { OfferedEntry, PipelineChoices } from '../../../../src/protocol/pipeline';
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

function choices(over: Partial<PipelineChoices> = {}): PipelineChoices {
    return {
        skills: [], nodes: [], commands: [], fragments: [], presets: [], ...over,
    };
}

const noop = () => undefined;

function form(over: Partial<PipelineChoices> = {}, onAttach = noop as (a: Attachment) => void) {
    return mount(
        <AttachForm step={step()} anchor="gather" choices={choices(over)}
            onCancel={noop} onAttach={onAttach} />,
    );
}

function kind(host: HTMLElement, label: string): void {
    const button = Array.from(host.querySelectorAll('.pb-segment'))
        .find(b => b.textContent === label) as HTMLButtonElement;
    button.click();
}

async function offered(host: HTMLElement): Promise<{ label: string; note: string }[]> {
    (host.querySelector('.pb-pick-open') as HTMLButtonElement).click();
    await flush();
    return Array.from(host.querySelectorAll('.pb-menu-option')).map(el => ({
        label: el.querySelector('.pb-menu-label')?.textContent ?? el.textContent ?? '',
        note: el.querySelector('.pb-menu-note')?.textContent ?? '',
    }));
}

describe('the second selector reacts to the first (#646)', () => {
    it('offers this project\'s commands under Instruction, where they can run', async () => {
        // Not under Command: that kind renders a bash fence, and a spec-kit
        // command is dispatched, not shelled. Offered there it would have
        // written a hook that runs nothing.
        const host = form({ commands: COMMANDS });
        kind(host, 'Instruction');
        await flush();
        const rows = await offered(host);
        expect(rows.map(r => r.label)).toEqual(
            ['speckit.git.commit', 'speckit.companion.after-implement']);
    });

    it('says what each one does, where it goes and who registered it', async () => {
        const host = form({ commands: COMMANDS });
        kind(host, 'Instruction');
        await flush();
        const rows = await offered(host);
        expect(rows[0].note).toContain('Commits outstanding changes');
        expect(rows[0].note).toContain('from git');
        expect(rows[1].note).toContain('usually after implement');
    });

    it('offers skills for the skill kind and nodes for the node kind', async () => {
        const host = form({ skills: ['create-pr'], nodes: ['review'], commands: COMMANDS });
        kind(host, 'Skill');
        await flush();
        expect((await offered(host)).map(r => r.label)).toEqual(['create-pr']);
    });

    it('does not carry a choice across a kind change', async () => {
        const host = form({ skills: ['create-pr'], commands: COMMANDS });
        kind(host, 'Instruction');
        await flush();
        (host.querySelector('.pb-pick-open') as HTMLButtonElement).click();
        await flush();
        (host.querySelectorAll('.pb-menu-option')[0] as HTMLButtonElement).click();
        await flush();
        expect((host.querySelector('.pb-input--area') as HTMLTextAreaElement).value)
            .toContain('speckit.git.commit');

        kind(host, 'Skill');
        await flush();
        expect((host.querySelector('.pb-input--mono') as HTMLInputElement).value).toBe('');
    });

    it('writes an instruction that asks for the command, which is what runs it', async () => {
        const attached: Attachment[] = [];
        const host = form({ commands: COMMANDS }, a => attached.push(a));
        kind(host, 'Instruction');
        await flush();
        (host.querySelector('.pb-pick-open') as HTMLButtonElement).click();
        await flush();
        (host.querySelectorAll('.pb-menu-option')[1] as HTMLButtonElement).click();
        await flush();
        (host.querySelector('.pb-action--primary') as HTMLButtonElement).click();
        expect(attached).toHaveLength(1);
        expect(attached[0].hookType).toBe('prompt');
        expect(attached[0].value).toBe('Run `/speckit.companion.after-implement` now.');
    });

    it('leaves what it wrote editable, because it is only a sentence', async () => {
        const attached: Attachment[] = [];
        const host = form({ commands: COMMANDS }, a => attached.push(a));
        kind(host, 'Instruction');
        await flush();
        (host.querySelector('.pb-pick-open') as HTMLButtonElement).click();
        await flush();
        (host.querySelectorAll('.pb-menu-option')[0] as HTMLButtonElement).click();
        await flush();
        const area = host.querySelector('.pb-input--area') as HTMLTextAreaElement;
        area.value = 'Run `/speckit.git.commit` now, but only if the tests are green.';
        area.dispatchEvent(new Event('input', { bubbles: true }));
        await flush();
        (host.querySelector('.pb-action--primary') as HTMLButtonElement).click();
        expect(attached[0].value).toContain('only if the tests are green');
    });

    it('still takes a name typed by hand for a kind that has one', async () => {
        const attached: Attachment[] = [];
        const host = form({ commands: COMMANDS }, a => attached.push(a));
        kind(host, 'Command');
        await flush();
        const input = host.querySelector('.pb-input--mono') as HTMLInputElement;
        input.value = 'npm run lint-spec';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await flush();
        (host.querySelector('.pb-action--primary') as HTMLButtonElement).click();
        expect(attached[0].value).toBe('npm run lint-spec');
        expect(attached[0].hookType).toBe('command');
    });

    it('keeps type-to-filter for the kinds that had it', async () => {
        const host = form({ skills: ['create-pr', 'verify-code-review'] });
        kind(host, 'Skill');
        await flush();
        expect(Array.from(host.querySelectorAll('datalist option'))
            .map(el => el.getAttribute('value')))
            .toEqual(['create-pr', 'verify-code-review']);
    });

    it('says the list is empty rather than showing an empty control', async () => {
        const host = form();
        kind(host, 'Command');
        await flush();
        expect(host.querySelector('.pb-pick-open')).toBeNull();
        expect(host.querySelector('.pb-field-help')?.textContent)
            .toContain('Nothing installed to choose from');
    });

    it('offers no command list under the shell-command kind', async () => {
        // A `command` hook renders as a bash fence, so offering a spec-kit
        // command there would write a hook that runs nothing.
        const host = form({ commands: COMMANDS });
        kind(host, 'Command');
        await flush();
        expect(host.querySelector('.pb-pick-open')).toBeNull();
    });

    it('opens the list toward the panel, not off its edge', async () => {
        const host = form({ commands: COMMANDS });
        kind(host, 'Instruction');
        await flush();
        (host.querySelector('.pb-pick-open') as HTMLButtonElement).click();
        await flush();
        expect(host.querySelector('.pb-menu-list')?.className)
            .toContain('pb-menu-list--right');
    });
});

describe('a saved hook moves from the keyboard', () => {
    const hook = (index: number) => ({
        when: 'after' as const, type: 'skill' as const, summary: 'create-pr',
        anchor: 'draft-spec', index, note: '',
    });

    function editing(index: number, count: number) {
        const moves: Array<'up' | 'down'> = [];
        const host = mount(
            <AttachForm step={step()} anchor="draft-spec" choices={choices()} editing={hook(index)}
                count={count} onCancel={noop} onAttach={noop}
                onMove={direction => moves.push(direction)} />,
        );
        return { host, moves };
    }

    const order = (host: HTMLElement) => Array.from(host.querySelectorAll('.pb-field-label'))
        .find(el => el.textContent === 'Order')?.parentElement ?? null;
    const button = (host: HTMLElement, label: string) =>
        Array.from(host.querySelectorAll<HTMLButtonElement>('.pb-order-move'))
            .find(el => el.textContent?.startsWith(label))!;

    it('shows an Order row only for a hook that already exists', () => {
        expect(order(form())).toBeNull();
        const { host } = editing(1, 3);
        expect(order(host)?.textContent).toContain('2 of 3 after Draft the spec');
    });

    it('keeps Move up focusable at the first place, says why, and does nothing', () => {
        const { host, moves } = editing(0, 2);
        const up = button(host, 'Move up');
        expect(up.getAttribute('aria-disabled')).toBe('true');
        expect(up.disabled).toBe(false);
        expect(up.title).toBe('Already first after Draft the spec');
        expect(up.textContent).toBe('Move up, already first after Draft the spec');
        up.click();
        expect(moves).toEqual([]);
    });

    it('says Move down has nowhere to go at the last place', () => {
        const { host, moves } = editing(1, 2);
        const down = button(host, 'Move down');
        expect(down.getAttribute('aria-disabled')).toBe('true');
        expect(down.title).toBe('Already last after Draft the spec');
        down.click();
        expect(moves).toEqual([]);
    });

    it('asks to move down when there is a place below', () => {
        const { host, moves } = editing(0, 2);
        expect(button(host, 'Move down').getAttribute('aria-disabled')).toBeNull();
        button(host, 'Move down').click();
        expect(moves).toEqual(['down']);
    });
});

describe('a phase and a node can share a name', () => {
    const shared = step({
        phases: [
            { name: 'gather', hooks: [], nodes: [node()] },
            { name: 'review', hooks: [], nodes: [node({ id: 'review', name: 'Review the work' })] },
        ],
    });

    async function attachTo(label: string, seeded = 'gather'): Promise<Attachment> {
        const made: Attachment[] = [];
        const host = mount(
            <AttachForm step={shared} anchor={seeded} choices={choices()}
                onCancel={noop} onAttach={a => made.push(a)} />,
        );
        (host.querySelectorAll('.pb-runs .pb-menu-trigger')[1] as HTMLButtonElement).click();
        await flush();
        Array.from(host.querySelectorAll<HTMLButtonElement>('.pb-menu-option'))
            .find(el => el.querySelector('.pb-menu-label')?.textContent === label)!.click();
        await flush();
        const input = host.querySelector('.pb-input--mono') as HTMLInputElement;
        input.value = 'create-pr';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await flush();
        (host.querySelector('.pb-action--primary') as HTMLButtonElement).click();
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
            <AttachForm step={shared} anchor="review" choices={choices()}
                onCancel={noop} onAttach={noop} />,
        );
        expect(host.querySelectorAll('.pb-runs .pb-trigger-text')[1].textContent?.trim())
            .toBe('Review the work');
    });
});
