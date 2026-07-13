import type { Meta, StoryObj } from '@storybook/preact';
import './codex.css';

const frames = [
  { width: 800, gap: 20, note: 'TOC + reading column; context folds away' },
  { width: 1100, gap: 32, note: 'Three columns with compact gutters' },
  { width: 1400, gap: 56, note: 'Gutters grow; reading measure does not' },
];

function Layout() {
  return (
    <div class="codex-redesign cx-page cx-story-pad">
      <p class="cx-eyebrow">CODEX / RESPONSIVE GRID</p>
      <h1 class="cx-display">Space serves reading, not the viewport.</h1>
      <p class="cx-lede">A centered rail/content/context grid uses fluid gutters, while the prose column stops at 72 characters. Density stays comfortable: 14px body, 1.68 line-height, 4/8px spacing rhythm.</p>
      <div class="cx-layout-stack cx-section">
        {frames.map(frame => (
          <section class="cx-layout-demo" style={`max-width:${frame.width}px`} key={frame.width}>
            <div class="cx-layout-caption"><span>{frame.width}px viewport</span><span>{frame.note}</span></div>
            <div class="cx-layout-frame" style={`--demo-gap:${frame.gap}px`}>
              <div class="cx-layout-block">Document rail<br />208px max<br /><br />Pipeline<br />Artifacts</div>
              <div class="cx-layout-copy"><h3>One definition for shared logic</h3><p>A maintainer should be able to change sizing, routing, or timing once. This column remains the same readable width at every large viewport, eliminating the uncontrolled stretch and dead TOC gutter.</p><div class="cx-measure" /><div class="cx-measure-label">72ch maximum reading measure</div></div>
              <div class="cx-layout-block">Run context<br />260px max<br /><br />Status<br />Task<br />Progress</div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

const meta: Meta<typeof Layout> = { title: 'Redesign/Codex/Layout', component: Layout, parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj<typeof Layout>;
export const ResponsiveGrid: Story = {};
