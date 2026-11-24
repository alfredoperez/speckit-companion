/**
 * @jest-environment jsdom
 */
import { HookModal } from '../HookModal';
import { canvas, flush, mount, step } from './support';

afterEach(() => { document.body.innerHTML = ''; });

describe('one action keeps one name through the flow', () => {
    const noop = () => undefined;
    const CHOICES = { skills: [], nodes: [], commands: [], fragments: [], presets: [] };

    it('says "Add hook" on the phase, "Add" in the modal\'s title and on the confirm', async () => {
        const { host } = canvas();
        (host.querySelector('.pb-phase-add') as HTMLButtonElement).click();
        await flush();
        expect(host.querySelector('.pb-menu-label')?.textContent).toBe('Add hook');

        document.body.innerHTML = '';
        const sheet = mount(
            <HookModal step={step()} anchor="gather" choices={CHOICES} onCancel={noop} onAttach={noop} />,
        );
        expect(sheet.querySelector('.pb-modal-title')?.textContent).toBe('Add before the gather phase');
        expect(sheet.querySelector('.pb-action--primary')?.textContent).toBe('Add');
    });

    it('names the place line for when and where it goes, not what it is', () => {
        const sheet = mount(
            <HookModal step={step()} anchor="gather" choices={CHOICES} onCancel={noop} onAttach={noop} />);
        expect(sheet.querySelector('.pb-modal-runs')?.textContent).toContain('Runs');
        expect(Array.from(sheet.querySelectorAll('.pb-modal-runs .pb-menu-trigger'))
            .map(el => el.getAttribute('aria-label'))).toEqual(['When', 'Where']);
    });
});
