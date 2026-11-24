import { render } from 'preact-render-to-string';
import type { ViewerState } from '../../packages/viewer/src/contract';
import {
    IntentSection,
    ExpectationsSection,
    VerifiedSection,
    DecisionsSection,
    CoverageSection,
} from '../../packages/viewer/src/view/components/OverviewDossier';

/** The Overview's sections as HTML, in the order and classes the viewer's ActivityPanel uses. */
export function renderDossier(state: ViewerState): string {
    return render(
        <>
            <IntentSection state={state} />
            <ExpectationsSection state={state} />
            <VerifiedSection state={state} />
            <DecisionsSection state={state} />
            <CoverageSection state={state} />
        </>,
    );
}
