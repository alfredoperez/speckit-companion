/**
 * Pure filename-to-label helpers.
 *
 * Used by both the sidebar (`features/specs/specExplorerProvider`) and the
 * viewer (`features/spec-viewer/documentScanner`). Lives in `core/utils/`
 * rather than under either feature so the sidebar doesn't have to import
 * from `spec-viewer/` just to label a tree node — that was the layer
 * violation the structural-cleanup refactor broke.
 */

/**
 * Convert a markdown filename to a Title Case display label.
 *
 *   "research.md"      → "Research"
 *   "spec-context.md"  → "Spec Context"
 *   "PLAN.md"          → "PLAN"  (already uppercase, preserved by \b\w match)
 */
export function fileNameToDisplayName(fileName: string): string {
    const baseName = fileName.replace(/\.md$/i, '');
    return baseName
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Convert a markdown filename to a lowercase document type identifier.
 *
 *   "Research.md" → "research"
 *   "TASKS.md"    → "tasks"
 */
export function fileNameToDocType(fileName: string): string {
    return fileName.replace(/\.md$/i, '').toLowerCase();
}

/**
 * A document's type from its path relative to the spec directory.
 *
 * A nested file keeps its folder: `checklists/requirements.md` is `checklists/requirements`.
 * The scan and the click both come through here, because typing the same file two ways is
 * how a click resolves to nothing and the panel silently keeps whatever it was showing.
 */
export function relativePathToDocType(relativePath: string): string {
    return relativePath.split(/[\\/]/).join('/').replace(/\.md$/i, '').toLowerCase();
}
