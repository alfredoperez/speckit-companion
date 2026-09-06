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
import { flush, mount, step } from './support';

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
    it('offers this project\'s commands for the command kind', async () => {
        const host = form({ commands: COMMANDS });
        kind(host, 'Command');
        await flush();
        const rows = await offered(host);
        expect(rows.map(r => r.label)).toEqual(
            ['speckit.git.commit', 'speckit.companion.after-implement']);
    });

    it('says what each one does, where it goes and who registered it', async () => {
        const host = form({ commands: COMMANDS });
        kind(host, 'Command');
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
        kind(host, 'Command');
        await flush();
        (host.querySelector('.pb-pick-open') as HTMLButtonElement).click();
        await flush();
        (host.querySelectorAll('.pb-menu-option')[0] as HTMLButtonElement).click();
        await flush();
        expect((host.querySelector('.pb-input--mono') as HTMLInputElement).value)
            .toBe('speckit.git.commit');

        kind(host, 'Skill');
        await flush();
        expect((host.querySelector('.pb-input--mono') as HTMLInputElement).value).toBe('');
    });

    it('attaches the entry\'s own identifier, exactly as typing it would', async () => {
        const attached: Attachment[] = [];
        const host = form({ commands: COMMANDS }, a => attached.push(a));
        kind(host, 'Command');
        await flush();
        (host.querySelector('.pb-pick-open') as HTMLButtonElement).click();
        await flush();
        (host.querySelectorAll('.pb-menu-option')[1] as HTMLButtonElement).click();
        await flush();
        (host.querySelector('.pb-action--primary') as HTMLButtonElement).click();
        expect(attached).toHaveLength(1);
        expect(attached[0].value).toBe('speckit.companion.after-implement');
        expect(attached[0].hookType).toBe('command');
    });

    it('still takes a name typed by hand', async () => {
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
    });

    it('says the list is empty rather than showing an empty control', async () => {
        const host = form();
        kind(host, 'Command');
        await flush();
        expect(host.querySelector('.pb-pick-open')).toBeNull();
        expect(host.querySelector('.pb-field-help')?.textContent)
            .toContain('Nothing installed to choose from');
    });

    it('shows no picker for an instruction, whose value is prose', async () => {
        const host = form({ commands: COMMANDS });
        kind(host, 'Instruction');
        await flush();
        expect(host.querySelector('.pb-pick-open')).toBeNull();
        expect(host.querySelector('.pb-input--area')).not.toBeNull();
    });
});
