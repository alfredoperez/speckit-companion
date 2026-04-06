/**
 * @jest-environment jsdom
 */
/// <reference lib="dom" />
import { Button, Badge, Toast, Tab, TabBar, Stepper, Input, Callout } from '../components';

describe('Shared Primitive Components', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    describe('Button', () => {
        it('renders primary button with correct class', () => {
            const btn = new Button({ label: 'Save', variant: 'primary' });
            btn.mount(container);
            expect(btn.getElement().tagName).toBe('BUTTON');
            expect(btn.getElement().className).toBe('primary');
            expect(btn.getElement().textContent).toBe('Save');
        });

        it('renders with icon', () => {
            const btn = new Button({ label: 'Edit', variant: 'enhancement', icon: '✏️' });
            btn.mount(container);
            expect(btn.getElement().querySelector('.icon')!.textContent).toBe('✏️');
        });

        it('calls onClick handler', () => {
            const handler = jest.fn();
            const btn = new Button({ label: 'Go', onClick: handler });
            btn.mount(container);
            btn.getElement().click();
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('sets id and disabled', () => {
            const btn = new Button({ label: 'X', id: 'btn-1', disabled: true });
            btn.mount(container);
            expect(btn.getElement().id).toBe('btn-1');
            expect((btn.getElement() as HTMLButtonElement).disabled).toBe(true);
        });
    });

    describe('Badge', () => {
        it('renders status badge', () => {
            const badge = new Badge({ text: 'DRAFT', variant: 'status' });
            badge.mount(container);
            expect(badge.getElement().className).toBe('spec-badge');
            expect(badge.getElement().textContent).toBe('DRAFT');
        });

        it('renders stale badge', () => {
            const badge = new Badge({ text: '!', variant: 'stale' });
            badge.mount(container);
            expect(badge.getElement().className).toBe('stale-badge');
        });
    });

    describe('Toast', () => {
        it('shows and hides message', () => {
            jest.useFakeTimers();
            const toast = new Toast({ id: 'test-toast' });
            toast.mount(container);

            toast.show('Saved!', 1000);
            expect(toast.getElement().textContent).toBe('Saved!');
            expect(toast.getElement().classList.contains('visible')).toBe(true);

            jest.advanceTimersByTime(1000);
            expect(toast.getElement().classList.contains('visible')).toBe(false);
            jest.useRealTimers();
        });
    });

    describe('Tab', () => {
        it('renders step tab with state classes', () => {
            const tab = new Tab({
                label: 'Plan',
                variant: 'step',
                dataKey: 'plan',
                stateClasses: ['exists', 'viewing'],
            });
            tab.mount(container);
            expect(tab.getElement().className).toContain('step-tab');
            expect(tab.getElement().className).toContain('exists');
            expect(tab.getElement().className).toContain('viewing');
            expect(tab.getElement().getAttribute('data-phase')).toBe('plan');
        });

        it('renders related tab with active state', () => {
            const tab = new Tab({ label: 'Schema', variant: 'related', active: true, dataKey: 'schema' });
            tab.mount(container);
            expect(tab.getElement().className).toContain('related-tab');
            expect(tab.getElement().className).toContain('active');
        });
    });

    describe('TabBar', () => {
        it('renders with correct class', () => {
            const bar = new TabBar({ variant: 'step' });
            bar.mount(container);
            expect(bar.getElement().className).toBe('step-tabs');
        });
    });

    describe('Stepper', () => {
        it('renders steps with connectors', () => {
            const stepper = new Stepper({
                steps: [
                    { phase: 'spec', label: 'Specify', indicator: '✓', stateClass: 'completed' },
                    { phase: 'plan', label: 'Plan', indicator: '2', connectorFilled: true },
                    { phase: 'tasks', label: 'Tasks', indicator: '3' },
                ],
            });
            stepper.mount(container);
            expect(stepper.getElement().tagName).toBe('NAV');
            expect(stepper.getElement().className).toBe('phase-stepper');
            expect(stepper.getElement().querySelectorAll('.step').length).toBe(3);
            expect(stepper.getElement().querySelectorAll('.step-connector').length).toBe(2);
            expect(stepper.getElement().querySelector('.step.completed .step-indicator')!.textContent).toBe('✓');
        });
    });

    describe('Input', () => {
        it('renders text input with placeholder', () => {
            const input = new Input({ variant: 'refine', placeholder: 'Type here...', id: 'my-input' });
            input.mount(container);
            expect(input.getElement().tagName).toBe('INPUT');
            expect(input.getElement().className).toBe('refine-input');
            expect((input.getElement() as HTMLInputElement).placeholder).toBe('Type here...');
        });

        it('get/set value', () => {
            const input = new Input({ variant: 'refine' });
            input.mount(container);
            input.setValue('hello');
            expect(input.getValue()).toBe('hello');
        });
    });

    describe('Callout', () => {
        it('renders with correct type class and label', () => {
            const callout = new Callout({ type: 'warning', content: '<p>Be careful</p>' });
            callout.mount(container);
            expect(callout.getElement().className).toBe('callout callout-warning');
            expect(callout.getElement().querySelector('.callout-label')!.textContent).toBe('WARNING');
            expect(callout.getElement().querySelector('.callout-content')!.innerHTML).toContain('Be careful');
        });
    });
});
