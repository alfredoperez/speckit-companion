/**
 * Mockups, not shipped components: four blocks a step could write and the viewer
 * could draw. The content is from one real plan run; nothing here is wired.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

const CSS = `
.pc-page { max-width: 900px; margin: 0 auto; padding: 32px 28px 64px; font-family: var(--font-family); color: var(--text-body); }
.pc-page h2 { font-size: var(--text-xl); color: var(--text-primary); margin: 28px 0 12px; }
.pc-page p { line-height: var(--leading-relaxed); margin: 10px 0; }
.pc-card { border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-secondary); overflow: visible; margin: 14px 0 22px; }
.pc-head { display: flex; align-items: center; gap: 10px; padding: 9px 14px; background: var(--bg-inset); border-bottom: 1px solid var(--border); border-radius: var(--radius-lg) var(--radius-lg) 0 0; font-family: var(--font-mono); font-size: var(--text-sm); }
.pc-kind { background: var(--text-primary); color: var(--bg-primary); border-radius: var(--radius-sm); padding: 1px 7px; font-weight: 700; font-size: var(--text-xs); letter-spacing: .04em; text-transform: uppercase; }
.pc-title { color: var(--text-primary); font-weight: 600; }
.pc-right { margin-left: auto; display: flex; gap: 10px; color: var(--text-secondary); }
.pc-add { color: var(--success); } .pc-del { color: var(--error); } .pc-chg { color: var(--warning); }
.pc-link { color: inherit; text-decoration: none; border-bottom: 1px dotted currentColor; cursor: pointer; }
.pc-link:hover { color: var(--accent-strong); border-bottom-style: solid; }
.pc-rows { margin: 0; padding: 6px 0; list-style: none; font-family: var(--font-mono); font-size: var(--text-sm); }
.pc-row { position: relative; display: flex; align-items: baseline; gap: 8px; padding: 4px 14px; }
.pc-row--add { background: var(--success-subtle); }
.pc-row--chg { background: var(--warning-subtle); }
.pc-row--del { background: var(--error-subtle); }
.pc-row--del .pc-name { text-decoration: line-through; }
.pc-row--struck .pc-name, .pc-row--struck .pc-where { text-decoration: line-through; opacity: .55; }
.pc-mark { width: 12px; font-weight: 700; flex: none; }
.pc-tree { color: var(--text-muted); white-space: pre; flex: none; }
.pc-name { color: var(--text-primary); }
.pc-row--add .pc-name { font-weight: 700; }
.pc-new { font-family: var(--font-family); font-size: var(--text-xs); color: var(--success); border: 1px solid var(--success); border-radius: 999px; padding: 0 6px; }
.pc-where { margin-left: auto; color: var(--text-secondary); padding-left: 16px; white-space: nowrap; }
.pc-acts { display: none; gap: 6px; margin-left: 12px; }
.pc-row:hover .pc-acts, .pc-row--hover .pc-acts { display: flex; }
.pc-act { font-family: var(--font-mono); font-size: var(--text-xs); border: 1px solid var(--border); background: var(--bg-elevated); color: var(--text-primary); border-radius: var(--radius-sm); padding: 1px 8px; cursor: pointer; }
.pc-act--strike { color: var(--error); }
.pc-rowcomment { margin: 2px 14px 6px 46px; padding: 6px 10px; border-left: 3px solid var(--review); background: var(--review-subtle); color: var(--review-ink); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; font-family: var(--font-family); font-size: var(--text-sm); }
.pc-note { padding: 10px 14px 12px; border-top: 1px solid var(--border); font-size: var(--text-sm); }
.pc-code { margin: 0; padding: 10px 0; font-family: var(--font-mono); font-size: var(--text-sm); line-height: 1.7; overflow-x: auto; }
.pc-line { display: flex; gap: 14px; padding: 0 14px; }
.pc-line--hot { background: var(--warning-subtle); }
.pc-no { width: 18px; text-align: right; color: var(--text-muted); flex: none; user-select: none; }
.pc-line--hot .pc-no { color: var(--warning); font-weight: 700; }
.pc-src { color: var(--text-primary); white-space: pre; }
.pc-kw { color: var(--code-keyword); } .pc-str { color: var(--code-string); } .pc-fn { color: var(--code-function); } .pc-ty { color: var(--code-type); }
.pc-pin { margin: 6px 14px 8px 46px; padding: 7px 12px; border-left: 3px solid var(--review); background: var(--review-subtle); color: var(--review-ink); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 700; }
.pc-svg { display: block; width: 100%; height: auto; }
.pc-node rect { fill: var(--bg-elevated); stroke: var(--text-secondary); stroke-width: 1.5; cursor: pointer; }
.pc-node text { fill: var(--text-primary); font-family: var(--font-family); font-size: 14px; pointer-events: none; }
.pc-node--final rect { stroke-width: 3; }
.pc-node--on rect { fill: var(--review-subtle); stroke: var(--review); stroke-width: 2.5; }
.pc-node--past rect { fill: var(--bg-inset); }
.pc-edge { stroke: var(--text-secondary); stroke-width: 1.4; fill: none; }
.pc-edge--hot { stroke: var(--review); stroke-width: 2.6; }
.pc-edge--new { stroke: var(--success); stroke-dasharray: 5 4; }
.pc-elabel { fill: var(--text-secondary); font-family: var(--font-mono); font-size: 12px; }
.pc-elabel--hot { fill: var(--review-ink); font-weight: 700; }
.pc-elabel--new { fill: var(--success); }
.pc-statebar { display: flex; align-items: baseline; gap: 12px; padding: 10px 14px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.pc-statename { font-family: var(--font-mono); font-weight: 700; color: var(--review-ink); }
.pc-hint { margin-left: auto; color: var(--text-secondary); font-size: var(--text-sm); }
.pc-stage { background: var(--bg-inset); padding: 18px 14px; border-radius: 0 0 var(--radius-lg) var(--radius-lg); }
.pc-wire { position: relative; max-width: 560px; margin: 0 auto; background: var(--bg-primary); border: 1px dashed var(--text-muted); border-radius: var(--radius-lg); font-size: var(--text-sm); }
.pc-wire-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; }
.pc-wire-row + .pc-wire-row { border-top: 1px solid var(--border); }
.pc-wire-title { font-weight: 700; color: var(--text-primary); font-size: var(--text-lg); }
.pc-chip { font-family: var(--font-mono); font-size: var(--text-xs); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 1px 7px; color: var(--text-primary); background: var(--bg-elevated); position: relative; }
.pc-chip--status { background: var(--success-subtle); color: var(--success); border-color: transparent; font-weight: 700; }
.pc-chip--new { border-color: var(--success); color: var(--success); }
.pc-chip--merged { border-color: var(--review); color: var(--review-ink); }
.pc-muted { color: var(--text-secondary); }
.pc-dot { position: absolute; top: -11px; right: -11px; width: 20px; height: 20px; border-radius: 50%; background: var(--text-secondary); color: var(--bg-primary); font: 700 11px/20px var(--font-family); text-align: center; cursor: pointer; border: 2px solid var(--bg-primary); }
.pc-dot--on { background: var(--review); box-shadow: 0 0 0 3px var(--review-subtle); }
.pc-pop { position: absolute; top: 16px; left: 8px; z-index: 2; width: 250px; background: var(--bg-elevated); border: 1px solid var(--text-primary); border-radius: var(--radius-md); padding: 10px 12px; box-shadow: var(--shadow-md); font-family: var(--font-family); white-space: normal; text-align: left; }
.pc-pop b { display: block; color: var(--text-primary); font-size: var(--text-sm); }
.pc-pop span { color: var(--text-body); font-size: var(--text-sm); font-weight: 400; }
.pc-legend { margin: 12px auto 0; max-width: 560px; padding-left: 20px; font-size: var(--text-sm); }
.pc-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); margin: 12px 0; }
.pc-table th, .pc-table td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top; }
.pc-table th { background: var(--bg-inset); color: var(--text-primary); }
.pc-yes { color: var(--success); font-weight: 700; } .pc-no2 { color: var(--text-muted); }
`;

function Page({ children }: { children: ComponentChildren }) {
    return (
        <div class="pc-page">
            <style>{CSS}</style>
            {children}
        </div>
    );
}

function FileLink({ where }: { where: string }) {
    return <a class="pc-link" title={`Open ${where} in the editor`}>{where}</a>;
}

type Mark = '+' | '~' | '-' | ' ';
interface Call { mark: Mark; depth: number; last?: boolean; name: string; where: string; isNew?: boolean; hover?: boolean; struck?: boolean; comment?: string }
const MARK_CLASS: Record<Mark, string> = { '+': 'add', '~': 'chg', '-': 'del', ' ': '' };

function CallsCard({ title, calls, note }: { title: string; calls: Call[]; note?: string }) {
    const count = (mark: Mark) => calls.filter(call => call.mark === mark).length;
    return (
        <div class="pc-card">
            <div class="pc-head">
                <span class="pc-kind">calls</span>
                <span class="pc-title">{title}</span>
                <span class="pc-right">
                    <span class="pc-add">+{count('+')}</span>
                    <span class="pc-del">−{count('-')}</span>
                    <span class="pc-chg">~{count('~')}</span>
                    <span>· 1 entrypoint</span>
                </span>
            </div>
            <ul class="pc-rows">
                {calls.map(call => (
                    <>
                        <li class={[
                            'pc-row',
                            MARK_CLASS[call.mark] && `pc-row--${MARK_CLASS[call.mark]}`,
                            call.hover && 'pc-row--hover',
                            call.struck && 'pc-row--struck',
                        ].filter(Boolean).join(' ')}>
                            <span class={`pc-mark pc-${MARK_CLASS[call.mark]}`}>{call.mark.trim()}</span>
                            {call.depth > 0 && <span class="pc-tree">{'   '.repeat(call.depth - 1)}{call.last ? '└─ ' : '├─ '}</span>}
                            <span class="pc-name">{call.name}</span>
                            {call.isNew && <span class="pc-new">new file</span>}
                            <span class="pc-where"><FileLink where={call.where} /></span>
                            <span class="pc-acts">
                                <button class="pc-act">✎ comment</button>
                                <button class="pc-act pc-act--strike">⊘ strike</button>
                            </span>
                        </li>
                        {call.comment && <li class="pc-rowcomment">{call.comment}</li>}
                    </>
                ))}
            </ul>
            {note && <div class="pc-note">{note}</div>}
        </div>
    );
}

const RECORD: Call[] = [
    { mark: ' ', depth: 0, name: '_main()', where: 'scripts/write-context.py:364' },
    { mark: '~', depth: 1, name: '_classify_op()', where: 'scripts/write-context.py:899' },
    { mark: '+', depth: 1, name: 'record_pull_request()', where: 'scripts/capture.py:72', hover: true },
    { mark: ' ', depth: 2, name: 'read_ctx()', where: 'scripts/spec_context.py:627' },
    { mark: ' ', depth: 2, last: true, name: 'atomic_write()', where: 'scripts/spec_context.py:701' },
    { mark: ' ', depth: 1, last: true, name: 'set_fields()', where: 'scripts/capture.py:48', struck: true, comment: 'You: do not call this here, it fills other fields.  ·  goes to the assistant with Refine' },
];

const TOOLTIP: Call[] = [
    { mark: ' ', depth: 0, name: 'SpecItem()', where: 'features/specs/specExplorerProvider.ts:656' },
    { mark: '+', depth: 1, name: 'resolveSpecPullRequest()', where: 'features/specs/specPullRequest.ts', isNew: true },
    { mark: ' ', depth: 1, last: true, name: 'resolveSpecAssistant()', where: 'features/specs/specExplorerProvider.ts:714' },
];

interface CodeLine { src: ComponentChildren; hot?: boolean; pin?: string }

function CodeCard({ file, kind, lang, lines }: { file: string; kind: 'sketch' | 'today'; lang: string; lines: CodeLine[] }) {
    return (
        <div class="pc-card">
            <div class="pc-head">
                <span class="pc-title"><FileLink where={file} /> · {kind}</span>
                <span class="pc-right">{lang}</span>
            </div>
            <div class="pc-code">
                {lines.map((line, index) => (
                    <>
                        <div class={`pc-line ${line.hot ? 'pc-line--hot' : ''}`}><span class="pc-no">{index + 1}</span><span class="pc-src">{line.src}</span></div>
                        {line.pin && <div class="pc-pin">{line.pin}</div>}
                    </>
                ))}
            </div>
        </div>
    );
}

const SKETCH: CodeLine[] = [
    { src: <><span class="pc-kw">def</span> <span class="pc-fn">record_pull_request</span>(feature_dir, branch):</> },
    { src: <>    found = gh(<span class="pc-str">"pr"</span>, <span class="pc-str">"list"</span>, <span class="pc-str">"--head"</span>, branch, <span class="pc-str">"--state"</span>, <span class="pc-str">"all"</span>)</> },
    { src: <>    pick = first(found, state=<span class="pc-str">"OPEN"</span>) <span class="pc-kw">or</span> newest(found)</>, hot: true, pin: 'The open one wins. With none open, the newest.' },
    { src: <>    <span class="pc-kw">if not</span> pick: <span class="pc-kw">return None</span></> },
    { src: <>    ctx = read_ctx(target)</> },
    { src: <>    ctx[<span class="pc-str">"prNumber"</span>] = pick.number</>, hot: true },
    { src: <>    ctx[<span class="pc-str">"prUrl"</span>] = pick.url</>, hot: true, pin: 'Only these two fields. Nothing else on the record changes.' },
    { src: <>    atomic_write(target, ctx)</> },
];

const RESOLVER: CodeLine[] = [
    { src: <><span class="pc-kw">export function</span> <span class="pc-fn">resolveSpecPullRequest</span>(ctx: <span class="pc-ty">unknown</span>): <span class="pc-ty">PullRequest</span> | <span class="pc-ty">undefined</span> {'{'}</> },
    { src: <>    <span class="pc-kw">const</span> url = text(ctx, <span class="pc-str">'prUrl'</span>);</> },
    { src: <>    <span class="pc-kw">if</span> (!url?.startsWith(<span class="pc-str">'https://'</span>)) <span class="pc-kw">return undefined</span>;</>, hot: true, pin: 'A link from a file anyone can edit: https only, or no chip.' },
    { src: <>    <span class="pc-kw">return</span> {'{'} number: count(ctx, <span class="pc-str">'prNumber'</span>), url {'}'};</> },
    { src: <>{'}'}</> },
];

interface StateInfo { id: string; x: number; y: number; final?: boolean; says: string; chip: ComponentChildren }

const STATES: StateInfo[] = [
    { id: 'no pull request', x: 30, y: 30, says: 'The run has not opened one. The header shows the branch alone.', chip: null },
    { id: 'open', x: 300, y: 30, says: 'The run opened a pull request. The chip links to it.', chip: <span class="pc-chip pc-chip--new">#901 open</span> },
    { id: 'merged', x: 570, y: 30, final: true, says: 'Merged. The chip stays, so a finished spec still points at its change.', chip: <span class="pc-chip pc-chip--merged">#901 merged</span> },
    { id: 'closed', x: 300, y: 150, final: true, says: 'Closed without merging. The chip says so and still links.', chip: <span class="pc-chip">#901 closed</span> },
];
const EDGES: Array<{ from: string; to: string; label: string; d: string; lx: number; ly: number; isNew?: boolean }> = [
    { from: 'no pull request', to: 'open', label: 'run ends', d: 'M190 54 H296', lx: 212, ly: 46 },
    { from: 'open', to: 'merged', label: 'merge', d: 'M460 54 H566', lx: 492, ly: 46 },
    { from: 'open', to: 'closed', label: 'close', d: 'M380 78 V146', lx: 390, ly: 118 },
    { from: 'closed', to: 'open', label: 'reopen', d: 'M340 146 V78', lx: 276, ly: 118, isNew: true },
];

function StatesCard({ start = 'no pull request' }: { start?: string }) {
    const [on, setOn] = useState(start);
    const state = STATES.find(candidate => candidate.id === on) ?? STATES[0];
    const order = STATES.map(candidate => candidate.id);
    return (
        <div class="pc-card">
            <div class="pc-head">
                <span class="pc-kind">states</span>
                <span class="pc-title">A spec's pull request</span>
                <span class="pc-right">4 states · <span class="pc-add">1 proposed</span></span>
            </div>
            <svg class="pc-svg" viewBox="0 0 760 210" role="img" aria-label="States of a spec's pull request">
                <defs>
                    <marker id="pc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                        <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
                    </marker>
                </defs>
                {EDGES.map(edge => {
                    const hot = edge.from === on;
                    const kind = hot ? 'hot' : edge.isNew ? 'new' : '';
                    return (
                        <g style={`color: var(${hot ? '--review' : edge.isNew ? '--success' : '--text-secondary'})`}>
                            <path class={`pc-edge ${kind ? `pc-edge--${kind}` : ''}`} d={edge.d} marker-end="url(#pc-arrow)" />
                            <text class={`pc-elabel ${kind ? `pc-elabel--${kind}` : ''}`} x={edge.lx} y={edge.ly}>{edge.label}</text>
                        </g>
                    );
                })}
                {STATES.map(node => (
                    <g class={[
                        'pc-node',
                        node.final && 'pc-node--final',
                        node.id === on && 'pc-node--on',
                        order.indexOf(node.id) < order.indexOf(on) && 'pc-node--past',
                    ].filter(Boolean).join(' ')} onClick={() => setOn(node.id)}>
                        <rect x={node.x} y={node.y} width="160" height="48" rx="24" />
                        <text x={node.x + 80} y={node.y + 29} text-anchor="middle">{node.id}</text>
                    </g>
                ))}
            </svg>
            <div class="pc-statebar">
                <span class="pc-statename">{state.id}</span>
                <span>{state.says}</span>
                <span class="pc-hint">Click a state to see its screen</span>
            </div>
            <div class="pc-stage">
                <div class="pc-wire">
                    <div class="pc-wire-row"><span class="pc-wire-title">Record the pull request on a spec</span></div>
                    <div class="pc-wire-row">
                        <span class="pc-chip pc-chip--status">{on === 'merged' ? 'COMPLETED' : 'IMPLEMENTING'}</span>
                        <span class="pc-chip">⑂ 710-record-pull-request</span>
                        {state.chip}
                        <span class="pc-muted">Oct 8, 2026</span>
                    </div>
                </div>
            </div>
            <div class="pc-note">Dashed green is proposed: reopening a closed pull request is not handled today.</div>
        </div>
    );
}

const PINS = [
    { title: 'The pull request chip', text: 'New. Sits after the branch. Click opens it in the browser. See the states block.' },
    { title: 'Hover', text: 'The sidebar row tooltip gains one line: Pull request: #901 open.' },
];

function WireCard({ open = 0 }: { open?: number }) {
    const [at, setAt] = useState<number | null>(open);
    const dot = (index: number) => (
        <span class={`pc-dot ${at === index ? 'pc-dot--on' : ''}`} onClick={() => setAt(at === index ? null : index)}>
            {index + 1}
            {at === index && <span class="pc-pop"><b>{PINS[index].title}</b><span>{PINS[index].text}</span></span>}
        </span>
    );
    return (
        <div class="pc-card">
            <div class="pc-head">
                <span class="pc-kind">screen</span>
                <span class="pc-title">The viewer header, after</span>
                <span class="pc-right">2 notes</span>
            </div>
            <div class="pc-stage" style="border-radius: 0; padding-bottom: 90px;">
                <div class="pc-wire">
                    <div class="pc-wire-row"><span class="pc-wire-title">Record the pull request on a spec</span></div>
                    <div class="pc-wire-row">
                        <span class="pc-chip pc-chip--status">IMPLEMENTING</span>
                        <span class="pc-chip">⑂ 710-record-pull-request</span>
                        <span class="pc-chip pc-chip--new">#901 open{dot(0)}</span>
                        <span class="pc-muted">Oct 8, 2026</span>
                    </div>
                    <div class="pc-wire-row"><span class="pc-muted">Sidebar row</span><span class="pc-chip">Record The Pull Request… {dot(1)}</span></div>
                </div>
            </div>
            <ol class="pc-legend" style="padding-bottom: 12px;">
                {PINS.map(pin => <li><b>{pin.title}.</b> {pin.text}</li>)}
            </ol>
        </div>
    );
}

const meta: Meta = {
    title: 'VS Code Extension/Spec Viewer/Plan cards (mockup)',
    parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

export const Calls: Story = {
    name: '1 · Calls, with comment, strike and file links',
    render: () => (
        <Page>
            <h2>Call paths</h2>
            <CallsCard title="Record the pull request at the end of a run" calls={RECORD}
                note="The new writer calls the GitHub CLI and writes two fields." />
            <CallsCard title="Read the pull request safely" calls={TOOLTIP}
                note="The viewer and the tooltip read through the same resolver." />
        </Page>
    ),
};

export const Code: Story = {
    name: '2 · Code, with highlighted lines and pinned notes',
    render: () => (
        <Page>
            <h2>How it works</h2>
            <CodeCard file="scripts/capture.py" kind="sketch" lang="PY" lines={SKETCH} />
            <CodeCard file="features/specs/specPullRequest.ts" kind="sketch" lang="TS" lines={RESOLVER} />
        </Page>
    ),
};

export const StatesStart: Story = {
    name: '3 · States, first state',
    render: () => <Page><h2>What a reader sees</h2><StatesCard /></Page>,
};

export const StatesOpen: Story = {
    name: '3 · States, after clicking "open"',
    render: () => <Page><h2>What a reader sees</h2><StatesCard start="open" /></Page>,
};

export const Screen: Story = {
    name: '4 · Screen, with numbered notes',
    render: () => <Page><h2>Where it shows</h2><WireCard /></Page>,
};

export const WhereEachGoes: Story = {
    name: 'Which block fits which step',
    render: () => (
        <Page>
            <h2>Which block fits which step</h2>
            <p>Each block is a plain fenced block in the markdown. A project that never writes one sees no change, and a viewer that does not know the block shows it as code.</p>
            <table class="pc-table">
                <tr><th>Block</th><th>Spec</th><th>Plan</th><th>Tasks</th><th>The plan must write</th><th>Cost to draw</th></tr>
                <tr><td><b>Calls</b></td><td class="pc-no2">no</td><td class="pc-yes">yes</td><td class="pc-no2">no</td><td>Already does, in the open pull request</td><td>Small</td></tr>
                <tr><td><b>Code</b></td><td class="pc-no2">no</td><td class="pc-yes">yes</td><td class="pc-yes">yes, per task</td><td>A code block, which lines matter, one note</td><td>Small</td></tr>
                <tr><td><b>States</b></td><td class="pc-yes">yes</td><td class="pc-yes">yes</td><td class="pc-no2">no</td><td>States, arrows, one sentence per state</td><td>Medium</td></tr>
                <tr><td><b>Screen</b></td><td class="pc-yes">yes</td><td class="pc-no2">no</td><td class="pc-no2">no</td><td>Rows, chips and text in a small fixed grammar, plus numbered notes</td><td>Large</td></tr>
            </table>
            <h2>One plan with three of them</h2>
            <p>When the pipeline opens a pull request for a spec, the run record keeps its number and link, and the sidebar and the viewer header show it beside the branch.</p>
            <StatesCard start="open" />
            <CallsCard title="Record the pull request at the end of a run" calls={RECORD.map(call => ({ ...call, hover: false, struck: false, comment: undefined }))}
                note="The new writer calls the GitHub CLI and writes two fields." />
            <CodeCard file="scripts/capture.py" kind="sketch" lang="PY" lines={SKETCH} />
        </Page>
    ),
};
