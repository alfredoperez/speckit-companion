/** @jest-environment jsdom */
import { isReadOnly } from '../readOnly';
import { setupCheckboxToggle } from '../../actions';

const postMessage = jest.fn();
(globalThis as unknown as { vscode: unknown }).vscode = { postMessage };

function resetBody(): void {
    delete document.body.dataset.readOnly;
    delete document.body.dataset.specStatus;
    document.body.innerHTML = '';
}

describe('isReadOnly', () => {
    beforeEach(resetBody);

    it('is false for an active spec', () => {
        document.body.dataset.specStatus = 'active';
        expect(isReadOnly()).toBe(false);
    });

    it('is true for a page marked read-only, whatever its status', () => {
        document.body.dataset.specStatus = 'active';
        document.body.dataset.readOnly = 'true';
        expect(isReadOnly()).toBe(true);
    });

    it('stays true for a completed or archived spec', () => {
        document.body.dataset.specStatus = 'completed';
        expect(isReadOnly()).toBe(true);
        document.body.dataset.specStatus = 'archived';
        expect(isReadOnly()).toBe(true);
    });
});

describe('checkbox toggle on a read-only page', () => {
    beforeAll(() => setupCheckboxToggle());

    beforeEach(() => {
        resetBody();
        postMessage.mockClear();
        document.body.innerHTML = '<ul><li class="task-item"><input type="checkbox" data-line="3"></li></ul>';
    });

    it('sends no toggle and leaves the box as it was', () => {
        document.body.dataset.readOnly = 'true';
        const box = document.querySelector('input') as HTMLInputElement;

        box.checked = true;
        box.dispatchEvent(new Event('change', { bubbles: true }));

        expect(postMessage).not.toHaveBeenCalled();
        expect(box.checked).toBe(false);
    });

    it('still lets a completed spec tick its tasks', () => {
        document.body.dataset.specStatus = 'completed';
        const box = document.querySelector('input') as HTMLInputElement;

        box.checked = true;
        box.dispatchEvent(new Event('change', { bubbles: true }));

        expect(postMessage).toHaveBeenCalledWith({ type: 'toggleCheckbox', lineNum: 3, checked: true });
    });

    it('still sends the toggle on an editable page', () => {
        const box = document.querySelector('input') as HTMLInputElement;

        box.checked = true;
        box.dispatchEvent(new Event('change', { bubbles: true }));

        expect(postMessage).toHaveBeenCalledWith({ type: 'toggleCheckbox', lineNum: 3, checked: true });
    });
});
