/**
 * @jest-environment jsdom
 */
import { render } from 'preact';
import { DocumentModal, SectionPick } from '../DocumentModal';
import { documentNodeId } from '../documentNode';
import type { PipelineFragment } from '../../../../src/protocol/pipeline';
import { flush, mount, node, step } from './support';

afterEach(() => { document.body.innerHTML = ''; });

const PLAN = step({
    name: 'plan',
    phases: [{
        name: 'author', hooks: [], nodes: [
            node({ id: 'gather', name: 'Gather context' }),
            node({ id: 'plan-doc', name: 'Write the plan', kind: 'author', writes: ['plan.md'] }),
        ],
    }],
    template: {
        file: 'plan-template.md',
        sections: ['Constitution Check'],
        sectionsAvailable: ['Summary', 'Constitution Check', 'Complexity Tracking'],
        chosenBy: { 'Constitution Check': 'house-rules' },
    },
});

const FRAGMENTS: PipelineFragment[] = [
    { name: 'house-rules', section: 'Constitution Check', for: 'plan', summary: 'A house rules list' },
    { name: 'ears', section: 'Constitution Check', for: 'plan', summary: 'Numbered requirements' },
    { name: 'brief', section: 'Summary', for: 'plan', summary: 'One short paragraph' },
    { name: 'elsewhere', section: 'Summary', for: 'specify', summary: 'Not for plan' },
];

function open(overrides: Partial<Parameters<typeof DocumentModal>[0]> = {}) {
    const saved: SectionPick[][] = [];
    let cancelled = 0;
    const host = mount(
        <DocumentModal step={PLAN} nodeName="Write the plan" fragments={FRAGMENTS}
            savesTo="companion.yml" onCancel={() => { cancelled += 1; }}
            onSave={picks => saved.push(picks)} {...overrides} />,
    );
    return { host, saved, cancelled: () => cancelled };
}

const row = (host: HTMLElement, heading: string) =>
    Array.from(host.querySelectorAll<HTMLElement>('.pb-dm-row'))
        .find(el => el.querySelector('.pb-dm-heading')?.textContent === heading)!;

async function expand(host: HTMLElement, heading: string) {
    row(host, heading).querySelector<HTMLButtonElement>('.pb-dm-row-head')!.click();
    await flush();
}

const button = (host: HTMLElement, text: string) =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
        .find(el => el.textContent?.trim() === text
            || el.querySelector('.pb-dm-option-name')?.textContent === text)!;

