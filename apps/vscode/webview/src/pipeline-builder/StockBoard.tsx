/**
 * The board on a project that runs stock Spec Kit.
 *
 * Read from the project's own files — its workflow, its extension registry, the
 * presets applied to it — so the steps drawn are the steps it can actually run.
 * Everything Companion adds is drawn too, switched off, because "there is more
 * than this" is worth knowing and an empty board does not say it.
 */

import {
    HookWhen, PipelineStatus, StockHookRow, StockStepRow, StockWorkflowView,
} from '../../../src/protocol/pipeline';
import { StatusIcon } from './Header';

/** Where the one line of prose about Companion-only work points. */
const INSTALL_DOCS = 'https://speckit-companion.dev/docs/ide/install/#vscode-companion';

interface Props {
    view: StockWorkflowView;
    status: PipelineStatus | null;
    /** Switch one registry hook on or off. */
    onSetHook: (flip: { step: string; when: HookWhen; index: number; enabled: boolean }) => void;
    onOpenFile: (file: 'registry' | 'workflow') => void;
}

/** What Companion would add here, each row a thing the board cannot edit. */
const COMPANION_ONLY = [
    { label: 'Nodes', note: 'The blocks of instruction a step is built from' },
    { label: 'Phases', note: 'Named groups of nodes inside a step' },
    { label: 'Node instructions', note: 'The words a step tells your assistant' },
    { label: 'Routing decisions', note: 'Verdicts that skip steps a change does not need' },
    { label: 'Document shape', note: 'An alternative for one section of a template' },
    { label: 'Workflows', note: 'Whole named configurations you switch between' },
];

