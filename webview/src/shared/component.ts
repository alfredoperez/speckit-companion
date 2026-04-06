/**
 * Lightweight base class for webview UI components.
 * Provides render lifecycle, scoped queries, and automatic event cleanup.
 */

export interface ComponentOptions {
    /** CSS class(es) for the root element */
    className?: string;
    /** Tag name for the root element (default: 'div') */
    tag?: keyof HTMLElementTagNameMap;
}

export abstract class Component<TProps extends object = object> {
    protected el: HTMLElement;
    protected props: TProps;
    private mounted = false;
    private eventCleanups: Array<() => void> = [];
    private children: Component[] = [];

    constructor(props: TProps, options?: ComponentOptions) {
        this.props = { ...props };
        const tag = options?.tag ?? 'div';
        this.el = document.createElement(tag);
        if (options?.className) {
            this.el.className = options.className;
        }
    }

    /** Return HTML string for the component interior. */
    protected abstract render(): string;

    /** Called after render/re-render, for binding events to rendered elements. */
    protected onMount(): void {}

    /** Called before removal, for custom cleanup. */
    protected onUnmount(): void {}

    /** Update props and re-render. */
    update(newProps: Partial<TProps>): void {
        Object.assign(this.props, newProps);
        this.el.innerHTML = this.render();
        this.rebindEvents();
    }

    /** Mount into a parent element. */
    mount(parent: HTMLElement, before?: HTMLElement): void {
        if (before) {
            parent.insertBefore(this.el, before);
        } else {
            parent.appendChild(this.el);
        }
        this.el.innerHTML = this.render();
        this.mounted = true;
        this.onMount();
    }

    /** Remove from DOM and clean up all events and children. */
    unmount(): void {
        if (!this.mounted) return;
        this.onUnmount();
        this.cleanupEvents();
        for (const child of this.children) {
            child.unmount();
        }
        this.children = [];
        this.el.remove();
        this.mounted = false;
    }

    /** Whether this component is currently mounted. */
    isMounted(): boolean {
        return this.mounted;
    }

    /** Get the root DOM element. */
    getElement(): HTMLElement {
        return this.el;
    }

    /** Add an event listener with automatic cleanup on unmount/update. */
    protected listen<K extends keyof HTMLElementEventMap>(
        target: EventTarget,
        event: K,
        handler: (e: HTMLElementEventMap[K]) => void,
        options?: AddEventListenerOptions
    ): void {
        target.addEventListener(event, handler as EventListener, options);
        this.eventCleanups.push(() =>
            target.removeEventListener(event, handler as EventListener, options)
        );
    }

    /** querySelector scoped to this component's root element. */
    protected query<T extends HTMLElement = HTMLElement>(selector: string): T | null {
        return this.el.querySelector<T>(selector);
    }

    /** querySelectorAll scoped to this component's root element. */
    protected queryAll<T extends HTMLElement = HTMLElement>(selector: string): NodeListOf<T> {
        return this.el.querySelectorAll<T>(selector);
    }

    /** Register a child component for lifecycle management. */
    protected addChild(child: Component): void {
        this.children.push(child);
    }

    /** Remove a specific child component. */
    protected removeChild(child: Component): void {
        const idx = this.children.indexOf(child);
        if (idx > -1) {
            this.children.splice(idx, 1);
            child.unmount();
        }
    }

    private rebindEvents(): void {
        this.cleanupEvents();
        for (const child of this.children) {
            child.unmount();
        }
        this.children = [];
        this.onMount();
    }

    private cleanupEvents(): void {
        for (const cleanup of this.eventCleanups) {
            cleanup();
        }
        this.eventCleanups = [];
    }
}
