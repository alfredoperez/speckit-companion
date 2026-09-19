import type { TimelineEventModel } from '../timelineEvents';
import { formatStepOffset } from '../relativeTime';

const KNOWN_ACTORS = new Set(['extension', 'cli', 'ai', 'user']);

export interface TimelineEventProps {
    event: TimelineEventModel;
    stepStartedAt: string;
}

export function TimelineEvent({ event, stepStartedAt }: TimelineEventProps) {
    const actor = event.by && KNOWN_ACTORS.has(event.by) ? event.by : null;
    const offset = formatStepOffset(stepStartedAt, event.recordedAt);

    return (
        <div class="timeline-entry">
            <span class="timeline-substep">{event.name}</span>
            {actor && (
                <span class={`timeline-actor-badge is-${actor}`}>{event.by}</span>
            )}
            <time class="timeline-offset" dateTime={event.recordedAt} title={event.recordedAt}>
                recorded at {offset}
            </time>
        </div>
    );
}
