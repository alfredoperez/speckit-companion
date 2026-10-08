/**
 * Mockups, not shipped components: three cards a plan could be drawn with. The
 * data is a real plan and its research from one run; nothing here is wired.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import { useState } from 'preact/hooks';

const CSS = `
.pc-page { max-width: 880px; margin: 0 auto; padding: 32px 28px 64px; font-family: var(--font-family); color: var(--text-body); }
.pc-page h2 { font-size: var(--text-xl); color: var(--text-primary); margin: 28px 0 12px; }
.pc-page p { line-height: var(--leading-relaxed); margin: 10px 0; }
.pc-card { border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-secondary); overflow: hidden; margin: 14px 0 22px; }
.pc-head { display: flex; align-items: center; gap: 10px; padding: 9px 14px; background: var(--bg-inset); border-bottom: 1px solid var(--border); font-family: var(--font-mono); font-size: var(--text-sm); }
.pc-kind { background: var(--text-primary); color: var(--bg-primary); border-radius: var(--radius-sm); padding: 1px 7px; font-weight: 700; font-size: var(--text-xs); }
.pc-title { color: var(--text-primary); font-weight: 600; }
.pc-counts { margin-left: auto; display: flex; gap: 10px; color: var(--text-secondary); }
.pc-add { color: var(--success); } .pc-del { color: var(--error); } .pc-chg { color: var(--warning); }
.pc-rows { margin: 0; padding: 6px 0; list-style: none; font-family: var(--font-mono); font-size: var(--text-sm); }
.pc-row { display: flex; align-items: baseline; gap: 8px; padding: 4px 14px; }
.pc-row--add { background: var(--success-subtle); }
.pc-row--chg { background: var(--warning-subtle); }
.pc-row--del { background: var(--error-subtle); text-decoration: line-through; }
.pc-mark { width: 12px; font-weight: 700; flex: none; }
.pc-tree { color: var(--text-muted); white-space: pre; flex: none; }
.pc-name { color: var(--text-primary); }
.pc-row--add .pc-name { font-weight: 700; }
.pc-new { font-family: var(--font-family); font-size: var(--text-xs); color: var(--success); border: 1px solid var(--success); border-radius: 999px; padding: 0 6px; }
.pc-where { margin-left: auto; color: var(--text-secondary); padding-left: 16px; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.pc-note { padding: 10px 14px 12px; border-top: 1px solid var(--border); color: var(--text-body); font-size: var(--text-sm); }
.pc-lang { margin-left: auto; color: var(--text-secondary); }
.pc-code { margin: 0; padding: 10px 0; font-family: var(--font-mono); font-size: var(--text-sm); line-height: 1.7; }
.pc-line { display: flex; gap: 14px; padding: 0 14px; }
.pc-no { width: 18px; text-align: right; color: var(--text-muted); flex: none; user-select: none; }
.pc-src { color: var(--text-primary); white-space: pre; }
.pc-kw { color: var(--code-keyword); } .pc-str { color: var(--code-string); } .pc-fn { color: var(--code-function); }
.pc-pin { margin: 4px 14px 6px 46px; padding: 7px 12px; border-left: 3px solid var(--review); background: var(--review-subtle); color: var(--review-ink); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; font-family: var(--font-family); font-size: var(--text-sm); font-weight: 600; }
.pc-ask { padding: 12px 14px 14px; }
.pc-ask + .pc-ask { border-top: 1px solid var(--border); }
.pc-q { color: var(--text-primary); font-weight: 600; margin: 0 0 8px; display: flex; gap: 8px; align-items: baseline; }
.pc-state { font-size: var(--text-xs); font-weight: 600; border-radius: 999px; padding: 0 8px; white-space: nowrap; }
.pc-state--kept { color: var(--text-secondary); border: 1px solid var(--border); }
.pc-state--changed { color: var(--review-ink); background: var(--review-subtle); }
.pc-opt { display: flex; gap: 8px; align-items: baseline; padding: 4px 0; cursor: pointer; }
.pc-opt input { accent-color: var(--accent-strong); flex: none; }
.pc-opt small { color: var(--text-secondary); }
.pc-pick { color: var(--text-primary); }
.pc-why { margin: 8px 0 0 24px; color: var(--text-secondary); font-size: var(--text-sm); }
.pc-todo { margin-left: auto; font-family: var(--font-family); font-size: var(--text-xs); font-weight: 700; color: var(--review-ink); background: var(--review-subtle); border-radius: 999px; padding: 1px 9px; }
.pc-bar { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-top: 1px solid var(--border); background: var(--bg-inset); font-size: var(--text-sm); }
.pc-btn { margin-left: auto; background: var(--accent); color: var(--accent-ink); border: 0; border-radius: var(--radius-md); padding: 6px 14px; font-weight: 600; cursor: pointer; }
.pc-btn[disabled] { opacity: .45; cursor: default; }
`;

type Mark = '+' | '~' | '-' | ' ';
interface Call { mark: Mark; depth: number; last?: boolean; name: string; where: string; isNew?: boolean }

const MARK_CLASS: Record<Mark, string> = { '+': 'add', '~': 'chg', '-': 'del', ' ': '' };

function CallsCard({ title, calls, note }: { title: string; calls: Call[]; note?: string }) {
    const count = (mark: Mark) => calls.filter(call => call.mark === mark).length;
    return (
        <div class="pc-card">
            <div class="pc-head">
                <span class="pc-kind">calls</span>
                <span class="pc-title">{title}</span>
                <span class="pc-counts">
                    <span class="pc-add">+{count('+')}</span>
                    <span class="pc-del">−{count('-')}</span>
                    <span class="pc-chg">~{count('~')}</span>
                    <span>· 1 entrypoint</span>
                </span>
            </div>
            <ul class="pc-rows">
                {calls.map(call => (
                    <li class={`pc-row ${MARK_CLASS[call.mark] ? `pc-row--${MARK_CLASS[call.mark]}` : ''}`}>
                        <span class={`pc-mark pc-${MARK_CLASS[call.mark]}`}>{call.mark.trim()}</span>
                        {call.depth > 0 && <span class="pc-tree">{'   '.repeat(call.depth - 1)}{call.last ? '└─ ' : '├─ '}</span>}
                        <span class="pc-name">{call.name}</span>
                        {call.isNew && <span class="pc-new">new file</span>}
                        <span class="pc-where">{call.where}</span>
                    </li>
                ))}
            </ul>
            {note && <div class="pc-note">{note}</div>}
        </div>
    );
}

const RECORD: Call[] = [
    { mark: ' ', depth: 0, name: '_main()', where: 'scripts/write-context.py:364' },
    { mark: '~', depth: 1, name: '_classify_op()', where: 'scripts/write-context.py:899' },
    { mark: '+', depth: 1, name: 'record_pull_request()', where: 'scripts/capture.py:72' },
    { mark: ' ', depth: 2, name: 'read_ctx()', where: 'scripts/spec_context.py:627' },
    { mark: ' ', depth: 2, last: true, name: 'atomic_write()', where: 'scripts/spec_context.py:701' },
    { mark: ' ', depth: 1, last: true, name: 'set_fields()', where: 'scripts/capture.py:48' },
];

const TOOLTIP: Call[] = [
    { mark: ' ', depth: 0, name: 'SpecItem()', where: 'features/specs/specExplorerProvider.ts:656' },
    { mark: '+', depth: 1, name: 'resolveSpecPullRequest()', where: 'features/specs/specPullRequest.ts', isNew: true },
    { mark: ' ', depth: 1, last: true, name: 'resolveSpecAssistant()', where: 'features/specs/specExplorerProvider.ts:714' },
];

function SketchCard() {
    const lines: Array<[string, preact.ComponentChildren]> = [
        ['1', <><span class="pc-kw">def</span> <span class="pc-fn">record_pull_request</span>(feature_dir, branch):</>],
        ['2', <>    found = gh(<span class="pc-str">"pr"</span>, <span class="pc-str">"list"</span>, <span class="pc-str">"--head"</span>, branch, <span class="pc-str">"--state"</span>, <span class="pc-str">"all"</span>)</>],
        ['3', <>    pick = first(found, state=<span class="pc-str">"OPEN"</span>) <span class="pc-kw">or</span> newest(found)</>],
        ['4', <>    <span class="pc-kw">if not</span> pick: <span class="pc-kw">return None</span></>],
        ['5', <>    ctx = read_ctx(target)</>],
        ['6', <>    ctx.update(prNumber=pick.number, prUrl=pick.url)</>],
        ['7', <>    atomic_write(target, ctx)</>],
    ];
    return (
        <div class="pc-card">
            <div class="pc-head">
                <span class="pc-title">capture.py · sketch</span>
                <span class="pc-lang">python</span>
            </div>
            <div class="pc-code">
                {lines.map(([no, src]) => (
                    <>
                        <div class="pc-line"><span class="pc-no">{no}</span><span class="pc-src">{src}</span></div>
                        {no === '3' && <div class="pc-pin">The open pull request wins; with none open, the newest one.</div>}
                        {no === '6' && <div class="pc-pin">Nothing else on the record changes: no required fields are filled here.</div>}
                    </>
                ))}
            </div>
        </div>
    );
}

interface Ask { id: string; question: string; options: Array<{ label: string; detail?: string }>; why: string }

const ASKS: Ask[] = [
    {
        id: 'where',
        question: 'Where does the lookup run?',
        options: [
            { label: 'A closing line after the last step and its hooks', detail: 'the plan\'s choice' },
            { label: 'Inside mark-complete', detail: 'least code, but it runs before the pull request exists' },
            { label: 'A new step after handoff', detail: 'breaks the rule that handoff is last' },
        ],
        why: 'A project hook opens the pull request, and it is anchored after the last step. Only a line outside the step list is sure to run after it.',
    },
    {
        id: 'find',
        question: 'How is the pull request found?',
        options: [
            { label: 'List by branch, the open one wins', detail: 'the plan\'s choice' },
            { label: 'View the current branch only', detail: 'cannot apply "open one wins"' },
            { label: 'Call the GitHub API directly', detail: 'needs its own sign-in handling' },
        ],
        why: 'It uses the sign-in the developer already has and covers more than one pull request in a single call.',
    },
    {
        id: 'write',
        question: 'How is the record written?',
        options: [
            { label: 'A dedicated flag that sets only the two fields', detail: 'the plan\'s choice' },
            { label: 'Two generic set calls written by the assistant', detail: 'less script, but the rule lives in prose, untested' },
        ],
        why: 'Nothing else on the record may change, and the generic setter also fills in other fields.',
    },
];

function DecisionsCard({ seen = [], picked = {} }: { seen?: string[]; picked?: Record<string, number> }) {
    const [choice, setChoice] = useState<Record<string, number>>(picked);
    const [opened, setOpened] = useState<string[]>(seen);
    const changed = ASKS.filter(ask => (choice[ask.id] ?? 0) !== 0);
    const todo = ASKS.filter(ask => !opened.includes(ask.id) && !changed.includes(ask)).length;
    return (
        <div class="pc-card">
            <div class="pc-head">
                <span class="pc-kind">decisions</span>
                <span class="pc-title">{ASKS.length} choices this plan made for you</span>
                <span class="pc-todo">{todo ? `${todo} to look at` : 'all looked at'}</span>
            </div>
            {ASKS.map(ask => {
                const at = choice[ask.id] ?? 0;
                const look = () => setOpened(now => (now.includes(ask.id) ? now : [...now, ask.id]));
                return (
                    <div class="pc-ask" onMouseEnter={look}>
                        <p class="pc-q">
                            {ask.question}
                            {at !== 0
                                ? <span class="pc-state pc-state--changed">you changed this</span>
                                : opened.includes(ask.id) && <span class="pc-state pc-state--kept">default kept</span>}
                        </p>
                        {ask.options.map((option, index) => (
                            <label class="pc-opt">
                                <input type="radio" name={ask.id} checked={at === index}
                                    onChange={() => { look(); setChoice(now => ({ ...now, [ask.id]: index })); }} />
                                <span><span class={at === index ? 'pc-pick' : ''}>{option.label}</span>{option.detail && <small> · {option.detail}</small>}</span>
                            </label>
                        ))}
                        <p class="pc-why">Why: {ask.why}</p>
                    </div>
                );
            })}
            <div class="pc-bar">
                <span>{changed.length ? `${changed.length} changed. Refine sends your choice and the plan is redone around it.` : 'Nothing changed. The plan stands as written.'}</span>
                <button class="pc-btn" disabled={!changed.length}>Refine ({changed.length})</button>
            </div>
        </div>
    );
}

function Page({ children }: { children: preact.ComponentChildren }) {
    return (
        <div class="pc-page">
            <style>{CSS}</style>
            {children}
        </div>
    );
}

const meta: Meta = {
    title: 'VS Code Extension/Spec Viewer/Plan cards (mockup)',
    parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

export const CallsCardStory: Story = {
    name: '1 · Calls card',
    render: () => (
        <Page>
            <h2>Call paths</h2>
            <CallsCard title="Record the pull request at the end of a run" calls={RECORD}
                note="The new writer calls the GitHub CLI and skips set_fields, which also fills required fields." />
            <CallsCard title="Read the pull request safely, for the viewer and the tooltip" calls={TOOLTIP}
                note="The viewer reads through the same resolver, which is how the run strip gets the URL guard." />
        </Page>
    ),
};

export const DecisionsUntouched: Story = {
    name: '2 · Decisions, nothing looked at yet',
    render: () => <Page><h2>Decisions</h2><DecisionsCard /></Page>,
};

export const DecisionsChanged: Story = {
    name: '2 · Decisions, one changed',
    render: () => <Page><h2>Decisions</h2><DecisionsCard seen={['where', 'find']} picked={{ find: 1 }} /></Page>,
};

export const SketchCardStory: Story = {
    name: '3 · Sketch card with pinned notes',
    render: () => <Page><h2>How it works</h2><SketchCard /></Page>,
};

export const WholePlan: Story = {
    name: 'All three in one plan',
    render: () => (
        <Page>
            <h2>Summary</h2>
            <p>When the pipeline opens a pull request for a spec, the run record keeps its number and link, and the sidebar and the viewer header show it beside the branch.</p>
            <h2>Decisions</h2>
            <DecisionsCard seen={['where']} />
            <h2>Call paths</h2>
            <CallsCard title="Record the pull request at the end of a run" calls={RECORD}
                note="The new writer calls the GitHub CLI and skips set_fields, which also fills required fields." />
            <SketchCard />
        </Page>
    ),
};
