import type { ViewerState } from '../../types';

export interface ApproachCardProps {
    state: ViewerState;
}

function classificationLine(c: NonNullable<ViewerState['classification']>): string {
    const parts: string[] = [];
    if (typeof c.projectedFiles === 'number') parts.push(`${c.projectedFiles} files`);
    if (typeof c.projectedTasks === 'number') parts.push(`${c.projectedTasks} tasks`);
    const inputs = parts.join(', ');
    const signal = c.scopeSignal && c.scopeSignal !== 'none' ? `, ${c.scopeSignal} scope signal` : '';
    return inputs ? `Sized as ${c.verdict} — ${inputs} projected${signal}.` : `Sized as ${c.verdict}.`;
}

export function ApproachCard({ state }: ApproachCardProps) {
    const { approach, lastAction, status, prUrl, prNumber, checkpointStatus, classification } = state;

    const hasContent = !!(approach || lastAction || prUrl || checkpointStatus?.commit || checkpointStatus?.pr || classification);
    if (!hasContent) return null;

    return (
        <section class="activity-card activity-card--approach">
            <h3 class="activity-card__title">Approach</h3>
            <div class="activity-card__body">
                {approach && <p class="activity-approach__text">{approach}</p>}
                {classification && (
                    <p class="activity-detail">{classificationLine(classification)}</p>
                )}
                <div class="activity-approach__meta">
                    {checkpointStatus?.commit && (
                        <span class="activity-checkpoint" title="Commit landed">✓ committed</span>
                    )}
                    {checkpointStatus?.pr && (
                        <span class="activity-checkpoint" title="PR opened">✓ PR</span>
                    )}
                    {prUrl && (
                        <a class="activity-pr-link" href={prUrl} title={prUrl}>
                            PR{prNumber ? ` #${prNumber}` : ''}
                        </a>
                    )}
                </div>
                {lastAction && status !== 'completed' && status !== 'archived' && (
                    <p class="activity-approach__last-action">
                        <span class="activity-approach__last-action-label">Last action:</span>{' '}
                        {lastAction}
                    </p>
                )}
            </div>
        </section>
    );
}
