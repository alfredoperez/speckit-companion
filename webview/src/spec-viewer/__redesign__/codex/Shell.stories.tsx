import type { Meta, StoryObj } from '@storybook/preact';
import { useState } from 'preact/hooks';
import { MarkdownDoc } from '../../markdown/storyDoc';
import spec172 from '../../../../../specs/172-composable-command-nodes/spec.md?raw';
import plan172 from '../../../../../specs/172-composable-command-nodes/plan.md?raw';
import tasks172 from '../../../../../specs/172-composable-command-nodes/tasks.md?raw';
import research172 from '../../../../../specs/172-composable-command-nodes/research.md?raw';
import dataModel172 from '../../../../../specs/172-composable-command-nodes/data-model.md?raw';
import quickstart172 from '../../../../../specs/172-composable-command-nodes/quickstart.md?raw';
import checklist172 from '../../../../../specs/172-composable-command-nodes/checklists/requirements.md?raw';
import contract172 from '../../../../../specs/172-composable-command-nodes/contracts/assembly-and-parity.md?raw';
import './codex.css';

type View = 'overview' | 'document';
type DocId = 'spec' | 'plan' | 'tasks' | 'research' | 'data-model' | 'quickstart' | 'checklist' | 'contract';

const docs: Record<DocId, { label: string; md: string; kind: 'core' | 'artifact' }> = {
  spec: { label: 'Specification', md: spec172, kind: 'core' },
  plan: { label: 'Plan', md: plan172, kind: 'core' },
  tasks: { label: 'Tasks', md: tasks172, kind: 'core' },
  research: { label: 'Research', md: research172, kind: 'artifact' },
  'data-model': { label: 'Data Model', md: dataModel172, kind: 'artifact' },
  quickstart: { label: 'Quickstart', md: quickstart172, kind: 'artifact' },
  checklist: { label: 'Checklist', md: checklist172, kind: 'artifact' },
  contract: { label: 'Contract', md: contract172, kind: 'artifact' },
};

