import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSpecDetail } from '../specs-core.mjs';
import { coverageRows, renderOverview, stepTiming } from '../overview.mjs';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const TEAMBOARD = join(REPO, 'apps/vscode/webview/src/spec-viewer/__fixtures__/teamboard/041-profile-photo-upload');

describe('documents render through the VS Code viewer pipeline', () => {
    it('ships the vendored renderer and stylesheet', () => {
        assert.ok(existsSync(new URL('../vendor/viewer-markdown.mjs', import.meta.url)));
        assert.ok(existsSync(new URL('../vendor/viewer.css', import.meta.url)));
    });

    it('renders user stories, task phases and checkboxes the way the viewer does', () => {
        const detail = readSpecDetail(REPO, 'specs/_02_demo-tasked');
        const tasks = detail.documents.find(d => d.type === 'tasks').html;
        assert.match(tasks, /class="task-item/);
        assert.match(tasks, /<input type="checkbox"/);
        const spec = detail.documents.find(d => d.type === 'spec').html;
        assert.match(spec, /user-story|<h2/);
    });
});

describe('overview dossier', () => {
    const ctx = JSON.parse(readFileSync(join(TEAMBOARD, 'spec-context.completed.json'), 'utf8'));

    it('renders the sections in the viewer\'s order', () => {
        const html = renderOverview(ctx, TEAMBOARD);
        const order = ['dossier-intent', 'aria-label="Expectations"', 'aria-label="Verified"', 'aria-label="Decisions"', 'aria-label="Coverage"']
            .map(marker => html.indexOf(marker)).filter(i => i >= 0);
        assert.ok(order.length >= 3, `expected at least three sections, got ${order.length}`);
        assert.deepEqual(order, [...order].sort((a, b) => a - b));
    });

    it('escapes record text', () => {
        const html = renderOverview({ intent: '<img src=x onerror=alert(1)>' }, null);
        assert.ok(!html.includes('<img'));
        assert.match(html, /&lt;img/);
    });

    it('shows timing without an empty Intent heading when the record has no intent', () => {
        const html = renderOverview({ history: [{ step: 'specify', kind: 'start', at: '2026-01-01T00:00:00Z' }, { step: 'specify', kind: 'complete', at: '2026-01-01T00:05:00Z' }] }, null);
        assert.match(html, /dossier-timing/);
        assert.ok(!html.includes('>Intent<'));
    });

    it('is empty for a record with nothing to say', () => {
        assert.equal(renderOverview({ status: 'planned', history: [] }, null), '');
    });

    it('flags a named test file that is not on disk', () => {
        const root = mkdtempSync(join(tmpdir(), 'canvas-'));
        mkdirSync(join(root, 'tests'));
        writeFileSync(join(root, 'tests/a.test.ts'), '');
        const rows = coverageRows({ coverage: { R001: { tasks: 'T001, T002', tests: ['tests/a.test.ts', 'tests/gone.test.ts'] } } }, root);
        assert.deepEqual(rows[0].tasks, ['T001', 'T002']);
        assert.deepEqual(rows[0].missingTests, ['tests/gone.test.ts']);
    });

    it('takes each step\'s duration from its start and finish', () => {
        const timing = stepTiming({ history: [
            { step: 'plan', kind: 'start', at: '2026-01-01T00:00:00Z' },
            { step: 'plan', task: 'T001', kind: 'complete', at: '2026-01-01T00:01:00Z' },
            { step: 'plan', kind: 'complete', at: '2026-01-01T00:02:00Z' },
        ] });
        assert.deepEqual(timing.plan, { startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:02:00Z' });
    });

    it('ends each step at its first finish, so repeats and idle time before the next step count for nothing', () => {
        const timing = stepTiming({ history: [
            { step: 'specify', substep: null, kind: 'start', by: 'extension', at: '2026-09-30T20:23:24.574Z' },
            { step: 'specify', substep: null, kind: 'complete', by: 'extension', at: '2026-09-30T20:23:47.208Z' },
            { step: 'plan', substep: null, kind: 'start', by: 'extension', at: '2026-09-30T21:17:20.000Z' },
            { step: 'plan', substep: null, kind: 'complete', by: 'ai', at: '2026-09-30T21:20:18.000Z' },
            { step: 'plan', substep: null, kind: 'complete', by: 'ai', at: '2026-09-30T21:20:19.000Z' },
            { step: 'plan', substep: null, kind: 'complete', by: 'ai', at: '2026-09-30T21:20:20.000Z' },
        ] });
        assert.deepEqual(timing.specify, { startedAt: '2026-09-30T20:23:24.574Z', completedAt: '2026-09-30T20:23:47.208Z' });
        assert.deepEqual(timing.plan, { startedAt: '2026-09-30T21:17:20.000Z', completedAt: '2026-09-30T21:20:18.000Z' });
    });
});
