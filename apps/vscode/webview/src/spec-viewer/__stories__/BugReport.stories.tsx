/**
 * A bug report open in the viewer: the real App, fed the report text one real
 * run of Spec Kit's bug commands wrote. No run record, so `viewerState` is null
 * and there is no Overview or run strip; the page is read-only, so no line or
 * comment affordance appears. The footer holds only the next steps the
 * extension computed from the reports. The rail switches between the reports
 * the way the extension answers `stepperClick` / `switchDocument`.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import { useEffect, useState } from 'preact/hooks';
import { App } from '../App';
import { navState, viewerState, markdownHtml, historyEntries, viewerMode } from '../signals';
import { renderMarkdown, setCurrentTask, setHasSpecContext, setLivingMode, setTaskSummaries } from '../markdown';
import { applyHighlighting } from '../highlighting';
import { buildToc } from '../toc';
import { mockDoc, mockNavState } from '../components/__stories__/mockData';
import type { DocSet } from './viewerHarness';
import type { NavState } from '../types';

import cartAssessment from '../../../../tests/fixtures/bug-reports/.specify/bugs/cart-total-skips-first/assessment.md?raw';
import cartFix from '../../../../tests/fixtures/bug-reports/.specify/bugs/cart-total-skips-first/fix.md?raw';
import cartTest from '../../../../tests/fixtures/bug-reports/.specify/bugs/cart-total-skips-first/test.md?raw';
import slugAssessment from '../../../../tests/fixtures/bug-reports/.specify/bugs/slug-keeps-spaces/assessment.md?raw';
import badgesIntake from '../../../../tests/fixtures/idea-reports/.specify/assessments/member-badges/intake.md?raw';
import badgesDecision from '../../../../tests/fixtures/idea-reports/.specify/assessments/member-badges/decision.md?raw';

interface BugFixture {
    slug: string;
    title: string;
    badge: string;
    docs: DocSet;
    actions?: NonNullable<NavState['reportActions']>;
    reports?: Array<[type: string, label: string]>;
    folder?: string;
}

const cartTotalSkipsFirst: BugFixture = {
    slug: 'cart-total-skips-first',
    title: 'cartTotal skips the first cart item',
    badge: 'VERIFIED',
    docs: {
        assessment: { md: cartAssessment, label: 'Assessment' },
        fix: { md: cartFix, label: 'Fix' },
        test: { md: cartTest, label: 'Test' },
    },
};

const slugKeepsSpaces: BugFixture = {
    slug: 'slug-keeps-spaces',
    title: 'toSlug only replaces the first space',
    badge: 'VALID',
    docs: {
        assessment: { md: slugAssessment, label: 'Assessment' },
    },
};

const REPORTS: Array<[type: string, label: string]> = [
    ['assessment', 'Assessment'],
    ['fix', 'Fix'],
    ['test', 'Test'],
];

const IDEA_STAGES: Array<[type: string, label: string]> = [
    ['intake', 'Intake'],
    ['research', 'Research'],
    ['problem', 'Problem'],
    ['concept', 'Concept'],
    ['decision', 'Decision'],
];

const waitingForFix: BugFixture = {
    ...slugKeepsSpaces,
    actions: [{ id: 'bug.fix', label: 'Fix bug', primary: true }],
};

const waitingForTest: BugFixture = {
    ...cartTotalSkipsFirst,
    badge: 'APPLIED',
    docs: { assessment: cartTotalSkipsFirst.docs.assessment, fix: cartTotalSkipsFirst.docs.fix },
    actions: [
        { id: 'bug.test', label: 'Test fix', primary: true },
        { id: 'bug.fix', label: 'Fix again', primary: false },
    ],
};

const verified: BugFixture = {
    ...cartTotalSkipsFirst,
    actions: [{ id: 'bug.test', label: 'Test again', primary: false }],
};

const ideaDecidedGo: BugFixture = {
    slug: 'member-badges',
    title: 'Member status badges',
    badge: 'GO',
    docs: {
        intake: { md: badgesIntake, label: 'Intake' },
        decision: { md: badgesDecision, label: 'Decision' },
    },
    actions: [{ id: 'idea.createSpec', label: 'Create spec from this idea', primary: true }],
    reports: IDEA_STAGES,
    folder: 'assessments',
};

function BugViewer({ bug }: { bug: BugFixture }) {
    const reports = bug.reports ?? REPORTS;
    const folder = bug.folder ?? 'bugs';
    const first = reports.find(([type]) => bug.docs[type])?.[0] ?? reports[0][0];
    const [doc, setDoc] = useState(first);

    useEffect(() => {
        document.body.dataset.readOnly = 'true';
        return () => {
            delete document.body.dataset.readOnly;
        };
    }, []);

    useEffect(() => {
        const host = window as unknown as { vscode: { postMessage: (msg: unknown) => void } };
        const original = host.vscode.postMessage;
        host.vscode.postMessage = (msg: unknown) => {
            const m = msg as { type?: string; phase?: string; documentType?: string };
            const target = m?.type === 'stepperClick' ? m.phase : m?.type === 'switchDocument' ? m.documentType : undefined;
            if (target && bug.docs[target]) {
                setDoc(target);
            } else {
                original(msg);
            }
        };
        return () => {
            host.vscode.postMessage = original;
        };
    }, [bug]);

    const active = bug.docs[doc] ?? bug.docs[first];
    const md = active.md;

    viewerMode.value = 'document';
    viewerState.value = null;
    historyEntries.value = [];
    setLivingMode(false);
    setHasSpecContext(true);
    setCurrentTask(null);
    setTaskSummaries(null);
    navState.value = mockNavState({
        coreDocs: reports.map(([type, label]) => ({
            ...mockDoc(type, !!bug.docs[type], label),
            filePath: `/workspace/.specify/${folder}/${bug.slug}/${type}.md`,
        })),
        relatedDocs: [],
        currentDoc: doc,
        workflowPhase: doc,
        taskCompletionPercent: 0,
        isViewingRelatedDoc: false,
        specStatus: 'active',
        activeStep: null,
        currentStep: null,
        stepHistory: undefined,
        badgeText: bug.badge,
        createdDate: null,
        specContextName: bug.title,
        titleFromHeading: true,
        branch: null,
        filePath: `/workspace/.specify/${folder}/${bug.slug}/${doc}.md`,
        docTypeLabel: active.label,
        activityPanelEnabled: false,
        landing: 'document',
        reportActions: bug.actions,
    });
    markdownHtml.value = renderMarkdown(md);

    useEffect(() => {
        const id = requestAnimationFrame(() => {
            applyHighlighting();
            buildToc(
                document.getElementById('content-area'),
                document.getElementById('markdown-content'),
                document.getElementById('spec-toc'),
            );
        });
        return () => cancelAnimationFrame(id);
    }, [md]);

    useEffect(
        () => () => {
            viewerMode.value = null;
        },
        [],
    );

    return (
        <div class="viewer-container">
            <App specStatus="active" />
        </div>
    );
}

const meta: Meta = {
    title: 'VS Code Extension/Spec Viewer/Bug report',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'A bug report from Spec Kit\'s bug commands, opened read-only in the real viewer with ' +
                    'Assessment, Fix and Test on the rail. The text is a real run\'s reports.',
            },
        },
    },
};
export default meta;
type Story = StoryObj;

export const AllReports: Story = {
    name: 'All reports',
    render: () => <BugViewer bug={cartTotalSkipsFirst} />,
};

export const AssessmentOnly: Story = {
    name: 'Assessment only',
    render: () => <BugViewer bug={slugKeepsSpaces} />,
};

export const WaitingForFix: Story = {
    name: 'Waiting for a fix',
    render: () => <BugViewer bug={waitingForFix} />,
};

export const WaitingForTest: Story = {
    name: 'Waiting for a test',
    render: () => <BugViewer bug={waitingForTest} />,
};

export const Verified: Story = {
    name: 'Verified',
    render: () => <BugViewer bug={verified} />,
};

export const IdeaDecidedGo: Story = {
    name: 'Idea decided go',
    render: () => <BugViewer bug={ideaDecidedGo} />,
};