function tally(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function hookLine(hook: StockHookRow): string {
    return hook.description || hook.command || `a hook from ${hook.extension}`;
}

function HookRow({ hook, onSetHook }: { hook: StockHookRow; onSetHook: Props['onSetHook'] }) {
    const id = `stock-hook-${hook.when}-${hook.step}-${hook.index}`;
    return (
        <li class={`pb-stock-hook${hook.enabled ? '' : ' pb-stock-hook--off'}`}>
            <input class="pb-stock-switch" type="checkbox" id={id} checked={hook.enabled}
                onChange={() => onSetHook({
                    step: hook.step, when: hook.when, index: hook.index, enabled: !hook.enabled,
                })} />
            <label class="pb-stock-hook-body" for={id}>
                <span class="pb-stock-hook-when">{hook.when}</span>
                <span class="pb-stock-hook-text">{hookLine(hook)}</span>
                <span class="pb-stock-hook-meta">
                    {hook.extension}
                    {hook.optional ? ' · asks first' : ''}
                    {hook.conditional ? ' · sometimes' : ''}
                </span>
            </label>
        </li>
    );
}

function Step({ step, onSetHook }: { step: StockStepRow; onSetHook: Props['onSetHook'] }) {
    return (
        <li class={`pb-stock-step pb-stock-step--${step.kind}`} data-step={step.id}>
            <div class="pb-stock-step-head">
                <span class="pb-stock-step-name">{step.label}</span>
                {step.kind === 'gate'
                    ? <span class="pb-stock-chip">waits for you</span>
                    : <code class="pb-stock-command">/{step.command}</code>}
            </div>
            {step.writes.length > 0 && (
                <ul class="pb-stock-writes">
                    {step.writes.map(file => (
                        <li class="pb-stock-file" key={file}>{file}</li>
                    ))}
                </ul>
            )}
            {step.hooks.length > 0 && (
                <ul class="pb-stock-hooks">
                    {step.hooks.map(hook => (
                        <HookRow key={`${hook.when}-${hook.index}`}
                            hook={hook} onSetHook={onSetHook} />
                    ))}
                </ul>
            )}
        </li>
    );
}

export function StockBoard({ view, status, onSetHook, onOpenFile }: Props) {
    const hooks = view.steps.reduce((n, step) => n + step.hooks.length, 0);
    const running = view.steps.reduce(
        (n, step) => n + step.hooks.filter(hook => hook.enabled).length, 0);

    return (
        <div class="builder builder--stock">
            <header class="builder-header">
                <div class="builder-identity">
                    <span class="builder-title">Workflow</span>
                    <div class="builder-workflow">
                        <span class="builder-workflow-label">Stock Spec Kit</span>
                        <span class="builder-workflow-current pb-stock-workflow">
                            {view.workflow?.name ?? 'The installed commands'}
                        </span>
                    </div>
                </div>

                <div class="builder-tools">
                    <span class="builder-chip builder-chip--flat">
                        {tally(view.steps.length, 'step')}
                    </span>
                    <span class="builder-chip builder-chip--flat">
                        {hooks === 0 ? 'no hooks'
                            : `${tally(hooks, 'hook')} · ${running} on`}
                    </span>
                </div>

                <div class="builder-facts">
                    {view.registry && (
                        <button class="builder-action builder-action--quiet"
                            onClick={() => onOpenFile('registry')}>
                            Open extensions.yml
                        </button>
                    )}
                    {view.workflow && (
                        <button class="builder-action builder-action--quiet"
                            onClick={() => onOpenFile('workflow')}>
                            Open workflow.yml
                        </button>
                    )}
                    <button class="builder-action" disabled
                        aria-describedby="stock-build-reason">
                        Build
                    </button>
                </div>

                <div class="builder-notice builder-notice--info" id="stock-build-reason">
                    <StatusIcon tone="info" />
                    <span>
                        {view.source === 'workflow'
                            ? 'This project runs stock Spec Kit. '
                            : 'This project runs stock Spec Kit, and has no workflow file, '
                              + 'so the steps are its installed commands. '}
                        {view.buildBlocked}
                    </span>
                </div>

                {status && (
                    <div class={`builder-notice builder-notice--${status.tone}`} role="status">
                        <StatusIcon tone={status.tone} />
                        <span>{status.text}{status.detail ? ` · ${status.detail}` : ''}</span>
                    </div>
                )}
            </header>

            <div class="builder-body pb-stock">
                <section class="pb-stock-section">
                    <h2 class="pb-stock-heading">The run, in order</h2>
                    {view.workflow?.description && (
                        <p class="pb-stock-prose">{view.workflow.description}</p>
                    )}
                    {view.steps.length === 0 ? (
                        <p class="pb-stock-prose">
                            No Spec Kit steps found in this project yet. Install a workflow,
                            or the <code>/speckit.*</code> commands for your assistant.
                        </p>
                    ) : (
                        <ol class="pb-stock-steps">
                            {view.steps.map(step => (
                                <Step key={step.id} step={step} onSetHook={onSetHook} />
                            ))}
                        </ol>
                    )}
                    <p class="pb-stock-prose">
                        A hook&rsquo;s switch is written straight to
                        {' '}<code>.specify/extensions.yml</code>, which is where Spec Kit
                        reads it. There is nothing to build.
                    </p>
                </section>

                {view.presets.length > 0 && (
                    <section class="pb-stock-section">
                        <h2 class="pb-stock-heading">Presets applied here</h2>
                        <ul class="pb-stock-presets">
                            {view.presets.map(preset => (
                                <li class="pb-stock-preset" key={preset.id}>
                                    <span class="pb-stock-preset-name">{preset.name}</span>
                                    <span class="pb-stock-preset-note">
                                        {preset.description || preset.id}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <p class="pb-stock-prose">
                            A preset replaces the text of the stock commands. Add or remove one
                            with <code>specify preset</code>.
                        </p>
                    </section>
                )}

                {/* Said once for the whole group, rather than on each row. */}
                <section class="pb-stock-section pb-stock-section--locked"
                    aria-describedby="stock-locked-reason">
                    <h2 class="pb-stock-heading">What Companion would add</h2>
                    <ul class="pb-stock-locked">
                        {COMPANION_ONLY.map(item => (
                            <li class="pb-stock-locked-row" key={item.label} aria-disabled="true">
                                <span class="pb-stock-locked-name">{item.label}</span>
                                <span class="pb-stock-locked-note">{item.note}</span>
                            </li>
                        ))}
                    </ul>
                    <p class="pb-stock-prose" id="stock-locked-reason">
                        Install the Companion Spec Kit extension to shape these on this board.
                        {' '}
                        <a class="builder-link" href={INSTALL_DOCS}>How to install it</a>
                    </p>
                </section>
            </div>
        </div>
    );
}
