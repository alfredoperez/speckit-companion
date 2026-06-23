import type { Meta, StoryObj } from '@storybook/preact';

/**
 * Experiment: a more modern / "terminal-native" button language. Each variant is
 * theme-adaptive (uses the VS Code tokens) — the accent is the editor's, not a
 * fixed colour — and degrades on prefers-reduced-motion. Hover each to compare.
 */
const CSS = `
.tb-wrap { padding: 28px; font-family: var(--font-family, sans-serif); }
.tb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 34px 24px; max-width: 760px; }
.tb-cell { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.tb-demo { min-height: 60px; display: grid; place-items: center; }
.tb-label { font-size: 11px; color: var(--text-muted, #888); text-align: center; font-family: var(--font-mono, monospace); letter-spacing: .03em; }
.tb-btn { cursor: pointer; font-family: var(--font-mono, monospace); font-size: 13px; }

/* Baseline — today's button, for comparison */
.tb-base { background: var(--vscode-button-background, #0e639c); color: var(--vscode-button-foreground, #fff); border: 1px solid transparent; border-radius: 4px; padding: 7px 16px; font-family: var(--font-family, sans-serif); transition: background 120ms; }
.tb-base:hover { background: var(--vscode-button-hoverBackground, #0a4d7c); }

/* Terminal — color-flip on hover (the motion.dev move) */
.tb-term { background: transparent; color: var(--accent); border: 1.5px solid var(--accent); border-radius: 2px; padding: 9px 18px; text-transform: uppercase; letter-spacing: .1em; font-weight: 600; transition: color 160ms cubic-bezier(.2,0,0,1), background 160ms cubic-bezier(.2,0,0,1); }
.tb-term:hover { background: var(--accent); color: var(--bg-primary); }
.tb-term:active { transform: translateY(1px); }

/* Brutalist — hard offset shadow that collapses on press */
.tb-brut { background: var(--bg-elevated); color: var(--text-primary); border: 2px solid var(--text-primary); border-radius: 0; padding: 9px 18px; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; box-shadow: 4px 4px 0 var(--accent); transition: transform 110ms cubic-bezier(.2,0,0,1), box-shadow 110ms cubic-bezier(.2,0,0,1), background 140ms, color 140ms; }
.tb-brut:hover { background: var(--accent); color: var(--bg-primary); transform: translate(-1px, -1px); box-shadow: 5px 5px 0 var(--text-primary); }
.tb-brut:active { transform: translate(4px, 4px); box-shadow: 0 0 0 var(--text-primary); }

/* Crosshair — viewfinder corner brackets that expand on hover */
.tb-frame { position: relative; display: inline-block; padding: 6px; }
.tb-c { position: absolute; width: 9px; height: 9px; border: 2px solid var(--accent); transition: all 160ms cubic-bezier(.2,0,0,1); pointer-events: none; }
.tb-tl { top: 0; left: 0; border-right: 0; border-bottom: 0; }
.tb-tr { top: 0; right: 0; border-left: 0; border-bottom: 0; }
.tb-bl { bottom: 0; left: 0; border-right: 0; border-top: 0; }
.tb-br { bottom: 0; right: 0; border-left: 0; border-top: 0; }
.tb-cross { background: var(--bg-code, #111); color: var(--accent); border: 0; border-radius: 0; padding: 10px 22px; text-transform: uppercase; letter-spacing: .12em; font-weight: 600; transition: color 160ms, background 160ms; }
.tb-frame:hover .tb-tl { top: -3px; left: -3px; }
.tb-frame:hover .tb-tr { top: -3px; right: -3px; }
.tb-frame:hover .tb-bl { bottom: -3px; left: -3px; }
.tb-frame:hover .tb-br { bottom: -3px; right: -3px; }
.tb-frame:hover .tb-cross { background: var(--accent); color: var(--bg-primary); }

@media (prefers-reduced-motion: reduce) {
  .tb-btn, .tb-c { transition: none !important; }
  .tb-brut:hover, .tb-brut:active { transform: none; }
}
`;

function Cell({ label, children }: { label: string; children: unknown }) {
    return (
        <div class="tb-cell">
            <div class="tb-demo">{children}</div>
            <div class="tb-label">{label}</div>
        </div>
    );
}

function Gallery() {
    return (
        <div class="tb-wrap">
            <style>{CSS}</style>
            <div class="tb-grid">
                <Cell label="Baseline (today)"><button class="tb-btn tb-base">Plan</button></Cell>
                <Cell label="Terminal · color-flip"><button class="tb-btn tb-term">Plan</button></Cell>
                <Cell label="Brutalist · hard shadow"><button class="tb-btn tb-brut">Plan</button></Cell>
                <Cell label="Crosshair · viewfinder">
                    <span class="tb-frame">
                        <span class="tb-c tb-tl" /><span class="tb-c tb-tr" /><span class="tb-c tb-bl" /><span class="tb-c tb-br" />
                        <button class="tb-btn tb-cross">Plan</button>
                    </span>
                </Cell>
            </div>
        </div>
    );
}

const meta: Meta<typeof Gallery> = {
    title: 'Experiments/Techy Buttons',
    component: Gallery,
};
export default meta;
type Story = StoryObj<typeof Gallery>;

export const Variants: Story = {};
