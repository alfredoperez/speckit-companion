/**
 * @jest-environment jsdom
 */

import { render } from 'preact';
import { RemovedDocBanner } from '../RemovedDocBanner';
import { navState } from '../../signals';
import { mockNavState } from '../__stories__/mockData';

function renderInto(): HTMLDivElement {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(<RemovedDocBanner />, container);
    return container;
}

describe('RemovedDocBanner', () => {
    it('says which document was deleted and which one is showing instead', () => {
        navState.value = mockNavState({ currentDoc: 'spec', removedDocument: 'Plan' });
        const container = renderInto();
        expect(container.querySelector('#removed-doc-banner')?.textContent)
            .toBe('Plan was moved or deleted, so Specification is showing.');
    });

    it('renders nothing when no document was removed', () => {
        navState.value = mockNavState({ currentDoc: 'spec' });
        const container = renderInto();
        expect(container.querySelector('#removed-doc-banner')).toBeNull();
    });
});
