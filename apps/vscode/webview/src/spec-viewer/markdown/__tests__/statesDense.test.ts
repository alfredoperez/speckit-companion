/** @jest-environment jsdom */
import { registerBlockRenderer } from '../blockFences';
import { MAX_LABELLED_ARROWS, diagramGeometry, parseStates, renderStatesCard } from '../statesCard';
import { renderMarkdown } from '../renderer';
import { setupStatesSelect } from '../../editor/statesSelect';

const DENSE = [
    'NoDate: No due date yet. (start)',
    'Upcoming: Due in the future.',
    'DueToday: Due today.',
    'Overdue: Past its date.',
    'Done: Finished. (final)',
    'NoDate -> Upcoming: set a future date',
    'NoDate -> DueToday: set today\'s date',
    'Upcoming -> NoDate: clear the date',
    'Upcoming -> DueToday: rollover',
    'DueToday -> Overdue: rollover',
    'NoDate -> Done: mark done',
    'Upcoming -> Done: mark done',
    'DueToday -> Done: mark done',
    'Overdue -> Done: mark done',
    'Overdue -> DueToday: reschedule',
    'Overdue -> Upcoming: reschedule',
    'DueToday -> Upcoming: push back',
    'DueToday -> NoDate: clear the date',
    'Done -> NoDate: unmark, no date',
    'Done -> Upcoming: unmark, future date',
    'Done -> DueToday: unmark, due today',
    'Done -> Overdue: unmark, date passed (proposed)',
    'grid:',
    'NoDate | Upcoming | DueToday | Overdue',
    'Done | . | . | .',
].join('\n');

const sparse = (arrows: number): string => {
    const lines = ['A: one. (start)', 'B: two.', 'C: three. (final)'];
    for (let i = 0; i < arrows - 1; i++) lines.push(i % 2 ? 'B -> A: back' : 'A -> B: go');
    lines.push('B -> C: finish');
    return [...lines, 'grid:', 'A | B | C'].join('\n');
};

const doc = (body: string): string => ['## States', '', '```states A lifecycle', body, '```'].join('\n');
const mount = (body: string): void => {
    document.body.innerHTML = `<div id="markdown-content">${renderMarkdown(doc(body))}</div>`;
};
const pick = (n: number): void => (document.querySelectorAll('.states-state')[n] as HTMLElement).click();
const moves = (): string[] =>
    Array.from(document.querySelectorAll('.states-card > .states-moves .states-move')).map((m) => m.textContent ?? '');

let installed = false;
beforeEach(() => {
    registerBlockRenderer('states', renderStatesCard);
    if (!installed) { setupStatesSelect(); installed = true; }
});

describe('arrow labels', () => {
    it('are drawn at 8 arrows', () => {
        mount(sparse(MAX_LABELLED_ARROWS));

        expect(document.querySelectorAll('.states-edge')).toHaveLength(8);
        expect(document.querySelectorAll('.states-label')).toHaveLength(8);
    });

    it('are left off at 9 arrows', () => {
        mount(sparse(MAX_LABELLED_ARROWS + 1));

        expect(document.querySelectorAll('.states-edge')).toHaveLength(9);
        expect(document.querySelectorAll('.states-label')).toHaveLength(0);
    });
});

describe('a dense block', () => {
    it('never clips: every label sits inside the viewBox', () => {
        const parsed = parseStates(DENSE);
        if (!parsed.ok) throw new Error(parsed.error);
        const view = diagramGeometry(parsed, true);
        const { viewBox } = view;

        expect(parsed.arrows).toHaveLength(17);
        expect(view.labels).toHaveLength(17);
        view.labels.forEach((l) => {
            expect(l.x).toBeGreaterThanOrEqual(viewBox.x);
            expect(l.y).toBeGreaterThanOrEqual(viewBox.y);
            expect(l.x + l.w).toBeLessThanOrEqual(viewBox.x + viewBox.w);
            expect(l.y + l.h).toBeLessThanOrEqual(viewBox.y + viewBox.h);
        });
    });

    it('grows the viewBox past the grid when a label would hang outside it', () => {
        const parsed = parseStates('A: a long left label. (start)\nB: two. (final)\nA -> A: a very long loop label here\nA -> B: go\ngrid:\nA | B');
        if (!parsed.ok) throw new Error(parsed.error);
        const { viewBox, labels } = diagramGeometry(parsed);

        labels.forEach((l) => {
            expect(l.x).toBeGreaterThanOrEqual(viewBox.x);
            expect(l.y).toBeGreaterThanOrEqual(viewBox.y);
            expect(l.x + l.w).toBeLessThanOrEqual(viewBox.x + viewBox.w);
        });
        expect(viewBox.y).toBeLessThan(0);
    });

    it('draws no labels and marks the diagram dense', () => {
        mount(DENSE);

        expect(document.querySelectorAll('.states-edge')).toHaveLength(17);
        expect(document.querySelectorAll('.states-label')).toHaveLength(0);
        expect(document.querySelector('.states-svg')?.classList.contains('states-svg--dense')).toBe(true);
    });

    it('keeps the start state outgoing arrows at full strength and swaps on pick', () => {
        mount(DENSE);
        const out = (): string[] => Array.from(document.querySelectorAll('.states-edge[data-out="true"]')).map((e) => (e as HTMLElement).dataset.from ?? '');

        expect(out()).toEqual(['0', '0', '0']);
        pick(4);
        expect(out()).toEqual(['4', '4', '4', '4']);
        expect(document.querySelectorAll('.states-edge:not([data-out])')).toHaveLength(13);
    });

    it('a sparse diagram is not marked dense', () => {
        mount(sparse(3));

        expect(document.querySelector('.states-svg')?.classList.contains('states-svg--dense')).toBe(false);
    });

    it('bends an arrow that would cross another box into a curve', () => {
        mount(DENSE);
        const paths = Array.from(document.querySelectorAll('.states-arrow')).map((p) => p.getAttribute('d') ?? '');

        expect(paths.some((d) => d.includes(' Q '))).toBe(true);
    });
});

