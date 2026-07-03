import type { ViewerState, HistoryEntry, StepHistoryEntry } from '../../types';
import { mergeStepEvents, buildHistoryIndex, TimelineEventModel } from '../../timelineEvents';
import { Badge } from '../../../shared/components/Badge';
import {
    formatElapsed,
    formatStepOffset,
    formatAbsolute,
    activeDurationMs,
    IDLE_GAP_CAP_MS,
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

/**
 * Collapse consecutive events that share the same name — an implement loop
 * writes the same substep (e.g. `phase1`) several times in a row. Keeps the
 * first of each run so its real `startedAt` is preserved; distinct substeps are
 * untouched.
 */
function dedupeEvents(events: TimelineEventModel[]): TimelineEventModel[] {
    const out: TimelineEventModel[] = [];
    for (const e of events) {
        const prev = out[out.length - 1];
        if (prev && prev.name === e.name) continue;
        out.push(e);
    }
    return out;
}

/**
 * All recorded activity timestamps for a step, in no particular order:
 * the step start, every event boundary, and the completion (when present).
 * Feeds `activeDurationMs`, which sorts them and sums the gaps with long idle
 * pauses capped — so "elapsed" reflects working time, not wall-clock.
 */
function activityPoints(group: StepGroup): string[] {
    const pts = [group.startedAt];
    for (const e of group.events) {
        pts.push(e.startedAt);
        if (e.completedAt) pts.push(e.completedAt);
    }
    if (group.completedAt) pts.push(group.completedAt);
    return pts;
}

export function PhasesCard({ state }: PhasesCardProps) {
    const groups = buildGroups(state.stepHistory ?? {}, state.history ?? []);
    if (groups.length === 0) return null;

    // Overall: the whole-spec start (absolute), end (absolute or in-flight), and
    // total *active* time — the sum of each step's active time, so idle pauses
    // between transitions never count as elapsed work.
    const overallStart = groups[0].startedAt;
    const lastGroup = groups[groups.length - 1];
    const overallEnd = lastGroup.completedAt;
    const TERMINAL_STATUSES = new Set(['completed', 'archived']);
    const overallInFlight = overallEnd === null || !TERMINAL_STATUSES.has(state.status ?? '');
    const overallActiveMs = groups.reduce(
        (sum, g) => sum + activeDurationMs(activityPoints(g)),
        0
    );

    // Per-step start dates are noise on a single-day spec; show a step's start
    // date only when it began on a different calendar day than the spec start
    // (i.e. a multi-day spec).
    const specStartDay = new Date(overallStart).toDateString();

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
                <div class="phases-overall">
                    <div class="phases-overall__stat">
                        <span class="phases-overall__label">Started</span>
                        <span class="phases-overall__value">{formatAbsolute(overallStart)}</span>
                    </div>
                    <div class="phases-overall__stat">
                        <span class="phases-overall__label">Total</span>
                        <span class="phases-overall__value">
                            {formatElapsed(overallActiveMs)} active
                        </span>
                    </div>
                    <div class="phases-overall__stat">
                        <span class="phases-overall__label">Ended</span>
                        <span class="phases-overall__value">
                            {overallInFlight ? 'in progress' : formatAbsolute(overallEnd as string)}
                        </span>
                    </div>
                </div>
                <div class="phases-strip" role="list">
                    {groups.map((group, idx) => {
                        const inFlight = group.completedAt === null;
                        // Elapsed = active time (idle gaps capped), not wall-clock.
                        const duration = formatElapsed(activeDurationMs(activityPoints(group)));
                        const showStepDate =
                            new Date(group.startedAt).toDateString() !== specStartDay;
                        return (
                            <div
                                key={group.step}
                                role="listitem"
                                class={`phases-strip__node${inFlight ? ' is-in-flight' : ''}`}
                                data-step={group.step}
                                title={showStepDate ? formatAbsolute(group.startedAt) : undefined}
                            >
                                {idx > 0 && <span class="phases-strip__connector" aria-hidden="true" />}
                                <span class="phases-strip__dot" aria-hidden="true" />
                                <span class="phases-strip__name">{group.step}</span>
                                <span class="phases-strip__time">{duration}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
