import type { FenceInfo } from './fenceInfo';

export const BLOCK_FENCES = ['calls', 'states', 'screen'] as const;

export type BlockRenderer = (body: string, info: FenceInfo) => string;

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
export function renderBlockFence(name: string, body: string, info: FenceInfo): string | null {
    const render = renderers.get(name);
    if (!render) return null;
    try {
        return render(body, info) || null;
    } catch {
        return null;
    }
}
