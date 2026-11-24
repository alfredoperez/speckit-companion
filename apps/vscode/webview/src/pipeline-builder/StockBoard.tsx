/**
 * The board on a project that runs stock Spec Kit.
 *
 * The same lanes and cards a Companion project sees, read from the project's
 * own files: its workflow, its extension registry, its templates. What can be
 * changed here is what Spec Kit itself owns, and every change is written at once.
 */

import { useState } from 'preact/hooks';
import {
    HookWhen, PipelineStatus, SpecPreset, StockHookDraft, StockHookRow, StockStepRow,
    StockWorkflowView,
} from '../../../src/protocol/pipeline';
import { StatusIcon } from './Header';
import { GateIcon, HookIcon } from './HookIcon';
import { Menu } from './Menu';
import { StockDocuments, inForceWord } from './StockDocuments';
import { StockHookModal } from './StockHookModal';
import { StockHookPopover } from './StockHookPopover';
import { StockSetup } from './StockSetup';
import { FileIcon, HookSwitch, PlugIcon, hookKey, hookMeta, hookTitle } from './stockParts';

type Flip = { step: string; when: HookWhen; index: number; enabled: boolean };
type Address = { step: string; when: HookWhen; index: number };

/** What is open over the board, so a story can draw it open. */
export type StockOpen =
    | { kind: 'hook'; key: string }
    | { kind: 'add'; step: string; when: HookWhen }
    | { kind: 'edit'; key: string }
    | { kind: 'documents'; file?: string }
    | { kind: 'setup' };

interface Props {
    view: StockWorkflowView;
    status: PipelineStatus | null;
    narrow?: boolean;
    /** Switch one registry hook on or off. */
    onSetHook: (flip: Flip) => void;
    /** Attach a hook of the person's own. */
    onAddHook: (add: { step: string; when: HookWhen; hook: StockHookDraft }) => void;
    /** Change or take away one the person owns. */
    onUpdateHook: (update: Address & { hook: StockHookDraft }) => void;
    onRemoveHook: (address: Address) => void;
    /** Open one of the files the board drew, by the path it was given. */
    onOpenFile: (path: string) => void;
    /** Draw another installed workflow. */
    onSelectWorkflow: (id: string) => void;
    /** Run the stock command that owns the constitution. */
    onRunCommand: (command: 'constitution') => void;
    /** Run the product's own install of the Companion extension. */
    onInstallCompanion: () => void;
    presets?: SpecPreset[];
    onPresetSearch?: (query: string) => void;
    onPresetAdd?: (id: string) => void;
    onPresetUpdate?: (id: string) => void;
    onPresetRemove?: (id: string) => void;
    /** Draw with something already open, for a story or a capture. */
    initialOpen?: StockOpen | null;
}

const noop = () => undefined;

