import { SpecHeader } from './SpecHeader';
import { RunStrip } from './RunStrip';

/**
 * The viewer's single header band. It carries two things that answer different
 * questions — what this spec IS (name, lifecycle badge, branch, date) and how
 * its run WENT (phase, tasks, traceability, checks, time) — but they are one
 * bounded region with one boundary, not two stacked headers.
 *
 * The run facts yield first as the pane narrows (see `_content.css`); identity
 * never does. A spec with no recorded run renders the identity half alone,
 * because `RunStrip` returns null.
 */
export function PageChrome() {
    return (
        <header class="page-chrome">
            <SpecHeader />
            <RunStrip />
        </header>
    );
}
