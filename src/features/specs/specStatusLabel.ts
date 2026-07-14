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

/** Friendly Title Case for a document's completion state. */
export function documentStatusLabel(status: 'empty' | 'partial' | 'complete'): string {
    switch (status) {
        case 'complete':
            return 'Complete';
        case 'partial':
            return 'In Progress';
        default:
            return 'Not Created';
    }
}
