import type { NavState } from '../contract';

/**
 * The live navigation state `/core` can read while it renders.
 * A plain holder here, so `/core` runs with no framework; the extension points this
 * module at its own signal at build time.
 */
export const navState: { readonly value: NavState | null } = { value: null };
