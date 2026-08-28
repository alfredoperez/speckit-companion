/**
 * @jest-environment jsdom
 *
 * Every interaction story, played.
 *
 * The stories are how a person sees these actions; this is how CI does. Each
 * one renders the story and runs its own `play`, so a story that stops working
 * fails the build instead of quietly rendering a broken panel in Storybook.
 */
import { render } from 'preact';
import * as interactions from '../__stories__/Interactions.stories';

type Story = {
    name?: string;
    render: () => preact.ComponentChild;
    play?: (context: { canvasElement: HTMLElement }) => unknown;
};

/** Every exported story, without the meta default. */
const stories = Object.entries(interactions)
    .filter(([name]) => name !== 'default')
    .map(([name, value]) => [name, value as Story] as const);

afterEach(() => { document.body.innerHTML = ''; });

describe('the interaction stories play', () => {
    it('exports one story per action the panel offers', () => {
        expect(stories.length).toBeGreaterThanOrEqual(19);
    });

    it.each(stories.map(([name, story]) => [story.name ?? name, story] as const))(
        '%s', async (_name, story) => {
            const host = document.createElement('div');
            document.body.appendChild(host);
            render(story.render() as never, host);

            // A story that renders nothing has nothing to assert against.
            expect(host.firstElementChild).not.toBeNull();
            if (story.play) {
                await story.play({ canvasElement: host });
            }
        });
});
