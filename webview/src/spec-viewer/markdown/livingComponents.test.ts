/**
 * Unit tests for the living-spec component preprocessors.
 *
 * Each preprocessor is a pure string transform gated by the renderer's
 * livingMode flag. These tests exercise the transforms directly plus the
 * renderer-level guarantees: feature-spec byte parity when livingMode is off,
 * and the per-region fallback that keeps a throwing component from blanking the
 * page.
 */

import {
    safe,
    preprocessLivingDraftNotice,
    preprocessLivingPurpose,
    preprocessLivingScenarios,
    preprocessLivingRequirements,
    preprocessLivingUncovered,
    setLivingCoverage,
} from './livingComponents';
import { renderMarkdown, setLivingMode } from './renderer';

afterEach(() => {
    setLivingMode(false);
    setLivingCoverage(null);
});

describe('safe() — per-region fallback (FR-002, FR-003)', () => {
    it('returns the transformed region when the component succeeds', () => {
        expect(safe('abc', (r) => r.toUpperCase())).toBe('ABC');
    });

    it('returns the input region unchanged when the component throws (SC-007)', () => {
        const region = '### A requirement\n\nsome prose\n';
        const result = safe(region, () => {
            throw new Error('boom');
        });
        expect(result).toBe(region);
    });

    it('drops no line on fallback (SC-006)', () => {
        const region = 'line one\nline two\nline three';
        const result = safe(region, () => {
            throw new Error('boom');
        });
        expect(result.split('\n')).toHaveLength(3);
    });
});

describe('preprocessLivingDraftNotice (FR-006)', () => {
    it('renders a draft notice from a top-window [DRAFT] marker', () => {
        const md = '# Some Capability\n\n> [DRAFT] Surface-first draft — review before trusting.\n\n## Purpose\n\nWhy it exists.';
        const out = preprocessLivingDraftNotice(md);
        expect(out).toContain('living-draft-notice');
    });

    it('leaves the authored banner line intact (FR-006)', () => {
        const md = '# Cap\n\n> [DRAFT] Surface-first draft — review before trusting.\n';
        const out = preprocessLivingDraftNotice(md);
        expect(out).toContain('> [DRAFT] Surface-first draft — review before trusting.');
    });

    it('renders no notice for a non-draft document', () => {
        const md = '# Cap\n\n## Purpose\n\nWhy it exists.';
        const out = preprocessLivingDraftNotice(md);
        expect(out).toBe(md);
        expect(out).not.toContain('living-draft-notice');
    });

    it('does not count the word "draft" deep in the body (windowed)', () => {
        const body = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n');
        const md = `# Cap\n\n${body}\n\n> [DRAFT] a late marker`;
        const out = preprocessLivingDraftNotice(md);
        expect(out).not.toContain('living-draft-notice');
    });
});

describe('preprocessLivingPurpose (FR-007)', () => {
    it('wraps the Purpose section in a callout when present', () => {
        const md = '# Cap\n\n## Purpose\n\nThe reason it exists.\n\n## Requirements\n\n### A rule';
        const out = preprocessLivingPurpose(md);
        expect(out).toContain('<div class="living-purpose">');
        expect(out).toContain('## Purpose');
        expect(out).toContain('The reason it exists.');
    });

    it('keeps the authored purpose text verbatim', () => {
        const md = '## Purpose\n\nExact authored words, unchanged.\n\n## Requirements';
        const out = preprocessLivingPurpose(md);
        expect(out).toContain('Exact authored words, unchanged.');
    });

    it('omits the callout entirely when there is no Purpose section (never a placeholder)', () => {
        const md = '# Cap\n\n## Requirements\n\n### A rule';
        const out = preprocessLivingPurpose(md);
        expect(out).toBe(md);
        expect(out).not.toContain('living-purpose');
    });
});

