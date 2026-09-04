/**
 * @jest-environment jsdom
 */
/**
 * The panel's own picker, on its own.
 *
 * The keyboard behaviour is exercised through the header's workflow switcher,
 * which is a real caller. What is here is the part no caller has yet: a row
 * that is offered and impossible, which exists so a menu can explain why it
 * cannot do something instead of hiding that it ever could.
 */
import { Menu } from '../Menu';
import { flush, mount } from './support';

afterEach(() => { document.body.innerHTML = ''; });

/** Preact runs effects after the paint, which jsdom times to a frame. */
const painted = () => new Promise(resolve =>
    requestAnimationFrame(() => setTimeout(resolve, 0)));

const PHASE = [
    { id: 'add-hook', label: 'Add hook' },
    {
        id: 'split', label: 'Split phase', disabled: true,
        note: 'One node here, so there is nothing to split off',
    },
    { id: 'rename', label: 'Rename phase' },
];

function open(options = PHASE) {
    const picked: string[] = [];
    const host = mount(
        <Menu trigger="⋯" title="Phase" options={options} onPick={id => picked.push(id)} />);
    (host.querySelector('.pb-menu-trigger') as HTMLButtonElement).click();
    return { host, picked, rows: () => Array.from(
        host.querySelectorAll<HTMLButtonElement>('.pb-menu-option')) };
}

describe('a row that is offered and impossible', () => {
    it('is still listed, so the menu teaches what a phase can do', async () => {
        const { rows } = open();
        await flush();
        expect(rows().map(row => row.textContent)).toEqual([
            'Add hook',
            'Split phaseOne node here, so there is nothing to split off',
            'Rename phase',
        ]);
    });

    it('says why, on the row itself', async () => {
        const { host } = open();
        await flush();
        expect(host.querySelector('.pb-menu-option--inert .pb-menu-note')?.textContent)
            .toBe('One node here, so there is nothing to split off');
    });

    it('does nothing when picked, and does not close over a non-event', async () => {
        const { host, picked, rows } = open();
        await flush();
        rows()[1].click();
        await flush();
        expect(picked).toEqual([]);
        expect(host.querySelector('.pb-menu-list')).not.toBeNull();
    });

    it('picks normally either side of it', async () => {
        const { picked, rows } = open();
        await flush();
        rows()[2].click();
        expect(picked).toEqual(['rename']);
    });

    it('is announced as unavailable rather than merely looking it', async () => {
        const { rows } = open();
        await flush();
        expect(rows()[1].getAttribute('aria-disabled')).toBe('true');
        expect(rows()[0].getAttribute('aria-disabled')).toBeNull();
    });

    it('stays reachable by keyboard, which is how the note gets read out', async () => {
        const { rows } = open();
        await painted();
        rows()[0].parentElement!.parentElement!.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(document.activeElement).toBe(rows()[1]);
    });

    it('opens onto something that can actually be picked', async () => {
        const { rows } = open([
            { id: 'split', label: 'Split phase', disabled: true, note: 'Nothing to split off' },
            { id: 'rename', label: 'Rename phase' },
        ]);
        await painted();
        expect(document.activeElement).toBe(rows()[1]);
    });
});
