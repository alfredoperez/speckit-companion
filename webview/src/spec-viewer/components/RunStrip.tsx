import { navState, viewerState, viewerMode } from '../signals';
import { heroStats, formatActiveTime } from '../activityHeroModel';
import { hasAnyData } from './ActivityPanel';

/**
 * The run facts, sitting in the right half of the header band: how far the run
 * got, at a glance. The status is NOT here — the header badge owns it, and
 * saying it twice was what made the chrome read as two headers.
 *
 * Facts are ranked, and the CSS drops them from the least important end as the
 * pane narrows (checks and active time first). In a split pane they all yield
 * and only "Run details" survives, which jumps to the Overview — the same rail
 * destination the outline points at. Renders nothing when there is no run.
 */

/** Least → most important; the CSS hides by this key as width runs out. */
type FactKey = 'active' | 'checks' | 'traced' | 'concerns' | 'tasks' | 'phase';

export function RunStrip() {
    const vs = viewerState.value;
    const ns = navState.value;
    if (!vs || ns?.livingMode) return null;

    const stats = heroStats(vs);
    const facts: Array<{ key: FactKey; value: string; warning?: boolean }> = [];
    if (vs.activeStep) facts.push({ key: 'phase', value: vs.activeStep });
    if (stats.tasksTotal !== undefined) {
        facts.push({ key: 'tasks', value: `${stats.tasksDone}/${stats.tasksTotal} tasks` });
    } else if (typeof ns?.taskCompletionPercent === 'number' && ns.taskCompletionPercent > 0) {
        facts.push({ key: 'tasks', value: `${ns.taskCompletionPercent}% tasks` });
    }
    if (stats.coverageTotal !== undefined) {
        facts.push({
            key: 'traced',
            value: `${stats.covered}/${stats.coverageTotal} traced`,
            warning: stats.covered !== stats.coverageTotal,
        });
    }
    if (stats.concerns !== undefined) {
        facts.push({
            key: 'concerns',
            value: `${stats.concerns} concern${stats.concerns === 1 ? '' : 's'}`,
            warning: true,
        });
    }
    if (stats.checks !== undefined) facts.push({ key: 'checks', value: `${stats.checks} checks` });
    if (stats.trustedActiveMs !== undefined) {
        facts.push({ key: 'active', value: `${formatActiveTime(stats.trustedActiveMs)} active` });
    }

    if (facts.length === 0 && !vs.prUrl) return null;

    // "Run details" is only an offer when there's an Overview to land on and
    // you aren't already standing on it.
    const overviewAvailable = (ns?.activityPanelEnabled ?? true) && hasAnyData(vs);
    const showingOverview = (viewerMode.value ?? 'overview') === 'overview';
    const showDetails = overviewAvailable && !showingOverview;

    return (
        <div class="run-strip" aria-label="Run context">
            {facts.map(f => (
                <span
                    key={f.key}
                    data-fact={f.key}
                    class={f.warning ? 'run-strip__fact run-strip__fact--warning' : 'run-strip__fact'}
                >
                    {f.value}
                </span>
            ))}
            {vs.prUrl && (
                <a class="run-strip__pr" href={vs.prUrl} title={vs.prUrl}>
                    PR{vs.prNumber ? ` #${vs.prNumber}` : ''}
                </a>
            )}
            {showDetails && (
                <button
                    type="button"
                    class="run-strip__details"
                    title="Open the Overview — the run's durable context"
                    onClick={() => { viewerMode.value = 'overview'; }}
                >
                    Run details <span aria-hidden="true">→</span>
                </button>
            )}
        </div>
    );
}
