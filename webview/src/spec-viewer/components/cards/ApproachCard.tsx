import type { ViewerState } from '../../types';
import { Badge } from '../../../shared/components/Badge';

export interface ApproachCardProps {
    state: ViewerState;
}

export function ApproachCard({ state }: ApproachCardProps) {
    const { approach, lastAction, status, prUrl, prNumber, checkpointStatus } = state;

    const hasContent = !!(approach || lastAction || prUrl || checkpointStatus?.commit || checkpointStatus?.pr);
    if (!hasContent) return null;

    return (
        <section class="activity-card activity-card--approach">
            <header class="activity-card__title">Approach</header>
            <div class="activity-card__body">
                {approach && <p class="activity-approach__text">{approach}</p>}
                <div class="activity-approach__meta">
                    {status && (
                        <Badge
                            variant="passthrough"
                            text={status}
                            class={`activity-status-pill is-${status}`}
                        />
                    )}
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
                {lastAction && (
                    <p class="activity-approach__last-action">
                        <span class="activity-approach__last-action-label">Last action:</span>{' '}
                        {lastAction}
                    </p>
                )}
            </div>
        </section>
    );
}
