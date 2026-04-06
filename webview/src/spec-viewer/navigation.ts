/**
 * SpecKit Companion - Navigation Module
 * Now delegates to store — components subscribe and react.
 */

import type { NavState } from './types';
import { viewerStore } from './viewerStore';

/**
 * Update navigation state — writes to store; components react via subscriptions.
 */
export function updateNavState(navState: NavState): void {
    viewerStore.set('navState', navState);
}

/**
 * Setup step-tab navigation — now handled by NavigationBar/RelatedBar components.
 * Kept as no-op for backward compatibility with init() call.
 */
export function setupTabNavigation(): void {
    // Components handle their own event listeners via onMount().
}
