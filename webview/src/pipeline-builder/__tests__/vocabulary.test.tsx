/**
 * @jest-environment jsdom
 */
import { AttachForm } from '../AttachForm';
import { canvas, flush, mount, step } from './support';

afterEach(() => { document.body.innerHTML = ''; });

describe('one action keeps one name through the flow', () => {
    const noop = () => undefined;

    it('says "Add hook" on the phase, in the sheet, and on the confirm', async () => {
        const { host } = canvas();
        (host.querySelector('.pb-phase-add') as HTMLButtonElement).click();
        await flush();
        expect(host.querySelector('.pb-menu-label')?.textContent).toBe('Add hook');

        document.body.innerHTML = '';
        const sheet = mount(
            <AttachForm step={step()} anchor="gather" choices={{ skills: [], nodes: [], fragments: [], presets: [] }}
                onCancel={noop} onAttach={noop} />,
        );
        expect(sheet.querySelector('.pb-side-title')?.textContent).toBe('Add hook');
        expect(sheet.querySelector('.pb-action--primary')?.textContent).toContain('Add hook');
    });

    it('names the anchor field for where it goes, not what it is', () => {
        const sheet = mount(
            <AttachForm step={step()} anchor="gather" choices={{ skills: [], nodes: [], fragments: [], presets: [] }}
                onCancel={noop} onAttach={noop} />);
        const labels = Array.from(sheet.querySelectorAll('.pb-field-label'))
            .map(el => el.textContent);
        expect(labels).toContain('Where');
        expect(labels).not.toContain('What');
    });
});
