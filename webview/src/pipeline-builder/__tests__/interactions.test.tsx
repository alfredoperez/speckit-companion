/**
 * @jest-environment jsdom
 *
 * Every story, rendered — and every interaction story, played.
 *
 * The stories are how a person sees the panel; this is how CI does. This used
 * to run the interaction stories alone, which left the sixty that only draw
 * something unrendered outside Storybook: their props drifted behind the
 * components for a whole session, so the gallery showed an inspector with no
 * Save button and phase controls wired to nothing, and the panel they were
 * being reviewed in was not the panel that shipped.
 *
 * So all three files render here, and anything with a `play` runs it. A story
 * that stops working now fails the build rather than quietly misinforming the
 * next review.
 */
import { render } from 'preact';
import * as components from '../__stories__/Components.stories';
import * as interactions from '../__stories__/Interactions.stories';
import * as situations from '../__stories__/PipelineBuilder.stories';

type Story = {
    name?: string;
    render: () => preact.ComponentChild;
    play?: (context: { canvasElement: HTMLElement }) => unknown;
};

/** Every exported story in one file, without the meta default. */
function storiesIn(module: Record<string, unknown>): Array<readonly [string, Story]> {
    return Object.entries(module)
        .filter(([name]) => name !== 'default')
        .map(([name, value]) => [name, value as Story] as const);
}

const interactionStories = storiesIn(interactions);
const everyStory = [
    ...storiesIn(components),
    ...interactionStories,
    ...storiesIn(situations),
];

/** Anything the panel logged while a story drew — a warning here is a defect. */
let complaints: unknown[][];
const realError = console.error;
const realWarn = console.warn;

beforeEach(() => {
    complaints = [];
    console.error = (...args: unknown[]) => { complaints.push(args); };
    console.warn = (...args: unknown[]) => { complaints.push(args); };
});

afterEach(() => {
    console.error = realError;
    console.warn = realWarn;
    document.body.innerHTML = '';
});

describe('every story renders', () => {
    it('covers each part, each action and each situation', () => {
        expect(storiesIn(components).length).toBeGreaterThanOrEqual(30);
        expect(interactionStories.length).toBeGreaterThanOrEqual(19);
        expect(storiesIn(situations).length).toBeGreaterThanOrEqual(25);
    });

    it.each(everyStory.map(([name, story]) => [story.name ?? name, story] as const))(
        '%s', (_name, story) => {
            const host = document.createElement('div');
            document.body.appendChild(host);
            render(story.render() as never, host);

            expect(host.firstElementChild).not.toBeNull();
            expect(complaints).toEqual([]);
        });
});

describe('the interaction stories play', () => {
    it.each(interactionStories.map(([name, story]) => [story.name ?? name, story] as const))(
        '%s', async (_name, story) => {
            const host = document.createElement('div');
            document.body.appendChild(host);
            render(story.render() as never, host);

            expect(story.play).toBeDefined();
            await story.play!({ canvasElement: host });
        });
});
