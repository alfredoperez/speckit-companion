import type { Meta, StoryObj } from '@storybook/preact';
import { MarkdownDoc } from './storyDoc';

/** Ledger research and data components, rendered through the real pipeline. */
const meta: Meta<typeof MarkdownDoc> = {
    title: 'VS Code Extension/Spec Viewer/Markdown Rendering/Ledger Research & Data',
    component: MarkdownDoc,
};
export default meta;
type Story = StoryObj<typeof MarkdownDoc>;

const research = [
    '# Research: Step rail', '',
    '## Decision 1 — Read the step directory in TypeScript', '',
    '**Decision**: `projectSteps.ts` reads `.specify/companion/nodes/*/` with fs directly.',
    '**Rationale**: The builder reads the graph once and can afford a 30-second timeout. See FR-002.',
    '**Alternatives considered**:',
    '- **Shell out to pipeline-graph.py**: Cost, and the Python dependency.',
    '- **Cache the graph**: Puts the launch back on the first render.', '',
    '## Decision 2: No cache', '', '**Decision**: Read the directory on each resolution.', '',
    '## R1 — What actually kills the process', '',
    '**Question**: Which client emits the fatal event, and why does the process exit?', '',
    '**Finding**: the store never attaches an `error` listener, so redis emitting `error` becomes an uncaught exception.', '',
    '```js', 'var redisCache = Redis.createClient.apply(Redis, arguments);', '```', '',
    'It emits from seven sites.', '',
    '**Decision**: attach `client.on(\'error\', …)` at construction. FR-003', '',
    '## Follow-up work identified', '', '- Migrate the cache store to ioredis.', '- Emit a metric for outage duration.', '',
].join('\n');

const dataModel = [
    '# Data Model: Dialect', '',
    '## ParsedStatement', '', 'File: `models/parsed_statement.rs` (new).', '',
    '| Field | Type | Invariant |', '|---|---|---|',
    '| source | `Arc<str>` | Original active-batch text. |',
    '| span | `SqlSourceSpan` | Original statement bounds. |',
    '| payload | `StatementPayload` | Exactly one variant. |', '',
    'Immutable and role-independent.', '',
    '## SqlSourceSpan', '', '| Field | Type | Invariant |', '|---|---|---|', '| start | `u32` | Byte offset. |', '',
    '## StatementPayload', '', '| Variant | Payload | Use |', '|---|---|---|',
    '| Sql | `Box<Statement>` | Standard SQL |', '| Kalam | `KalamStatement` | Product extensions |', '',
    '## State transitions', '', '| From | Event | To |', '|---|---|---|',
    '| State A picked | Click on state B\'s button | State B picked |', '| Any | The board redraws | Drawn |', '',
    '## Key Relationships', '', '- **ParsedStatement** has one **StatementPayload**', '- **ParsedStatement** has one **SqlSourceSpan**', '',
].join('\n');

const contracts = [
    '# Contract: living-validate', '',
    '## The script', '', 'A shape check over every registered living spec. Reports and exits; never writes.', '',
    '```', 'python3 living_validate.py [--root PATH] [--json]', '```', '',
    '| Flag | Meaning |', '|---|---|', '| `--root` | Repository root. Defaults to the working directory. |', '| `--json` | Emit the machine-readable object. |', '',
    '**Exit code is always 0, whatever state the project is in.**', '',
    '## POST /api/items', '', '| Status | Meaning |', '|---|---|', '| 400 | Body is not valid JSON |', '',
].join('\n');

const quickstart = [
    '# Quickstart: Demo', '',
    '1. **Switch off by default** (FR-002): open the page and sign in. Expect the "not enabled" page with a link.',
    '2. **Turn it on**: as the administrator, run:', '   ```', '   do ##class(Settings).SetInterfaceEnabled(1)', '   ```', '',
].join('\n');

export const DecisionsAndQuestions: Story = { args: { md: research } };
export const DataModel: Story = { args: { md: dataModel } };
export const Contracts: Story = { args: { md: contracts } };
export const Quickstart: Story = { args: { md: quickstart } };
