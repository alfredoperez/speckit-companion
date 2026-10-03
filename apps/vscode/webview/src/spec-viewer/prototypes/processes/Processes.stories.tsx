/**
 * Design prototypes for Spec Kit's three processes (specs, bugs, ideas) in the
 * sidebar and the viewer. Nothing here ships: each story asks one decision,
 * stated in the caption above its canvas. Sidebar frames reuse the sidebar
 * recreation, reports reuse the artifact gallery's renderers and fixtures.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import type { ComponentChildren } from 'preact';
import { SidebarShell, SIDEBAR_WIDTH, type SidebarPane, type SidebarRow } from '../../__stories__/sidebarTree';
import { livingSpecsPane, specsPane, steeringPane } from '../../__stories__/SidebarCapture.stories';
import * as recipes from '../artifact-gallery/recipes';
import { parseDoc, parseTable } from '../artifact-gallery/parse';
import { CreateProcessMock } from './CreateProcessMock';
import { Stage, type ShellFooter } from './ProcessShell';
import { BugViewer, IdeaViewer, SpecReportViewer, type SpecReport } from './ProcessViewers';
import {
    BUGS,
    IDEAS,
    archivedGroup,
    bugGroups,
    bugsFlat,
    deepen,
    ideaGroups,
    ideasFlat,
    manyBugs,
    manyIdeas,
    manySpecs,
    section,
    type RowOptions,
} from './sidebarRows';
import '../../../../styles/spec-editor.css';
import '../artifact-gallery/artifact-gallery.css';
import './processes.css';

import bugAssessmentMd from '../../../../../tests/fixtures/bug-reports/.specify/bugs/cart-total-skips-first/assessment.md?raw';
import bugFixMd from '../../../../../tests/fixtures/bug-reports/.specify/bugs/cart-total-skips-first/fix.md?raw';
import bugTestMd from '../../../../../tests/fixtures/bug-reports/.specify/bugs/cart-total-skips-first/test.md?raw';
import intakeMd from '../../__fixtures__/artifact-gallery/tiny-todo/.specify/assessments/shared-lists/intake.md?raw';
import ideaResearchMd from '../../__fixtures__/artifact-gallery/tiny-todo/.specify/assessments/shared-lists/research.md?raw';
import problemMd from '../../__fixtures__/artifact-gallery/tiny-todo/.specify/assessments/shared-lists/problem.md?raw';
import conceptMd from '../../__fixtures__/artifact-gallery/tiny-todo/.specify/assessments/shared-lists/concept.md?raw';
import decisionKillMd from '../../__fixtures__/artifact-gallery/tiny-todo/.specify/assessments/shared-lists/decision.md?raw';
import decisionGoMd from './fixtures/decision-go.md?raw';
import decisionClarifyMd from './fixtures/decision-needs-clarification.md?raw';
import specMd from '../../__fixtures__/artifact-gallery/tiny-todo/specs/001-dark-mode-toggle/spec.md?raw';
import planMd from '../../__fixtures__/artifact-gallery/tiny-todo/specs/001-dark-mode-toggle/plan.md?raw';
import tasksMd from '../../__fixtures__/artifact-gallery/tiny-todo/specs/001-dark-mode-toggle/tasks.md?raw';
import analyzeMd from '../../__fixtures__/artifact-gallery/tiny-todo/printed/analyze.md?raw';
import convergeMd from '../../__fixtures__/artifact-gallery/tiny-todo/printed/converge.md?raw';

const meta: Meta = {
    title: 'VS Code Extension/Prototypes/Processes',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Prototypes for showing Spec Kit\'s three processes side by side: specs, bugs and ideas. ' +
                    'Three sidebar layouts to choose from, the create screens for a bug and an idea, the bug and idea viewers, ' +
                    'and the analyze and converge reports as a tab on a spec. Nothing here is wired to the extension.',
            },
        },
    },
};
export default meta;
type Story = StoryObj;

function story(name: string, caption: string, kind: 'viewer' | 'sidebar', render: () => ComponentChildren): Story {
    return {
        name,
        parameters: { docs: { description: { story: caption } } },
        render: () => (
            <Stage caption={caption} kind={kind}>
                {render()}
            </Stage>
        ),
    };
}

// ── Sidebars ──────────────────────────────────────────────────────────────

/** Paints a "+" at the right edge of the named rows, where VS Code puts a row's inline action. */
function RowPlus({ ids }: { ids: string[] }) {
    if (!ids.length) return null;
    const rows = ids.map((id) => `.sk-sidebar #row-${id}`);
    const css =
        `${rows.join(', ')} { padding-right: 30px; }\n` +
        `${rows.map((r) => `${r}::after`).join(', ')} { content: '\\ea60'; position: absolute; top: 0; right: 8px; ` +
        `font: normal normal normal 16px/22px codicon; color: var(--vscode-icon-foreground); }`;
    return <style>{css}</style>;
}

