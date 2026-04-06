/**
 * @jest-environment jsdom
 */
/// <reference lib="dom" />
import { Component } from '../component';

interface CounterProps {
    count: number;
    label: string;
}

class Counter extends Component<CounterProps> {
    public mountCalled = 0;
    public unmountCalled = 0;
    public clickHandler = jest.fn();

    constructor(props: CounterProps) {
        super(props, { className: 'counter', tag: 'section' });
    }

    protected render(): string {
        return `<span class="value">${this.props.count}</span>
                <button class="inc">${this.props.label}</button>`;
    }

    protected onMount(): void {
        this.mountCalled++;
        const btn = this.query<HTMLButtonElement>('.inc');
        if (btn) {
            this.listen(btn, 'click', this.clickHandler);
        }
    }

    protected onUnmount(): void {
        this.unmountCalled++;
    }
}

describe('Component', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    it('mounts into a parent and renders HTML', () => {
        const c = new Counter({ count: 5, label: 'Add' });
        c.mount(container);

        expect(c.isMounted()).toBe(true);
        expect(c.getElement().tagName).toBe('SECTION');
        expect(c.getElement().className).toBe('counter');
        expect(container.querySelector('.value')!.textContent).toBe('5');
        expect(container.querySelector('.inc')!.textContent).toBe('Add');
    });

    it('calls onMount after mount', () => {
        const c = new Counter({ count: 0, label: 'X' });
        c.mount(container);
        expect(c.mountCalled).toBe(1);
    });

    it('updates props and re-renders', () => {
        const c = new Counter({ count: 0, label: 'Go' });
        c.mount(container);

        c.update({ count: 10 });
        expect(container.querySelector('.value')!.textContent).toBe('10');
        expect(c.mountCalled).toBe(2);
    });

    it('binds events via listen() and cleans up on unmount', () => {
        const c = new Counter({ count: 0, label: 'Click' });
        c.mount(container);

        const btn = container.querySelector('.inc') as HTMLButtonElement;
        btn.click();
        expect(c.clickHandler).toHaveBeenCalledTimes(1);

        c.unmount();
        expect(c.unmountCalled).toBe(1);
        expect(c.isMounted()).toBe(false);
        expect(container.querySelector('.counter')).toBeNull();
    });

    it('rebinds events after update', () => {
        const c = new Counter({ count: 0, label: 'Click' });
        c.mount(container);

        c.update({ label: 'Press' });

        const btn = container.querySelector('.inc') as HTMLButtonElement;
        btn.click();
        expect(c.clickHandler).toHaveBeenCalledTimes(1);
    });

    it('mounts before a specific element', () => {
        const existing = document.createElement('span');
        existing.id = 'existing';
        container.appendChild(existing);

        const c = new Counter({ count: 1, label: 'Before' });
        c.mount(container, existing);

        expect(container.firstChild).toBe(c.getElement());
    });

    it('unmount is idempotent', () => {
        const c = new Counter({ count: 0, label: 'X' });
        c.mount(container);
        c.unmount();
        c.unmount();
        expect(c.unmountCalled).toBe(1);
    });
});
