/** A completed or archived spec shows its comments but offers no way to change them. */
export function isReadOnly(): boolean {
    const status = document.body.dataset.specStatus;
    return status === 'completed' || status === 'archived';
}