function Sidebar({ panes, height, label, plus = [], even }: { panes: SidebarPane[]; height: number; label?: string; plus?: string[]; even?: boolean }) {
    return (
        <div class={`pp-sidebar${even ? ' pp-sidebar--even' : ''}`}>
            {label && <p class="pp-sidebar__label">{label}</p>}
            <div class="pp-sidebar__box" style={`width: ${SIDEBAR_WIDTH}px; height: ${height}px`}>
                <SidebarShell panes={panes} />
            </div>
            <RowPlus ids={plus} />
        </div>
    );
}

const collapsed = (pane: SidebarPane): SidebarPane => ({ ...pane, collapsed: true });
const restPanes = (): SidebarPane[] => [collapsed(livingSpecsPane()), collapsed(steeringPane())];

/** Today's spec rows, with the spec that came from an idea saying so. */
function specRows(relation: RowOptions['relation'] = 'none'): SidebarRow[] {
    const rows = specsPane(false).rows.flatMap((row): SidebarRow[] => {
        if (row.id !== '042-member-status-badges') return [row];
        if (relation === 'suffix') return [{ ...row, description: 'from idea · 2h ago' }];
        if (relation === 'child') {
            return [
                { ...row, twistie: 'expanded' },
                { id: '042-doc-specification', depth: 2, label: 'Specification', icon: 'pass', tone: 'passed' },
                { id: '042-doc-plan', depth: 2, label: 'Plan', icon: 'pass', tone: 'passed' },
                { id: '042-doc-tasks', depth: 2, label: 'Tasks', icon: 'circle-filled', tone: 'blue' },
                { id: '042-idea', depth: 2, label: 'Member status badges', description: 'idea', icon: 'link' },
            ];
        }
        return [row];
    });
    return [...rows, archivedGroup(4)];
}

const PANE_TOOLBAR = ['refresh', 'filter', 'plus'];

function panesA(specs: SidebarRow[], specCount: number, bugs = BUGS, ideas = IDEAS, options: RowOptions = { relation: 'suffix' }): SidebarPane[] {
    return [
        {
            id: 'specs',
            title: 'Specs',
            fill: true,
            actions: ['refresh', 'filter', 'collapse-all'],
            rows: [
                section('sec-specs', 'Specs', 'beaker', specCount),
                ...deepen(specs),
                section('sec-bugs', 'Bugs', 'bug', bugs.length),
                ...bugGroups(bugs, 1, options),
                section('sec-ideas', 'Ideas', 'lightbulb', ideas.length),
                ...ideaGroups(ideas, 1, options),
            ],
        },
        ...restPanes(),
    ];
}

function panesB(specs: SidebarRow[], bugs = BUGS, ideas = IDEAS, options: RowOptions = { relation: 'suffix' }): SidebarPane[] {
    return [
        { ...specsPane(false, false), rows: specs },
        { id: 'bugs', title: 'Bugs', actions: PANE_TOOLBAR, rows: bugGroups(bugs, 0, options) },
        { id: 'ideas', title: 'Ideas', actions: PANE_TOOLBAR, rows: ideaGroups(ideas, 0, options), fill: true },
        ...restPanes(),
    ];
}

