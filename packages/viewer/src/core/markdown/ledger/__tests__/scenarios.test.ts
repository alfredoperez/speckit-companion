import { splitScenario } from '../specModel';

describe('splitScenario', () => {
    it('splits a bold Given/When/Then line and keeps "and" inside the clause', () => {
        const steps = splitScenario('**Given** the new interface is turned on and the user is signed in, **When** the Overview opens, **Then** all 18 overview metrics are shown with value, unit and status, and any metric that is not ok is placed before the ok ones.');
        expect(steps.map((s) => s.kw)).toEqual(['given', 'when', 'then']);
        expect(steps[2].text).toBe('all 18 overview metrics are shown with value, unit and status, and any metric that is not ok is placed before the ok ones.');
    });

    it('does not split on lowercase given inside a clause', () => {
        const steps = splitScenario('**Given** a metric is a warning, critical or unavailable, **When** it is shown, **Then** its status is conveyed by text and an icon as well as color, and an unavailable metric shows the reason given by the API.');
        expect(steps.map((s) => s.kw)).toEqual(['given', 'when', 'then']);
        expect(steps[2].text).toContain('the reason given by the API');
    });

    it('splits the plain template form with capitalised keywords after commas', () => {
        const steps = splitScenario('Given a pager is on, When a call fails, Then an alert opens and stays until read.');
        expect(steps.map((s) => s.kw)).toEqual(['given', 'when', 'then']);
        expect(steps[2].text).toBe('an alert opens and stays until read.');
    });

    it('keeps a keyword-less line as one step', () => {
        expect(splitScenario('the reader sees status and given values')).toEqual([{ kw: '', text: 'the reader sees status and given values' }]);
    });
});
