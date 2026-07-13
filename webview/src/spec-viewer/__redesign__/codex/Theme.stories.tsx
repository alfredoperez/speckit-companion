import type { Meta, StoryObj } from '@storybook/preact';
import { MarkdownDoc } from '../../markdown/storyDoc';
import './codex.css';

const SAMPLE = [
  '## Functional Requirements',
  '',
  '- **FR-001** The viewer MUST keep the reading measure stable at wide widths.',
  '- **FR-002** The active document MUST remain visually distinct in both themes.',
  '',
  '## Decision 1: Theme ownership',
  '',
  '**Decision**: Own semantic surfaces and content colors; inherit typography and accessibility settings.',
  '**Rationale**: Stable contrast prevents arbitrary editor palettes from changing information hierarchy.',
].join('\n');

const swatches = [
  ['Canvas', '--cx-canvas'], ['Surface', '--cx-surface'], ['Raised', '--cx-surface-2'],
  ['Ink', '--cx-ink'], ['Accent', '--cx-accent'], ['Danger', '--cx-danger'],
];

function ThemeSheet() {
  return (
    <div class="codex-redesign cx-page cx-story-pad">
      <p class="cx-eyebrow">CODEX / THEME SYSTEM</p>
      <h1 class="cx-display">A stable reading environment inside a variable editor.</h1>
      <p class="cx-lede">The host supplies font and accessibility context. The viewer owns semantic surfaces, contrast, syntax color, and status meaning.</p>

      <section class="cx-section">
        <h2 class="cx-section-title">Semantic palette</h2>
        <div class="cx-swatches">
          {swatches.map(([name, token]) => (
            <div class="cx-swatch" key={token}>
              <div class="cx-swatch-color" style={`--swatch: var(${token})`} />
              <div class="cx-swatch-meta"><span class="cx-swatch-name">{name}</span><span class="cx-swatch-token">{token}</span></div>
            </div>
          ))}
        </div>
      </section>

      <section class="cx-section">
        <h2 class="cx-section-title">Type ramp</h2>
        <div class="cx-type-row"><span class="cx-type-meta">Display / 46</span><p class="cx-type-sample" style="font-size:46px;line-height:1.05">Composable nodes</p></div>
        <div class="cx-type-row"><span class="cx-type-meta">Heading / 24</span><p class="cx-type-sample" style="font-size:24px;line-height:1.2">Functional requirements</p></div>
        <div class="cx-type-row"><span class="cx-type-meta">Body / 14</span><p class="cx-type-sample" style="font-size:14px">Readable prose uses a deliberate 72-character measure.</p></div>
        <div class="cx-type-row"><span class="cx-type-meta">Label / 11</span><p style="font:600 11px var(--cx-mono);letter-spacing:.06em">FR-001 · IMPLEMENTING · T021</p></div>
      </section>

      <section class="cx-section">
        <h2 class="cx-section-title">Tokens applied to real output</h2>
        <div class="codex-doc cx-card"><MarkdownDoc md={SAMPLE} /></div>
      </section>
    </div>
  );
}

const meta: Meta<typeof ThemeSheet> = { title: 'Redesign/Codex/Theme', component: ThemeSheet, parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj<typeof ThemeSheet>;
export const TokenSheet: Story = {};
