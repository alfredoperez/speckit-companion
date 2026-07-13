import { navState, viewerState } from '../signals';
import { formatStatusLabel } from './SpecHeader';

/**
 * Contextual run-facts column: "how far along is
 * the run" at a glance — status, phase, current task, progress, evidence
 * counts. Renders only the facts that exist; the whole column yields on
 * narrow panes via CSS.
 */
export function RunAside() {
    const vs = viewerState.value;
    const ns = navState.value;
    if (!vs) return null;

    const facts: Array<{ key: string; value: string }> = [];
    if (vs.status) facts.push({ key: 'Status', value: formatStatusLabel(vs.status) });
    if (vs.activeStep) facts.push({ key: 'Phase', value: vs.activeStep });
    if (ns?.currentTask) facts.push({ key: 'Task', value: ns.currentTask });
    if (typeof ns?.taskCompletionPercent === 'number' && ns.taskCompletionPercent > 0) {
        facts.push({ key: 'Progress', value: `${ns.taskCompletionPercent}%` });
    }
    if (vs.verified && vs.verified.length > 0) {
        facts.push({ key: 'Checks', value: String(vs.verified.length) });
    }
    if (vs.concerns && vs.concerns.length > 0) {
        facts.push({ key: 'Concerns', value: String(vs.concerns.length) });
    }
    if (facts.length === 0) return null;

    return (
        <aside class="run-aside" aria-label="Run context">
            <div class="run-aside__card">
                <h2 class="run-aside__title">Run context</h2>
                <dl>
                    {facts.map(f => (
                        <div key={f.key}>
                            <dt>{f.key}</dt>
                            <dd>{f.value}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </aside>
    );
}
