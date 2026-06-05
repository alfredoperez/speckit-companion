import type { TimelineEventModel } from '../timelineEvents';
import { formatDuration, formatStepOffset } from '../relativeTime';

const KNOWN_ACTORS = new Set(['extension', 'cli', 'ai', 'user']);

export interface TimelineEventProps {
    event: TimelineEventModel;
    stepStartedAt: string;
}

export function TimelineEvent({ event, stepStartedAt }: TimelineEventProps) {
    const actor = event.by && KNOWN_ACTORS.has(event.by) ? event.by : null;
    const offset = formatStepOffset(stepStartedAt, event.startedAt);
    const isInFlight = event.source === 'tracked' && event.completedAt === null;
    const duration = event.source === 'tracked'
        ? (event.completedAt
            ? formatDuration(event.startedAt, event.completedAt)
            : formatDuration(event.startedAt, null))
        : null;

    return (
        <div class={`timeline-entry${isInFlight ? ' is-in-flight' : ''}`}>
            <span class="timeline-substep">{event.name}</span>
            {actor && (
                <span class={`timeline-actor-badge is-${actor}`}>{event.by}</span>
            )}
            <time class="timeline-offset" dateTime={event.startedAt} title={event.startedAt}>
                {offset}
            </time>
            {duration && (
                <span
                    class="timeline-event-duration"
                    title={event.completedAt ?? `live since ${event.startedAt}`}
                >
                    {isInFlight ? `${duration} so far` : duration}
                </span>
            )}
        </div>
    );
}
