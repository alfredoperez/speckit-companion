// When a preview and a build overlap, only the run started last may answer the panel.
import { BuildReport, PipelineBuildKind } from '../../protocol/pipeline';

export interface LatestRun {
    /** Starts a run and returns its ticket. */
    start(): number;
    /** Whether no run has started since this ticket. */
    isNewest(ticket: number): boolean;
}

export function latestRun(): LatestRun {
    let newest = 0;
    return {
        start: () => ++newest,
        isNewest: ticket => ticket === newest,
    };
}

/**
 * Whether a redraw leaves the last report standing. The build's own writes
 * redraw the board, and "Built" is still true while the build is current.
 */
export function reportHolds(report: BuildReport | null, buildState: PipelineBuildKind): boolean {
    return Boolean(report?.ok && !report.dryRun && buildState === 'current');
}
