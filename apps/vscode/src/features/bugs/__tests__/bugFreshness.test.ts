import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { ProcessPaneProvider } from '../../processes/processPaneProvider';
import { bugActions } from '../../processes/processActions';
import { assessmentHash, referenceFreshness, worstFreshness } from '../bugFreshness';
import { readBugReport, readBugReports, staleReports } from '../bugReports';
import { bugsPaneConfig } from '../bugsPane';

const temps: string[] = [];

function workspaceWith(build: (root: string) => void): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-freshness-'));
    temps.push(root);
    build(root);
    return root;
}

afterAll(() => temps.forEach(root => fs.rmSync(root, { recursive: true, force: true })));

const ASSESSMENT = (created: string) =>
    `# Bug Assessment: cart\n\n- **Slug**: cart\n- **Created**: ${created}\n- **Verdict**: valid\n- **Severity**: high\n\n## Symptom\n\nThe total is wrong.\n`;
const FIX = (reference: string) =>
    `# Bug Fix: cart\n\n- **Slug**: cart\n- **Fixed**: 2026-10-01\n- **Assessment**: ${reference}\n- **Status**: applied\n\n## Summary\n\nFixed it.\n`;
const TEST = (reference: string, result = 'verified') =>
    `# Bug Verification: cart\n\n- **Slug**: cart\n- **Tested**: 2026-10-01\n- **Assessment**: ${reference}\n- **Fix**: ./fix.md\n- **Result**: ${result}\n\n## Summary\n\nChecked it.\n`;

function writeBug(root: string, files: Record<string, string>, slug = 'cart'): string {
    const dir = path.join(root, '.specify', 'bugs', slug);
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
    return dir;
}

describe('referenceFreshness', () => {
    const text = ASSESSMENT('2026-11-03T08:00:00Z');
    const hash = assessmentHash(text);

    it('is current when the reference carries the hash of the assessment as it stands', () => {
        expect(referenceFreshness(`./assessment.md#${hash.slice(0, 12)}`, text, '2026-11-03T08:00:00Z')).toBe('current');
        expect(referenceFreshness(`./assessment.md (sha256:${hash})`, text, undefined)).toBe('current');
    });

    it('is stale when the hash names an earlier assessment', () => {
        expect(referenceFreshness('./assessment.md#0123456789ab', text, '2026-11-03T08:00:00Z')).toBe('stale');
    });

    it('hashes the same through a CRLF checkout and trailing blank lines', () => {
        expect(assessmentHash(text.replace(/\n/g, '\r\n') + '\n\n')).toBe(hash);
    });

    it('compares full Created stamps exactly', () => {
        expect(referenceFreshness('./assessment.md (created 2026-11-03T08:00:00Z)', text, '2026-11-03T08:00:00Z')).toBe('current');
        expect(referenceFreshness('./assessment.md (created 2026-11-03T07:00:00Z)', text, '2026-11-03T08:00:00Z')).toBe('stale');
    });

    it('is stale when the reference names another day than the assessment', () => {
        expect(referenceFreshness('./assessment.md (created 2026-10-01)', text, '2026-11-03')).toBe('stale');
    });

    it('is unknown when both sides name the same day only, since a same-day re-assessment keeps it', () => {
        expect(referenceFreshness('./assessment.md (created 2026-11-03)', text, '2026-11-03')).toBe('unknown');
    });

    it.each([
        ['a bare path', './assessment.md', '2026-11-03'],
        ['no reference at all', undefined, '2026-11-03'],
        ['a reference to an assessment with no Created line', './assessment.md (created 2026-11-03)', undefined],
    ])('is unknown with %s', (_name, reference, created) => {
        expect(referenceFreshness(reference, text, created)).toBe('unknown');
    });

    it('is unknown when the assessment could not be read', () => {
        expect(referenceFreshness('./assessment.md#0123456789ab', undefined, '2026-11-03')).toBe('unknown');
    });

    it('takes the worst of several answers', () => {
        expect(worstFreshness('current', 'unknown')).toBe('unknown');
        expect(worstFreshness('unknown', 'stale', 'current')).toBe('stale');
        expect(worstFreshness('current')).toBe('current');
    });
});

