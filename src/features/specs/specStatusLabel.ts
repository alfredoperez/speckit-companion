const STATUS_LABELS: Record<string, string> = {
    draft: 'Draft',
    specifying: 'Specifying',
    specified: 'Specified',
    planning: 'Planning',
    planned: 'Planned',
    tasking: 'Tasking',
    'ready-to-implement': 'Ready to Implement',
    implementing: 'Implementing',
    implemented: 'Implemented',
    completed: 'Completed',
    archived: 'Archived',
};

/** Friendly Title Case for a lifecycle status — raw enum keys never reach a tooltip. */
export function specStatusLabel(status: string | undefined): string | undefined {
    if (!status) {
        return undefined;
    }
    const known = STATUS_LABELS[status];
    if (known) {
        return known;
    }
    return status
        .split('-')
        .filter(part => part.length > 0)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

/** What a document's file holds on disk. */
export type DocumentStatus = 'empty' | 'partial' | 'complete';

/** What a document row renders — one value drives both its icon and its tooltip. */
export type DocumentState = 'missing' | 'pending' | 'in-progress' | 'complete';

/** Friendly Title Case for a document's rendered state. */
export function documentStateLabel(state: DocumentState): string {
    switch (state) {
        case 'complete':
            return 'Complete';
        case 'in-progress':
            return 'In Progress';
        case 'pending':
            return 'Not Started';
        default:
            return 'Not Created';
    }
}
