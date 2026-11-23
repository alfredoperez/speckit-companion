import { constitutionNeedsSetup } from '../constitution';

describe('constitutionNeedsSetup', () => {
    it('is true while placeholders remain in the body', () => {
        expect(constitutionNeedsSetup('# [PROJECT_NAME] Constitution\n### [PRINCIPLE_1_NAME]')).toBe(true);
    });

    it('is false when placeholders appear only in the Sync Impact Report comment', () => {
        expect(constitutionNeedsSetup('<!-- replaced [PROJECT_NAME], [PRINCIPLE_1_NAME] -->\n# Acme Constitution')).toBe(false);
    });
});
