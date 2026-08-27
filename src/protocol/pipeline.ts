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

/** How a hook acts when it fires. */
export type HookType = 'command' | 'prompt' | 'node';

export interface PipelineHook {
    when: HookWhen;
    type: HookType;
    /** One line describing what it does — the chip's label. */
    summary: string;
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
}

export interface PipelineTemplate {
    file: string;
    /** Sections this project replaced. */
    sections: string[];
}

export interface PipelineStep {
    name: string;
    phases: PipelinePhase[];
    decisions: PipelineDecision[];
    /** What a run of this step is expected to produce. */
    artifacts: string[];
    template: PipelineTemplate | null;
    changes: PipelineChanges;
}

export interface PipelineGraph {
    steps: PipelineStep[];
    /** Whether the project has a companion.yml at all. */
    configured: boolean;
    /** Whether anything differs from the shipped pipeline. */
    customised: boolean;
    warnings: string[];
    counts: { steps: number; phases: number; nodes: number; hooks: number };
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
    | { type: 'openNode'; command: string; nodeId: string };

export type ExtensionToBuilderMessage =
    | { type: 'graph'; graph: PipelineGraphResult; buildState: PipelineBuildKind }
    | { type: 'busy'; busy: boolean };
