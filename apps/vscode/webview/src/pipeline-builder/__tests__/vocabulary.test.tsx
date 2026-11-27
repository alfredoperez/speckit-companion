/**
 * @jest-environment jsdom
 */
import { HookModal } from '../HookModal';
import { canvas, flush, mount, step } from './support';

afterEach(() => { document.body.innerHTML = ''; });

describe('one action keeps one name through the flow', () => {
    const noop = () => undefined;
    const CHOICES = { skills: [], nodes: [], commands: [], fragments: [], presets: [] };

    it('says "Add to" on the lane, "Add" in the modal\'s title and on the confirm', () => {
        const { host } = canvas();
        expect(host.querySelector('.pb-lane-add')?.textContent).toBe('Add to specify');

        document.body.innerHTML = '';
        const sheet = mount(
            <HookModal step={step()} anchor="gather" choices={CHOICES} onCancel={noop} onAttach={noop} />,
        );
        expect(sheet.querySelector('.pb-modal-title')?.textContent).toBe('Add before the gather phase');
        expect(sheet.querySelector('.pb-action--primary')?.textContent).toBe('Add');

        document.body.innerHTML = '';
        const lane = mount(
            <HookModal step={step()} anchor="gather" choices={CHOICES} modes={['hook', 'node', 'step']}
                onCancel={noop} onAttach={noop} />,
        );
        expect(lane.querySelector('.pb-modal-title')?.textContent).toBe('Add to specify');
    });

    it('names the place line for when and where it goes, not what it is', () => {
        const sheet = mount(
            <HookModal step={step()} anchor="gather" choices={CHOICES} onCancel={noop} onAttach={noop} />);
        expect(sheet.querySelector('.pb-modal-runs')?.textContent).toContain('Runs');
        expect(Array.from(sheet.querySelectorAll('.pb-modal-runs .pb-menu-trigger'))
            .map(el => el.getAttribute('aria-label'))).toEqual(['When', 'Where']);
    });
});
