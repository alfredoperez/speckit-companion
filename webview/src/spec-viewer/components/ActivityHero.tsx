import type { ViewerState } from '../types';
import type { ActivityTabId } from '../activityTabsModel';
import { heroStats, formatActiveTime } from '../activityHeroModel';

export interface ActivityHeroProps {
    state: ViewerState;
    onJump: (tab: ActivityTabId) => void;
}

/** Small SVG donut: fraction filled in the success hue, remainder in warning. */
export function Donut({ covered, total }: { covered: number; total: number }) {
    const r = 7;
    const c = 2 * Math.PI * r;
    const frac = total > 0 ? covered / total : 0;
    return (
        <svg class="activity-donut" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <circle cx="10" cy="10" r={r} fill="none" class="activity-donut__track" stroke-width="3" />
            <circle
                cx="10" cy="10" r={r} fill="none"
                class={frac >= 1 ? 'activity-donut__fill is-full' : 'activity-donut__fill'}
                stroke-width="3"
                stroke-dasharray={`${c * frac} ${c}`}
                transform="rotate(-90 10 10)"
            />
        </svg>
    );
}

interface ChipProps {
    value: string;
    label: string;
    tab: ActivityTabId;
    onJump: (tab: ActivityTabId) => void;
    warning?: boolean;
    icon?: preact.ComponentChildren;
}

function Chip({ value, label, tab, onJump, warning, icon }: ChipProps) {
    return (
        <button
            type="button"
            class={warning ? 'activity-chip activity-chip--warning' : 'activity-chip'}
            onClick={() => onJump(tab)}
            title={`Open ${label}`}
        >
            {icon}
            <span class="activity-chip__value">{value}</span>
            <span class="activity-chip__label">{label}</span>
        </button>
    );
}

/**
 * The panel's summary strip: how the run stands, at a glance. Chips are
 * buttons that activate the matching detail tab. Counts render only when
 * their source data exists — the hero never fabricates a 0/0.
 */
export function ActivityHero({ state, onJump }: ActivityHeroProps) {
    const stats = heroStats(state);
    const size = state.classification?.verdict;
    const hasChips =
        stats.tasksTotal !== undefined || stats.coverageTotal !== undefined ||
        stats.checks !== undefined || stats.concerns !== undefined;

    return (
        <div class="activity-hero">
            <div class="activity-hero__line">
                <span class={`activity-hero__status is-${state.status}`}>{state.status}</span>
                {size && <span class="activity-hero__fact">sized {size}</span>}
                {stats.trustedActiveMs !== undefined && (
                    <span class="activity-hero__fact" title="Extension-measured active time (journaled spans excluded)">
                        {formatActiveTime(stats.trustedActiveMs)} active
                    </span>
                )}
                {state.checkpointStatus?.commit && <span class="activity-hero__fact">✓ committed</span>}
                {state.prUrl && (
                    <a class="activity-hero__pr" href={state.prUrl} title={state.prUrl}>
                        PR{state.prNumber ? ` #${state.prNumber}` : ''}
                    </a>
                )}
            </div>
            {state.lastAction && state.status !== 'completed' && state.status !== 'archived' && (
                <p class="activity-hero__last-action">{state.lastAction}</p>
            )}
            {hasChips && (
                <div class="activity-hero__chips">
                    {stats.tasksTotal !== undefined && (
                        <Chip value={`${stats.tasksDone}/${stats.tasksTotal}`} label="tasks" tab="work" onJump={onJump} />
                    )}
                    {stats.coverageTotal !== undefined && (
                        <Chip
                            value={`${stats.covered}/${stats.coverageTotal}`}
                            label="covered"
                            tab="proof"
                            onJump={onJump}
                            warning={stats.covered !== stats.coverageTotal}
                            icon={<Donut covered={stats.covered ?? 0} total={stats.coverageTotal} />}
                        />
                    )}
                    {stats.checks !== undefined && (
                        <Chip value={String(stats.checks)} label="checks" tab="proof" onJump={onJump} />
                    )}
                    {stats.concerns !== undefined && (
                        <Chip
                            value={String(stats.concerns)}
                            label={stats.concerns === 1 ? 'concern' : 'concerns'}
                            tab="notes"
                            onJump={onJump}
                            warning
                            icon={<span class="activity-chip__dot" aria-hidden="true" />}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
