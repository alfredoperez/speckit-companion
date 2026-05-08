import type { ViewerState, Transition } from '../../types';
import { mergeStepEvents, buildTransitionIndex, TimelineEventModel } from '../../timelineEvents';
import { formatDuration, formatRelativeTime } from '../../relativeTime';

const STEP_ORDER = ['specify', 'clarify', 'plan', 'tasks', 'analyze', 'implement'];
const KNOWN_ACTORS = new Set(['extension', 'cli', 'sdd', 'ai', 'user']);

interface StepGroup {
    step: string;
    startedAt: string;
    completedAt: string | null;
    events: TimelineEventModel[];
}

export interface PhasesCardProps {
    state: ViewerState;
}

function buildGroups(stepHistory: ViewerState['stepHistory'], transitions: Transition[]): StepGroup[] {
    const transitionIndex = buildTransitionIndex(transitions);
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
            events: mergeStepEvents(step, entry, transitions, transitionIndex),
        });
    }

    // Specs that have transitions for steps that never made it into stepHistory.
    for (const t of transitions) {
        if (seen.has(t.step)) continue;
        if (!t.substep) continue;
        seen.add(t.step);
        groups.push({
            step: t.step,
            startedAt: t.at,
            completedAt: null,
            events: mergeStepEvents(t.step, undefined, transitions, transitionIndex),
        });
    }

    return groups;
}

export function PhasesCard({ state }: PhasesCardProps) {
    const groups = buildGroups(state.stepHistory ?? {}, state.transitions ?? []);
    if (groups.length === 0) return null;

    return (
        <section class="activity-card activity-card--phases">
            <header class="activity-card__title">Phases</header>
            <div class="activity-card__body">
                {groups.map(group => {
                    const inFlight = group.completedAt === null;
                    const duration = formatDuration(group.startedAt, group.completedAt);
                    const age = formatRelativeTime(group.startedAt);
                    return (
                        <div
                            key={group.step}
                            class={`phases-step${inFlight ? ' is-in-flight' : ''}`}
                            data-step={group.step}
                        >
                            <h4 class="phases-step__heading">
                                <span class="phases-step__name">{group.step}</span>
                                <span class="phases-step__meta">
                                    <span class="phases-step__duration">
                                        {inFlight ? `${duration} so far` : duration}
                                    </span>
                                    <span class="phases-step__age">{age}</span>
                                </span>
                            </h4>
                            {group.events.length === 0 ? (
                                <div class="phases-event phases-event--empty">no substeps recorded</div>
                            ) : (
                                group.events.map((event, i) => {
                                    const actor = event.by && KNOWN_ACTORS.has(event.by) ? event.by : null;
                                    return (
                                        <div
                                            key={`${event.name}-${i}`}
                                            class="phases-event"
                                            title={`event recorded at ${event.startedAt}`}
                                        >
                                            <span class="phases-event__name">{event.name}</span>
                                            {actor && (
                                                <span class={`activity-actor-badge is-${actor}`}>
                                                    {event.by}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
