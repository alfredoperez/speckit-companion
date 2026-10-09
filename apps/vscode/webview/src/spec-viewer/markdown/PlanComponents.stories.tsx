import type { Meta, StoryObj } from '@storybook/preact';
import { MarkdownDoc } from './storyDoc';

/** Plan-page renderers in isolation (real excerpts from a speckit plan.md). */
const meta: Meta<typeof MarkdownDoc> = {
    title: 'VS Code Extension/Spec Viewer/Markdown Rendering/Plan/Components',
    component: MarkdownDoc,
};
export default meta;
type Story = StoryObj<typeof MarkdownDoc>;

export const TechnicalContext: Story = {
    args: {
        md: [
            '## Technical Context',
            '',
            '**Language/Version**: TypeScript 5.3+ (ES2022, strict)',
            '**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Preact (webview)',
            '**Storage**: File-based — `.spec-context.json` per spec dir',
            '**Testing**: Jest with `ts-jest`, BDD describe/it',
            '**Target Platform**: VS Code 1.84+ (desktop)',
            '**Performance Goals**: Viewer badge/state updates <100ms after context change',
            '**Constraints**: Tolerate unknown fields, never overwrite user edits, append-only transitions',
            '**Scale/Scope**: ~7 viewer files + ~6 prompt skills + 1 schema module',
        ].join('\n'),
    },
};

export const ConstitutionCheck: Story = {
    args: {
        md: [
            '## Constitution Check',
            '',
            '- **I. Extensibility**: PASS — schema accepts unknown fields; workflows pluggable.',
            '- **II. Spec-Driven Workflow**: PASS — reinforces explicit lifecycle, removes heuristic inference.',
            '- **III. Visual and Interactive**: PASS — fixes pulse/highlight/badge correctness in viewer.',
            '- **IV. Modular Architecture**: PASS — schema, reader/writer, derivation kept as separate modules.',
        ].join('\n'),
    },
};

export const CallPaths: Story = {
    args: {
        md: [
            '## Call paths',
            '',
            '```calls A finished step lands in the record',
            '  session.idle @ apps/copilot-canvas/extension.mjs:153',
            '~   settle() @ apps/copilot-canvas/server.mjs:187',
            '      reviewRuns() @ apps/copilot-canvas/server.mjs:117',
            '~     didStep() @ apps/copilot-canvas/server.mjs:114',
            '+     writeRecord() @ apps/copilot-canvas/server.mjs:160',
            '+       recordStep() **new** @ apps/copilot-canvas/run-record.mjs',
            '```',
            'note: only a run the board sent, in a project with no context writer, is written.',
            '',
            '```calls Retired settle path',
            '  session.idle @ apps/copilot-canvas/extension.mjs:153',
            '~   settle() @ apps/copilot-canvas/server.mjs:187',
            '-     legacySettle() @ apps/copilot-canvas/server.mjs:96',
            '```',
        ].join('\n'),
    },
};

export const CallPathsMalformed: Story = {
    args: {
        md: [
            '## Call paths',
            '',
            'This block breaks the grammar (the second line has an odd indent), so it stays a plain code block.',
            '',
            '```calls A block that does not parse',
            '  session.idle @ apps/copilot-canvas/extension.mjs:153',
            '~  settle() @ apps/copilot-canvas/server.mjs:187',
            '```',
        ].join('\n'),
    },
};

const STATES_MD = [
    '## States',
    '',
    '```states A review\'s lifecycle',
    'Draft: Edited, not sent yet. (start)',
    'Sent: Waiting on a reviewer.',
    'Held: Parked until someone picks it up. (proposed)',
    'Done: Merged and closed. (final)',
    'Draft -> Sent: submit',
    'Sent -> Held: park (proposed)',
    'Held -> Sent: resume (proposed)',
    'Sent -> Done: approve',
    'grid:',
    'Draft | Sent | Done',
    '.     | Held | .',
    '```',
    'note: only the parked state is new.',
].join('\n');

export const StatesLight: Story = {
    args: { md: STATES_MD },
    globals: { vscodeTheme: 'vivid-light' },
};

export const StatesDark: Story = {
    args: { md: STATES_MD },
    globals: { vscodeTheme: 'monokai-black' },
};

export const StatesFallback: Story = {
    args: {
        md: [
            '## States',
            '',
            'An arrow names a state that is not listed, so this stays a plain code block.',
            '',
            '```states A block that does not parse',
            'Draft: Edited. (start)',
            'Draft -> Gone: submit',
            'grid:',
            'Draft',
            '```',
        ].join('\n'),
    },
};
