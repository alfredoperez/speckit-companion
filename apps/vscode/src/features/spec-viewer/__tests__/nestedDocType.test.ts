import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getDocumentTypeFromPath } from '../utils';
import { relativePathToDocType } from '../../../core/utils/fileNaming';

/**
 * A click and the document scan have to type the same file the same way. When they did not,
 * `resolveTabClickDocument` found nothing, `updateContent` returned early, and the panel kept
 * showing whatever it already had — so clicking Requirements looked like it opened the
 * Specification, with only an output-channel line to say otherwise.
 */
describe('a nested document is typed by its path under the spec', () => {
    let root: string;
    let specDir: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'nested-doctype-'));
        specDir = path.join(root, 'specs', '001-a-feature');
        fs.mkdirSync(path.join(specDir, 'checklists'), { recursive: true });
        fs.mkdirSync(path.join(specDir, 'contracts'), { recursive: true });
        fs.writeFileSync(path.join(specDir, 'spec.md'), '# Spec\n');
        fs.writeFileSync(path.join(specDir, 'research.md'), '# Research\n');
        fs.writeFileSync(path.join(specDir, 'checklists', 'requirements.md'), '# Requirements\n');
        fs.writeFileSync(path.join(specDir, 'contracts', 'webview-messages.md'), '# Contract\n');
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('keeps the folder, so the type matches what the scan stored', () => {
        expect(getDocumentTypeFromPath(path.join(specDir, 'checklists', 'requirements.md')))
            .toBe('checklists/requirements');
        expect(getDocumentTypeFromPath(path.join(specDir, 'contracts', 'webview-messages.md')))
            .toBe('contracts/webview-messages');
    });

    it('leaves a flat related document alone', () => {
        expect(getDocumentTypeFromPath(path.join(specDir, 'research.md'))).toBe('research');
    });

    it('leaves a core document alone', () => {
        expect(getDocumentTypeFromPath(path.join(specDir, 'spec.md'))).toBe('spec');
    });

    it('agrees with the scan derivation for the same relative path', () => {
        // The scan types from the relative path; the click types from the absolute one. Both
        // land here, which is the only reason they cannot drift apart again.
        expect(getDocumentTypeFromPath(path.join(specDir, 'checklists', 'requirements.md')))
            .toBe(relativePathToDocType('checklists/requirements.md'));
    });

    it('normalises a Windows separator to the stored form', () => {
        expect(relativePathToDocType('checklists\\requirements.md')).toBe('checklists/requirements');
    });
});