describe('preprocessLivingRequirements (FR-008, FR-005)', () => {
    const doc = [
        '## Requirements',
        '',
        '### A Rule With Mixed Case And  Double Space',
        '',
        'The rule body.',
        '',
        '### Second rule',
        '',
        'Another body.',
    ].join('\n');

    it('keys the card on the exact heading text, no trim/normalize/re-case (FR-008)', () => {
        const out = preprocessLivingRequirements(doc);
        expect(out).toContain('data-req="A Rule With Mixed Case And  Double Space"');
        expect(out).toContain('<div class="living-req-card"');
    });

    it('keeps the heading and body as their own markdown lines (per-line identity, FR-005)', () => {
        const out = preprocessLivingRequirements(doc);
        expect(out).toContain('### A Rule With Mixed Case And  Double Space');
        expect(out).toContain('The rule body.');
    });

    it('keeps inner scenario steps as individual per-line .line units (FR-005)', () => {
        const withScenario = [
            '## Requirements',
            '',
            '### A rule',
            '',
            'Body.',
            '',
            '#### Scenario: it happens',
            '- **WHEN** a thing occurs',
            '- **THEN** the outcome holds',
        ].join('\n');
        const out = preprocessLivingRequirements(preprocessLivingScenarios(withScenario));
        expect(out).toContain('class="living-scenario-step line living-when"');
        expect(out).toContain('class="living-scenario-step line living-then"');
        // still inside the card wrapper
        expect(out).toContain('<div class="living-req-card"');
    });

    it('leaves a document without a Requirements section unchanged', () => {
        const md = '# Cap\n\n## Purpose\n\nWhy.';
        expect(preprocessLivingRequirements(md)).toBe(md);
    });
});

describe('requirement confidence + coverage (FR-009, FR-010, FR-011, FR-019)', () => {
    it('renders an inferred badge only when [inferred] is tagged, and lifts the tag out of prose', () => {
        const md = '## Requirements\n\n### Inferred rule\n\nThis was guessed from code. [inferred]';
        const out = preprocessLivingRequirements(md);
        expect(out).toContain('living-req-confidence--inferred');
        expect(out).not.toContain('[inferred]');
        expect(out).toContain('This was guessed from code.');
    });

    it('renders no confidence badge for an untagged (observed) requirement', () => {
        const md = '## Requirements\n\n### Observed rule\n\nSeen directly in code.';
        const out = preprocessLivingRequirements(md);
        expect(out).not.toContain('living-req-confidence');
    });

    it('shows coverage only when the tier is determinable', () => {
        setLivingCoverage({ 'Covered rule': '3/3 tests' });
        const md = '## Requirements\n\n### Covered rule\n\nBody.';
        const out = preprocessLivingRequirements(md);
        expect(out).toContain('living-req-coverage');
        expect(out).toContain('3/3 tests');
    });

    it('omits coverage entirely when undeterminable and never renders it as 0 (FR-019)', () => {
        setLivingCoverage({ 'Zero rule': '0' });
        const md = '## Requirements\n\n### Zero rule\n\nBody.\n\n### Unknown rule\n\nBody.';
        const out = preprocessLivingRequirements(md);
        expect(out).not.toContain('living-req-coverage');
        expect(out).not.toMatch(/living-req-coverage[^>]*>0</);
    });

    it('does not resolve coverage through inherited object keys (prototype safety)', () => {
        setLivingCoverage({ 'Real rule': '2/2 tests' });
        const md = '## Requirements\n\n### toString\n\nBody.\n\n### __proto__\n\nBody.';
        const out = preprocessLivingRequirements(md);
        expect(out).not.toContain('living-req-coverage');
    });
});

describe('preprocessLivingScenarios (FR-012, FR-013)', () => {
    it('separates WHEN from THEN/AND without reordering or rewording', () => {
        const md = [
            '#### Scenario: an edit is committed',
            '- **WHEN** the user commits an inline edit',
            '- **THEN** the request identifies the source line',
            '- **AND** the extension rewrites the file',
        ].join('\n');
        const out = preprocessLivingScenarios(md);
        expect(out).toContain('living-when');
        expect(out).toContain('living-then');
        expect(out).toContain('living-and');
        // order preserved: WHEN step appears before THEN step
        expect(out.indexOf('living-when')).toBeLessThan(out.indexOf('living-then'));
        // wording preserved
        expect(out).toContain('the user commits an inline edit');
        expect(out).toContain('the extension rewrites the file');
    });

    it('renders a requirement with no scenarios cleanly, no empty scenario container (FR-013)', () => {
        const md = '## Requirements\n\n### A rule with no scenarios\n\nJust a body.';
        const out = preprocessLivingRequirements(preprocessLivingScenarios(md));
        expect(out).not.toContain('living-scenario');
        expect(out).toContain('<div class="living-req-card"');
    });

    it('leaves a Scenario heading with no recognized steps unchanged (defensive fallback)', () => {
        const md = '#### Scenario: malformed\n\nJust prose, no WHEN/THEN bullets.';
        const out = preprocessLivingScenarios(md);
        expect(out).toContain('#### Scenario: malformed');
        expect(out).not.toContain('living-scenario');
    });
});

