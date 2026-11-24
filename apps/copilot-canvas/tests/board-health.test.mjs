import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConstitution, readSpecDetail } from '../com.github.copilot/extensions/speckit-companion/specs-core.mjs';
import { buildConstitutionPrompt } from '../com.github.copilot/extensions/speckit-companion/prompts.mjs';

function project() {
    const root = mkdtempSync(join(tmpdir(), 'board-health-'));
    mkdirSync(join(root, '.specify', 'memory'), { recursive: true });
    return root;
}

const writeConstitution = (root, text) => writeFileSync(join(root, '.specify', 'memory', 'constitution.md'), text);

function specWithDocs(times) {
    const root = project();
    const dir = join(root, 'specs', '001-thing');
    mkdirSync(dir, { recursive: true });
    for (const [name, seconds] of Object.entries(times)) {
        const file = join(dir, `${name}.md`);
        writeFileSync(file, `# ${name}\n`);
        utimesSync(file, seconds, seconds);
    }
    return root;
}

describe('constitution on the board', () => {
    it('is missing when the file does not exist', () => {
        assert.deepEqual(readConstitution(project()), { state: 'missing', changedAt: null });
    });

    it('is the template while placeholders remain in the body', () => {
        const root = project();
        writeConstitution(root, '# [PROJECT_NAME] Constitution\n### [PRINCIPLE_1_NAME]\n');
        assert.equal(readConstitution(root).state, 'template');
    });

    it('is in place when placeholders only appear in the sync report comment', () => {
        const root = project();
        writeConstitution(root, '<!-- replaced [PROJECT_NAME] -->\n# Acme Constitution\n');
        const found = readConstitution(root);
        assert.equal(found.state, 'in-place');
        assert.ok(Date.parse(found.changedAt) > 0);
    });

    it('sends the stock command, never the Companion one', () => {
        assert.match(buildConstitutionPrompt(project()), /^\/speckit\.constitution/);
    });
});

describe('stale documents on the spec detail', () => {
    it('says the plan is older than the spec', () => {
        const root = specWithDocs({ spec: 2_000_000_000, plan: 1_900_000_000 });
        assert.deepEqual(readSpecDetail(root, 'specs/001-thing', { html: false }).staleNotes, ['The plan is older than the spec; run plan again to catch up.']);
    });

    it('is quiet when the documents are in order', () => {
        const root = specWithDocs({ spec: 1_900_000_000, plan: 2_000_000_000 });
        assert.deepEqual(readSpecDetail(root, 'specs/001-thing', { html: false }).staleNotes, []);
    });

    it('is quiet for a spec that is complete', () => {
        const root = specWithDocs({ spec: 2_000_000_000, plan: 1_900_000_000 });
        writeFileSync(join(root, 'specs', '001-thing', '.spec-context.json'), JSON.stringify({ status: 'completed', history: [] }));
        assert.deepEqual(readSpecDetail(root, 'specs/001-thing', { html: false }).staleNotes, []);
    });
});