function RailButton({ id, active, onSelect }: { id: DocId; active: boolean; onSelect: (id: DocId) => void }) {
  const state = id === 'tasks' ? 'is-current' : 'is-complete';
  return <button class={`cx-rail-button ${state}${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => onSelect(id)}><span class="cx-rail-mark" />{docs[id].label}</button>;
}

function Overview() {
  return (
    <>
      <header class="cx-main-head"><p class="cx-eyebrow">RUN OVERVIEW</p><h2>Ready to ship with proof attached.</h2><p>The overview is the landing view: progress, current intent, decisions, and evidence are visible before opening any document.</p></header>
      <div class="cx-progress">
        <div class="cx-progress-top"><div><div class="cx-progress-value">25 / 32</div><div class="cx-progress-label">implementation tasks complete</div></div><span class="cx-badge cx-badge--warning"><span class="cx-dot" />Implementing</span></div>
        <div class="cx-progress-track" aria-label="78 percent complete" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={78}><div class="cx-progress-fill" /></div>
      </div>
      <div class="cx-metrics">
        <div class="cx-metric"><strong>16 / 16</strong><span>requirements covered</span></div>
        <div class="cx-metric"><strong>9</strong><span>verification checks</span></div>
        <div class="cx-metric"><strong>0</strong><span>open concerns</span></div>
      </div>
      <section class="cx-card">
        <span class="cx-card-label">LATEST ACTIVITY</span>
        <ul class="cx-feed">
          <li><span class="cx-feed-mark" /><div><strong>Golden fixtures captured</strong><p>The parity baseline now covers every assembled Companion command.</p></div><time>11:42</time></li>
          <li><span class="cx-feed-mark" /><div><strong>Shared timing block extracted</strong><p>Eleven command bodies now resolve from one source.</p></div><time>11:19</time></li>
          <li><span class="cx-feed-mark" /><div><strong>Decision recorded</strong><p>Assembly stays authoring-time so shipped commands remain self-contained.</p></div><time>10:56</time></li>
        </ul>
      </section>
    </>
  );
}

function Shell() {
  const [view, setView] = useState<View>('overview');
  const [doc, setDoc] = useState<DocId>('spec');
  const selectDoc = (id: DocId) => { setDoc(id); setView('document'); };

  return (
    <div class="codex-redesign cx-shell">
      <header class="cx-shell-top">
        <div><h1 class="cx-shell-title">Composable Command Nodes</h1><div class="cx-shell-subtitle">172-composable-command-nodes</div></div>
        <div class="cx-view-switch" aria-label="Viewer mode"><button class={`cx-view-btn${view === 'overview' ? ' is-active' : ''}`} onClick={() => setView('overview')}>Overview</button><button class={`cx-view-btn${view === 'document' ? ' is-active' : ''}`} onClick={() => setView('document')}>Documents</button></div>
        <span class="cx-badge cx-badge--warning"><span class="cx-dot" />Implementing</span>
      </header>

      <div class="cx-shell-grid">
        <nav class="cx-rail" aria-label="Spec documents">
          <div class="cx-rail-group"><p class="cx-rail-label">PIPELINE</p>{(['spec', 'plan', 'tasks'] as DocId[]).map(id => <RailButton key={id} id={id} active={view === 'document' && doc === id} onSelect={selectDoc} />)}</div>
          <div class="cx-rail-group"><p class="cx-rail-label">ARTIFACTS</p>{(['research', 'data-model', 'quickstart', 'checklist', 'contract'] as DocId[]).map(id => <RailButton key={id} id={id} active={view === 'document' && doc === id} onSelect={selectDoc} />)}</div>
        </nav>

        <main class="cx-main">
          {view === 'overview' ? <Overview /> : <div><header class="cx-main-head"><p class="cx-eyebrow">DOCUMENT / {docs[doc].kind}</p><h2>{docs[doc].label}</h2><p>Reading mode keeps navigation persistent while constraining prose to a stable 72-character measure.</p></header><div class="codex-doc" style="padding:0"><MarkdownDoc md={docs[doc].md} /></div></div>}
        </main>

        <aside class="cx-aside" aria-label="Run context">
          <div class="cx-aside-card"><h2 class="cx-aside-title">Run context</h2><dl><div><dt>Status</dt><dd>Active</dd></div><div><dt>Phase</dt><dd>Implement</dd></div><div><dt>Task</dt><dd>T026</dd></div><div><dt>Progress</dt><dd>78%</dd></div></dl></div>
          <div class="cx-aside-card"><h2 class="cx-aside-title">Pipeline state</h2><p style="margin:0;color:var(--cx-ink-2);font-size:12px">Location is selected in the document rail. Completion is shown separately by the rail marks.</p></div>
        </aside>
      </div>

      <footer class="cx-shell-footer"><span class="cx-footer-context">Next: finish T026</span><button class="cx-btn cx-btn--ghost">Review changes</button><button class="cx-btn cx-btn--primary">Continue run</button></footer>
    </div>
  );
}

const customSteps = [
  { name: 'discover', label: 'Discovery', kind: 'doc', state: 'complete' },
  { name: 'specify', label: 'Specification', kind: 'doc', state: 'complete' },
  { name: 'plan', label: 'Plan', kind: 'doc', state: 'complete' },
  { name: 'security-review', label: 'Security Review', kind: 'doc', state: 'next' },
  { name: 'tickets', label: 'Create Tickets', kind: 'action', state: 'waiting' },
  { name: 'implement', label: 'Implement', kind: 'action', state: 'waiting' },
  { name: 'release', label: 'Release', kind: 'action', state: 'waiting' },
] as const;

function CustomWorkflow() {
  const [menuOpen, setMenuOpen] = useState(true);
  return (
    <div class="codex-redesign cx-shell">
      <header class="cx-shell-top"><div><h1 class="cx-shell-title">Identity Service Hardening</h1><div class="cx-shell-subtitle">workflow: secure-delivery · branch: feature/identity-hardening</div></div><div class="cx-view-switch"><button class="cx-view-btn">Overview</button><button class="cx-view-btn is-active">Documents</button></div><span class="cx-badge cx-badge--warning"><span class="cx-dot" />Review gate</span></header>
      <div class="cx-shell-grid">
        <nav class="cx-rail" aria-label="Custom workflow steps"><div class="cx-rail-group"><p class="cx-rail-label">SECURE DELIVERY</p><div class="cx-workflow-map">{customSteps.map(step => <div class={`cx-workflow-step${step.state === 'next' ? ' is-active' : ''}${step.kind === 'action' ? ' is-action' : ''}`} key={step.name}><span class={`cx-rail-mark${step.state === 'complete' ? ' is-complete' : ''}`} style={step.state === 'complete' ? 'background:var(--cx-success);border-color:var(--cx-success)' : ''} /><span>{step.label}</span><span class="cx-workflow-kind">{step.kind === 'doc' ? 'DOC' : 'ACTION'}</span></div>)}</div></div></nav>
        <main class="cx-main"><header class="cx-main-head"><p class="cx-eyebrow">CUSTOM WORKFLOW / REVIEW GATE</p><h2>Plan approved. Security review is next.</h2><p>The navigation is generated from the workflow definition. Document-producing and action-only steps share the run order, while only real files appear as readable artifacts.</p></header><section class="cx-card"><span class="cx-card-label">SECURITY REVIEW INPUTS</span><h3>Artifacts attached to this step</h3><div class="cx-row" style="margin-top:14px"><span class="cx-chip is-active">threat-model.md</span><span class="cx-chip">contracts/auth-api.md</span><span class="cx-chip">research.md</span></div></section><section class="cx-card cx-card--quiet" style="margin-top:14px"><span class="cx-card-label">WORKFLOW-PROVIDED COMMANDS</span><p>Custom commands remain available beside lifecycle actions: Generate risk register, Sync Jira, and Request architecture review.</p></section></main>
        <aside class="cx-aside"><div class="cx-aside-card"><h2 class="cx-aside-title">Workflow contract</h2><dl><div><dt>Steps</dt><dd>7</dd></div><div><dt>Documents</dt><dd>4</dd></div><div><dt>Actions</dt><dd>3</dd></div><div><dt>Next</dt><dd>Review</dd></div></dl></div><div class="cx-aside-card"><h2 class="cx-aside-title">Why this scales</h2><p style="margin:0;color:var(--cx-ink-2);font-size:12px">Labels, ordering, artifacts, checkpoints, and commands are rendered from workflow data—not a canonical four-step assumption.</p></div></aside>
      </div>
      <footer class="cx-shell-footer"><span class="cx-footer-context">Next from workflow: Security Review</span><div class="cx-action-wrap"><button class="cx-btn cx-btn--secondary" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>Other actions</button>{menuOpen && <div class="cx-action-menu"><button>Generate risk register<small>Custom command · security-review</small></button><button>Request architecture review<small>Custom command · security-review</small></button><button>Re-run Plan<small>Step action · plan</small></button></div>}</div><button class="cx-btn cx-btn--primary">Continue to Security Review</button></footer>
    </div>
  );
}

const meta: Meta<typeof Shell> = { title: 'Redesign/Codex/Full Viewer', component: Shell, parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj<typeof Shell>;
export const ActivityFirst: Story = {};
export const CustomWorkflowSteps: Story = { name: 'Custom workflow · extra steps and actions', render: () => <CustomWorkflow /> };
