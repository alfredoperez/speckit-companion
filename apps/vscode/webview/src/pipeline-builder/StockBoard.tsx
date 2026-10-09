/**
 * The board on a project that runs stock Spec Kit.
 *
 * Read from the project's own files — its workflows, its templates, its
 * extension registry, the presets applied to it — so what is drawn is what this
 * project can run, and what can be changed here is what Spec Kit itself owns.
 */

import {
    HookWhen, PipelineStatus, StockHookRow, StockStepRow, StockWorkflowView,
} from '../../../src/protocol/pipeline';
import { StatusIcon } from './Header';

/** The one way on to Companion, for a reader who wants more than this. */
const INSTALL_DOCS = 'https://speckit-companion.dev/docs/ide/install/#vscode-companion';

interface Props {
    view: StockWorkflowView;
    status: PipelineStatus | null;
    /** Switch one registry hook on or off. */
    onSetHook: (flip: { step: string; when: HookWhen; index: number; enabled: boolean }) => void;
    /** Open one of the files the board drew, by the path it was given. */
    onOpenFile: (path: string) => void;
    /** Draw another installed workflow. */
    onSelectWorkflow: (id: string) => void;
    /** Run the stock command that owns the constitution. */
    onRunCommand: (command: 'constitution') => void;
}

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

export function StockBoard(
    { view, status, onSetHook, onOpenFile, onSelectWorkflow, onRunCommand }: Props,
) {
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
                            onClick={() => onOpenFile(view.registry!.path)}>
                            Open extensions.yml
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
                            or the Spec Kit command family for your assistant.
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
                        reads it.
                    </p>
                </section>

                {/* A command owns the constitution, so the row runs it rather
                    than opening the file it produces. */}
                {view.constitution && (
                    <section class="pb-stock-section">
                        <h2 class="pb-stock-heading">The constitution</h2>
                        <button class="pb-stock-row pb-stock-row--runs"
                            onClick={() => onRunCommand('constitution')}>
                            <span class="pb-stock-row-name">
                                {view.constitution.written
                                    ? 'Revise the constitution'
                                    : 'Set the constitution'}
                            </span>
                            <code class="pb-stock-command">/{view.constitution.command}</code>
                            <span class="pb-stock-row-note">
                                {view.constitution.written
                                    ? 'Sends the command to your assistant, which rewrites '
                                      + 'memory/constitution.md'
                                    : 'Not written yet. Sends the command to your assistant, '
                                      + 'which writes memory/constitution.md'}
                            </span>
                        </button>
                    </section>
                )}

                {view.templates.length > 0 && (
                    <section class="pb-stock-section">
                        <h2 class="pb-stock-heading">Document shapes</h2>
                        <ul class="pb-stock-rows">
                            {view.templates.map(template => (
                                <li key={template.path}>
                                    <button class="pb-stock-row"
                                        onClick={() => onOpenFile(template.path)}>
                                        <span class="pb-stock-row-name">{template.label}</span>
                                        <code class="pb-stock-command">{template.file}</code>
                                        <span class="pb-stock-row-note">
                                            {template.note}
                                            {template.command
                                                ? <> <code>/{template.command}</code></>
                                                : ''}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <p class="pb-stock-prose">
                            A template opens in an editor, where it is yours to change. Spec Kit
                            reads it on the next run.
                        </p>
                    </section>
                )}

                {view.workflows.length > 0 && (
                    <section class="pb-stock-section">
                        <h2 class="pb-stock-heading">Workflows installed here</h2>
                        <ul class="pb-stock-rows">
                            {view.workflows.map(choice => (
                                <li class="pb-stock-rowline" key={choice.id}>
                                    <button
                                        class={`pb-stock-row${
                                            choice.drawn ? ' pb-stock-row--drawn' : ''}`}
                                        aria-pressed={choice.drawn}
                                        onClick={() => onSelectWorkflow(choice.id)}>
                                        <span class="pb-stock-row-name">{choice.name}</span>
                                        <code class="pb-stock-command">{choice.id}</code>
                                        <span class="pb-stock-row-note">
                                            {choice.drawn ? 'Drawn above. ' : ''}
                                            {choice.description}
                                        </span>
                                    </button>
                                    <button class="builder-action builder-action--quiet"
                                        onClick={() => onOpenFile(choice.path)}>
                                        Open
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <p class="pb-stock-prose">
                            Picking one draws it here. Which workflow a run takes is chosen when
                            the run starts, with <code>specify workflow run &lt;id&gt;</code>, and
                            the registry records no active one — so there is nothing here to set.
                        </p>
                    </section>
                )}

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

                <p class="pb-stock-foot">
                    <a class="builder-link" href={INSTALL_DOCS}>
                        The Companion Spec Kit extension
                    </a>{' '}adds nodes, hooks of your own and a pipeline you shape here.
                </p>
            </div>
        </div>
    );
}
