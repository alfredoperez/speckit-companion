import { navState, viewerState } from '../signals';
import { heroStats, formatActiveTime } from '../activityHeroModel';

/**
 * Run facts for the header band. Deliberately says nothing the badge or the rail
 * already says (no status, no phase, no link to the Overview).
 */

/** Least → most important; the CSS hides by this key as width runs out. */
type FactKey = 'timing' | 'checks' | 'traced' | 'concerns' | 'tasks';

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
    if (vs.timing?.complete && vs.timing.elapsedMs !== undefined) {
        facts.push({ key: 'timing', value: `${formatActiveTime(vs.timing.elapsedMs)} elapsed` });
    } else if (vs.timing && vs.timing.measuredPhases > 0) {
        facts.push({
            key: 'timing',
            value: `Timing ${vs.timing.measuredPhases}/${vs.timing.expectedPhases} phases`,
        });
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
