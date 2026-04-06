/**
 * SpecKit Companion - Navigation Module
 * Writes to navState signal — components react via Preact.
 */

import type { NavState } from './types';
import { navState } from './signals';

export function updateNavState(ns: NavState): void {
    navState.value = ns;
}

export function setupTabNavigation(): void {
    // Components handle their own event listeners.
}
