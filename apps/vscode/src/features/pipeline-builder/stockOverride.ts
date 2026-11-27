/**
 * Making and removing the project's own copy of a stock template.
 *
 * Spec Kit reads `.specify/templates/overrides/<file>` ahead of every preset,
 * extension and its own core file, always as a replacement. The paths come
 * from the board's own view, so a path it never offered finds nothing here.
 */

import * as fs from 'fs';
import * as path from 'path';
import { readStockWorkflow } from './stockWorkflow';

const OVERRIDES_REL = path.join('.specify', 'templates', 'overrides');

export type OverrideResult = { file: string } | { error: string };

function topLayerOf(workspaceRoot: string, rel: string, drawing?: string) {
    const view = readStockWorkflow(workspaceRoot, drawing);
    for (const template of view.templates) {
        const top = template.layers?.[0];
        if (top && top.path === rel) { return { template, top }; }
    }
    return null;
}

/** Copy the file a run uses now into the overrides folder, and say where it is. */
export function makeOverride(workspaceRoot: string, rel: string, drawing?: string): OverrideResult {
    const found = topLayerOf(workspaceRoot, rel, drawing);
    if (!found) { return { error: 'That is not a template this board drew.' }; }
    if (found.top.kind === 'override') { return { file: path.join(workspaceRoot, found.top.path) }; }
    const source = path.join(workspaceRoot, found.top.path);
    if (!fs.existsSync(source)) { return { error: `${found.top.path} is not on disk.` }; }
    const target = path.join(workspaceRoot, OVERRIDES_REL, found.template.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    // simplified: a preset that appends, prepends, wraps or replaces a section copies that layer's file alone, not the composed result; an override always replaces.
    fs.copyFileSync(source, target);
    return { file: target };
}

/** Delete an override after `confirm` says yes; null when the person declined. */
export async function removeOverride(
    workspaceRoot: string, rel: string,
    confirm: (relativeFile: string) => Promise<boolean>, drawing?: string,
): Promise<OverrideResult | null> {
    const found = topLayerOf(workspaceRoot, rel, drawing);
    if (!found || found.top.kind !== 'override') { return { error: 'That is not an override of yours.' }; }
    if (!(await confirm(found.top.path))) { return null; }
    const file = path.join(workspaceRoot, found.top.path);
    fs.rmSync(file, { force: true });
    return { file };
}