function panesC(specs: SidebarRow[], bugs = BUGS, ideas = IDEAS, options: RowOptions = { relation: 'suffix' }): SidebarPane[] {
    return [
        {
            ...specsPane(false),
            rows: [
                ...specs,
                { id: 'group-bugs', depth: 0, label: `Bugs (${bugs.length})`, icon: 'bug', twistie: 'expanded' },
                ...bugsFlat(bugs, 1, options),
                { id: 'group-ideas', depth: 0, label: `Ideas (${ideas.length})`, icon: 'lightbulb', twistie: 'expanded' },
                ...ideasFlat(ideas, 1, options),
            ],
        },
        ...restPanes(),
    ];
}

const PLUS_A = ['sec-specs', 'sec-bugs', 'sec-ideas'];
const PLUS_C = ['group-bugs', 'group-ideas'];

export const SidebarAThreeSections = story(
    'Sidebar A · Three sections in one view',
    'Should Specs, Bugs and Ideas be three top-level sections inside the one Specs view, each with its own count and its own "+" on the row? VS Code paints a row\'s "+" on hover or focus only; it is shown on all three here so they can be compared.',
    'sidebar',
    () => <Sidebar panes={panesA(specRows('suffix'), 9)} height={780} plus={PLUS_A} />,
);

export const SidebarBThreePanes = story(
    'Sidebar B · Three panes',
    'Should Bugs and Ideas be panes of their own beside Specs, each with its own toolbar ("+" and filter) and each collapsible on its own? This is the layout where every process creates its own thing from its own header.',
    'sidebar',
    () => <Sidebar panes={panesB(specRows('suffix'))} height={740} />,
);

export const SidebarBNotInstalled = story(
    'Sidebar B · Extensions not installed',
    'When Spec Kit\'s bug or assess extension is missing, should its pane stay visible with a single install row, or should the pane be hidden until the extension is there?',
    'sidebar',
    () => (
        <Sidebar
            panes={[
                { ...specsPane(false, false), rows: specRows() },
                { id: 'bugs', title: 'Bugs', rows: [{ id: 'bugs-install', depth: 0, label: "Install Spec Kit's bug extension", icon: 'cloud-download' }] },
                {
                    id: 'ideas',
                    title: 'Ideas',
                    fill: true,
                    rows: [{ id: 'ideas-install', depth: 0, label: "Install Spec Kit's assess extension", icon: 'cloud-download' }],
                },
                ...restPanes(),
            ]}
            height={460}
        />
    ),
);

export const SidebarCTodayExtended = story(
    'Sidebar C · Today\'s layout extended',
    'Is the smallest change enough: today\'s single Specs tree with a Bugs group and an Ideas group after Archived, each group header carrying a "+"? Shown for comparison with A and B.',
    'sidebar',
    () => <Sidebar panes={panesC(specRows('suffix'))} height={620} plus={PLUS_C} />,
);

export const RelationshipRows = story(
    'Relationship rows',
    'How should a row say what it is related to: a few words at the end of its description (left), or a link row under it when expanded (right)? Shown on an idea that became spec 042, on that spec, and on two bug fixes that belong to a spec\'s area.',
    'sidebar',
    () => (
        <div class="pp-sidebars">
            <Sidebar label="In the description" panes={panesB(specRows('suffix'), BUGS, IDEAS, { relation: 'suffix' })} height={1010} />
            <Sidebar label="As a child row" panes={panesB(specRows('child'), BUGS, IDEAS, { relation: 'child' })} height={1010} />
        </div>
    ),
);

// ── Create screens ────────────────────────────────────────────────────────

