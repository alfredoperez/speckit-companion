import { navState, viewerState, viewerMode } from '../signals';
import { heroStats, formatActiveTime } from '../activityHeroModel';
import { formatStatusLabel } from './SpecHeader';
import { hasAnyData } from './ActivityPanel';

/**
 * One-line run context above the content: the frequently scanned facts the
 * old permanent Run-context column carried, compacted so the width goes back
 * to the reading column. Full detail is a secondary action (Run details →
 * the Overview). Renders only the facts that exist; null when none do.
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

    if (!vs.status && facts.length === 0) return null;

    const overviewAvailable = (ns?.activityPanelEnabled ?? true) && hasAnyData(vs);
    const mode = viewerMode.value ?? (overviewAvailable ? 'overview' : 'document');
    const showDetailsAction = overviewAvailable && mode !== 'overview';

    return (
        <div class="run-strip" aria-label="Run context">
            {vs.status && (
                <span class={`run-strip__status is-${vs.status}`}>
                    <i aria-hidden="true" /> {formatStatusLabel(vs.status)}
                </span>
            )}
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
            {showDetailsAction && (
                <button
                    type="button"
                    class="run-strip__details"
                    onClick={() => { viewerMode.value = 'overview'; }}
                >
                    Run details <span aria-hidden="true">→</span>
                </button>
            )}
        </div>
    );
}
