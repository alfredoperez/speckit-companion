import type { ViewerAction } from '../contract/viewer';

type ActionHandler = (action: ViewerAction) => void;

let handler: ActionHandler | null = null;

/** The host's one listener for everything the view asks for. */
export function setActionHandler(next: ActionHandler | null): void {
    handler = next;
}

/** What the view says to its host. Dropped when no host listens. */
export function onAction(action: ViewerAction): void {
    handler?.(action);
}
