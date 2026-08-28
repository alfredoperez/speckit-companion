/**
 * The pipeline structure the builder draws, and the messages it exchanges.
 *
 * Both sides compile this: the extension fills it from the spec-kit half, the
 * webview renders it. It lives beside the viewer's protocol for the same reason
 * that one does — a contract declared twice is a contract that drifts.
 *
 * Keep free of `vscode` imports.
 */

/** What a node does. Drawn as a chip beside its name. */
export type NodeKind = 'investigate' | 'author' | 'gate' | 'control';

/** Where a hook attaches relative to its anchor. */
export type HookWhen = 'before' | 'after';

/** How a hook acts when it fires. Mirrors `HOOK_TYPES` in companion_config.py. */
export type HookType = 'command' | 'prompt' | 'node' | 'skill';

/**
 * A hook stock spec-kit's own extension registry attaches to a step.
 *
 * `.specify/extensions.yml` is spec-kit's, keyed by lifecycle step, and a
 * Companion run fires it alongside `companion.yml`. Drawing only Companion's
 * half told a project it had nine hooks when it had twenty-one.
 */
export interface StockHook {
    when: HookWhen;
    /** Which installed extension registered it. */
    extension: string;
    /** The command it dispatches. */
    command: string;
    description: string;
    /** Optional hooks prompt before running; mandatory ones just run. */
    optional: boolean;
    /** Guarded by a condition the run evaluates, so it may not fire. */
    conditional: boolean;
}

export interface PipelineHook {
    when: HookWhen;
    type: HookType;
    /** One line describing what it does — the chip's label. */
    summary: string;
    /** The node or phase it attaches to. Its address, with `when` and `index`. */
    anchor: string;
    /** Its place among the hooks at that anchor, so it can be edited or removed. */
    index: number;
    /** The extra line a skill hook may carry. */
    note: string;
}

export interface PipelineNode {
    /** The handle the configuration uses. */
    id: string;
    /** What a person reads. Falls back to the id when a node has no name. */
    name: string;
    kind: NodeKind;
    /** Nodes this one needs to have run. */
    reads: string[];
    /** Files this node is declared to produce. */
    writes: string[];
    hooks: PipelineHook[];
    /** Why this node cannot be dragged, or empty when it can. */
    pinned: string;
    /** The file these instructions were read from — what opening the node opens. */
    source: string;
    /** Whether that file is the project's own copy rather than the shipped one. */
    replaced: boolean;
}

/** The middle block: a named group of nodes, and a place a hook can attach. */
export interface PipelinePhase {
    name: string;
    nodes: PipelineNode[];
    hooks: PipelineHook[];
}

export interface PipelineVerdict {
    name: string;
    /** Steps this verdict skips. Empty means it runs everything. */
    folds: string[];
    /** A notice printed before continuing. */
    warns: string;
}

export interface PipelineDecision {
    /** The node whose verdict decides the route. */
    node: string;
    verdicts: PipelineVerdict[];
}

/** How a step differs from the pipeline as shipped. */
export interface PipelineChanges {
    added: string[];
    removed: string[];
    reordered: boolean;
    hooks: number;
    decisions: string[];
    /** Nodes this project replaced with its own instructions. */
    replaced: string[];
    /** Phases this project named itself. */
    phases: string[];
}

export interface PipelineTemplate {
    file: string;
    /** Sections this project replaced. */
    sections: string[];
}

/** A step's own preamble — the text every node in it sits under. */
export interface PipelineFrame {
    source: string;
    /** Whether the project replaced it with its own. */
    replaced: boolean;
}

export interface PipelineStep {
    name: string;
    /** Nodes this step ships with that the recipe is not running — what can be added back. */
    dropped: string[];
    /** The step's own instructions, which nothing could reach before. */
    frame: PipelineFrame;
    /** Hooks stock spec-kit extensions attach to this step. Not ours, and not editable here. */
    stockHooks: StockHook[];
    /**
     * Whether this step takes a turn in the run.
     *
     * `auto` runs the others rather than sitting among them, so drawing it as a
     * peer reads like a fifth step. Steps arrive in run order, not alphabetical.
     */
    inSequence: boolean;
    phases: PipelinePhase[];
    decisions: PipelineDecision[];
    /** What a run of this step is expected to produce. */
    artifacts: string[];
    template: PipelineTemplate | null;
    changes: PipelineChanges;
}

/** The named configurations this project can switch between. */
export interface PipelineWorkflows {
    /** Every workflow, `shipped` first — that one is always offered and has no file. */
    available: string[];
    /** Which one `companion.yml` selects. Empty means companion.yml itself. */
    active: string;
}

/** What a hook in this project can be pointed at, so a name is picked not typed. */
export interface PipelineChoices {
    skills: string[];
    nodes: string[];
}

