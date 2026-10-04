/**
 * The bug story page and the idea decision page, one story per state. Each
 * mounts the real App with the nav state the extension would send: the page
 * model comes from the production builders run over fixture reports, and the
 * footer actions from the production action rules. The rail switches documents
 * the way the extension answers `stepperClick` / `switchDocument`.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import { useEffect, useState } from 'preact/hooks';
import { App } from '../App';
import { navState, viewerState, markdownHtml, historyEntries, viewerMode } from '../signals';
import { renderMarkdown, setCurrentTask, setHasSpecContext, setLivingMode, setReportMode, setTaskSummaries } from '../markdown';
import { setupAnswerActions } from '../editor/answerEditor';
import { applyHighlighting } from '../highlighting';
import { buildToc } from '../toc';
import { mockNavState } from '../components/__stories__/mockData';
import type { NavState, SpecDocument } from '../types';
import { buildBugStory } from '../../../../src/features/reports/bugStory';
import { buildIdeaDecision } from '../../../../src/features/reports/ideaDecision';
import { knownValue, parseReportHeader } from '../../../../src/features/reports/reportValues';
import type { ReportNav } from '../../../../src/features/reports/reportPageModel';
import { BUG_FIX_STATUSES, BUG_TEST_RESULTS, BUG_VERDICTS } from '../../../../src/features/bugs/bugValues';
import { IDEA_STAGES, IDEA_VERDICTS } from '../../../../src/features/ideas/ideaValues';
import { bugActions, ideaActions, type ReportAction } from '../../../../src/features/processes/processActions';

import cartAssessment from '../../../../tests/fixtures/bug-reports/.specify/bugs/cart-total-skips-first/assessment.md?raw';
import cartFix from '../../../../tests/fixtures/bug-reports/.specify/bugs/cart-total-skips-first/fix.md?raw';
import cartTest from '../../../../tests/fixtures/bug-reports/.specify/bugs/cart-total-skips-first/test.md?raw';
import slugAssessment from '../../../../tests/fixtures/bug-reports/.specify/bugs/slug-keeps-spaces/assessment.md?raw';
import discountAssessment from '../../../../tests/fixtures/report-pages/.specify/bugs/discount-applied-twice/assessment.md?raw';
import discountFix from '../../../../tests/fixtures/report-pages/.specify/bugs/discount-applied-twice/fix.md?raw';
import discountTest from '../../../../tests/fixtures/report-pages/.specify/bugs/discount-applied-twice/test.md?raw';
import exportAssessment from '../../../../tests/fixtures/report-pages/.specify/bugs/export-drops-header/assessment.md?raw';
import offlineIntake from '../../../../tests/fixtures/idea-reports/.specify/assessments/offline-mode/intake.md?raw';
import offlineResearch from '../../../../tests/fixtures/idea-reports/.specify/assessments/offline-mode/research.md?raw';
import filtersIntake from '../../../../tests/fixtures/report-pages/.specify/assessments/saved-filters/intake.md?raw';
import filtersResearch from '../../../../tests/fixtures/report-pages/.specify/assessments/saved-filters/research.md?raw';
import filtersProblem from '../../../../tests/fixtures/report-pages/.specify/assessments/saved-filters/problem.md?raw';
import filtersConcept from '../../../../tests/fixtures/report-pages/.specify/assessments/saved-filters/concept.md?raw';
import filtersDecision from '../../../../tests/fixtures/report-pages/.specify/assessments/saved-filters/decision.md?raw';
import archiveIntake from '../../../../tests/fixtures/report-pages/.specify/assessments/bulk-archive/intake.md?raw';
import archiveResearch from '../../../../tests/fixtures/report-pages/.specify/assessments/bulk-archive/research.md?raw';
import archiveDecision from '../../../../tests/fixtures/report-pages/.specify/assessments/bulk-archive/decision.md?raw';
import listsIntake from '../../../../tests/fixtures/idea-reports/.specify/assessments/shared-lists/intake.md?raw';
import listsResearch from '../../../../tests/fixtures/idea-reports/.specify/assessments/shared-lists/research.md?raw';
import listsProblem from '../../../../tests/fixtures/idea-reports/.specify/assessments/shared-lists/problem.md?raw';
import listsConcept from '../../../../tests/fixtures/idea-reports/.specify/assessments/shared-lists/concept.md?raw';
import listsDecision from '../../../../tests/fixtures/idea-reports/.specify/assessments/shared-lists/decision.md?raw';

export interface ReportFixture {
    set: 'bugs' | 'ideas';
    slug: string;
    texts: Record<string, string | undefined>;
}

interface SetShape {
    dir: string;
    kinds: readonly string[];
    labels: Record<string, string>;
    titlePrefixes: Record<string, string>;
    fallbackBadge: string;
    overview?: { type: string; label: string };
}

// Mirrors BUG_SET and IDEA_SET, whose modules load `fs` and `path` and cannot run in a browser.
const SETS: Record<ReportFixture['set'], SetShape> = {
    bugs: {
        dir: '.specify/bugs',
        kinds: ['assessment', 'fix', 'test'],
        labels: { assessment: 'Assessment', fix: 'Fix', test: 'Test' },
        titlePrefixes: { assessment: 'Bug Assessment:', fix: 'Bug Fix:', test: 'Bug Verification:' },
        fallbackBadge: 'BUG',
        overview: { type: 'story', label: 'Story' },
    },
    ideas: {
        dir: '.specify/assessments',
        kinds: IDEA_STAGES,
        labels: { intake: 'Intake', research: 'Research', problem: 'Problem', concept: 'Concept', decision: 'Decision' },
        titlePrefixes: {
            intake: 'Idea Intake:',
            research: 'Idea Research:',
            problem: 'Problem Definition:',
            concept: 'Concept:',
            decision: 'Decision:',
        },
        fallbackBadge: 'IDEA',
    },
};

interface Panel {
    title: string;
    badge?: string;
    actions: ReportAction[];
    kind: ReportNav['kind'];
    defaultDocument: string;
    pageDocument: string;
    page?: ReportNav['page'];
}

function readPanel(fixture: ReportFixture): Panel {
    const set = SETS[fixture.set];
    const stages = set.kinds.filter(kind => fixture.texts[kind] !== undefined);
    const fields: Record<string, Map<string, string>> = {};
    let title: string | undefined;
    for (const kind of stages) {
        const header = parseReportHeader(fixture.texts[kind] ?? '');
        fields[kind] = header.fields;
        const prefix = set.titlePrefixes[kind];
        if (!title && header.title?.startsWith(prefix)) title = header.title.slice(prefix.length).trim() || undefined;
    }
    title ??= fixture.slug;

    if (fixture.set === 'bugs') {
        const verdict = knownValue(BUG_VERDICTS, fields.assessment?.get('verdict'));
        const fixStatus = knownValue(BUG_FIX_STATUSES, fields.fix?.get('status'));
        const testResult = knownValue(BUG_TEST_RESULTS, fields.test?.get('result'));
        const bugStages = stages as Parameters<typeof bugActions>[0]['stages'];
        const state = verdict === 'invalid' ? 'closed'
            : stages.includes('test') ? (testResult === 'verified' ? 'verified' : 'to-fix')
            : stages.includes('fix') && fixStatus !== 'not-applied' ? 'to-test'
            : 'to-fix';
        const actions = bugActions({ state, stages: bugStages });
        const page = buildBugStory(
            { assessment: fixture.texts.assessment, fix: fixture.texts.fix, test: fixture.texts.test },
            actions.find(action => action.primary)?.label,
        );
        return {
            title,
            badge: testResult ?? fixStatus ?? verdict,
            actions,
            kind: 'bug',
            defaultDocument: page ? 'story' : stages[0] ?? 'assessment',
            pageDocument: 'story',
            page,
        };
    }

    const latestStage = stages[stages.length - 1] as Parameters<typeof ideaActions>[0]['latestStage'];
    const verdict = knownValue(IDEA_VERDICTS, fields.decision?.get('verdict'));
    const decision = fixture.texts.decision;
    return {
        title,
        badge: verdict,
        actions: ideaActions({ state: stages.includes('decision') ? 'decided' : 'assessing', latestStage, verdict }),
        kind: 'idea',
        defaultDocument: latestStage,
        pageDocument: 'decision',
        page: decision ? buildIdeaDecision(decision) : undefined,
    };
}

function documentsOf(fixture: ReportFixture): SpecDocument[] {
    const set = SETS[fixture.set];
    const overview: SpecDocument[] = set.overview
        ? [{ type: set.overview.type, label: set.overview.label, fileName: '', filePath: '', exists: true, isCore: true, category: 'core' }]
        : [];
    return overview.concat(set.kinds.map(kind => ({
        type: kind,
        label: set.labels[kind],
        fileName: `${kind}.md`,
        filePath: `/workspace/${set.dir}/${fixture.slug}/${kind}.md`,
        exists: fixture.texts[kind] !== undefined,
        isCore: true,
        category: 'core',
    })));
}

function hostState(fixture: ReportFixture, documentType: string): { nav: NavState; content: string } {
    const panel = readPanel(fixture);
    const documents = documentsOf(fixture);
    const reports = documents.filter(d => d.filePath);
    const wanted = documents.find(d => d.type === documentType);
    const doc = wanted && (wanted.filePath || panel.page) ? wanted : reports[0];
    const page = doc.type === panel.pageDocument ? panel.page : undefined;
    const nav = mockNavState({
        coreDocs: documents,
        relatedDocs: [],
        currentDoc: doc.type,
        workflowPhase: doc.type,
        taskCompletionPercent: 0,
        isViewingRelatedDoc: false,
        specStatus: 'active',
        activeStep: null,
        currentStep: null,
        stepHistory: {},
        badgeText: panel.badge?.toUpperCase() ?? SETS[fixture.set].fallbackBadge,
        createdDate: null,
        lastUpdatedDate: null,
        specContextName: panel.title,
        titleFromHeading: true,
        branch: null,
        filePath: doc.filePath,
        docTypeLabel: doc.type.charAt(0).toUpperCase() + doc.type.slice(1),
        activityPanelEnabled: false,
        landing: 'document',
        ...(panel.actions.length > 0 ? { reportActions: panel.actions } : {}),
        report: { kind: panel.kind, page },
    });
    return { nav, content: (doc.exists && fixture.texts[doc.type]) || '' };
}

export function ReportViewer({ fixture, initialDocument }: { fixture: ReportFixture; initialDocument?: string }) {
    const [doc, setDoc] = useState(() => initialDocument ?? readPanel(fixture).defaultDocument);
    const { nav, content } = hostState(fixture, doc);

    useEffect(() => {
        document.body.dataset.readOnly = 'true';
        setupAnswerActions();
        return () => {
            delete document.body.dataset.readOnly;
            setReportMode(false);
            viewerMode.value = null;
        };
    }, []);

    useEffect(() => {
        const host = window as unknown as { vscode: { postMessage: (msg: unknown) => void } };
        const original = host.vscode.postMessage;
        host.vscode.postMessage = (msg: unknown) => {
            const m = msg as { type?: string; phase?: string; documentType?: string };
            const target = m?.type === 'stepperClick' ? m.phase : m?.type === 'switchDocument' ? m.documentType : undefined;
            if (target && nav.coreDocs.some(d => d.type === target && d.exists)) {
                setDoc(target);
            } else {
                original(msg);
            }
        };
        return () => {
            host.vscode.postMessage = original;
        };
    }, [fixture, doc]);

    viewerMode.value = 'document';
    viewerState.value = null;
    historyEntries.value = [];
    setLivingMode(false);
    setReportMode(true);
    setHasSpecContext(true);
    setCurrentTask(null);
    setTaskSummaries(null);
    navState.value = nav;
    markdownHtml.value = renderMarkdown(content);

    useEffect(() => {
        if (nav.report?.page) return;
        const id = requestAnimationFrame(() => {
            applyHighlighting();
            buildToc(
                document.getElementById('content-area'),
                document.getElementById('markdown-content'),
                document.getElementById('spec-toc'),
            );
        });
        return () => cancelAnimationFrame(id);
    }, [content, nav.currentDoc]);

    return (
        <div class="viewer-container">
            <App specStatus="active" />
        </div>
    );
}

export const cartTotalSkipsFirst: ReportFixture = {
    set: 'bugs',
    slug: 'cart-total-skips-first',
    texts: { assessment: cartAssessment, fix: cartFix, test: cartTest },
};

const slugKeepsSpaces: ReportFixture = { set: 'bugs', slug: 'slug-keeps-spaces', texts: { assessment: slugAssessment } };

const cartFixedNotTested: ReportFixture = {
    set: 'bugs',
    slug: 'cart-total-skips-first',
    texts: { assessment: cartAssessment, fix: cartFix },
};

const discountAppliedTwice: ReportFixture = {
    set: 'bugs',
    slug: 'discount-applied-twice',
    texts: { assessment: discountAssessment, fix: discountFix, test: discountTest },
};

const exportDropsHeader: ReportFixture = { set: 'bugs', slug: 'export-drops-header', texts: { assessment: exportAssessment } };

const offlineMode: ReportFixture = {
    set: 'ideas',
    slug: 'offline-mode',
    texts: { intake: offlineIntake, research: offlineResearch },
};

const savedFilters: ReportFixture = {
    set: 'ideas',
    slug: 'saved-filters',
    texts: {
        intake: filtersIntake,
        research: filtersResearch,
        problem: filtersProblem,
        concept: filtersConcept,
        decision: filtersDecision,
    },
};

const bulkArchive: ReportFixture = {
    set: 'ideas',
    slug: 'bulk-archive',
    texts: { intake: archiveIntake, research: archiveResearch, decision: archiveDecision },
};

const sharedLists: ReportFixture = {
    set: 'ideas',
    slug: 'shared-lists',
    texts: {
        intake: listsIntake,
        research: listsResearch,
        problem: listsProblem,
        concept: listsConcept,
        decision: listsDecision,
    },
};

const meta: Meta = {
    title: 'VS Code Extension/Spec Viewer/Report pages',
    excludeStories: ['ReportViewer', 'cartTotalSkipsFirst'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'The bug story page and the idea decision page in every state, built from fixture reports ' +
                    'by the same code the extension runs. The rail still opens each raw report.',
            },
        },
    },
};
export default meta;
type Story = StoryObj;

export const BugAssessedOnly: Story = {
    name: 'Bug assessed only',
    render: () => <ReportViewer fixture={slugKeepsSpaces} />,
};

export const BugFixedNotTested: Story = {
    name: 'Bug fixed, not tested',
    render: () => <ReportViewer fixture={cartFixedNotTested} />,
};

export const BugVerified: Story = {
    name: 'Bug verified',
    render: () => <ReportViewer fixture={cartTotalSkipsFirst} />,
};

export const RawAssessmentWithOpenQuestions: Story = {
    name: 'Raw assessment with open questions',
    render: () => <ReportViewer fixture={cartTotalSkipsFirst} initialDocument="assessment" />,
};

export const BugTestFailed: Story = {
    name: 'Bug test failed',
    render: () => <ReportViewer fixture={discountAppliedTwice} />,
};

export const BugClosedInvalid: Story = {
    name: 'Bug closed as invalid',
    render: () => <ReportViewer fixture={exportDropsHeader} />,
};

export const IdeaAssessing: Story = {
    name: 'Idea assessing',
    render: () => <ReportViewer fixture={offlineMode} />,
};

export const IdeaGo: Story = {
    name: 'Idea go',
    render: () => <ReportViewer fixture={savedFilters} />,
};

export const IdeaNeedsClarification: Story = {
    name: 'Idea needs clarification',
    render: () => <ReportViewer fixture={bulkArchive} />,
};

export const IdeaKill: Story = {
    name: 'Idea kill',
    render: () => <ReportViewer fixture={sharedLists} />,
};
