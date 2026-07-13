import type { Meta, StoryObj } from '@storybook/preact';
import './codex.css';

function Components() {
  return (
    <div class="codex-redesign cx-page cx-story-pad">
      <p class="cx-eyebrow">CODEX / OWNED PRIMITIVES</p>
      <h1 class="cx-display">Technical, not theatrical.</h1>
      <p class="cx-lede">The Techy seed becomes quieter: compact mono metadata, precise borders, and direct state changes—without viewfinder ornament or uppercase body labels.</p>

      <section class="cx-section">
        <h2 class="cx-section-title">Buttons</h2>
        <div class="cx-row">
          <button class="cx-btn cx-btn--primary">Continue to tasks</button>
          <button class="cx-btn cx-btn--secondary">Open document</button>
          <button class="cx-btn cx-btn--ghost">Copy branch</button>
          <button class="cx-btn cx-btn--danger">Archive spec</button>
          <button class="cx-btn cx-btn--secondary" disabled>Unavailable</button>
        </div>
      </section>

      <section class="cx-section cx-grid cx-grid--2">
        <div class="cx-card">
          <span class="cx-card-label">STATUS BADGES</span>
          <div class="cx-row"><span class="cx-badge cx-badge--success"><i class="cx-dot" />Complete</span><span class="cx-badge cx-badge--warning"><i class="cx-dot" />In review</span><span class="cx-badge cx-badge--danger"><i class="cx-dot" />Blocked</span><span class="cx-badge">Draft</span></div>
        </div>
        <div class="cx-card">
          <span class="cx-card-label">DOCUMENT CHIPS</span>
          <div class="cx-row"><button class="cx-chip is-active">Specification</button><button class="cx-chip">Research <span class="cx-badge">6</span></button><button class="cx-chip">Data model</button></div>
        </div>
        <div class="cx-card">
          <span class="cx-card-label">SEGMENTED TAB</span>
          <div class="cx-tabs" role="tablist" aria-label="Activity details"><button class="cx-tab is-active" role="tab" aria-selected="true">Decisions</button><button class="cx-tab" role="tab" aria-selected="false">Work</button><button class="cx-tab" role="tab" aria-selected="false">Proof</button></div>
        </div>
        <div class="cx-card cx-card--quiet">
          <span class="cx-card-label">SURFACE HIERARCHY</span>
          <h3>Parity gate</h3><p>Secondary surfaces group related facts. Primary cards are reserved for decisions and actions.</p>
        </div>
      </section>
    </div>
  );
}

const meta: Meta<typeof Components> = { title: 'Redesign/Codex/Component Library', component: Components, parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj<typeof Components>;
export const Primitives: Story = {};