describe('the document a node writes', () => {
    it('is edited from the node that writes the file', () => {
        expect(documentNodeId(PLAN)).toBe('plan-doc');
    });

    it('falls back to the first authoring node when no node names the file', () => {
        const other = { ...PLAN, template: { ...PLAN.template!, file: 'notes-template.md' } };
        expect(documentNodeId(other)).toBe('plan-doc');
    });

    it('names the file, who writes it and how many sections it has', () => {
        const { host } = open();
        expect(host.querySelector('.pb-modal-title')?.textContent).toBe('Document: plan.md');
        expect(host.querySelector('.pb-modal-where')?.textContent)
            .toBe('Written by Write the plan, in plan · 3 sections');
    });

    it('lists every section, shipped or yours with the fragment', () => {
        const { host } = open();
        expect(Array.from(host.querySelectorAll('.pb-dm-heading')).map(el => el.textContent))
            .toEqual(['Summary', 'Constitution Check', 'Complexity Tracking']);
        expect(row(host, 'Summary').querySelector('.pb-dm-status')?.textContent).toBe('Shipped');
        expect(row(host, 'Constitution Check').querySelector('.pb-dm-status')?.textContent)
            .toBe('yours · house-rules');
    });

    it('opens a section to the fragments written for it, the chosen one marked', async () => {
        const { host } = open();
        await expand(host, 'Constitution Check');
        const options = Array.from(row(host, 'Constitution Check').querySelectorAll('.pb-dm-option'));
        expect(options.map(el => el.querySelector('.pb-dm-option-name')?.textContent))
            .toEqual(['house-rules', 'ears']);
        expect(options[0].getAttribute('aria-pressed')).toBe('true');
        expect(row(host, 'Constitution Check').textContent).toContain('Restore shipped');
    });

    it('offers no Restore on a section still shipped', async () => {
        const { host } = open();
        await expand(host, 'Summary');
        expect(row(host, 'Summary').textContent).not.toContain('Restore shipped');
        expect(row(host, 'Summary').textContent).not.toContain('Not for plan');
    });

    it('sends only the sections whose pick changed, on Done', async () => {
        const { host, saved } = open();
        await expand(host, 'Summary');
        button(host, 'brief').click();
        await flush();
        expect(saved).toHaveLength(0);
        button(host, 'Done').click();
        expect(saved).toEqual([[{ heading: 'Summary', fragment: 'brief' }]]);
    });

    it('restores the shipped section as an empty fragment', async () => {
        const { host, saved } = open();
        await expand(host, 'Constitution Check');
        button(host, 'Restore shipped').click();
        await flush();
        expect(row(host, 'Constitution Check').querySelector('.pb-dm-status')?.textContent).toBe('Shipped');
        button(host, 'Done').click();
        expect(saved).toEqual([[{ heading: 'Constitution Check', fragment: '' }]]);
    });

    it('writes nothing on Cancel or Escape', async () => {
        const { host, saved, cancelled } = open();
        await expand(host, 'Summary');
        button(host, 'brief').click();
        button(host, 'Cancel').click();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(saved).toHaveLength(0);
        expect(cancelled()).toBe(2);
    });

    it('outlines the resulting document from the picks', async () => {
        const { host } = open();
        const bodies = () => Array.from(host.querySelectorAll('.pb-dm-block-body')).map(el => el.textContent);
        expect(bodies()).toEqual(['As shipped', 'A house rules list', 'As shipped']);
        await expand(host, 'Summary');
        button(host, 'brief').click();
        await flush();
        expect(bodies()[0]).toBe('One short paragraph');
        expect(host.querySelector('.pb-dm-preview-note')?.textContent).toContain('plan-template.md');
    });

    it('keeps the advice about writing a section as a placeholder', () => {
        const { host } = open();
        expect(host.querySelector('.pb-dm-tip')?.textContent).toBe('Write a section as a placeholder, like '
            + '[List the house rules or write None]. Text written as an order tends to be ignored by the assistant.');
    });

    it('says once when nothing but the shipped text is on offer', () => {
        const { host } = open({ fragments: [] });
        expect(host.querySelector('.pb-dm-empty')?.textContent).toContain('Nothing but the shipped text');
    });

    it('splits Sections and Preview into tabs when narrow', async () => {
        const { host } = open({ narrow: true });
        const tabs = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
        expect(tabs.map(t => t.textContent)).toEqual(['Sections', 'Preview']);
        expect(host.querySelector<HTMLElement>('.pb-dm-preview')!.hidden).toBe(true);
        tabs[1].click();
        await flush();
        expect(host.querySelector<HTMLElement>('.pb-dm-preview')!.hidden).toBe(false);
        expect(host.querySelector<HTMLElement>('.pb-dm-sections')!.hidden).toBe(true);
    });

    it('takes the keyboard when it opens', () => {
        const { host } = open();
        expect(document.activeElement).toBe(host.querySelector('.pb-dm-row-head'));
    });

    it('keeps Tab inside it, both ways (FR-011)', () => {
        const { host } = open();
        const first = host.querySelector<HTMLElement>('.pb-modal-close')!;
        const done = button(host, 'Done');
        done.focus();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
        expect(document.activeElement).toBe(first);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
        expect(document.activeElement).toBe(done);
    });

    it('gives the keyboard back to what opened it', () => {
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();
        const { host } = open();
        expect(document.activeElement).not.toBe(opener);
        render(null, host);
        expect(document.activeElement).toBe(opener);
    });
});
