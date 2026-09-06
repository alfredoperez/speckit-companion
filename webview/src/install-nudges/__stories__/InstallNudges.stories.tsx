/**
 * Every surface that promotes installing the companion spec-kit extension, on one screen.
 *
 * The three banners are the real markup and the real stylesheet. Everything else is
 * VS Code chrome the extension only contributes copy to — a notification toast, a
 * viewsWelcome block, a tree row, a modal, a quick pick — so those are faithful
 * mocks, labelled as mocks, drawn from the repo's own tokens.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import type { ComponentChildren } from 'preact';
import '../../../styles/spec-viewer/_install-banner.css';

const meta: Meta = {
    title: 'Install nudges/Every surface',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Every place the VS Code extension promotes installing the companion spec-kit extension. ' +
                    'Each row is captioned with the file and line it comes from, what triggers it, and how (or whether) it can be dismissed. ' +
                    'The last story stacks the ones a fresh uninstalled workspace actually meets, in the order it meets them.',
            },
        },
    },
};
export default meta;

type Story = StoryObj;

const CHROME_CSS = `
.nudge-page { font-family: var(--font-family); color: var(--text-body); padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-6); }
.nudge-row { display: flex; flex-direction: column; gap: var(--space-3); }
.nudge-cap { font-size: var(--text-xs); line-height: var(--leading-normal); color: var(--text-secondary); border-left: 2px solid var(--border); padding-left: var(--space-3); }
.nudge-cap b { color: var(--text-primary); font-weight: 600; }
.nudge-cap code { font-family: var(--font-mono); color: var(--text-label); }
.nudge-tag { display: inline-block; font-size: var(--text-xs); padding: 1px 6px; border-radius: var(--radius-sm); background: var(--warning-subtle); color: var(--warning); margin-left: var(--space-2); }
.nudge-stage { background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: var(--space-4); }

.vsc-toast { width: 420px; background: var(--bg-elevated); border: 1px solid var(--border); box-shadow: 0 2px 8px rgba(0,0,0,.4); border-radius: var(--radius-sm); padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; font-size: var(--text-sm); }
.vsc-toast__head { display: flex; gap: 8px; align-items: flex-start; }
.vsc-toast__msg { flex: 1 1 auto; line-height: var(--leading-normal); color: var(--text-primary); }
.vsc-toast__close { color: var(--text-muted); font-size: 14px; }
.vsc-toast__actions { display: flex; gap: 8px; justify-content: flex-end; }
.vsc-btn { font-size: var(--text-sm); padding: 3px 12px; border: none; border-radius: var(--radius-sm); background: var(--accent-strong); color: var(--accent-ink); }
.vsc-btn--secondary { background: color-mix(in srgb, var(--text-primary) 14%, transparent); color: var(--text-primary); }
.vsc-toast--warning .vsc-toast__icon { color: var(--warning); }
.vsc-toast--info .vsc-toast__icon { color: var(--info); }

.vsc-modal { width: 460px; background: var(--bg-elevated); border: 1px solid var(--border-hover); border-radius: 6px; box-shadow: 0 8px 30px rgba(0,0,0,.5); padding: 20px; display: flex; flex-direction: column; gap: 16px; align-items: center; text-align: center; }
.vsc-modal__msg { font-size: var(--text-sm); line-height: var(--leading-relaxed); color: var(--text-primary); }
.vsc-modal__actions { display: flex; gap: 8px; }

.vsc-side { width: 320px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
.vsc-side__title { display: flex; align-items: center; gap: 6px; padding: 4px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-label); font-weight: 700; }
.vsc-side__title .spacer { flex: 1 1 auto; }
.vsc-side__title .codicon { font-size: 14px; color: var(--text-body); opacity: .85; }
.vsc-row { display: flex; align-items: center; gap: 6px; padding: 3px 8px 3px 18px; font-size: var(--text-sm); color: var(--text-primary); }
.vsc-row--cta { color: var(--accent); }
.vsc-row .codicon { font-size: 14px; }
.vsc-welcome { padding: 10px 18px 16px; font-size: var(--text-sm); line-height: var(--leading-relaxed); color: var(--text-body); display: flex; flex-direction: column; gap: 12px; }
.vsc-welcome a { color: var(--accent); }
.vsc-welcome a.vsc-welcome__cta { display: flex; gap: 6px; align-items: center; justify-content: center; background: var(--accent-strong); color: var(--accent-ink); border-radius: var(--radius-sm); padding: 4px 10px; }
.vsc-welcome a.vsc-welcome__cta .codicon { font-size: 14px; }

.vsc-actbar { width: 48px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 0; display: flex; justify-content: center; }
.vsc-actbar__icon { position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: var(--text-primary); }
.vsc-actbar__icon .codicon { font-size: 22px; }
.vsc-actbar__badge { position: absolute; right: -2px; bottom: -2px; min-width: 16px; height: 16px; border-radius: 8px; background: var(--accent-strong); color: var(--accent-ink); font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; }

.vsc-menu { width: 300px; background: var(--bg-elevated); border: 1px solid var(--border-hover); border-radius: var(--radius-sm); padding: 4px 0; font-size: var(--text-sm); }
.vsc-menu__item { padding: 4px 12px; color: var(--text-primary); display: flex; gap: 8px; align-items: center; }
.vsc-menu__sep { height: 1px; background: var(--border); margin: 4px 0; }
.vsc-quickpick { width: 560px; background: var(--bg-elevated); border: 1px solid var(--border-hover); border-radius: var(--radius-sm); padding: 6px 0; font-size: var(--text-sm); }
.vsc-quickpick__input { margin: 0 8px 6px; padding: 3px 6px; border: 1px solid var(--accent); color: var(--text-muted); }
.vsc-quickpick__item { padding: 4px 12px; display: flex; gap: 10px; align-items: baseline; color: var(--text-primary); }
.vsc-quickpick__item .desc { color: var(--text-secondary); font-size: var(--text-xs); }

.vsc-statusbar { width: 640px; height: 22px; display: flex; align-items: center; background: var(--bg-secondary); border-top: 1px solid var(--border); font-size: 12px; color: var(--text-primary); }
.vsc-statusbar__item { display: flex; align-items: center; gap: 4px; height: 100%; padding: 0 8px; }
.vsc-statusbar__item--warning { background: var(--warning); color: #000; }
.vsc-statusbar__item .codicon { font-size: 14px; }
.vsc-panel { width: 640px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px; }
.vsc-panel__h { font-size: var(--text-lg); color: var(--header-title); margin: 0 0 10px; }
.vsc-panel__ghost { height: 64px; border: 1px dashed var(--border); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: var(--text-xs); }
`;

interface RowProps {
    where: string;
    source: string;
    trigger: string;
    dismiss: string;
    mock?: boolean;
    children: ComponentChildren;
}

function Row({ where, source, trigger, dismiss, mock, children }: RowProps) {
    return (
        <div class="nudge-row">
            <div class="nudge-cap">
                <b>{where}</b>
                {mock ? <span class="nudge-tag">VS Code chrome — mock</span> : null}
                <br />
                <code>{source}</code>
                <br />
                Trigger: {trigger}
                <br />
                Dismiss: {dismiss}
            </div>
            <div class="nudge-stage">{children}</div>
        </div>
    );
}

function Page({ children }: { children: ComponentChildren }) {
    return (
        <div class="nudge-page">
            <style>{CHROME_CSS}</style>
            {children}
        </div>
    );
}

/** The real banner markup, as `installBanner.ts` and `ActivityPanel.tsx` emit it. */
function InstallBanner() {
    return (
        <div class="install-banner" role="region" aria-label="Install spec-kit extension">
            <span class="install-banner__icon codicon codicon-rocket" aria-hidden="true" />
            <span class="install-banner__text">Install the spec-kit extension for the leaner <code>/speckit.companion.*</code> pipeline and capture.</span>
            <button type="button" class="install-banner__btn install-banner__btn--primary">Install</button>
            <button type="button" class="install-banner__btn install-banner__btn--link">Learn more</button>
            <button type="button" class="install-banner__dismiss codicon codicon-close" aria-label="Dismiss install prompt" />
        </div>
    );
}

