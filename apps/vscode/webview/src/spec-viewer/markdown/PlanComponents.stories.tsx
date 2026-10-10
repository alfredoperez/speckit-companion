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

const SCREEN_MD = [
    '## Screens',
    '',
    '```screen settings The settings page, with a way to save',
    'title: Settings',
    'row:',
    '  field: Display name (changed) (1)',
    '  field: Email',
    'row:',
    '  chip: Draft',
    '  button: Save changes (new) (2)',
    'text: Changes apply the next time you open the page.',
    'list: General | Account | Billing (changed) (3)',
    '```',
    '1: The name is editable. It was read only before.',
    '2: Save is the only new control. It writes the record and closes the page.',
    '3: The list gains Billing. General and Account are untouched.',
].join('\n');

export const ScreenDark: Story = {
    args: { md: SCREEN_MD },
    globals: { vscodeTheme: 'monokai-black' },
};

export const ScreenLight: Story = {
    args: { md: SCREEN_MD },
    globals: { vscodeTheme: 'vivid-light' },
};

export const ScreenMalformed: Story = {
    args: {
        md: [
            '## Screens',
            '',
            'This block uses a part that is not allowed, so it stays a plain code block.',
            '',
            '```screen settings The settings page',
            'title: Settings',
            'image: logo.png',
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

const CODE_PINS = [
    '## Code',
    '',
    'New code, with a note where one line needs it.',
    '',
    '```ts sketch apps/vscode/webview/src/spec-viewer/markdown/codeCard.ts hl=2-3',
    'export function renderKind(info: CodeInfo): string {',
    "    if (info.to === null) return 'sketch';",
    '    return info.to === info.from ? `line ${info.from}` : `lines ${info.from}-${info.to}`;',
    '}',
    '```',
    'pin 2: a sketch has no end line, so the header says what it is instead of a range.',
    '',
    'Real lines, cited from the file. The path opens it at the first line.',
    '',
    '```ts apps/vscode/webview/src/spec-viewer/markdown/blockFences.ts:41-48 hl=45',
    'export function renderBlockFence(name: string, body: string, info: FenceInfo, context: BlockContext): string | null {',
    '    const render = renderers.get(name);',
    '    if (!render) return null;',
    '    try {',
    '        return render(body, info, context) || null;',
    '    } catch {',
    '        return null;',
    '    }',
    '```',
    'pin 45: an empty string is the renderer saying "not mine", and the fence stays plain code.',
    'pin 47: a renderer that throws never takes the page down with it.',
].join('\n');

export const CodePinsDark: Story = {
    args: { md: CODE_PINS },
    globals: { vscodeTheme: 'monokai-black' },
};

export const CodePinsLight: Story = {
    args: { md: CODE_PINS },
    globals: { vscodeTheme: 'vivid-light' },
};

const CODE_PINS_MALFORMED = [
    '## Code',
    '',
    'The pin names line 9 of a three-line sketch, so the fence stays a plain code block and the pin stays text.',
    '',
    '```ts sketch src/add.ts',
    'export function add(a: number, b: number) {',
    '    return a + b;',
    '}',
    '```',
    'pin 9: there is no line 9.',
].join('\n');

export const CodePinsMalformedDark: Story = {
    args: { md: CODE_PINS_MALFORMED },
    globals: { vscodeTheme: 'monokai-black' },
};

export const CodePinsMalformedLight: Story = {
    args: { md: CODE_PINS_MALFORMED },
    globals: { vscodeTheme: 'vivid-light' },
};

const ALL_BLOCKS_MD = [
    '## Call paths',
    '',
    '```calls Saving the settings page',
    '  saveSettings() @ apps/vscode/webview/src/spec-viewer/markdown/statesCard.ts:236',
    '~   renderStatesCard() @ apps/vscode/webview/src/spec-viewer/markdown/statesCard.ts:236',
    '```',
    '',
    '## Code',
    '',
    '```ts sketch apps/vscode/webview/src/spec-viewer/markdown/statesCard.ts hl=2',
    'const frame = state.shows ? renderScreenFrameByName(state.shows) : null;',
    'const shown = frame ? `<div class="states-shown">${frame}</div>` : \'\';',
    '```',
    'pin 2: the row only exists when the picked state names a screen.',
    '',
    '## States',
    '',
    '```states A settings page\'s lifecycle',
    'Viewing: Read only. (start)',
    'Editing: The name can be changed. shows settings',
    'Saved: The record is written. (final)',
    'Viewing -> Editing: edit',
    'Editing -> Saved: save',
    'grid:',
    'Viewing | Editing | Saved',
    '```',
    '',
    '## Screens',
    '',
    '```screen settings The settings page, with a way to save',
    'title: Settings',
    'row:',
    '  field: Display name (changed) (1)',
    '  button: Save changes (new) (2)',
    '```',
    '1: **The name is editable.** It was read only before.',
    '2: **Save is the only new control.** It writes the record and closes the page.',
].join('\n');

export const AllBlocksLight: Story = {
    args: { md: ALL_BLOCKS_MD },
    globals: { vscodeTheme: 'vivid-light' },
};

export const AllBlocksDark: Story = {
    args: { md: ALL_BLOCKS_MD },
    globals: { vscodeTheme: 'monokai-black' },
};