describe('the transitions list', () => {
    it('lists the picked state outgoing moves, always', () => {
        mount(DENSE);

        expect(moves()).toEqual(['→ Upcoming: set a future date', '→ DueToday: set today\'s date', '→ Done: mark done']);
    });

    it('swaps when another state is picked', () => {
        mount(DENSE);
        pick(4);

        expect(moves()).toHaveLength(4);
        expect(moves()[3]).toBe('→ Overdue: unmark, date passed (proposed)');
        expect(document.querySelector('.states-card > .states-moves strong')?.textContent).toBe('NoDate');
    });

    it('marks a proposed move', () => {
        mount(DENSE);
        pick(4);

        expect(document.querySelectorAll('.states-card > .states-moves .states-move--proposed')).toHaveLength(1);
    });

    it('shows nothing for a state with no way out', () => {
        mount(DENSE);
        mount('A: one. (start)\nB: two. (final)\nA -> B: go\ngrid:\nA | B');
        pick(1);

        expect(document.querySelector('.states-card > .states-moves')).toBeNull();
    });

    it('is listed for every state in the static list the board shows', () => {
        mount(DENSE);

        expect(document.querySelectorAll('.states-list .states-moves')).toHaveLength(5);
    });

    it('keeps markup in a label as text', () => {
        mount('A: one. (start)\nB: two. (final)\nA -> B: <img src=x onerror=alert(1)>\ngrid:\nA | B');

        expect(document.querySelector('.states-card > .states-moves img')).toBeNull();
        expect(moves()[0]).toContain('<img');
    });
});

describe('labels that do not fit', () => {
    const WAITING = [
        'Queued: Stored offline, waiting to be sent. (start)',
        'Sending: Being sent during catch-up.',
        'Sent: Server accepted it, removed from the list. (final)',
        'Dropped: Server rejected it, removed from the list. (final)',
        'Cancelled: Opposite change made, removed from the list. (final)',
        'Queued -> Sending: online report or launch',
        'Queued -> Cancelled: opposite change on the same article',
        'Sending -> Sent: server accepts',
        'Sending -> Dropped: server answers with an error',
        'Sending -> Queued: no response, change stays waiting',
        'grid:',
        'Queued | Sending | Sent',
        '.      | Cancelled | Dropped',
    ].join('\n');
    const render = (body: string): void => {
        registerBlockRenderer('states', renderStatesCard);
        document.body.innerHTML = renderMarkdown('```states Waiting change\n' + body + '\n```');
    };
    const drawn = (): string[] => Array.from(document.querySelectorAll('.states-label')).map((n) => n.textContent ?? '');

    it('draws only the labels that fit and says the rest are listed below', () => {
        render(WAITING);

        expect(drawn()).toEqual(['server accepts']);
        expect(document.querySelector('.states-hint')?.textContent).toBe('Pick a state to read what it means and where it goes');
    });

    it('keeps every dropped label in the moves list', () => {
        render(WAITING);
        const queued = document.querySelector('.states-list li[data-state="0"]')?.textContent ?? '';
        const sending = document.querySelector('.states-list li[data-state="1"]')?.textContent ?? '';

        expect(queued).toContain('online report or launch');
        expect(queued).toContain('opposite change on the same article');
        expect(sending).toContain('no response, change stays waiting');
        expect(sending).toContain('server answers with an error');
    });

    it('draws every label when all are short', () => {
        render('A: one. (start)\nB: two.\nA -> B: go\nB -> A: back\ngrid:\nA | B');

        expect(drawn().sort()).toEqual(['back', 'go']);
        expect(document.querySelector('.states-hint')?.textContent).toBe('Pick a state to read what it means');
    });
});
