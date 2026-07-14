export interface MoreActionsContext {
    /** True when every spec row is currently collapsed. */
    allCollapsed: boolean;
    /** True when the companion spec-kit extension is installed in the project. */
    companionInstalled: boolean;
    /** True when spec-kit is detected in the workspace or its CLI is installed. */
    speckitAvailable: boolean;
}

export interface MoreActionsEntry {
    label: string;
    /** Absent on a separator row. */
    command?: string;
    separator?: boolean;
}

/**
 * The Specs "More Actions" picker, composed from the same gates the actions
 * used when they lived in the title bar. Pure so every context combination is
 * testable.
 */
export function buildMoreActions(ctx: MoreActionsContext): MoreActionsEntry[] {
    const entries: MoreActionsEntry[] = [
        { label: 'View', separator: true },
        ctx.allCollapsed
            ? { label: 'Expand All', command: 'speckit.specs.expandAll' }
            : { label: 'Collapse All', command: 'speckit.specs.collapseAll' },
    ];

    const maintenance: MoreActionsEntry[] = [];
    if (ctx.speckitAvailable && !ctx.companionInstalled) {
        maintenance.push({
            label: 'Install Companion Extension',
            command: 'speckit.companion.installSpecKitExtension',
        });
    }
    if (ctx.speckitAvailable) {
        maintenance.push({ label: 'Upgrade…', command: 'speckit.upgrade' });
    }

    if (maintenance.length > 0) {
        entries.push({ label: 'Maintenance', separator: true }, ...maintenance);
    }

    return entries;
}
