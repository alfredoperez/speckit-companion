import type { Meta, StoryObj } from '@storybook/preact';
import './header-study.css';

function BranchIcon() {
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="4" cy="3" r="1.5" />
            <circle cx="4" cy="13" r="1.5" />
            <circle cx="12" cy="6" r="1.5" />
            <path d="M4 4.5v5.2c0 1.8 1.2 2.8 2.8 2.8M5.5 5.5h3.3c2 0 3.2-.9 3.2-2.1" />
        </svg>
    );
}

function UnifiedHeader() {
    return (
        <header className="hs-header">
            <div className="hs-identity">
                <div className="hs-title-row">
                    <span className="hs-state"><i /> Completed</span>
                    <h1>Adopt Codex design</h1>
                </div>
                <div className="hs-spec-meta">
                    <span className="hs-branch"><BranchIcon />viewer-redesign-investigation</span>
                    <span>Updated Jul 12</span>
                </div>
            </div>

            <div className="hs-run-summary" aria-label="Run summary">
                <span><b>Implement</b><small>phase</small></span>
                <span><b>30/30</b><small>tasks</small></span>
                <span className="is-warning"><b>3/17</b><small>traced</small></span>
                <span className="is-warning"><b>1</b><small>concern</small></span>
                <button>Run details <span aria-hidden="true">→</span></button>
            </div>

            <button className="hs-overflow" aria-label="More spec actions">•••</button>
        </header>
    );
}

const navGroups = [
    {
        label: 'Pipeline',
        rows: [
            { label: 'Specification', done: true },
            { label: 'Plan', done: true, selected: true, warning: true },
            { label: 'Tasks', done: true },
            { label: 'Implement', done: true },
        ],
    },
    {
        label: 'Plan files',
        rows: [
            { label: 'Data model' },
            { label: 'Research' },
            { label: 'UI contract' },
        ],
    },
];

function Rail() {
    return (
        <aside className="hs-rail">
            <button className="hs-overview-link"><span>◫</span> Overview</button>
            {navGroups.map((group) => (
                <nav key={group.label} aria-label={group.label}>
                    <div className="hs-label">{group.label}</div>
                    {group.rows.map((row) => (
                        <button className={row.selected ? 'is-selected' : ''} key={row.label}>
                            {row.done ? <span className="hs-done">✓</span> : <span className="hs-empty">·</span>}
                            <span>{row.label}</span>
                            {row.warning && <span className="hs-warning-mark" aria-label="May be stale">!</span>}
                        </button>
                    ))}
                </nav>
            ))}
        </aside>
    );
}

function DocumentHeader() {
    return (
        <div className="hs-document-head">
            <div className="hs-document-title">
                <div className="hs-label">Plan · plan.md</div>
                <h2>Implementation plan</h2>
                <p>Technical approach, project structure, and delivery phases.</p>
            </div>
            <div className="hs-stale-notice" role="status">
                <span className="hs-warning-mark">!</span>
                <div>
                    <strong>Plan may be stale</strong>
                    <p>The specification changed after this plan was generated.</p>
                </div>
                <button>Regenerate</button>
            </div>
        </div>
    );
}

function Toc() {
    return (
        <aside className="hs-toc">
            <div className="hs-label">On this page</div>
            <a className="is-active" href="#summary">Summary</a>
            <a href="#constitution">Constitution check</a>
            <a href="#structure">Project structure</a>
            <a href="#research">Phase 0 — Research</a>
            <a href="#design">Phase 1 — Design</a>
        </aside>
    );
}

function ReadingContent() {
    return (
        <article className="hs-reading">
            <section id="summary">
                <h3>Summary</h3>
                <p>
                    Ship the Codex redesign in the production spec viewer as a reskin-and-relayout over the viewer’s
                    existing state seams. The owned light/dark palette lands by re-valuing the existing token layer,
                    while the shell recomposes around a focused reading experience.
                </p>
                <p>
                    Behavior stays fenced: signals, message handlers, state derivation, and the lifecycle state machine
                    remain untouched, so every status and custom workflow keeps working.
                </p>
            </section>
            <section id="constitution">
                <h3>Constitution check</h3>
                <div className="hs-table-row"><b>Content fidelity</b><span>Pass</span></div>
                <div className="hs-table-row"><b>Behavioral compatibility</b><span>Pass</span></div>
            </section>
            <section id="structure">
                <h3>Project structure</h3>
                <p>The redesign stays inside the existing component and token boundaries.</p>
            </section>
        </article>
    );
}

function HeaderExample({ split = false }: { split?: boolean }) {
    return (
        <div className={split ? 'hs-stage is-split' : 'hs-stage'}>
            <div className="header-study">
                <UnifiedHeader />
                <div className="hs-body">
                    <Rail />
                    <main className="hs-main">
                        <DocumentHeader />
                        <details className="hs-compact-toc">
                            <summary>On this page · Summary</summary>
                            <a href="#constitution">Constitution check</a>
                            <a href="#structure">Project structure</a>
                        </details>
                        <div className="hs-document-layout">
                            <ReadingContent />
                            <Toc />
                        </div>
                    </main>
                </div>
                <footer className="hs-footer">
                    <span>Next: Reactivate</span>
                    <button>Archive</button>
                    <button className="is-primary">Reactivate</button>
                </footer>
            </div>
        </div>
    );
}

const meta = {
    title: 'Redesign/Codex/Header Direction',
    component: HeaderExample,
    parameters: {
        layout: 'fullscreen',
        controls: { disable: true },
    },
} satisfies Meta<typeof HeaderExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnifiedSpecHeader: Story = {
    render: () => <HeaderExample />,
};

export const SplitPaneHeader: Story = {
    render: () => <HeaderExample split />,
};
