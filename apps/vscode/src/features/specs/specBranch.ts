/** The one source both the sidebar row and the viewer read a spec's branch from: the working branch, else the branch it was created on. */
export function resolveSpecBranch(
    ctx: { workingBranch?: unknown; branch?: unknown } | null | undefined,
): string | undefined {
    for (const value of [ctx?.workingBranch, ctx?.branch]) {
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
}