export const NewBug = story(
    'New bug',
    'Is this the right set of inputs to start a bug: the symptom, an optional link or error, a slug you can edit, and the assistant it goes to, with one button that only assesses?',
    'viewer',
    () => (
        <CreateProcessMock
            heading="New Bug"
            intro="Describe what is going wrong. The assistant reads the code and writes an assessment before anything is changed."
            mainLabel="Symptom"
            mainPlaceholder="What happens, what you expected, and how to make it happen."
            mainValue="cartTotal in src/cart.js returns the wrong total: for [{price:5,qty:2},{price:3,qty:1}] it returns 3 instead of 13. The first item seems to be skipped."
            extraLabel="Link or pasted error"
            extraPlaceholder="An issue URL, a stack trace, or the failing output."
            extraValue={'$ node -e \'const {cartTotal}=require("./src/cart.js");console.log(cartTotal([{price:5,qty:2},{price:3,qty:1}]))\'\n3'}
            slugRoot=".specify/bugs/"
            slug="cart-total-skips-first"
            next="What happens next: the assistant runs /speckit-bug-assess and writes assessment.md with a verdict, a severity and the root cause. Fix and Test come after, from the bug's own page."
            submitLabel="Assess bug"
        />
    ),
);

export const NewIdea = story(
    'New idea',
    'Is this the right set of inputs to start an idea: the idea in a sentence or two, who it is for, a slug and an assistant, with one button that starts the assessment?',
    'viewer',
    () => (
        <CreateProcessMock
            heading="New Idea"
            intro="Write the idea down, however rough. The assistant assesses it before anyone specs or builds it."
            mainLabel="The idea"
            mainPlaceholder="A sentence or two. What would exist that does not exist today?"
            mainValue="Let two people share one todo list in this tiny browser todo app."
            extraLabel="Who it is for"
            extraPlaceholder="Who asked for it, or who would use it."
            slugRoot=".specify/assessments/"
            slug="shared-lists"
            next="What happens next: the assistant runs /speckit-assess-intake. The idea then moves through five stages (Intake, Research, Problem, Concept, Decision) and ends in go, needs-clarification or kill."
            submitLabel="Assess idea"
        />
    ),
);

// ── Bug viewer ────────────────────────────────────────────────────────────

export const BugAssessed = story(
    'Bug at a glance · Assessed',
    'Should a bug open on one screen that tells its story (symptom, root cause, what changed, how it was verified), with the footer offering only the next step? Here only the assessment exists, so the next step is Fix bug.',
    'viewer',
    () => <BugViewer docs={{ assessment: bugAssessmentMd }} />,
);

export const BugFixed = story(
    'Bug at a glance · Fixed',
    'Same screen once fix.md exists: the third card fills in and the footer moves on to Test fix. Is reading the state from the files, with no run record, enough?',
    'viewer',
    () => <BugViewer docs={{ assessment: bugAssessmentMd, fix: bugFixMd }} />,
);

export const BugVerified = story(
    'Bug at a glance · Verified',
    'A verified bug: all four cards filled, residual risks under them, and no primary button left. Is "nothing more to do" the right end state for the footer?',
    'viewer',
    () => <BugViewer docs={{ assessment: bugAssessmentMd, fix: bugFixMd, test: bugTestMd }} />,
);

export const BugReportTab = story(
    'Bug report tab · Assessment',
    'Should each report stay one click away as its own tab, drawn with the gallery\'s proposed look? Compare this with the at-a-glance stories: is the landing view worth having on top of the three reports?',
    'viewer',
    () => <BugViewer docs={{ assessment: bugAssessmentMd, fix: bugFixMd, test: bugTestMd }} initial="assessment" />,
);

// ── Idea viewer ───────────────────────────────────────────────────────────

export const IdeaGo = story(
    'Idea decision · Go',
    'Should a "go" idea end on its decision with one primary button, Create spec from this idea, that carries the handoff into Create Spec? The decision text here is written from the command\'s template, not a real run; only the Decision tab opens.',
    'viewer',
    () => <IdeaViewer docs={{ decision: decisionGoMd }} />,
);

export const IdeaNeedsClarification = story(
    'Idea decision · Needs clarification',
    'When the verdict is needs-clarification, should the footer offer Continue assessment, which re-runs the stage the decision names? The decision text here is written from the command\'s template, not a real run; only the Decision tab opens.',
    'viewer',
    () => <IdeaViewer docs={{ decision: decisionClarifyMd }} />,
);

