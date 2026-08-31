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

/** An alternative for one node's slot: same place in the run, different words. */
export interface PipelineVariant {
    id: string;
    name: string;
    summary: string;
}

export interface PipelineNode {
    /** The handle the configuration uses. */
    id: string;
    /** Alternatives that stand in for this node. Empty when nothing does. */
    variants: PipelineVariant[];
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
    /**
     * Every `##` section the template has — what a project *could* replace.
     *
     * Reported for a step whose template exists even when nothing was changed,
     * so the panel can offer a row per section rather than only showing the
     * ones already swapped. Its presence therefore says nothing about whether
     * the project customised anything; `sections` is what says that.
     */
    sectionsAvailable: string[];
    /** Which fragment each replaced section is using, by heading. */
    chosenBy: Record<string, string>;
}

/** A shipped alternative for one template section. */
export interface PipelineFragment {
    name: string;
    /** The `## heading` it is written to replace. */
    section: string;
    /** The step it belongs to. */
    for: string;
    summary: string;
}

/** A step's own preamble — the text every node in it sits under. */
export interface PipelineFrame {
    source: string;
    /** Whether the project replaced it with its own. */
    replaced: boolean;
}

export interface PipelineStep {
    name: string;
    /** Nodes this step could run and is not — the only ones that can be added. */
    dropped: string[];
    /**
     * Which of `dropped` are shipped add-ons rather than nodes the recipe took out.
     *
     * Both can be put in a phase and the picker offers both, but one is "put it
     * back" and the other is "this step can also do this" — as bare ids they read
     * identically, so the list gave no clue which was which.
     */
    addOns: string[];
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
    /** Whether this step is the project's own rather than one Companion ships. */
    own: boolean;
    /** For a step the project added, the step it runs behind. Empty means by hand. */
    after: string;
    phases: PipelinePhase[];
    /** Hooks on the step itself — outside every phase, at its two edges. */
    hooks: PipelineHook[];
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

/** A whole configuration Companion ships as a starting point for a new workflow. */
export interface PipelinePreset {
    /** The filename, which is what seeding names. */
    name: string;
    /** How it reads in the picker. */
    label: string;
    summary: string;
}

/** What a hook in this project can be pointed at, so a name is picked not typed. */
export interface PipelineChoices {
    skills: string[];
    nodes: string[];
    /** Shipped alternatives a template section can be pointed at. */
    fragments: PipelineFragment[];
    /** Shipped configurations a new workflow can start from. */
    presets: PipelinePreset[];
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
 * One way out of a broken configuration, offered as an action rather than advice.
 *
 * Each is a named retreat toward what ships, and `detail` says what it costs —
 * a recovery that quietly discarded an afternoon's work would be worse than the
 * breakage it fixes.
 */
export interface PipelineRepair {
    id: string;
    label: string;
    detail: string;
    /** The broadest retreat — discards work across every step, so it reads as one. */
    destructive?: boolean;
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
    /** Absent when the configuration is too broken to even diagnose. */
    repairs?: PipelineRepair[];
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
    | { type: 'repair'; repairId: string }
    | { type: 'saveNode'; command: string; nodeId: string; body: string }
    | { type: 'openNode'; command: string; nodeId: string }
    /** Take ownership of a node: copy the shipped instructions in to edit. */
    /** Give it back: drop the project's copy and return to the shipped node. */
    | { type: 'restoreNode'; command: string; nodeId: string }
    /**
     * Run a different block in one node's place.
     *
     * A variant is a shipped node of its own, so this is the recipe write the
     * panel already makes — the order and the grouping with one id swapped —
     * rather than a new kind of edit. It stays editable afterwards like any node.
     */
    | {
        type: 'useVariant';
        command: string;
        /** The whole step, with the variant's id in the old node's place. */
        order: string[];
        phases: Array<{ name: string; nodes: string[] }>;
    }
    /**
     * Point one template section at a fragment, or back at what ships.
     *
     * `fragment` empty restores the shipped section: an absent entry means the
     * template's own words, so there is nothing to write for "as shipped".
     */
    | { type: 'setTemplateSection'; command: string; heading: string; fragment: string }
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
    /**
     * Add a step of the project's own, seeded runnable.
     *
     * The pipeline's steps were a fixed set: "review the change before it counts
     * as done" had to hide inside implement or not exist. A step is a directory
     * of nodes, so adding one writes that directory and the build finds it.
     */
    | {
        type: 'newStep';
        name: string;
        label: string;
        /** The step it runs behind. Empty means it is launched by hand. */
        after: string;
        /** The file it produces. Empty means it writes none. */
        writes: string;
    }
    /** Switch the whole configuration. `shipped` is Companion with nothing changed. */
    | { type: 'selectWorkflow'; name: string }
    /** Start a new workflow, optionally seeded from the active one. */
    | { type: 'newWorkflow'; from: string; name: string };

export type ExtensionToBuilderMessage =
    | { type: 'graph'; graph: PipelineGraphResult; buildState: PipelineBuildKind }
    | { type: 'busy'; busy: boolean }
    /** A node's instructions, with the frontmatter and shared-part fences taken out. */
    | {
        type: 'nodeBody'; command: string; nodeId: string; body: string; parts: string[];
        /** The stored text, fences intact — what an edit starts from. */
        editable: string;
    }
    /**
     * Something to tell the person, shown in the panel.
     *
     * Not a toast: this view is meant to run outside VS Code too, and a message
     * the panel cannot draw is a message that does not exist there.
     */
    | { type: 'notice'; text: string };
