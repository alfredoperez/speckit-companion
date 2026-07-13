import { navState, viewerState } from '../signals';
import { heroStats, formatActiveTime } from '../activityHeroModel';

/**
 * One-line run context above the content: the frequently scanned facts the
 * old permanent Run-context column carried, compacted so the width goes back
 * to the reading column. The status is NOT repeated here — the header badge
 * already carries it. Renders only the facts that exist; null when none do.
 */
export function RunStrip() {
    const vs = viewerState.value;
    const ns = navState.value;
    if (!vs || ns?.livingMode) return null;

    const stats = heroStats(vs);
    const facts: Array<{ key: string; value: string; warning?: boolean }> = [];
    if (vs.activeStep) facts.push({ key: 'phase', value: vs.activeStep });
    if (stats.tasksTotal !== undefined) {
        facts.push({ key: 'tasks', value: `${stats.tasksDone}/${stats.tasksTotal} tasks` });
    } else if (typeof ns?.taskCompletionPercent === 'number' && ns.taskCompletionPercent > 0) {
        facts.push({ key: 'tasks', value: `${ns.taskCompletionPercent}% tasks` });
    }
    if (stats.coverageTotal !== undefined) {
        facts.push({
            key: 'traced',
            value: `${stats.covered}/${stats.coverageTotal} traced to tests`,
            warning: stats.covered !== stats.coverageTotal,
        });
    }
    if (stats.checks !== undefined) facts.push({ key: 'checks', value: `${stats.checks} checks` });
    if (stats.concerns !== undefined) {
        facts.push({ key: 'concerns', value: `${stats.concerns} concern${stats.concerns === 1 ? '' : 's'}`, warning: true });
    }
    if (stats.trustedActiveMs !== undefined) {
        facts.push({ key: 'active', value: `${formatActiveTime(stats.trustedActiveMs)} active` });
    }

    if (facts.length === 0 && !vs.prUrl) return null;

    return (
        <div class="run-strip" aria-label="Run context">
            {facts.map(f => (
                <span key={f.key} class={f.warning ? 'run-strip__fact run-strip__fact--warning' : 'run-strip__fact'}>
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