function tally(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** The quiet line under a lane's name. */
export function laneCounts(step: StockStepRow): string {
    const off = step.hooks.filter(hook => !hook.enabled).length;
    const hooks = step.hooks.length
        ? ` · ${tally(step.hooks.length, 'hook')}${off ? `, ${off} off` : ''}` : '';
    return `1 command${hooks}`;
}

interface Lane { step: StockStepRow; number: number; gates: StockStepRow[] }

/** Command steps become lanes; a gate rides the join before the next lane, or after the last. */
export function lanesOf(steps: StockStepRow[]): { lanes: Lane[]; tail: StockStepRow[] } {
    const lanes: Lane[] = [];
    let pending: StockStepRow[] = [];
    for (const step of steps) {
        if (step.kind === 'gate') { pending.push(step); continue; }
        lanes.push({ step, number: lanes.length + 1, gates: pending });
        pending = [];
    }
    return { lanes, tail: pending };
}

function Arrow() {
    return (
        <>
            <svg class="pb-sj-arrow pb-sj-arrow--across" width="40" height="14" viewBox="0 0 40 14"
                aria-hidden="true" focusable="false">
                <path d="M2 7h34M30 2l6 5-6 5" fill="none" stroke="currentColor" stroke-width="1.5"
                    stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg class="pb-sj-arrow pb-sj-arrow--down" width="12" height="20" viewBox="0 0 12 20"
                aria-hidden="true" focusable="false">
                <path d="M6 2V17M2 12L6 17L10 12" fill="none" stroke="currentColor" stroke-width="1.5"
                    stroke-linecap="round" stroke-linejoin="round" />
            </svg>
        </>
    );
}

/** The join between two lanes: the review gates that wait there, then the arrow. */
function Join({ gates, arrow, next }: { gates: StockStepRow[]; arrow: boolean; next?: string }) {
    return (
        <div class="pb-sj" role="group" aria-label={next ? `Then ${next}` : 'At the end'}>
            {gates.map(gate => (
                <div key={gate.id} class="pb-sj-gate" data-step={gate.id}>
                    <GateIcon />
                    <span class="pb-sj-gate-name">{gate.label}</span>
                    <span class="pb-sj-gate-wait">waits for you</span>
                </div>
            ))}
            {arrow && <Arrow />}
        </div>
    );
}

function HookRow({ hook, open, onOpen, onSetHook }: {
    hook: StockHookRow;
    open: boolean;
    onOpen: () => void;
    onSetHook: Props['onSetHook'];
}) {
    const own = Boolean(hook.own);
    return (
        <div data-stock-hook={hookKey(hook)}
            class={['pb-sh-row', own ? 'pb-sh-row--yours' : '', hook.enabled ? '' : 'pb-sh-row--off',
                open ? 'pb-sh-row--open' : ''].filter(Boolean).join(' ')}>
            <button type="button" class="pb-sh-open" aria-haspopup="dialog" aria-expanded={open}
                onClick={onOpen}>
                <span class="pb-sh-mark">{own ? <HookIcon type="skill" /> : <PlugIcon />}</span>
                <span class="pb-sh-text">
                    <span class="pb-sh-name">{hookTitle(hook)}</span>
                    <span class="pb-sh-meta">{hookMeta(hook)}</span>
                </span>
            </button>
            {!own && (
                <HookSwitch hook={hook} onToggle={() => onSetHook({
                    step: hook.step, when: hook.when, index: hook.index, enabled: !hook.enabled,
                })} />
            )}
        </div>
    );
}

function EdgeAdd({ when, label, onAdd }: { when: HookWhen; label: string; onAdd: () => void }) {
    return (
        <button type="button" class={`pb-edge-add pb-edge-add--${when} pb-edge-add--stock`}
            aria-haspopup="dialog" aria-label={`Add a hook ${when} ${label}`} onClick={onAdd}>
            <span aria-hidden="true">{`+ ${when}`}</span>
        </button>
    );
}

function StockLane({ lane, openKey, onOpenHook, onSetHook, onAdd }: {
    lane: Lane;
    openKey: string;
    onOpenHook: (hook: StockHookRow) => void;
    onSetHook: Props['onSetHook'];
    onAdd: (when: HookWhen) => void;
}) {
    const { step } = lane;
    const before = step.hooks.filter(hook => hook.when === 'before');
    const after = step.hooks.filter(hook => hook.when === 'after');
    const slot = (when: HookWhen, hooks: StockHookRow[]) => hooks.length > 0 && (
        <div class={`pb-sh-slot pb-sh-slot--${when}`} role="group"
            aria-label={`Runs ${when} ${step.label}`}>
            {hooks.map(hook => (
                <HookRow key={hookKey(hook)} hook={hook} open={openKey === hookKey(hook)}
                    onOpen={() => onOpenHook(hook)} onSetHook={onSetHook} />
            ))}
        </div>
    );

    return (
        <section class="pb-sl" data-step={step.id} aria-labelledby={`pb-sl-${step.id}`}>
            <header class="pb-sl-head">
                <h2 class="pb-sl-title" id={`pb-sl-${step.id}`}>
                    <span class="pb-sl-number">{lane.number}</span>
                    <span class="pb-sl-name">{step.hookStep ?? step.id}</span>
                </h2>
                <p class="pb-sl-counts">{laneCounts(step)}</p>
            </header>
            <div class="pb-node-group pb-sc-group">
                <EdgeAdd when="before" label={step.label} onAdd={() => onAdd('before')} />
                <div class={`pb-sc${step.hooks.length ? ' pb-sc--hooked' : ''}`}>
                    {slot('before', before)}
                    <div class="pb-sc-command">
                        <span class="pb-sc-name">{step.label}</span>
                        <span class="pb-sc-meta">
                            {[step.command && `/${step.command}`, ...step.writes].filter(Boolean).join(' · ')}
                        </span>
                    </div>
                    {slot('after', after)}
                </div>
                <EdgeAdd when="after" label={step.label} onAdd={() => onAdd('after')} />
            </div>
            <div class="pb-sl-companion">
                <span class="pb-sl-companion-label">With Companion</span>
                <span class="pb-sl-companion-text">
                    Companion splits this into nodes in phases, and lets you hook any one of them.
                </span>
            </div>
        </section>
    );
}

export function StockBoard(props: Props) {
    const { view, status, narrow, onSetHook, onOpenFile, onSelectWorkflow, onRunCommand } = props;
    const [open, setOpen] = useState<StockOpen | null>(props.initialOpen ?? null);
    const { lanes, tail } = lanesOf(view.steps);
    const hooks = view.steps.flatMap(step => step.hooks.map(hook => ({ hook, step })));
    const find = (key: string) => hooks.find(found => hookKey(found.hook) === key);
    const openKey = open?.kind === 'hook' ? open.key : '';
    const stepFor = (name: string) => view.steps.find(step => (step.hookStep ?? step.id) === name);

    const drawing = view.workflow?.name ?? 'The installed commands';
    const workflowMenu = view.workflows.length > 1 ? (
        <Menu class="builder-workflow-current pb-sb-workflow"
            trigger={drawing}
            label={`Drawing: ${drawing}`}
            title="The installed workflow the board draws"
            options={view.workflows.map(choice => ({
                id: choice.id, label: choice.name, note: choice.description, checked: choice.drawn,
            }))}
            onPick={onSelectWorkflow} />
    ) : <span class="pb-sb-workflow">{drawing}</span>;

    const popped = open?.kind === 'hook' ? find(open.key) : undefined;
    const editing = open?.kind === 'edit' ? find(open.key) : undefined;
    const adding = open?.kind === 'add' ? stepFor(open.step) : undefined;
    const presetActions = {
        onSearch: props.onPresetSearch ?? noop,
        onAdd: props.onPresetAdd ?? noop,
        onUpdate: props.onPresetUpdate ?? noop,
        onRemove: props.onPresetRemove ?? noop,
    };

    return (
        <div class="builder builder--stock">
            <header class="builder-header">
                <div class="builder-identity">
                    <span class="builder-title">Workflow</span>
                    <span class="builder-workflow">
                        <span class="builder-workflow-label">Drawing</span>
                        {workflowMenu}
                    </span>
                    <span class="pb-sb-applies">Changes apply at once</span>
                </div>
                <div class="builder-facts">
                    <button type="button" class="builder-action builder-action--quiet"
                        aria-haspopup="dialog" onClick={() => setOpen({ kind: 'setup' })}>
                        Workflows and presets
                    </button>
                </div>
                {status && (
                    <div class={`builder-notice builder-notice--${status.tone}`} role="status">
                        <StatusIcon tone={status.tone} />
                        <span>{status.text}{status.detail ? ` · ${status.detail}` : ''}</span>
                    </div>
                )}
            </header>

            <main class="pb-canvas pb-sb">
                <div class="pb-sb-banner" role="note">
                    <p class="pb-sb-banner-text">
                        This project runs stock Spec Kit. Hooks and templates work here. Add SpecKit
                        Companion to shape nodes and phases.
                        {view.source === 'commands'
                            && ' It has no workflow file, so the lanes are its installed commands.'}
                    </p>
                    <button type="button" class="builder-action pb-sb-banner-add"
                        onClick={props.onInstallCompanion}>
                        Add Companion
                    </button>
                </div>

                {lanes.length === 0 ? (
                    <p class="pb-sb-empty">
                        No Spec Kit steps found in this project yet. Install a workflow, or the Spec Kit
                        command family for your assistant.
                    </p>
                ) : (
                    <div class="pb-sb-run">
                        {lanes.flatMap((lane, at) => [
                            (at > 0 || lane.gates.length > 0) && (
                                <Join key={`join-${lane.step.id}`} gates={lane.gates} arrow={at > 0}
                                    next={lane.step.hookStep ?? lane.step.id} />
                            ),
                            <StockLane key={lane.step.id} lane={lane} openKey={openKey}
                                onSetHook={onSetHook}
                                onOpenHook={hook => setOpen(openKey === hookKey(hook)
                                    ? null : { kind: 'hook', key: hookKey(hook) })}
                                onAdd={when => setOpen({
                                    kind: 'add', step: lane.step.hookStep ?? lane.step.id, when,
                                })} />,
                        ])}
                        {tail.length > 0 && <Join key="join-tail" gates={tail} arrow={false} />}
                    </div>
                )}

                {(view.templates.length > 0 || view.constitution) && (
                    <section class="pb-sb-docs" aria-labelledby="pb-sb-docs-label">
                        <h2 class="pb-sb-docs-label" id="pb-sb-docs-label">Documents</h2>
                        <ul class="pb-sb-docs-list">
                            {view.templates.map(template => (
                                <li key={template.path}>
                                    <button type="button" class="pb-sb-doc" aria-haspopup="dialog"
                                        onClick={() => setOpen({ kind: 'documents', file: template.file })}>
                                        <FileIcon />
                                        <span class="pb-sb-doc-file">{template.file}</span>
                                        {template.inForce && template.inForce !== 'core' && (
                                            <span class={`pb-sb-doc-force${template.inForce === 'override'
                                                ? ' pb-sb-doc-force--yours' : ''}`}>
                                                {inForceWord(template)}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            ))}
                            {view.constitution && (
                                <li class="pb-sb-doc pb-sb-doc--memory">
                                    <FileIcon />
                                    <span class="pb-sb-doc-file">constitution.md</span>
                                    {view.constitution.path && (
                                        <button type="button" class="pb-sb-revise"
                                            aria-label={`Open ${view.constitution.path}`}
                                            onClick={() => onOpenFile(view.constitution!.path!)}>
                                            Open
                                        </button>
                                    )}
                                    <button type="button" class="pb-sb-revise"
                                        title={`Sends /${view.constitution.command} to your assistant`}
                                        onClick={() => onRunCommand('constitution')}>
                                        {view.constitution.written ? 'Revise' : 'Write it'}
                                    </button>
                                </li>
                            )}
                        </ul>
                    </section>
                )}
            </main>

            {popped && (
                <StockHookPopover hook={popped.hook} command={popped.step.command} narrow={narrow}
                    onClose={() => setOpen(null)}
                    onToggle={() => onSetHook({
                        step: popped.hook.step, when: popped.hook.when,
                        index: popped.hook.index, enabled: !popped.hook.enabled,
                    })}
                    onEdit={() => setOpen({ kind: 'edit', key: hookKey(popped.hook) })}
                    onRemove={() => {
                        const { step, when, index } = popped.hook;
                        setOpen(null);
                        props.onRemoveHook({ step, when, index });
                    }}
                    onOpenRegistry={view.registry ? () => onOpenFile(view.registry!.path) : undefined} />
            )}

            {open?.kind === 'add' && (
                <StockHookModal step={open.step} when={open.when}
                    label={adding?.label ?? open.step}
                    onCancel={() => setOpen(null)}
                    onSave={(hook, keep) => {
                        props.onAddHook({ step: open.step, when: open.when, hook });
                        if (!keep) { setOpen(null); }
                    }} />
            )}

            {editing && (
                <StockHookModal step={editing.hook.step} when={editing.hook.when}
                    label={editing.step.label} editing={editing.hook}
                    onCancel={() => setOpen(null)}
                    onSave={hook => {
                        const { step, when, index } = editing.hook;
                        setOpen(null);
                        props.onUpdateHook({ step, when, index, hook });
                    }}
                    onRemove={() => {
                        const { step, when, index } = editing.hook;
                        setOpen(null);
                        props.onRemoveHook({ step, when, index });
                    }} />
            )}

            {open?.kind === 'documents' && (
                <StockDocuments templates={view.templates} constitution={view.constitution}
                    open={open.file} onOpenFile={onOpenFile}
                    onRevise={() => onRunCommand('constitution')}
                    onClose={() => setOpen(null)} />
            )}

            {open?.kind === 'setup' && (
                <StockSetup view={view} presets={props.presets ?? []} presetActions={presetActions}
                    onSelectWorkflow={onSelectWorkflow} onOpenFile={onOpenFile}
                    onClose={() => setOpen(null)} />
            )}
        </div>
    );
}
