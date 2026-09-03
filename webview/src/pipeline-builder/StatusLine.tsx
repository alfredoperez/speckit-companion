/**
 * What the last write did, said at the foot of the panel.
 *
 * Every write redrew the board and only refusals spoke, so a hook attached at
 * the bottom of a lane that is scrolled away changed nothing anybody could see.
 * The line says what happened, offers the way back while there is one, and says
 * what it means next — a change is not in the pipeline until Build writes it.
 *
 * At the foot rather than under the header because the header is where the
 * pipeline is named; the foot is where the eye is free. It is a component of
 * its own so the stories draw the real thing rather than a copy of it.
 */

import { PipelineStatus } from '../../../src/protocol/pipeline';
import { StatusIcon } from './Header';

interface Props {
    status: PipelineStatus;
    /** Take the last write back, by the token the status carries. */
    onUndo: (token: string) => void;
    onDismiss: () => void;
}

export function StatusLine({ status, onUndo, onDismiss }: Props) {
    return (
        <div class="builder-status" role="status">
            <StatusIcon tone={status.tone} />
            <span class="builder-status-text">{status.text}</span>
            {status.undo && (
                <button class="builder-status-undo" onClick={() => onUndo(status.undo!.token)}>
                    {status.undo.label ?? 'Undo'}
                </button>
            )}
            {status.detail && <span class="builder-status-detail">{status.detail}</span>}
            <button class="builder-status-close" title="Dismiss" onClick={onDismiss}>×</button>
        </div>
    );
}
