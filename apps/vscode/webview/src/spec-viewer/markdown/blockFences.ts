import type { FenceInfo } from './fenceInfo';

export const BLOCK_FENCES = ['calls', 'code', 'states', 'screen'] as const;

export const PIN_LINE = /^\s*pin\s+(\d{1,7}):\s*(.*)$/i;

export interface BlockPin {
    line: number;
    text: string;
    sourceLine: number;
    source: string;
}

export interface BlockContext {
    /** The file line of the body's first line. */
    firstLine: number;
    /** The text of a `note:` line straight after the closing fence, if any. */
    note: string | null;
    /** The `pin N: text` lines straight after the closing fence. Only a `code` block is handed any. */
    pins: BlockPin[];
    /** The text after the language word, as written. */
    rawTitle: string;
    /** The numbered lines (`1: …`) straight after the closing fence of a `screen`, else none. */
    numberedNotes?: string[];
    wrapLine: (html: string, lineNum: number) => string;
}

export type BlockRenderer = (body: string, info: FenceInfo, context: BlockContext) => string;

const renderers = new Map<string, BlockRenderer>();

export function isBlockFence(name: string): boolean {
    return (BLOCK_FENCES as readonly string[]).includes(name);
}

export function registerBlockRenderer(name: string, renderer: BlockRenderer | undefined): void {
    if (!isBlockFence(name)) return;
    if (renderer) renderers.set(name, renderer);
    else renderers.delete(name);
}

/** The block's HTML, or null when the fence should render as the plain code block. */
export function renderBlockFence(name: string, body: string, info: FenceInfo, context: BlockContext): string | null {
    const render = renderers.get(name);
    if (!render) return null;
    try {
        return render(body, info, context) || null;
    } catch {
        return null;
    }
}
