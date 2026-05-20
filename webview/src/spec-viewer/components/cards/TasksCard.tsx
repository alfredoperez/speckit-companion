import type { ViewerState, VSCodeApi, TaskSummary } from '../../types';
import { toStringArray } from './toStringArray';

declare const vscode: VSCodeApi;

const DID_TRUNCATE = 140;

export interface TasksCardProps {
    state: ViewerState;
}

function truncate(text: string, max: number): { display: string; truncated: boolean } {
    if (text.length <= max) return { display: text, truncated: false };
    return { display: text.slice(0, max).trimEnd() + '…', truncated: true };
}

function statusClass(status: string): string {
    if (status === 'DONE') return 'is-done';
    if (status === 'DONE_WITH_CONCERNS') return 'is-done-concerns';
    return 'is-other';
}

function statusLabel(status: string): string {
    if (status === 'DONE') return 'done';
    if (status === 'DONE_WITH_CONCERNS') return 'done ⚠';
    return status.toLowerCase();
}

export function TasksCard({ state }: TasksCardProps) {
    const summaries = state.taskSummaries;
    if (!summaries || Object.keys(summaries).length === 0) return null;

    const ids = Object.keys(summaries).sort();

    const handleFileClick = (filename: string) => {
        vscode.postMessage({ type: 'openFile', filename });
    };

    return (
        <section class="activity-card activity-card--tasks">
            <header class="activity-card__title">
                Tasks <span class="activity-card__count">({ids.length})</span>
            </header>
            <div class="activity-card__body">
                {ids.map(id => {
                    const t: TaskSummary = summaries[id];
                    const did = typeof t.did === 'string' ? t.did : '';
                    const { display, truncated } = truncate(did, DID_TRUNCATE);
                    const files = toStringArray(t.files);
                    const concerns = toStringArray(t.concerns);
                    return (
                        <article key={id} class="task-row">
                            <div class="task-row__head">
                                <span class="task-row__id">{id}</span>
                                <span class={`task-row__status ${statusClass(t.status)}`}>
                                    {statusLabel(t.status)}
                                </span>
                                <span class="task-row__did" title={truncated ? did : undefined}>
                                    {display}
                                </span>
                            </div>
                            {files.length > 0 && (
                                <div class="task-row__files">
                                    {files.map(f => (
                                        <button
                                            key={f}
                                            type="button"
                                            class="task-row__file"
                                            title={`Open ${f}`}
                                            onClick={() => handleFileClick(f)}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {concerns.length > 0 && (
                                <ul class="task-row__concerns">
                                    {concerns.map((c, i) => (
                                        <li key={i}>{c}</li>
                                    ))}
                                </ul>
                            )}
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
