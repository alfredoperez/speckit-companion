import type { ViewerState, HistoryEntry, StepHistoryEntry } from '../../types';
import { mergeStepEvents, buildHistoryIndex, TimelineEventModel } from '../../timelineEvents';
import { Badge } from '../../../shared/components/Badge';
import { TimelineEvent } from '../TimelineEvent';
import {
    formatElapsed,
    formatAbsolute,
} from '../../relativeTime';

const STEP_ORDER = ['specify', 'clarify', 'plan', 'tasks', 'analyze', 'implement'];
const KNOWN_ACTORS = new Set(['extension', 'cli', 'ai', 'user']);

/** Span length in ms, but only for extension-stamped (trusted) steps; 0 otherwise. */
interface StepGroup {
    step: string;
    startedAt: string;
    completedAt: string | null;
    events: TimelineEventModel[];
}

export interface PhasesCardProps {
    state: ViewerState;
}

function buildGroups(stepHistory: ViewerState['stepHistory'], history: HistoryEntry[]): StepGroup[] {
    const historyIndex = buildHistoryIndex(history);
    const groups: StepGroup[] = [];
    const seen = new Set<string>();

    for (const step of STEP_ORDER) {
        const entry = stepHistory[step];
        if (!entry?.startedAt) continue;
        seen.add(step);
        groups.push({
            step,
            startedAt: entry.startedAt,
            completedAt: entry.completedAt ?? null,
            events: mergeStepEvents(step, entry, history, historyIndex),
        });
    }

    // Specs that have history entries for steps that never made it into stepHistory.
    for (const t of history) {
        if (seen.has(t.step)) continue;
        if (!t.substep) continue;
        seen.add(t.step);
        groups.push({
            step: t.step,
            startedAt: t.at,
            completedAt: null,
            events: mergeStepEvents(t.step, undefined, history, historyIndex),
        });
    }

    return groups;
}

export function PhasesCard({ state }: PhasesCardProps) {
    const groups = buildGroups(state.stepHistory ?? {}, state.history ?? []);
    if (groups.length === 0) return null;

    const timing = state.timing;
    const completeTiming = timing?.complete === true
        && timing.startedAt !== undefined
        && timing.endedAt !== undefined
        && timing.elapsedMs !== undefined;

    const hasEvents = groups.some(group => group.events.length > 0);
    if (!completeTiming && !hasEvents) return null;

    // Author only at spec start: the first history entry's actor.
    const firstEntry = (state.history ?? [])[0];
    const startAuthor =
        firstEntry?.by && KNOWN_ACTORS.has(firstEntry.by) ? firstEntry.by : null;

    return (
        <section class="activity-card activity-card--phases">
            <h3 class="activity-card__title">
                Phases
                {startAuthor && (
                    <Badge
                        variant="passthrough"
                        text={startAuthor}
                        class={`activity-actor-badge is-${startAuthor}`}
                    />
                )}
            </h3>
            <div class="activity-card__body">
                {completeTiming && (
                    <div class="phases-overall">
                        <div class="phases-overall__stat">
                            <span class="phases-overall__label">Started</span>
                            <span class="phases-overall__value">{formatAbsolute(timing.startedAt!)}</span>
                        </div>
                        <div class="phases-overall__stat">
                            <span class="phases-overall__label">Elapsed</span>
                            <span class="phases-overall__value">{formatElapsed(timing.elapsedMs!)}</span>
                        </div>
                        <div class="phases-overall__stat">
                            <span class="phases-overall__label">Ended</span>
                            <span class="phases-overall__value">
                                {formatAbsolute(timing.endedAt!)}
                            </span>
                        </div>
                    </div>
                )}
                {hasEvents && (
                    <div class="phases-events" aria-label="Recorded phase events">
                        {groups.filter(group => group.events.length > 0).map(group => (
                            <div class="phases-events__group" key={`${group.step}-events`}>
                                <h4>{group.step}</h4>
                                {group.events.map((event, index) => (
                                    <TimelineEvent
                                        key={`${event.name}-${event.recordedAt}-${index}`}
                                        event={event}
                                        stepStartedAt={group.startedAt}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
