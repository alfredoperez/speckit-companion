/**
 * @jest-environment jsdom
 *
 * The annotation: a comment costs one collapsed line until it is asked to open,
 * carries its pending/applied state without opening, and can never let a
 * comment's text — which is user data — become markup.
 */
import { render } from 'preact';
import { InlineComment } from '../InlineComment';
import type { Refinement } from '../../types';

function refinement(over: Partial<Refinement> = {}): Refinement {
    return {
        id: 'ref-1',
        lineNum: 5,
        lineContent: 'The user should be able to log in',
        comment: 'Name the auth methods in scope',
        lineType: 'paragraph',
        status: 'pending',
        ...over,
    };
}

function mount(over: Partial<Refinement> = {}, props: Record<string, unknown> = {}): HTMLDivElement {
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(
        <InlineComment
            refinement={refinement(over)}
            mode="line"
            onDelete={() => undefined}
            onEdit={() => undefined}
            onRefine={() => undefined}
            {...props}
        />,
        host,
    );
    return host;
}

function disclosure(host: HTMLElement): HTMLButtonElement {
    return host.querySelector('.comment-disclosure') as HTMLButtonElement;
}

/** Preact re-renders on a microtask — let it land before asserting. */
async function toggle(host: HTMLElement): Promise<void> {
    disclosure(host).click();
    await new Promise(resolve => setTimeout(resolve, 0));
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('InlineComment — collapsed by default', () => {
    it('renders as a single disclosure row with no body and no delete control', () => {
        const host = mount();

        expect(disclosure(host)).not.toBeNull();
        expect(disclosure(host).getAttribute('aria-expanded')).toBe('false');
        expect(host.querySelector('.comment-body')).toBeNull();
        expect(host.querySelector('.comment-actions')).toBeNull();
    });

    it('shows the comment text and its state on the collapsed row', () => {
        const host = mount();

        expect(host.querySelector('.comment-text')?.textContent).toBe('Name the auth methods in scope');
        expect(host.querySelector('.comment-state')?.textContent).toBe('Pending');
    });
});

describe('InlineComment — pending vs applied', () => {
    it('marks a pending comment with the pending modifier and the comment glyph', () => {
        const host = mount({ status: 'pending' });

        expect(host.querySelector('.inline-comment--pending')).not.toBeNull();
        expect(host.querySelector('.comment-glyph')?.className).toContain('codicon-comment');
    });

    it('marks an applied comment with the applied modifier and the check glyph', () => {
        const host = mount({ status: 'applied' });

        expect(host.querySelector('.inline-comment--applied')).not.toBeNull();
        expect(host.querySelector('.comment-glyph')?.className).toContain('codicon-check');
        expect(host.querySelector('.comment-state')?.textContent).toBe('Applied');
    });
});

describe('InlineComment — disclosure', () => {
    it('reveals the full text and the action row when opened, and points aria-controls at the body', async () => {
        const host = mount();

        await toggle(host);

        const body = host.querySelector('.comment-body') as HTMLElement;
        expect(body.textContent).toBe('Name the auth methods in scope');
        expect(disclosure(host).getAttribute('aria-expanded')).toBe('true');
        expect(disclosure(host).getAttribute('aria-controls')).toBe(body.id);
        expect(host.querySelector('.inline-comment')?.className).toContain('is-expanded');
    });

    it('collapses again on a second activation', async () => {
        const host = mount();

        await toggle(host);
        await toggle(host);

        expect(host.querySelector('.comment-body')).toBeNull();
        expect(disclosure(host).getAttribute('aria-expanded')).toBe('false');
    });

    it('offers refine, edit and delete on an expanded pending comment', async () => {
        const onDelete = jest.fn();
        const onEdit = jest.fn();
        const onRefine = jest.fn();
        const host = mount({}, { onDelete, onEdit, onRefine });

        await toggle(host);

        (host.querySelector('.comment-action--refine') as HTMLButtonElement).click();
        (host.querySelector('.comment-action--edit') as HTMLButtonElement).click();
        (host.querySelector('.comment-action--delete') as HTMLButtonElement).click();

        expect(onRefine).toHaveBeenCalledWith('ref-1');
        expect(onEdit).toHaveBeenCalledWith('ref-1');
        expect(onDelete).toHaveBeenCalledWith('ref-1');
    });

    it('does not offer refine on an applied comment — that work is already dispatched', async () => {
        const host = mount({ status: 'applied' });

        await toggle(host);

        expect(host.querySelector('.comment-action--refine')).toBeNull();
        expect(host.querySelector('.comment-action--edit')).not.toBeNull();
        expect(host.querySelector('.comment-action--delete')).not.toBeNull();
    });

    it('offers no actions at all on a read-only spec, but still shows the comment', async () => {
        const host = mount({}, { readOnly: true });

        await toggle(host);

        expect(host.querySelector('.comment-body')?.textContent).toBe('Name the auth methods in scope');
        expect(host.querySelector('.comment-actions')).toBeNull();
    });
});

describe('InlineComment — comment text is user data, never markup', () => {
    const hostile = '"><img src=x onerror="alert(1)"><script>alert(2)</script>';

    it('renders markup-like comment text as literal characters, collapsed and expanded', async () => {
        const host = mount({ comment: hostile });

        expect(host.querySelector('.comment-text')?.textContent).toBe(hostile);
        expect(host.querySelector('img')).toBeNull();
        expect(host.querySelector('script')).toBeNull();

        await toggle(host);

        expect(host.querySelector('.comment-body')?.textContent).toBe(hostile);
        expect(host.querySelector('img')).toBeNull();
        expect(host.querySelector('script')).toBeNull();
    });

    it('never lets comment text escape into an attribute', () => {
        const host = mount({ comment: hostile, id: 'ref-"><b>x</b>' });

        // The id lands in data-ref-id and the body id; neither may break the markup.
        expect(host.querySelector('b')).toBeNull();
        expect(host.querySelector('.inline-comment')?.getAttribute('data-ref-id')).toBe('ref-"><b>x</b>');

        for (const el of Array.from(host.querySelectorAll('*'))) {
            for (const attr of Array.from(el.attributes)) {
                expect(attr.name).not.toContain('onerror');
            }
        }
    });
});