export const IdeaKill = story(
    'Idea decision · Kill',
    'A killed idea from a real run, all five stages openable. Should a closed idea keep any action at all, or is the record enough?',
    'viewer',
    () => <IdeaViewer docs={{ intake: intakeMd, research: ideaResearchMd, problem: problemMd, concept: conceptMd, decision: decisionKillMd }} />,
);

// ── Reports on a spec ─────────────────────────────────────────────────────

const SPEC_DOCS = { spec: specMd, plan: planMd, tasks: tasksMd };

const analyzeFooter: ShellFooter = {
    context: 'Next: Implement',
    left: [
        { label: 'Regenerate', title: 'Re-run only the current step' },
        { label: 'Analyze', title: '/speckit-analyze: cross-check spec, plan, and tasks for consistency' },
        { label: 'Other actions' },
    ],
    right: [{ label: 'Implement', variant: 'primary' }],
};

const convergeFooter: ShellFooter = {
    context: 'Next: Mark Completed',
    left: [{ label: 'Converge', title: '/speckit-converge: check the code against spec, plan and tasks' }],
    right: [{ label: 'Archive' }, { label: 'Mark Completed', variant: 'primary' }],
};

function rowCount(md: string, heading: RegExp): number {
    const found = parseDoc(md).sections.find((s) => heading.test(s.heading));
    return (found && parseTable(found.body)?.rows.length) || 0;
}

const analysisReport: SpecReport = {
    id: 'analysis',
    label: 'Analysis',
    icon: 'search',
    md: analyzeMd,
    recipe: recipes.analyze,
    result: `${rowCount(analyzeMd, /Analysis Report/i)} findings`,
    origin: 'Saved as specs/001-dark-mode-toggle/analysis.md, because Analyze was started from Companion.',
};

const convergenceReport: SpecReport = {
    id: 'convergence',
    label: 'Converge',
    icon: 'git-compare',
    md: convergeMd,
    recipe: recipes.converge,
    result: `${rowCount(convergeMd, /Convergence Findings/i)} gaps`,
    origin: 'Saved as specs/001-dark-mode-toggle/convergence.md, because Converge was started from Companion.',
};

export const AnalyzeAction = story(
    'Analyze · The action on the Tasks tab',
    'Should Analyze be a button of its own in the footer next to Regenerate, instead of an entry inside Other actions? Running it from here is what saves the report and adds the Analysis tab under Reports.',
    'viewer',
    () => <SpecReportViewer docs={SPEC_DOCS} report={analysisReport} initial="tasks" footer={analyzeFooter} />,
);

export const AnalyzeReport = story(
    'Analyze · The report as a tab',
    'Should the analyze report be a tab after Tasks, in a Reports group so it does not read as a pipeline step, showing its findings count on the rail?',
    'viewer',
    () => <SpecReportViewer docs={SPEC_DOCS} report={analysisReport} initial="analysis" footer={analyzeFooter} />,
);

export const ConvergeReport = story(
    'Converge · The report as a tab',
    'Should the converge report sit in the same Reports group as Analysis, with Converge as a footer button once the spec is implemented?',
    'viewer',
    () => <SpecReportViewer docs={SPEC_DOCS} report={convergenceReport} initial="convergence" footer={convergeFooter} />,
);

// ── Many items ────────────────────────────────────────────────────────────

export const SidebarsAtScale = story(
    'Sidebars at scale · 40 specs, 12 bugs, 6 ideas',
    'Which layout still lets you reach a bug or an idea when the project has 40 specs? Same items in all three, everything expanded, at the height of a laptop screen.',
    'sidebar',
    () => (
        <div class="pp-sidebars">
            <Sidebar label="A · Three sections" panes={panesA(manySpecs(), 40, manyBugs(), manyIdeas())} height={860} plus={PLUS_A} />
            <Sidebar label="B · Three panes" panes={panesB(manySpecs(), manyBugs(), manyIdeas())} height={860} even />
            <Sidebar label="C · Today extended" panes={panesC(manySpecs(), manyBugs(), manyIdeas())} height={860} plus={PLUS_C} />
        </div>
    ),
);