describe('a bug that was assessed again after its fix and test', () => {
    const root = workspaceWith(r =>
        writeBug(r, {
            'assessment.md': ASSESSMENT('2026-11-03T08:00:00Z'),
            'fix.md': FIX('./assessment.md (created 2026-10-01T09:00:00Z)'),
            'test.md': TEST('./assessment.md (created 2026-10-01T09:00:00Z)'),
        }),
    );
    const bug = readBugReports(root)[0];

    it('is back in To fix instead of Verified, with the old reports marked stale', () => {
        expect(bug.testResult).toBe('verified');
        expect(bug.state).toBe('to-fix');
        expect(bug.freshness).toEqual({ fix: 'stale', test: 'stale' });
        expect(staleReports(bug)).toEqual(['fix', 'test']);
    });

    it('offers Fix again as the main button', () => {
        expect(bugActions(bug).map(action => `${action.primary ? 'main' : 'secondary'}: ${action.label}`)).toEqual(['main: Fix again']);
    });

    it('gives the same answer in a fresh clone where every file time is reset', () => {
        const clone = workspaceWith(r => writeBug(r, {
            'assessment.md': ASSESSMENT('2026-11-03T08:00:00Z'),
            'fix.md': FIX('./assessment.md (created 2026-10-01T09:00:00Z)'),
            'test.md': TEST('./assessment.md (created 2026-10-01T09:00:00Z)'),
        }));
        const dir = path.join(clone, '.specify', 'bugs', 'cart');
        // The fix is written after the assessment on disk, as a clone would leave it, so only the key can tell.
        const same = new Date('2026-01-01T00:00:00Z');
        for (const name of fs.readdirSync(dir)) fs.utimesSync(path.join(dir, name), same, same);
        const cloned = readBugReports(clone)[0];
        expect(cloned.state).toBe(bug.state);
        expect(cloned.freshness).toEqual(bug.freshness);
    });

    it('describes the row as an old fix and test in the Bugs pane', () => {
        (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [{ uri: { fsPath: root }, name: 'ws' }];
        const rows = new ProcessPaneProvider({} as vscode.ExtensionContext, bugsPaneConfig).getChildren();
        const toFix = rows.find(group => String(group.label).startsWith('To fix'));
        expect(toFix?.children.map(row => row.description)).toEqual(['high · old fix and test']);
        (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = undefined;
    });
});

describe('a bug whose reports carry the current key', () => {
    it('stays Verified', () => {
        const text = ASSESSMENT('2026-11-03T08:00:00Z');
        const ref = `./assessment.md#${assessmentHash(text).slice(0, 12)}`;
        const root = workspaceWith(r => writeBug(r, { 'assessment.md': text, 'fix.md': FIX(ref), 'test.md': TEST(ref) }));
        const bug = readBugReports(root)[0];
        expect(bug.state).toBe('verified');
        expect(bug.freshness).toEqual({ fix: 'current', test: 'current' });
    });
});

describe('a bug whose reports carry no key', () => {
    const root = workspaceWith(r =>
        writeBug(r, {
            'assessment.md': ASSESSMENT('2026-11-03'),
            'fix.md': FIX('./assessment.md'),
            'test.md': TEST('./assessment.md'),
        }),
    );
    const bug = readBugReports(root)[0];

    it('shows unknown freshness instead of guessing', () => {
        expect(bug.freshness).toEqual({ fix: 'unknown', test: 'unknown' });
        expect(staleReports(bug)).toEqual([]);
    });

    it('keeps its verified state, since nothing proves the reports are old', () => {
        expect(bug.state).toBe('verified');
    });
});

describe('a test report whose fix is stale', () => {
    it('is stale too, because it checked that fix', () => {
        const root = workspaceWith(r =>
            writeBug(r, {
                'assessment.md': ASSESSMENT('2026-11-03T08:00:00Z'),
                'fix.md': FIX('./assessment.md (created 2026-10-01T09:00:00Z)'),
                'test.md': TEST('./assessment.md'),
            }),
        );
        expect(readBugReport(path.join(root, '.specify', 'bugs', 'cart'))?.freshness).toEqual({ fix: 'stale', test: 'stale' });
    });
});

describe('the Bugs pane for a bug run through the bugfix workflow', () => {
    const log = [
        { event: 'step_started', step_id: 'assess', type: 'command', timestamp: '2026-11-01T05:11:58+00:00' },
        { event: 'step_completed', step_id: 'assess', status: 'completed', timestamp: '2026-11-01T05:13:46+00:00' },
        { event: 'step_started', step_id: 'review-assessment', type: 'gate', timestamp: '2026-11-01T05:13:46+00:00' },
        { event: 'step_completed', step_id: 'review-assessment', status: 'paused', timestamp: '2026-11-01T05:13:47+00:00' },
    ];

    function runWorkspace(slug: string, runLog: string): string {
        return workspaceWith(r => {
            writeBug(r, { 'assessment.md': ASSESSMENT('2026-11-03') }, slug);
            const run = path.join(r, '.specify', 'workflows', 'runs', '3471d74b');
            fs.mkdirSync(run, { recursive: true });
            fs.writeFileSync(path.join(run, 'inputs.json'), JSON.stringify({ inputs: { slug } }));
            fs.writeFileSync(
                path.join(run, 'state.json'),
                JSON.stringify({ run_id: '3471d74b', workflow_id: 'bugfix', status: 'paused', current_step_id: 'review-assessment', inputs: { slug } }),
            );
            fs.writeFileSync(path.join(run, 'log.jsonl'), runLog);
        });
    }

    function pane(root: string) {
        (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [{ uri: { fsPath: root }, name: 'ws' }];
        try {
            return new ProcessPaneProvider({} as vscode.ExtensionContext, bugsPaneConfig).getChildren();
        } finally {
            (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = undefined;
        }
    }

    it('files the bug under Waiting for your review with its step time and paused gate', () => {
        const rows = pane(runWorkspace('cart', log.map(event => JSON.stringify(event)).join('\n')));
        expect(rows[0].label).toBe('Waiting for your review (1)');
        expect(rows[0].children.map(row => row.description)).toEqual(['high · assess 1m 48s · paused at review']);
    });

    it('still files the bug as paused when the log is malformed, just without times', () => {
        const rows = pane(runWorkspace('cart', 'not json at all'));
        expect(rows[0].children.map(row => row.description)).toEqual(['high · paused at review']);
    });

    it('files a bug with no run as it always has', () => {
        const root = workspaceWith(r => writeBug(r, { 'assessment.md': ASSESSMENT('2026-11-03') }));
        const rows = pane(root);
        expect(rows.map(group => String(group.label))).not.toContain('Waiting for your review (1)');
        expect(rows.find(group => String(group.label).startsWith('To fix'))?.children.map(row => row.description)).toEqual(['high · valid']);
    });

    it('ignores a run for a different bug', () => {
        const root = runWorkspace('other-bug', log.map(event => JSON.stringify(event)).join('\n'));
        writeBug(root, { 'assessment.md': ASSESSMENT('2026-11-03') }, 'cart');
        const cart = readBugReports(root).find(bug => bug.slug === 'cart');
        expect(cart?.engine).toBeUndefined();
        expect(cart?.state).toBe('to-fix');
    });
});
