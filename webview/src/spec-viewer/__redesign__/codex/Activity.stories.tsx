import type { Meta, StoryObj } from '@storybook/preact';
import { useState } from 'preact/hooks';
import ctx392Raw from '../../../../../specs/392-living-specs-viewer/.spec-context.json?raw';
import './codex.css';

type ActivityTab = 'intent' | 'decisions' | 'evaluation' | 'work';
interface Context392 {
  specName: string;
  branch: string;
  status: string;
  intent: string;
  context: string[];
  expectations: string[];
  approach: string;
  last_action: string;
  decisions: { decision: string; why?: string; rejected?: string }[];
  verified: { what: string; command?: string; result?: string }[];
  coverage: Record<string, { title: string; tasks: string[]; tests: string[] }>;
  task_summaries: Record<string, { status: string; did?: string; files?: string[] }>;
  classification: { verdict: string; projectedFiles: number; projectedTasks: number };
  step_summaries: Record<string, { summary?: string; key_finding?: string }>;
}
const ctx = JSON.parse(ctx392Raw) as Context392;

function sentenceCase(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function ContextRows() {
  return <dl class="cx-context-list">{ctx.context.map((item, index) => {
    const split = item.indexOf(':');
    const rawLabel = split >= 0 ? item.slice(0, split) : `Context ${index + 1}`;
    const value = split >= 0 ? item.slice(split + 1).trim() : item;
    return <div key={item}><dt>{sentenceCase(rawLabel)}</dt><dd>{value}</dd></div>;
  })}</dl>;
}

function IntentPanel() {
  const approachParts = ctx.approach.split(':');
  const approachTitle = approachParts.length > 1 ? approachParts.shift()! : 'Implementation approach';
  const approachBody = approachParts.length > 0 ? approachParts.join(':').trim() : ctx.approach;
  return (
    <div class="cx-activity-panel">
      <section class="cx-card cx-approach-card"><span class="cx-card-label">Approach</span><h3>{approachTitle}</h3><p>{sentenceCase(approachBody)}</p>{ctx.step_summaries.plan?.key_finding && <div class="cx-key-finding"><span>Key finding</span><p>{sentenceCase(ctx.step_summaries.plan.key_finding)}</p></div>}</section>
      <div class="cx-intent-grid">
        <section class="cx-card"><span class="cx-card-label">Context</span><ContextRows /></section>
        <section class="cx-card cx-card--quiet"><span class="cx-card-label">Boundaries</span><ul class="cx-list">{ctx.expectations.map(item => <li key={item}>{sentenceCase(item)}</li>)}</ul></section>
      </div>
      <section class="cx-card cx-outcome-card"><span class="cx-card-label">Outcome</span><h3>What changed</h3><p>{ctx.step_summaries.implement?.summary ?? ctx.last_action}</p><div class="cx-outcome-line"><span class="cx-proof-check">✓</span><span>{ctx.last_action}</span></div></section>
    </div>
  );
}

function DecisionsPanel() {
  return <section class="cx-card cx-decision-list"><span class="cx-card-label">Recorded decisions</span>{ctx.decisions.map(item => <article class="cx-decision" key={item.decision}><div><h3>{sentenceCase(item.decision)}</h3>{item.why && <p><b>Why&nbsp;</b>{item.why}</p>}{item.rejected && <p><b>Rejected&nbsp;</b>{item.rejected}</p>}</div></article>)}</section>;
}

function EvaluationPanel() {
  return (
    <div class="cx-activity-panel">
      <section class="cx-card"><span class="cx-card-label">Verified</span>{ctx.verified.map(item => <div class="cx-proof-row" key={item.what}><span class="cx-proof-check">✓</span><div><strong>{sentenceCase(item.what)}</strong>{item.command && <code>{item.command}</code>}{item.result && <span> · {item.result}</span>}</div></div>)}</section>
      <section class="cx-card"><span class="cx-card-label">Requirement coverage</span>{Object.entries(ctx.coverage).map(([id, row]) => <div class="cx-coverage-row" key={id}><code>{id}</code><span>{row.title}</span><span class="cx-badge cx-badge--success">{row.tasks.length} tasks · {row.tests.length} proof</span></div>)}</section>
    </div>
  );
}

function WorkPanel() {
  const tasks = Object.entries(ctx.task_summaries);
  return <section class="cx-card"><span class="cx-card-label">Implemented work</span>{tasks.map(([id, task]) => <div class="cx-proof-row" key={id}><span class="cx-proof-check">✓</span><div><strong>{id} · {task.did ?? 'Completed'}</strong>{task.files?.length ? <code>{task.files.join(' · ')}</code> : null}</div></div>)}</section>;
}

function Activity392() {
  const [tab, setTab] = useState<ActivityTab>('intent');
  const labels: { id: ActivityTab; label: string; count?: number }[] = [
    { id: 'intent', label: 'Intent' },
    { id: 'decisions', label: 'Decisions', count: ctx.decisions.length },
    { id: 'evaluation', label: 'Evaluation', count: ctx.verified.length },
    { id: 'work', label: 'Work', count: Object.keys(ctx.task_summaries).length },
  ];
  return (
    <div class="codex-redesign cx-page cx-story-pad">
      <div style="max-width:980px;margin:0 auto">
        <header class="cx-activity-hero">
          <div class="cx-row"><span class="cx-badge cx-badge--success"><span class="cx-dot" />{sentenceCase(ctx.status)}</span><span class="cx-badge">{sentenceCase(ctx.classification.verdict)} scope</span><span class="cx-branch-chip" title={`Branch: ${ctx.branch}`}><span class="codicon codicon-git-branch" aria-hidden="true" /><span class="cx-branch-label">Branch</span><code>{ctx.branch}</code></span></div>
          <h2>{sentenceCase(ctx.specName)}</h2>
          <p class="cx-activity-intent">{ctx.intent}</p>
          <div class="cx-activity-stats"><span class="cx-activity-stat"><strong>15 / 15</strong> tasks</span><span class="cx-activity-stat"><strong>9 / 9</strong> requirements</span><span class="cx-activity-stat"><strong>{ctx.verified.length}</strong> checks</span><span class="cx-activity-stat"><strong>{ctx.decisions.length}</strong> decisions</span></div>
        </header>
        <nav class="cx-activity-tabs" aria-label="Activity sections">{labels.map(item => <button class={`cx-tab${tab === item.id ? ' is-active' : ''}`} aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)} key={item.id}><span>{item.label}</span>{item.count !== undefined && <span class="cx-tab-count">{item.count}</span>}</button>)}</nav>
        {tab === 'intent' && <IntentPanel />}
        {tab === 'decisions' && <DecisionsPanel />}
        {tab === 'evaluation' && <EvaluationPanel />}
        {tab === 'work' && <WorkPanel />}
      </div>
    </div>
  );
}

const meta: Meta<typeof Activity392> = { title: 'Redesign/Codex/Activity', component: Activity392, parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj<typeof Activity392>;
export const LivingSpecs392: Story = { name: '392 · Intent, context, and evaluation' };