export interface PipelineGraph {
    steps: PipelineStep[];
    workflows: PipelineWorkflows;
    choices: PipelineChoices;
    /** Whether the project has a companion.yml at all. */
    configured: boolean;
    /** Whether anything differs from the shipped pipeline. */
    customised: boolean;
    warnings: string[];
    counts: {
        steps: number; phases: number; nodes: number;
        /** Hooks this project declared in companion.yml. */
        hooks: number;
        /** Hooks stock spec-kit extensions contribute. */
        stockHooks: number;
    };
}

/**
 * A configuration the builder could not resolve.
 *
 * It arrives as data rather than a thrown error because a broken configuration
 * is exactly when someone opens the builder, and a panel that renders nothing
 * is no help in fixing it.
 */
export interface PipelineGraphError {
    error: string;
}

export type PipelineGraphResult = PipelineGraph | PipelineGraphError;

export function isGraphError(result: PipelineGraphResult): result is PipelineGraphError {
    return typeof (result as PipelineGraphError).error === 'string';
}

/** Whether the built pipeline still matches the configuration behind it. */
export type PipelineBuildKind = 'unconfigured' | 'never-built' | 'stale' | 'current';

// ============================================
// Messages
// ============================================

export type BuilderToExtensionMessage =
    | { type: 'ready' }
    | { type: 'refresh' }
    | { type: 'build' }
    | { type: 'preview' }
    | { type: 'openConfig' }
    | { type: 'openNode'; command: string; nodeId: string }
    /** Take ownership of a node: copy the shipped instructions in to edit. */
    | { type: 'replaceNode'; command: string; nodeId: string }
    /** Give it back: drop the project's copy and return to the shipped node. */
    | { type: 'restoreNode'; command: string; nodeId: string }
    /** Save a step's node order after a drag. `order` is the whole step, in order. */
    | { type: 'reorderNodes'; command: string; order: string[] }
    /**
     * Save a step's whole phase grouping — names and membership together.
     *
     * Whole rather than a patch: the grouping is small, and half of one leaves
     * the reader guessing which nodes are where.
     */
    | {
        type: 'setPhases';
        command: string;
        phases: Array<{ name: string; nodes: string[] }>;
        /** A phase this write renames, so the hooks anchored to it follow. */
        renamed?: { from: string; to: string };
    }
    /**
     * Attach work at a boundary. The panel collects all of it — a native
     * dialog covered the thing you were pointing at.
     */
    | {
        type: 'addHook';
        command: string;
        anchor: string;
        when: HookWhen;
        hookType: HookType;
        /** The skill name, node ref, shell line or instruction text. */
        value: string;
        /** An optional extra line, used by a skill hook. */
        note?: string;
        /** Set to replace the hook already at this index rather than add one. */
        editIndex?: number;
    }
    /** Take a hook out. A hook could only ever be added before this. */
    | { type: 'removeHook'; command: string; anchor: string; when: HookWhen; index: number }
    /** Read a node's instructions to show them here rather than in the editor. */
    | { type: 'readNode'; command: string; nodeId: string }
    /** Read a step's own preamble. `_frame` is a node id like any other. */
    | { type: 'readFrame'; command: string }
    /**
     * Hand a whole step to one document of your own.
     *
     * Rewriting each shipped node in place is the wrong shape for "use their
     * plan instead of ours": you want one file to paste into and adapt. The
     * step's current instructions seed it, so adapting starts from what it does.
     */
    | { type: 'replaceStep'; command: string }
    /**
     * Put a node the recipe dropped back, in one phase.
     *
     * Order and grouping move together: a node in the order with no phase, or in
     * a phase but not the order, is a pipeline that contradicts itself.
     */
    | {
        type: 'addNode';
        command: string;
        nodeId: string;
        phase: string;
        order: string[];
        phases: Array<{ name: string; nodes: string[] }>;
    }
    /** Switch the whole configuration. `shipped` is Companion with nothing changed. */
    | { type: 'selectWorkflow'; name: string }
    /** Start a new workflow, optionally seeded from the active one. */
    | { type: 'newWorkflow'; from: string; name: string };

export type ExtensionToBuilderMessage =
    | { type: 'graph'; graph: PipelineGraphResult; buildState: PipelineBuildKind }
    | { type: 'busy'; busy: boolean }
    /** A node's instructions, with the frontmatter and shared-part fences taken out. */
    | { type: 'nodeBody'; command: string; nodeId: string; body: string; parts: string[] }
    /**
     * Something to tell the person, shown in the panel.
     *
     * Not a toast: this view is meant to run outside VS Code too, and a message
     * the panel cannot draw is a message that does not exist there.
     */
    | { type: 'notice'; text: string };
