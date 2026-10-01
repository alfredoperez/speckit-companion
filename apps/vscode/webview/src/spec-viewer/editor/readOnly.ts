/** A page the extension rendered read-only, such as a bug report: nothing on it may write. */
export function isReadOnlyPage(): boolean {
    return document.body.dataset.readOnly === 'true';
}

/** A completed or archived spec, or a read-only page, shows its comments but offers no way to change them. */
export function isReadOnly(): boolean {
    if (isReadOnlyPage()) return true;
    const status = document.body.dataset.specStatus;
    return status === 'completed' || status === 'archived';
}
