import type { Meta, StoryObj } from '@storybook/preact';
import { ProcessCreateMock, type ProcessCreateMockProps } from '../ProcessCreateMock';
import '../../../styles/spec-editor.css';

const meta: Meta = {
    title: 'VS Code Extension/Create Bug or Idea',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'The New Bug and New Idea screens, opened from the + on the Bugs and Ideas panes. ' +
                    'The slug follows the first field until it is edited, and a slug that already names an item blocks sending.',
            },
        },
    },
};
export default meta;

type Story = StoryObj;

const BUG: ProcessCreateMockProps = {
    kind: 'bug',
    text: 'The sidebar count stays at 3 after a spec is archived. It only corrects itself on reload.',
    extra: 'TypeError: Cannot read properties of undefined (reading "status")\n    at countActive (specExplorer.ts:212)',
    slug: 'the-sidebar-count-stays',
};

const IDEA: ProcessCreateMockProps = {
    kind: 'idea',
    text: 'Let a reviewer leave comments on a spec from the browser, without installing the editor.',
    extra: 'Product managers and designers who review specs',
    slug: 'let-a-reviewer-leave',
};

const story = (name: string, props: ProcessCreateMockProps): Story => ({
    name,
    render: () => <ProcessCreateMock {...props} />,
});

export const BugEmpty = story('Bug: Empty', { kind: 'bug' });
export const BugFilled = story('Bug: Filled', BUG);
export const BugSlugExists = story('Bug: Slug Exists (sending blocked)', { ...BUG, existingSlugs: [BUG.slug!] });
export const BugSubmitting = story('Bug: Submitting', { ...BUG, submitting: true });
export const BugError = story('Bug: Error (screen stays open)', {
    ...BUG,
    error: 'Could not send to your assistant: the terminal could not be opened.',
});
export const BugNarrow = story('Bug: Narrow', { ...BUG, narrow: true });

export const IdeaEmpty = story('Idea: Empty', { kind: 'idea' });
export const IdeaFilled = story('Idea: Filled', IDEA);
export const IdeaSlugExists = story('Idea: Slug Exists (sending blocked)', { ...IDEA, existingSlugs: [IDEA.slug!] });
export const IdeaSubmitting = story('Idea: Submitting', { ...IDEA, submitting: true });
export const IdeaError = story('Idea: Error (screen stays open)', {
    ...IDEA,
    error: 'Could not send to your assistant: the terminal could not be opened.',
});
export const IdeaNarrow = story('Idea: Narrow', { ...IDEA, narrow: true });
