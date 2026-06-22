import type { Meta, StoryObj } from '@storybook/preact';
import { MarkdownDoc } from './markdown/storyDoc';

/**
 * Experiment: extend the Terminal button language to the card components.
 * Renders the *real* entity / decision / requirement components twice — current
 * vs a "terminal" skin (squared corners, hairline border that flips to the
 * accent on hover, a viewfinder corner-bracket that sharpens on hover, squared
 * badges). Theme-adaptive; the accent is the editor's.
 */
const SAMPLE = [
    '### Key Entities',
    '',
    '- **SpecContext** (`.spec-context.json`) — the per-spec lifecycle record; status and history stay byte-identical.',
    '- **Transition** — an append-only event: `step`, `substep`, `from`, `by`, `at`.',
    '',
    '## Functional Requirements',
    '',
    '- **FR-001** The system MUST keep the side-by-side layout when there is room.',
    '',
    '## Decision 1: Status vocabulary',
    '',
    '**Decision**: use a closed `status` enum.',
    '**Rationale**: maps 1:1 to pipeline steps; the viewer picks badge text without inspecting history.',
].join('\n');

const TERMINAL_CSS = `
.terminal-skin #markdown-content .entity-row,
.terminal-skin #markdown-content .decision-card,
.terminal-skin #markdown-content .con-row,
.terminal-skin #markdown-content .req-row,
.terminal-skin #markdown-content .ck-group {
  border-radius: 2px;
  position: relative;
  transition: border-color 150ms cubic-bezier(.2,0,0,1), box-shadow 150ms cubic-bezier(.2,0,0,1);
}
.terminal-skin #markdown-content .entity-row:hover,
.terminal-skin #markdown-content .decision-card:hover {
  border-color: var(--accent);
  transform: none;
  box-shadow: none;
}
/* viewfinder corner-bracket accent (top-right), sharpens on hover */
.terminal-skin #markdown-content .entity-row::after,
.terminal-skin #markdown-content .decision-card::after {
  content: "";
  position: absolute;
  top: 7px; right: 7px;
  width: 8px; height: 8px;
  border-top: 1.5px solid var(--accent);
  border-right: 1.5px solid var(--accent);
  opacity: .4;
  transition: all 150ms cubic-bezier(.2,0,0,1);
  pointer-events: none;
}
.terminal-skin #markdown-content .entity-row:hover::after,
.terminal-skin #markdown-content .decision-card:hover::after {
  opacity: 1; top: 4px; right: 4px;
}
/* squared, terminal-feel badges */
.terminal-skin #markdown-content .decision-num,
.terminal-skin #markdown-content .req-badge { border-radius: 2px; }
.terminal-skin #markdown-content .entity-name,
.terminal-skin #markdown-content .decision-title { letter-spacing: .01em; }
@media (prefers-reduced-motion: reduce) {
  .terminal-skin #markdown-content .entity-row::after,
  .terminal-skin #markdown-content .decision-card::after { transition: none; }
}
`;

const COL = 'flex: 1 1 320px; min-width: 300px;';
const HEAD = 'font-family: var(--font-mono, monospace); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted, #888); margin: 0 0 8px; padding-left: 4px;';

function Compare() {
    return (
        <div style="padding: 24px;">
            <style>{TERMINAL_CSS}</style>
            <div style="display: flex; gap: 32px; flex-wrap: wrap;">
                <div style={COL}>
                    <p style={HEAD}>Current</p>
                    <MarkdownDoc md={SAMPLE} />
                </div>
                <div style={COL}>
                    <p style={HEAD}>Terminal</p>
                    <div class="terminal-skin"><MarkdownDoc md={SAMPLE} /></div>
                </div>
            </div>
        </div>
    );
}

const meta: Meta<typeof Compare> = {
    title: 'Experiments/Techy Cards',
    component: Compare,
};
export default meta;
type Story = StoryObj<typeof Compare>;

export const CurrentVsTerminal: Story = {};
