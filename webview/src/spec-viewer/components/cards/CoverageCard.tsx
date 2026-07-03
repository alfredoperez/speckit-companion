import type { ViewerState, ViewerCoverageRow } from '../../types';
import { Donut } from '../ActivityHero';

export interface CoverageCardProps {
    state: ViewerState;
}

function CoverageRow({ row }: { row: ViewerCoverageRow }) {
    return (
        <li>
            <span class={row.tests.length > 0 ? 'activity-req-chip is-covered' : 'activity-req-chip is-uncovered'}>{row.req}</span>
            {row.title && <span class="activity-coverage__title">{row.title}</span>}
            {row.tasks.length > 0 && (
                <div class="activity-detail">
                    <span class="activity-inline-label">Tasks</span> {row.tasks.join(', ')}
                </div>
            )}
            {row.tests.length > 0 ? (
                <div class="activity-detail">
                    <span class="activity-inline-label">Tests</span> {row.tests.join(', ')}
                </div>
            ) : (
                <div class="activity-detail activity-detail--warning">No test mapped</div>
            )}
        </li>
    );
}

/**
 * Requirement → tasks/tests traceability, exceptions-first: the uncovered
 * requirements are the signal, so they render up front and the full mapping
 * sits behind a native disclosure. Covered = has ≥1 test.
 */
export function CoverageCard({ state }: CoverageCardProps) {
    const rows = state.coverage;
    if (!rows || rows.length === 0) return null;

    const uncovered = rows.filter(r => r.tests.length === 0);
    const covered = rows.length - uncovered.length;
    // Uncovered requirements lead — the gaps are the signal.
    const ordered = [...uncovered, ...rows.filter(r => r.tests.length > 0)];

    return (
        <section class="activity-card activity-card--coverage">
            <h3 class="activity-card__title">
                <Donut covered={covered} total={rows.length} /> Coverage{' '}
                <span class="activity-card__count">({covered}/{rows.length})</span>
            </h3>
            <div class="activity-card__body">
                {covered === 0 && (
                    <p class="activity-detail">
                        No tests mapped yet — {rows.length} requirement{rows.length === 1 ? '' : 's'} tracked.
                    </p>
                )}
                <details class="activity-disclosure" open>
                    <summary>{rows.length} requirement{rows.length === 1 ? '' : 's'}</summary>
                    <ul class="activity-list">
                        {ordered.map(r => (
                            <CoverageRow key={r.req} row={r} />
                        ))}
                    </ul>
                </details>
            </div>
        </section>
    );
}