describe('preprocessLivingUncovered (FR-014–FR-019)', () => {
    const grouped = [
        '## Uncovered',
        '',
        'Read most of the area at surface level; three files were not read in full.',
        '',
        '- **Too large to read fully**',
        '  - `src/big/module-a.ts`',
        '  - `src/big/module-b.ts`',
        '- **Unreadable (binary)**',
        '  - `assets/blob.bin`',
        '',
        '## Assumptions',
    ].join('\n');

    it('opens with a count and scope statement before any file list (FR-014)', () => {
        const out = preprocessLivingUncovered(grouped);
        expect(out).toContain('living-uncovered-count');
        expect(out).toContain('3 files not fully read');
        expect(out).toContain('living-uncovered-scope');
        const countIdx = out.indexOf('living-uncovered-count');
        const fileIdx = out.indexOf('living-uncovered-file');
        expect(countIdx).toBeLessThan(fileIdx);
    });

    it('groups files by reason as closed-by-default disclosures (FR-015, FR-016)', () => {
        const out = preprocessLivingUncovered(grouped);
        const groups = out.match(/<details class="living-uncovered-group">/g) ?? [];
        expect(groups).toHaveLength(2);
        expect(out).not.toContain('<details class="living-uncovered-group" open');
        expect(out).toContain('Too large to read fully');
        expect(out).toContain('Unreadable (binary)');
    });

    it('keeps the ## Uncovered heading as a normal line', () => {
        const out = preprocessLivingUncovered(grouped);
        expect(out).toContain('## Uncovered');
    });

    it('renders each uncovered file as a commentable line with add button and comment slot', () => {
        const out = preprocessLivingUncovered(grouped);
        const files = out.match(/<li class="living-uncovered-file line"[^>]*>/g) ?? [];
        expect(files).toHaveLength(3);
        expect(out).toContain('line-add-btn');
        expect(out).toContain('line-comment-slot');
        for (const file of files) {
            expect(file).toMatch(/data-line="\d+"/);
            expect(file).toMatch(/data-list-id="living-uncovered-\d+"/);
        }
    });

    it('gives each reason group its own list id so comments anchor per group', () => {
        const out = preprocessLivingUncovered(grouped);
        const listIds = [...out.matchAll(/data-list-id="(living-uncovered-\d+)"/g)].map((m) => m[1]);
        expect(new Set(listIds).size).toBe(2);
    });
});

describe('uncovered read-everything + fallback (FR-017, FR-018, SC-006)', () => {
    it('renders the read-everything sentinel as a plain statement, no empty banner (FR-017)', () => {
        const md = '## Uncovered\n\n_None — every file in the area was read._\n';
        const out = preprocessLivingUncovered(md);
        expect(out).toContain('living-uncovered-none');
        expect(out).toContain('None — every file in the area was read.');
        expect(out).not.toContain('living-uncovered-count');
    });

    it('treats an empty uncovered section as read-everything', () => {
        const md = '## Uncovered\n\n## Assumptions\n\nx';
        const out = preprocessLivingUncovered(md);
        expect(out).toContain('living-uncovered-none');
    });

    it('falls back to plain markdown for an unrecognized flat list, dropping no line (FR-018, SC-006)', () => {
        const md = [
            '## Uncovered',
            '',
            'Not read:',
            '',
            '- `src/one.ts` — too large',
            '- `src/two.ts` — binary',
        ].join('\n');
        const out = preprocessLivingUncovered(md);
        expect(out).toBe(md);
        expect(out).toContain('`src/one.ts` — too large');
        expect(out).toContain('`src/two.ts` — binary');
        expect(out).not.toContain('living-uncovered');
    });

    it('leaves a document with no Uncovered section unchanged', () => {
        const md = '# Cap\n\n## Purpose\n\nWhy.';
        expect(preprocessLivingUncovered(md)).toBe(md);
    });
});

describe('renderMarkdown — feature-spec byte parity (FR-001, SC-001)', () => {
    const featureSpec = [
        '# Feature Spec',
        '',
        '## Purpose',
        '',
        'This heading must not be treated as a living callout when livingMode is off.',
        '',
        '> [DRAFT] this must not become a notice when livingMode is off',
        '',
        '### A requirement heading',
        '',
        'Body prose.',
    ].join('\n');

    it('renders identically with livingMode off regardless of prior state', () => {
        setLivingMode(false);
        const off = renderMarkdown(featureSpec);
        expect(off).not.toContain('living-');
    });

    it('is byte-identical across repeated feature-spec renders', () => {
        setLivingMode(false);
        const first = renderMarkdown(featureSpec);
        setLivingMode(true);
        renderMarkdown(featureSpec); // living render in between
        setLivingMode(false);
        const second = renderMarkdown(featureSpec);
        expect(second).toBe(first);
    });
});
