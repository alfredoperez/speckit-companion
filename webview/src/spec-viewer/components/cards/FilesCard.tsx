import type { ViewerState, VSCodeApi } from '../../types';

declare const vscode: VSCodeApi;

export interface FilesCardProps {
    state: ViewerState;
}

export function FilesCard({ state }: FilesCardProps) {
    const files = state.filesModified;
    if (!files || files.length === 0) return null;

    const sorted = [...files].sort();

    const handleClick = (filename: string) => {
        vscode.postMessage({ type: 'openFile', filename });
    };

    return (
        <section class="activity-card activity-card--files">
            <h3 class="activity-card__title">
                Files touched <span class="activity-card__count">({sorted.length})</span>
            </h3>
            <div class="activity-card__body">
                <ul class="activity-files">
                    {sorted.map(f => (
                        <li key={f}>
                            <button
                                type="button"
                                class="activity-files__item"
                                title={`Open ${f}`}
                                onClick={() => handleClick(f)}
                            >
                                {f}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
