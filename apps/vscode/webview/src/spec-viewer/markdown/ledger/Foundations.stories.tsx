import type { Meta, StoryObj } from '@storybook/preact';
import { MarkdownDoc } from '../storyDoc';
import { eyebrow, fileChip, idChip, priorityMark, statusDot, type Family, type Status } from './primitives';

const families: Family[] = ['story', 'req', 'decision', 'task', 'data', 'guard'];
const statuses: Status[] = ['done', 'running', 'warn', 'fail', 'todo'];

const gallery = `
<div style="display:grid;gap:16px;max-width:820px">
  <div style="display:flex;gap:20px;flex-wrap:wrap">${families.map((f) => `<span class="lg-block lg-wash lg-fam-${f}" style="padding:6px 12px">${eyebrow(f, f, 3)}</span>`).join('')}</div>
  <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">${idChip('FR-001')}${idChip('T003', { status: 'done' })}${idChip('US1')}${idChip('R12', { doc: 'research' })}${idChip('FR-404', { resolved: false })}${fileChip('src/core/store.ts')}</div>
  <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">${statuses.map((s) => `<span style="display:inline-flex;gap:6px;align-items:center">${statusDot(s)}${s}</span>`).join('')}</div>
  <div style="display:flex;gap:16px;align-items:center">${priorityMark(1)}${priorityMark(2)}${priorityMark(3)}</div>
</div>`;

const sample = `### User Story 1 - See status at a glance (Priority: P1)

Covers FR-001 and SC-001. Decided in research.md R12; tracked by T003. FR-404 does not exist.

**Acceptance Scenarios**:

1. **Given** a spec is open, **When** the header renders, **Then** the badge shows the status

- **FR-001**: The system MUST show the status in the header at all times.
- [x] T003 Wire the header badge (FR-001)
`;

/** Hover or focus a chip for the card, click it to jump and get the Back pill (Alt+Left returns). */
const meta: Meta = {
    title: 'VS Code Extension/Spec Viewer/Ledger/Foundations',
};
export default meta;
type Story = StoryObj;

const Page = () => (
    <div style="display:grid;gap:24px">
        <div dangerouslySetInnerHTML={{ __html: gallery }} />
        <MarkdownDoc md={sample} />
    </div>
);

export const Dark: Story = { render: Page, globals: { vscodeTheme: 'monokai-black' } };
export const Light: Story = { render: Page, globals: { vscodeTheme: 'vivid-light' } };