/** The real out-of-date banner markup, as `installBanner.ts` and `ActivityPanel.tsx` emit it. */
function UpdateBanner() {
    return (
        <div class="install-banner install-banner--update" role="region" aria-label="Update spec-kit extension">
            <span class="install-banner__icon codicon codicon-arrow-circle-up" aria-hidden="true" />
            <span class="install-banner__text">SpecKit commands are 0.20.2, this extension expects 0.21.0.</span>
            <button type="button" class="install-banner__btn install-banner__btn--primary">Update</button>
            <button type="button" class="install-banner__dismiss codicon codicon-close" aria-label="Dismiss update prompt" />
        </div>
    );
}

function StatusBar() {
    return (
        <div class="vsc-statusbar">
            <div class="vsc-statusbar__item"><span class="codicon codicon-source-control" aria-hidden="true" /> main</div>
            <div class="vsc-statusbar__item vsc-statusbar__item--warning"><span class="codicon codicon-arrow-circle-up" aria-hidden="true" /> SpecKit commands out of date</div>
        </div>
    );
}

interface ToastProps {
    kind: 'info' | 'warning';
    message: string;
    actions: string[];
}

function Toast({ kind, message, actions }: ToastProps) {
    return (
        <div class={`vsc-toast vsc-toast--${kind}`}>
            <div class="vsc-toast__head">
                <span class={`vsc-toast__icon codicon codicon-${kind === 'warning' ? 'warning' : 'info'}`} aria-hidden="true" />
                <span class="vsc-toast__msg">{message}</span>
                <span class="vsc-toast__close codicon codicon-close" aria-hidden="true" />
            </div>
            {actions.length > 0 ? (
                <div class="vsc-toast__actions">
                    {actions.map((label, i) => (
                        <button key={label} type="button" class={i === 0 ? 'vsc-btn' : 'vsc-btn vsc-btn--secondary'}>{label}</button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function SpecsWelcome() {
    return (
        <div class="vsc-side">
            <div class="vsc-side__title">
                <span class="codicon codicon-chevron-down" aria-hidden="true" />
                <span>Specs</span>
            </div>
            <div class="vsc-welcome">
                <div>Welcome to SpecKit</div>
                <div>A spec turns an idea into a plan and tasks your AI assistant can implement — and this panel shows every step as it runs.</div>
                <a class="vsc-welcome__cta"><span class="codicon codicon-plus" aria-hidden="true" />Create your first spec</a>
                <a class="vsc-welcome__cta"><span class="codicon codicon-play" aria-hidden="true" />Open a live sample</a>
                <div>SpecKit Companion adds living specs, lifecycle capture, and a fast-path for small changes.</div>
                <a class="vsc-welcome__cta"><span class="codicon codicon-rocket" aria-hidden="true" />Install SpecKit Companion</a>
                <a>Dismiss</a>
            </div>
        </div>
    );
}

function ActivityBarBadge() {
    return (
        <div class="vsc-actbar">
            <div class="vsc-actbar__icon" title="Install SpecKit Companion">
                <span class="codicon codicon-symbol-misc" aria-hidden="true" />
                <span class="vsc-actbar__badge">1</span>
            </div>
        </div>
    );
}

function CreateSpecModalDialog() {
    return (
        <div class="vsc-modal">
            <div class="vsc-modal__msg">SpecKit Companion adds living specs, full lifecycle capture, a fast-path for small changes, and hands-off Auto. Install it to enable the full workflow — or continue with standard SpecKit.</div>
            <div class="vsc-modal__actions">
                <button type="button" class="vsc-btn">Install SpecKit Companion</button>
                <button type="button" class="vsc-btn vsc-btn--secondary">Use SpecKit Instead</button>
                <button type="button" class="vsc-btn vsc-btn--secondary">Cancel</button>
            </div>
        </div>
    );
}

function CreateSpecPanel({ banner = <InstallBanner /> }: { banner?: ComponentChildren }) {
    return (
        <div class="vsc-panel">
            {banner}
            <h2 class="vsc-panel__h">Create New Spec</h2>
            <div class="vsc-panel__ghost">Describe what you want to build…</div>
        </div>
    );
}

export const ActivationToast: Story = {
    name: '1 · Activation notification (removed)',
    render: () => (
        <Page>
            <Row
                where="Was: a notification toast, bottom-right, on window open"
                source="Removed — the badge and the pinned CTA row already carry this"
                trigger="Nothing. This no longer fires."
                dismiss="N/A"
                mock
            >
                <Toast
                    kind="info"
                    message="This project uses spec-kit. Install the SpecKit Companion extension to unlock live status, resumability, the complexity fast path, and living specs 🌱."
                    actions={['Install', "Don't show again"]}
                />
            </Row>
        </Page>
    ),
};

export const SidebarBadge: Story = {
    name: '2 · Activity-bar badge',
    render: () => (
        <Page>
            <Row
                where="Blue count badge on the SpecKit activity-bar icon"
                source="src/extension.ts:301"
                trigger="Companion extension missing. Re-applied by the file watcher on every change."
                dismiss="Cannot be dismissed. Ignores both the dismissal flag and the speckit.companion.installPrompt setting — installing is the only way to clear it."
                mock
            >
                <ActivityBarBadge />
            </Row>
        </Page>
    ),
};

export const PinnedCtaRow: Story = {
    name: '3 · Pinned CTA row in Specs',
    render: () => (
        <Page>
            <Row
                where="First row of the Specs tree, above every spec"
                source="src/features/specs/specExplorerProvider.ts:133 (buildInstallCtaItem)"
                trigger="Companion extension missing and at least one spec exists"
                dismiss="Cannot be dismissed. Ignores the dismissal flag and the installPrompt setting."
                mock
            >
                <div class="vsc-side">
                    <div class="vsc-side__title">
                        <span class="codicon codicon-chevron-down" aria-hidden="true" />
                        <span>Specs</span>
                        <span class="spacer" />
                        <span class="codicon codicon-filter" aria-hidden="true" />
                        <span class="codicon codicon-add" aria-hidden="true" />
                        <span class="codicon codicon-ellipsis" aria-hidden="true" />
                    </div>
                    <div class="vsc-row vsc-row--cta">
                        <span class="codicon codicon-rocket" aria-hidden="true" />
                        <span>Get Companion — living specs, capture, fast-path</span>
                    </div>
                    <div class="vsc-row"><span class="codicon codicon-chevron-right" aria-hidden="true" /><span>Active (2)</span></div>
                    <div class="vsc-row"><span class="codicon codicon-chevron-right" aria-hidden="true" /><span>Completed (7)</span></div>
                </div>
            </Row>
        </Page>
    ),
};

export const WelcomeView: Story = {
    name: '4 · viewsWelcome install block (removed)',
    render: () => (
        <Page>
            <Row
                where="Was: the Specs view welcome content, when no spec exists yet"
                source="Removed — one welcome block now, with no Companion pitch in it"
                trigger="Nothing. The welcome copy stayed; the install pitch left."
                dismiss="N/A"
                mock
            >
                <SpecsWelcome />
            </Row>
        </Page>
    ),
};

export const CreateSpecBanner: Story = {
    name: '5 · Install banner — Create Spec panel',
    render: () => (
        <Page>
            <Row
                where="Top of the Create New Spec webview"
                source="src/features/spec-editor/installBanner.ts:14 · rendered at specEditorProvider.ts:592"
                trigger="Companion missing, installPrompt setting on, banner not dismissed. Every time the panel opens."
                dismiss="The × writes speckit.installBannerDismissed — a separate global flag from the welcome/activation one, and it clears both banners at once."
            >
                <CreateSpecPanel />
            </Row>
        </Page>
    ),
};

export const ActivityPanelBanner: Story = {
    name: '6 · Install banner — spec viewer Activity panel',
    render: () => (
        <Page>
            <Row
                where="Top of the Activity panel inside every open spec"
                source="webview/src/spec-viewer/components/ActivityPanel.tsx:28 · gated at specViewerProvider.ts:183"
                trigger="Companion missing, installPrompt on, banner not dismissed, Activity panel enabled. Every spec you open, every viewer refresh."
                dismiss="Same × and the same speckit.installBannerDismissed flag as the Create Spec banner. Identical copy — the only nudge that appears twice word for word."
            >
                <div class="vsc-panel">
                    <h2 class="vsc-panel__h">Activity</h2>
                    <InstallBanner />
                    <div class="vsc-panel__ghost">Timeline of steps for this spec…</div>
                </div>
            </Row>
        </Page>
    ),
};

export const CreateSpecModal: Story = {
    name: '7 · Blocking modal on Create Spec submit',
    render: () => (
        <Page>
            <Row
                where="Modal dialog over the editor — blocks the submit"
                source="src/features/spec-editor/specEditorProvider.ts:125 (promptCompanionInstallFirst)"
                trigger="Submitting Create Spec with the SpecKit Companion workflow selected and the extension missing"
                dismiss="No permanent dismissal. Escape cancels the spec entirely. Fires again on the next submit, indefinitely."
                mock
            >
                <CreateSpecModalDialog />
            </Row>
        </Page>
    ),
};

export const PostInstallToast: Story = {
    name: '8 · “Re-run New Spec” toast',
    render: () => (
        <Page>
            <Row
                where="Notification toast, right after choosing Install in the modal above"
                source="src/features/spec-editor/specEditorProvider.ts:308"
                trigger="The modal's Install branch — the spec is abandoned and the user has to start over"
                dismiss="Auto-dismisses like any toast. Not repeatable on its own."
                mock
            >
                <Toast kind="info" message="Installing SpecKit Companion — re-run New Spec once it finishes to use the Companion workflow." actions={[]} />
            </Row>
        </Page>
    ),
};

export const FallbackWarningCreateSpec: Story = {
    name: '9 · Fallback warning — Create Spec',
    render: () => (
        <Page>
            <Row
                where="Warning toast after a Companion spec downgrades to stock"
                source="src/features/spec-editor/specEditorProvider.ts:105 (warnFellBackToStock)"
                trigger="A Companion dispatch from Create Spec resolves to the stock command"
                dismiss="No permanent dismissal. Recurs on every downgraded create."
                mock
            >
                <Toast
                    kind="warning"
                    message="The SpecKit Companion workflow needs the companion spec-kit extension, which is not installed — creating this spec with the standard SpecKit flow instead."
                    actions={['Install spec-kit Extension']}
                />
            </Row>
        </Page>
    ),
};

export const FallbackWarningDispatch: Story = {
    name: '10 · Fallback warning — every pipeline step',
    render: () => (
        <Page>
            <Row
                where="Warning toast on any pipeline step dispatch that falls back"
                source="src/features/specs/dispatchStep.ts:70 (resolveDispatchCommand)"
                trigger="Every Companion step — plan, tasks, implement — dispatched without the extension"
                dismiss="No permanent dismissal, no per-session guard. Once per step, so a four-step run raises it four times. Near-identical wording to #9."
                mock
            >
                <Toast
                    kind="warning"
                    message="The SpecKit Companion workflow needs the companion spec-kit extension, which is not installed — running the standard SpecKit flow instead."
                    actions={['Install spec-kit Extension']}
                />
            </Row>
        </Page>
    ),
};

export const AutoUnavailableWarning: Story = {
    name: '11 · Auto unavailable warning',
    render: () => (
        <Page>
            <Row
                where="Warning toast when Auto is pressed"
                source="src/features/spec-editor/specEditorProvider.ts:152 (warnAutoUnavailable)"
                trigger="Auto requested without the extension — Auto has no stock twin, so the run is suppressed"
                dismiss="No permanent dismissal. Recurs on every Auto press."
                mock
            >
                <Toast
                    kind="warning"
                    message="Auto needs the companion spec-kit extension, which is not installed — install it, then use Auto to build the whole spec hands-off."
                    actions={['Install spec-kit Extension']}
                />
            </Row>
        </Page>
    ),
};

export const ResumeUnavailableWarning: Story = {
    name: '12 · Resume unavailable warning',
    render: () => (
        <Page>
            <Row
                where="Warning toast from the Resume action"
                source="src/features/specs/specCommands.ts:333"
                trigger="Resume invoked without the extension. The inline Resume icon is itself hidden when not installed (package.json:633), so this is mostly reachable from the command palette."
                dismiss="No permanent dismissal."
                mock
            >
                <Toast
                    kind="warning"
                    message="Resume needs the companion spec-kit extension, which is not installed — install it, then resume the spec from where it left off."
                    actions={['Install spec-kit Extension']}
                />
            </Row>
        </Page>
    ),
};

export const TitleMenuItem: Story = {
    name: '13 · Specs title “…” menu item',
    render: () => (
        <Page>
            <Row
                where="Overflow menu on the Specs view title bar"
                source="package.json:841 (speckit.specs.titleMenu)"
                trigger="(speckit.detected || speckit.cliInstalled) && !companion.installed — passive, only seen if the menu is opened"
                dismiss="N/A — a menu entry, not a prompt."
                mock
            >
                <div class="vsc-menu">
                    <div class="vsc-menu__item">Collapse All</div>
                    <div class="vsc-menu__sep" />
                    <div class="vsc-menu__item">Install Companion Extension</div>
                    <div class="vsc-menu__item">Upgrade…</div>
                </div>
            </Row>
        </Page>
    ),
};

export const UpgradeQuickPick: Story = {
    name: '14 · Upgrade… quick pick entry',
    render: () => (
        <Page>
            <Row
                where="SpecKit: Upgrade quick pick"
                source="src/speckit/cliCommands.ts:51"
                trigger="User runs Upgrade…. Always listed, installed or not."
                dismiss="N/A — user-initiated. Its description still says “Turbo + Capture”, wording the rest of the product dropped."
                mock
            >
                <div class="vsc-quickpick">
                    <div class="vsc-quickpick__input">Choose what to upgrade</div>
                    <div class="vsc-quickpick__item"><span><span class="codicon codicon-sync" aria-hidden="true" /> Upgrade All</span><span class="desc">Refresh the spec-kit CLI and this project's scaffolding</span></div>
                    <div class="vsc-quickpick__item"><span><span class="codicon codicon-cloud-download" aria-hidden="true" /> Update spec-kit Extension</span><span class="desc">Install or force-update the companion spec-kit extension (Turbo + Capture)</span></div>
                </div>
            </Row>
        </Page>
    ),
};

export const SteeringInlineIconDead: Story = {
    name: '15 · Steering inline install icon (unreachable)',
    render: () => (
        <Page>
            <Row
                where="Inline install icon on the Steering view's Companion header row"
                source="package.json:718 · header built at src/features/steering/steeringExplorerProvider.ts:867"
                trigger="Never. Its when clause needs !companion.installed, but the Companion header node is only built when isCompanionInstalled() is true — the two conditions cannot both hold."
                dismiss="N/A — dead configuration, safe to delete."
                mock
            >
                <div class="vsc-side">
                    <div class="vsc-side__title">
                        <span class="codicon codicon-chevron-down" aria-hidden="true" />
                        <span>Steering</span>
                    </div>
                    <div class="vsc-row" style="opacity:.45">
                        <span class="codicon codicon-chevron-right" aria-hidden="true" />
                        <span>Companion</span>
                        <span class="spacer" style="flex:1 1 auto" />
                        <span class="codicon codicon-desktop-download" aria-hidden="true" />
                    </div>
                </div>
            </Row>
        </Page>
    ),
};

export const OutOfDateStatusBar: Story = {
    name: '16 · Status bar — SpecKit commands out of date',
    render: () => (
        <Page>
            <Row
                where="Status bar, left side, warning background"
                source="src/speckit/companionUpdateNudge.ts · created in src/extension.ts next to the badge"
                trigger="The extension is installed but the version in .specify/extensions/.registry (or the installed manifest) is older than the one bundled in this build. Compared locally, no network."
                dismiss="None — click runs the update, and the item disappears as soon as the versions match. Re-checked by the same watcher that flips speckit.companion.installed."
                mock
            >
                <StatusBar />
            </Row>
        </Page>
    ),
};

export const OutOfDateBanner: Story = {
    name: '17 · Update banner — Create Spec and Activity panels',
    render: () => (
        <Page>
            <Row
                where="Same slot as the install banner in both panels"
                source="src/features/spec-editor/installBanner.ts · webview/src/spec-viewer/components/ActivityPanel.tsx · gated by resolveInstallPrompt"
                trigger="Installed but out of date, installPrompt setting on, not dismissed for this expected version. The install banner and this one are the same slot: a workspace shows one or the other, never both."
                dismiss="× writes speckit.companionUpdateSkippedVersion = the expected version, so a later release asks again."
            >
                <CreateSpecPanel banner={<UpdateBanner />} />
            </Row>
        </Page>
    ),
};

export const OutOfDateToast: Story = {
    name: '18 · Update notification on activation',
    render: () => (
        <Page>
            <Row
                where="Bottom-right toast, once per expected version"
                source="src/speckit/companionUpdateNudge.ts"
                trigger="Opening a workspace whose installed spec-kit extension is behind this build, the first time for that version."
                dismiss="“Skip this version” writes the same speckit.companionUpdateSkippedVersion the banner × uses; closing it still counts as shown for this version."
                mock
            >
                <Toast
                    kind="info"
                    message="SpecKit commands are 0.20.2, this extension expects 0.21.0. Update the spec-kit extension to get the matching commands."
                    actions={['Update', 'Skip this version']}
                />
            </Row>
        </Page>
    ),
};

export const FreshWorkspaceAllAtOnce: Story = {
    name: '19 · A fresh workspace, all at once',
    parameters: {
        docs: {
            description: {
                story:
                    'Open a spec-kit project without the companion extension and this is the first minute, in order: the badge is already lit, ' +
                    'the activation toast slides in, the Specs view welcome carries a third pitch, and opening Create Spec adds a fourth — ' +
                    'before the user has typed anything. Submitting turns the fourth into a blocking modal.',
            },
        },
    },
    render: () => (
        <Page>
            <div class="nudge-cap">
                <b>What a fresh, uninstalled workspace shows before the user does anything.</b>
                <br />
                Four pitches on screen at once, then a fifth — the modal — at the first submit.
            </div>

            <Row
                where="Instant — the badge is lit before the window finishes loading"
                source="src/extension.ts:301"
                trigger="Companion missing"
                dismiss="Never"
                mock
            >
                <ActivityBarBadge />
            </Row>

            <Row
                where="Opening the Specs view — the pinned CTA row"
                source="specExplorerProvider.ts:133 (specs exist)"
                trigger="Companion missing"
                dismiss="Never — ambient by design"
                mock
            >
                <SpecsWelcome />
            </Row>

            <Row
                where="First click on “Create your first spec”"
                source="src/features/spec-editor/installBanner.ts:14"
                trigger="Companion missing, banner not dismissed"
                dismiss="× — its own flag"
            >
                <CreateSpecPanel />
            </Row>

            <Row
                where="First submit — a blocking modal, asked once and then remembered"
                source="src/features/spec-editor/specEditorProvider.ts:125"
                trigger="Submitting with the Companion workflow selected"
                dismiss="Never permanently — every submit"
                mock
            >
                <CreateSpecModalDialog />
            </Row>
        </Page>
    ),
};
