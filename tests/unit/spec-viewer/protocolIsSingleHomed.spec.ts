import * as fs from 'fs';
import * as path from 'path';

/**
 * The extension and the webview used to declare the message protocol
 * separately, by hand. They drifted: three variants existed on the extension
 * side that the webview had never heard of, and the two disagreed about which
 * documents a review comment may be anchored to — a disagreement neither
 * compiler could see, because each side type-checked its own copy.
 *
 * The protocol now lives in one module both projects compile. This test guards
 * that arrangement, since re-declaring a type is easier than importing one.
 */
const repoRoot = path.join(__dirname, '..', '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

const PROTOCOL = 'src/protocol/viewer.ts';
const EXTENSION_TYPES = 'src/features/spec-viewer/types.ts';
const WEBVIEW_TYPES = 'webview/src/spec-viewer/types.ts';

describe('the viewer protocol has one home', () => {
    it('declares both message unions in the protocol module', () => {
        const protocol = read(PROTOCOL);
        expect(protocol).toContain('export type ExtensionToViewerMessage');
        expect(protocol).toContain('export type ViewerToExtensionMessage');
    });

    it('is compiled by the webview, not copied into it', () => {
        const webviewConfig = JSON.parse(read('tsconfig.webview.json').replace(/^\s*\/\/.*$/gm, ''));
        expect(webviewConfig.include).toContain('src/protocol/**/*');
        expect(read(WEBVIEW_TYPES)).toContain("export * from '../../../src/protocol/viewer'");
    });

    it('is not re-declared on either side', () => {
        for (const file of [EXTENSION_TYPES, WEBVIEW_TYPES]) {
            const source = read(file);
            expect(source).not.toMatch(/export type ExtensionToViewerMessage\s*=/);
            expect(source).not.toMatch(/export type ViewerToExtensionMessage\s*=/);
        }
    });

    it('stays free of vscode imports, since the webview compiles it', () => {
        expect(read(PROTOCOL)).not.toMatch(/from ['"]vscode['"]/);
    });

    it('carries every variant the extension can post, including the install banner', () => {
        // These three were posted from an inline script in the HTML generator,
        // which bypassed the webview's copy of the union entirely.
        const protocol = read(PROTOCOL);
        for (const variant of ['installSpecKitExtension', 'openReadme', 'dismissInstallBanner']) {
            expect(protocol).toContain(`type: '${variant}'`);
        }
    });
});

/**
 * The step vocabulary was the most-copied knowledge in the codebase: the same
 * list of names appeared in five production files across two languages, so
 * adding a step meant finding every one of them. Production code reads it from
 * the contract now; this keeps it that way.
 */
describe('the step vocabulary has one home', () => {
    const productionSources = [
        'src/features/spec-viewer/stateDerivation.ts',
        'src/features/specs/stepHistoryDerivation.ts',
        'webview/src/spec-viewer/components/OverviewDossier.tsx',
        'webview/src/spec-viewer/components/cards/PhasesCard.tsx',
    ];

    it('is not re-declared as a literal in the code that reads it', () => {
        for (const file of productionSources) {
            const source = read(file);
            expect(source).not.toMatch(/\[\s*'specify',\s*'plan',\s*'tasks',\s*'implement'\s*\]/);
            expect(source).not.toMatch(/\[\s*'specify',\s*'clarify',\s*'plan',/);
        }
    });

    it('declares the step lists once, in the contract', () => {
        const contract = read('src/core/types/specContext.ts');
        expect(contract).toContain('export const DEFAULT_PIPELINE_STEPS');
        expect(contract).toContain('export const STEP_NAMES');
    });
});
