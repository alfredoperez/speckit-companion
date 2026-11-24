/**
 * The line at the top of a modal kept open to add another: it says "Added"
 * only once the write answered, and says the refusal when it did not.
 */

export interface WriteAnswer {
    /** The writer's refusal, when the last write was refused. */
    refusal?: string | null;
    /** A write was reported done since the modal sent its addition. */
    written?: boolean;
}

export function AddedLine({ pending, answer }: { pending: string; answer?: WriteAnswer }) {
    const refused = pending ? answer?.refusal ?? '' : '';
    const added = pending && !refused && answer?.written ? pending : '';
    return (
        <p class={`pb-modal-added${refused ? ' pb-modal-added--refused' : ''}`}
            role="status" aria-live="polite">
            {refused || (added && (
                <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                        stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                        stroke-linejoin="round" aria-hidden="true" focusable="false">
                        <path d="M2 6.5L4.75 9L10 3.5" />
                    </svg>
                    {`Added ${added}`}
                </>
            ))}
        </p>
    );
}
