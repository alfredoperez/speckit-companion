import type { Transition } from '../types';
import { formatRelativeTime } from '../relativeTime';

const KNOWN_ACTORS = new Set(['extension', 'cli', 'sdd', 'ai', 'user']);

export interface TimelineEntryProps {
    transition: Transition;
}

export function TimelineEntry({ transition }: TimelineEntryProps) {
    const actor = KNOWN_ACTORS.has(transition.by) ? transition.by : 'extension';
    const badgeClass = `timeline-actor-badge is-${actor}`;
    const substepClass = transition.substep ? 'timeline-substep' : 'timeline-substep timeline-substep--none';
    const substepText = transition.substep ?? '—';

    return (
        <div class="timeline-entry">
            <span class={substepClass}>{substepText}</span>
            <span class={badgeClass}>{transition.by}</span>
            <time class="timeline-time" dateTime={transition.at} title={transition.at}>
                {formatRelativeTime(transition.at)}
            </time>
        </div>
    );
}
