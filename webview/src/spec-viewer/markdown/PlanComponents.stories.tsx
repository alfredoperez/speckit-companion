import type { Meta, StoryObj } from '@storybook/preact';
import { MarkdownDoc } from './storyDoc';

/** Plan-page renderers in isolation (real excerpts from a speckit plan.md). */
const meta: Meta<typeof MarkdownDoc> = {
    title: 'Viewer/Markdown Rendering/Plan/Components',
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
