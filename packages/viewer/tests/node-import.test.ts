import { execFileSync } from 'child_process';
import { join } from 'path';

// A host with no VS Code, no Preact and no DOM: plain Node importing the built package by name.
const root = join(__dirname, '../../..');
const script = `
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { SpecContextSchema } from 'speckit-viewer/contract';
import { renderMarkdown } from 'speckit-viewer/core';
const record = JSON.parse(readFileSync(process.argv[1], 'utf8'));
const loaded = Object.keys(createRequire(import.meta.url).cache);
console.log(JSON.stringify({
    parsed: SpecContextSchema.safeParse(record).success,
    html: renderMarkdown('# Title\\n\\n- [x] **T001** Done'),
    hasDom: typeof document !== 'undefined',
    framework: loaded.filter((p) => /[\\\\/](preact|@preact|vscode)[\\\\/]/.test(p)),
}));
`;

describe('the package in plain Node', () => {
    beforeAll(() => {
        execFileSync('npm', ['run', 'build', '-w', 'speckit-viewer'], { cwd: root, stdio: 'ignore' });
    }, 120_000);

    it('imports /contract and /core by name, parses a record and renders a spec', () => {
        const fixture = join(root, 'apps/vscode/webview/src/spec-viewer/__fixtures__/teamboard/041-profile-photo-upload/spec-context.completed.json');
        const out = JSON.parse(execFileSync('node', ['--input-type=module', '-e', script, fixture], { cwd: root, encoding: 'utf8' }));
        expect(out.parsed).toBe(true);
        expect(out.html).toContain('Title');
        expect(out.html).toContain('T001');
        expect(out.hasDom).toBe(false);
        expect(out.framework).toEqual([]);
    });
});
