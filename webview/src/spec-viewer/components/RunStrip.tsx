import { navState, viewerState } from '../signals';
import { heroStats, formatActiveTime } from '../activityHeroModel';

/**
 * The run facts, sitting in the right half of the header band: how far the run
 * got, at a glance.
 *
 * It only says what nothing else already says. The status is the badge's job,
 * and the phase is the badge's job too (a COMPLETED spec saying "implement"
 * adds nothing, and a running one is already named by the badge and the
 * spinning rail step). Getting to the run's full story is the rail's job — the
 * Overview is an entry there at every width — so there is no "Run details" link
 * competing with it.
 *
 * Facts are ranked, and the CSS drops them from the least important end as the
 * pane narrows. Renders nothing when there is no run to describe.
 */

/** Least → most important; the CSS hides by this key as width runs out. */
type FactKey = 'active' | 'checks' | 'traced' | 'concerns' | 'tasks';

export function RunStrip() {
    const vs = viewerState.value;
    const ns = navState.value;
    if (!vs || ns?.livingMode) return null;

    const stats = heroStats(vs);
    const facts: Array<{ key: FactKey; value: string; warning?: boolean }> = [];
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
        </div>
    );
}
