import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { ideasPaneConfig } from '../ideasPane';
import { IDEA_SET, IdeaReport, readIdeaReport } from '../ideaReports';

const FIXTURE_ROOT = path.resolve(__dirname, '../../../../tests/fixtures/idea-reports');

const bySlug = (slug: string): IdeaReport => ideasPaneConfig.read(FIXTURE_ROOT).find(idea => idea.slug === slug)!;

const tint = (idea: IdeaReport): string | undefined => (ideasPaneConfig.icon(idea).color as vscode.ThemeColor | undefined)?.id;

function ideaWithDecision(decision: string): IdeaReport {
    const directory = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'idea-pane-')), '.specify', 'assessments', 'made-up');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'decision.md'), decision);
    return readIdeaReport(directory)!;
}

describe('Ideas pane', () => {
    beforeEach(() => {
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((_key: string, fallback?: unknown) => fallback),
        });
    });

    describe('grouping', () => {
        it('lists Assessing before Decided', () => {
            expect(ideasPaneConfig.groups.map(group => [group.id, group.label])).toEqual([
                ['assessing', 'Assessing'],
                ['decided', 'Decided'],
            ]);
        });

        it('reads the ideas of the assessments folder', () => {
            expect(ideasPaneConfig.set).toBe(IDEA_SET);
            expect(ideasPaneConfig.read(FIXTURE_ROOT).map(idea => idea.slug)).toEqual([
                'guest-links',
                'member-badges',
                'offline-mode',
                'shared-lists',
            ]);
        });

        it('puts an idea with no decision under Assessing', () => {
            expect(ideasPaneConfig.groupOf(bySlug('offline-mode'))).toBe('assessing');
        });

        it('puts an idea with a decision under Decided, however many stages it skipped', () => {
            expect(ideasPaneConfig.groupOf(bySlug('shared-lists'))).toBe('decided');
            expect(ideasPaneConfig.groupOf(bySlug('member-badges'))).toBe('decided');
            expect(ideasPaneConfig.groupOf(bySlug('guest-links'))).toBe('decided');
        });
    });

    describe('the text beside an idea', () => {
        it('names the last stage written for an idea still being assessed', () => {
            expect(ideasPaneConfig.describe(bySlug('offline-mode'))).toBe('research');
        });

        it('names the verdict for a decided idea', () => {
            expect(ideasPaneConfig.describe(bySlug('member-badges'))).toBe('go');
            expect(ideasPaneConfig.describe(bySlug('shared-lists'))).toBe('kill');
        });

        it('reads a verdict whatever its letter case', () => {
            expect(ideasPaneConfig.describe(bySlug('guest-links'))).toBe('needs-clarification');
        });

        it('shows nothing for a verdict it does not recognise', () => {
            const idea = ideaWithDecision('# Decision: Made up\n\n- **Verdict**: <b>ship it</b>\n');

            expect(ideasPaneConfig.groupOf(idea)).toBe('decided');
            expect(ideasPaneConfig.describe(idea)).toBeUndefined();
        });

        it('shows nothing when the decision states no verdict', () => {
            expect(ideasPaneConfig.describe(ideaWithDecision('# Decision: Made up\n'))).toBeUndefined();
        });
    });

    describe('the icon', () => {
        it('is a lightbulb for every idea', () => {
            for (const idea of ideasPaneConfig.read(FIXTURE_ROOT)) {
                expect(ideasPaneConfig.icon(idea).id).toBe('lightbulb');
            }
        });

        it('tints the three verdicts and the assessing state differently', () => {
            const tints = ['member-badges', 'guest-links', 'shared-lists', 'offline-mode'].map(slug => tint(bySlug(slug)));

            expect(tints.every(Boolean)).toBe(true);
            expect(new Set(tints).size).toBe(4);
        });

        it('leaves a decided idea with no known verdict untinted', () => {
            expect(tint(ideaWithDecision('# Decision: Made up\n\n- **Verdict**: maybe\n'))).toBeUndefined();
        });
    });

    describe('the labels', () => {
        it('names the pane and the extension that produces ideas', () => {
            expect(ideasPaneConfig.name).toBe('Ideas');
            expect(ideasPaneConfig.extensionId).toBe('assess');
            expect(ideasPaneConfig.installLabel).toBe("Install Spec Kit's assess extension");
        });

        it('says how to start an idea when there are none', () => {
            expect(ideasPaneConfig.emptyLabel()).toBe('No ideas yet. Start one with /speckit-assess-intake.');
        });

        it('writes the command the way the chosen format writes it', () => {
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
                get: jest.fn((key: string, fallback?: unknown) => (key === 'commandFormat' ? 'dot' : fallback)),
            });

            expect(ideasPaneConfig.emptyLabel()).toBe('No ideas yet. Start one with /speckit.assess.intake.');
        });
    });
});
