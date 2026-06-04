/**
 * Typed dispatcher utility for discriminated-union message types.
 *
 * `messageHandlers.ts` (spec-viewer) proved out the pattern: take a
 * discriminated-union type (e.g. `ViewerToExtensionMessage`), require a
 * handler for each variant via `{ [K in U['type']]: Handler<K> }`, and let
 * TypeScript fail the build if a new variant is added without an entry.
 *
 * This generic version lifts the pattern out of the spec-viewer feature so
 * other dispatch surfaces (workflow-editor action handlers, spec-editor
 * message routing, future webviews) can reuse it without re-deriving the
 * type plumbing.
 *
 * Usage:
 *
 *   type Msg = { type: 'foo'; n: number } | { type: 'bar'; s: string };
 *
 *   const handlers: DispatcherMap<Msg, [SpecDir, Deps]> = {
 *       foo: (msg, dir, deps) => doFoo(msg.n, dir, deps),
 *       bar: (msg, dir, deps) => doBar(msg.s, dir, deps),
 *   };
 *
 *   const dispatch = createDispatcher(handlers);
 *   await dispatch(incomingMsg, specDir, deps);
 */

/**
 * The discriminator key on the union. Every variant must have `type: string`.
 */
type Tagged = { type: string };

/**
 * A handler for the variant of `U` whose `type` equals `K`. Receives the
 * narrowed message plus whatever extra args the caller threads in.
 */
export type DispatcherHandler<
    U extends Tagged,
    K extends U['type'],
    Args extends readonly unknown[],
> = (msg: Extract<U, { type: K }>, ...args: Args) => Promise<void>;

/**
 * A complete dispatcher map — one handler per variant. TS exhaustiveness:
 * adding a new variant to `U` fails the build until a new entry is added.
 */
export type DispatcherMap<
    U extends Tagged,
    Args extends readonly unknown[],
> = { [K in U['type']]: DispatcherHandler<U, K, Args> };

/**
 * Build the dispatcher function from a complete handler map.
 *
 * The cast in the body is necessary because TS can't narrow a map indexed
 * by `message.type` back to the specific variant on lookup — but the
 * `DispatcherMap` type already guarantees the correspondence, so the cast
 * is sound at the type-system level.
 */
export function createDispatcher<
    U extends Tagged,
    Args extends readonly unknown[],
>(
    handlers: DispatcherMap<U, Args>,
    options: { onUnhandled?: (message: U) => void } = {},
): (message: U, ...args: Args) => Promise<void> {
    return async (message: U, ...args: Args) => {
        const handler = handlers[message.type as U['type']] as
            | ((m: U, ...rest: Args) => Promise<void>)
            | undefined;
        if (!handler) {
            // Unknown / forward-compat message variant. The DispatcherMap
            // type prevents this at compile time, but a version-skewed
            // webview bundle (e.g. mid install-local hot-swap) can send an
            // unknown type. Drop it silently like the pre-dispatcher switch
            // ladder did, with an optional hook for the caller to log.
            options.onUnhandled?.(message);
            return;
        }
        await handler(message, ...args);
    };
}
