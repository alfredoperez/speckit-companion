/**
 * What the panel shows when it cannot read the project's pipeline.
 *
 * This screen used to be a dead end: the error, and a button that opened
 * `companion.yml`. That is the panel handing someone the YAML it exists to
 * replace, at the moment they are least equipped to read it — and the state is
 * reachable without ever having opened that file, from a configuration written
 * by an older build or left behind by a version whose guard did not exist yet.
 *
 * So the ways out are actions here. They arrive with the error, diagnosed from
 * what the file actually contains, and each carries what it costs — because the
 * only thing worse than a broken pipeline is a recovery that silently throws
 * away work somebody spent an afternoon on. The manual escape stays, smaller.
 */
import type { PipelineRepair } from '../../../src/protocol/pipeline';

interface BrokenPipelineProps {
    error: string;
    repairs: PipelineRepair[];
    /** A repair that was refused, shown where it was triggered. */
    notice?: string | null;
    busy?: boolean;
    onRepair: (repairId: string) => void;
    onOpenConfig: () => void;
}

export function BrokenPipeline({
    error, repairs, notice, busy, onRepair, onOpenConfig,
}: BrokenPipelineProps) {
    return (
        <div class="builder-error">
            <h2>The pipeline could not be read</h2>
            <p class="builder-error-detail">{error}</p>
            <p>Nothing has been changed, and nothing runs from a pipeline in this state.</p>

            {repairs.length > 0 && (
                <div class="builder-repairs">
                    <h3 class="builder-repairs-title">Ways out</h3>
                    <ul class="builder-repair-list">
                        {repairs.map(repair => (
                            <li key={repair.id} class="builder-repair">
                                <button
                                    class={`builder-action${
                                        repair.destructive ? ' builder-action--destructive' : ''}`}
                                    disabled={busy}
                                    onClick={() => onRepair(repair.id)}
                                >
                                    {repair.label}
                                </button>
                                <p class="builder-repair-detail">{repair.detail}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {notice && <p class="builder-error-detail">{notice}</p>}

            <p class="builder-repair-manual">
                {repairs.length > 0
                    ? 'Or fix it by hand — this refreshes on save. '
                    : 'Fix it by hand and this refreshes on save. '}
                <button class="builder-link" onClick={onOpenConfig}>
                    Open companion.yml
                </button>
            </p>
        </div>
    );
}
