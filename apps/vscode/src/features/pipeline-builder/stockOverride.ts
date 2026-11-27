/**
 * Making and removing the project's own copy of a stock template.
 *
 * Spec Kit reads `.specify/templates/overrides/<file>` ahead of every preset,
 * extension and its own core file, always as a replacement. The paths come
 * from the board's own view, so a path it never offered finds nothing here.
 */

import * as fs from 'fs';
import * as path from 'path';
import { StockTemplateLayer } from '../../protocol/pipeline';
import { readStockWorkflow } from './stockWorkflow';

const OVERRIDES_REL = path.join('.specify', 'templates', 'overrides');
const PLACEHOLDER = '{CORE_TEMPLATE}';

export type OverrideResult = { file: string } | { error: string };

function topLayerOf(workspaceRoot: string, rel: string, drawing?: string) {
    const view = readStockWorkflow(workspaceRoot, drawing);
    for (const template of view.templates) {
        const top = template.layers?.[0];
        if (top && top.path === rel) { return { template, top }; }
    }
    return null;
}

/** Why a copy cannot be made, or null. Shown beside the disabled button. */
export function overrideRefusal(layers: StockTemplateLayer[]): string | null {
    return layers.some(layer => layer.strategy === 'replace-section')
        ? 'A preset replaces a section of this template. Open the preset file instead.'
        : null;
}

/** The text a run uses, composed bottom-up with the joins Spec Kit's resolver uses. */
function composed(workspaceRoot: string, layers: StockTemplateLayer[]): string | { error: string } {
    const read = (layer: StockTemplateLayer) =>
        fs.readFileSync(path.join(workspaceRoot, layer.path), 'utf8');
    try {
        if (layers.length === 1 || layers[0].strategy === 'replace') { return read(layers[0]); }
        if (layers[layers.length - 1].strategy !== 'replace') {
            return { error: 'This template has no base file to compose onto.' };
        }
        let text = read(layers[layers.length - 1]).replace(/\r\n/g, '\n');
        for (const layer of layers.slice(0, -1).reverse()) {
            const body = read(layer).replace(/\r\n/g, '\n');
            if (layer.strategy === 'prepend') {
                text = `${body}\n\n${text}`;
            } else if (layer.strategy === 'append') {
                text = `${text}\n\n${body}`;
            } else if (layer.strategy === 'wrap') {
                if (!body.includes(PLACEHOLDER)) {
                    return { error: `${layer.path} has no ${PLACEHOLDER}, so it cannot be composed.` };
                }
                text = body.split(PLACEHOLDER).join(text);
            } else {
                return { error: `${layer.path} cannot be composed here.` };
            }
        }
        return text;
    } catch {
        return { error: 'A layer of this template is not readable.' };
    }
}

/** Write the text a run uses now into the overrides folder, and say where it is. */
export function makeOverride(workspaceRoot: string, rel: string, drawing?: string): OverrideResult {
    const found = topLayerOf(workspaceRoot, rel, drawing);
    if (!found) { return { error: 'That is not a template this board drew.' }; }
    if (found.top.kind === 'override') { return { file: path.join(workspaceRoot, found.top.path) }; }
    const layers = found.template.layers ?? [];
    const refusal = overrideRefusal(layers);
    if (refusal) { return { error: refusal }; }
    const text = composed(workspaceRoot, layers);
    if (typeof text !== 'string') { return text; }
    const target = path.join(workspaceRoot, OVERRIDES_REL, found.template.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text, 'utf8');
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
