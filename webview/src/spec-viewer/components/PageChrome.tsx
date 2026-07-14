import { SpecHeader } from './SpecHeader';
import { RunStrip } from './RunStrip';

/** The viewer's one header band: identity (left) + run facts (right). */
export function PageChrome() {
    return (
        <header class="page-chrome">
            <SpecHeader />
            <RunStrip />
        </header>
    );
}
