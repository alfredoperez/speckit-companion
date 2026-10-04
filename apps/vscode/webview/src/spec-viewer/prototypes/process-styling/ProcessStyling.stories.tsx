/**
 * Three styling directions for the bug, analysis and idea pages, each drawn on
 * the same three documents so they can be compared like for like. Prototype
 * only: nothing the extension loads imports this folder.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import type { ComponentChildren } from 'preact';
import { AnalysisA, BugA, IdeaA } from './DirectionA';
import { AnalysisB, BugB, IdeaB } from './DirectionB';
import { AnalysisC, BugC, IdeaC } from './DirectionC';
import { readAnalysis, readBug, readIdea } from './model';
import '../processes/processes.css';
import './process-styling.css';

import bugAssessmentMd from '../../../../../tests/fixtures/bug-reports/.specify/bugs/cart-total-skips-first/assessment.md?raw';
import bugFixMd from '../../../../../tests/fixtures/bug-reports/.specify/bugs/cart-total-skips-first/fix.md?raw';
import analyzeMd from '../../__fixtures__/artifact-gallery/tiny-todo/printed/analyze.md?raw';
import decisionGoMd from '../processes/fixtures/decision-go.md?raw';

const meta: Meta = {
    title: 'VS Code Extension/Prototypes/Process styling',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Three visual directions for the bug story page, the analysis report and the idea decision. ' +
                    'Same documents, same header, rail and footer in each; only the page body changes. Nothing here is wired to the extension.',
            },
        },
    },
};
export default meta;
type Story = StoryObj;

const bug = readBug(bugAssessmentMd, bugFixMd);
const report = readAnalysis(analyzeMd);
const idea = readIdea(decisionGoMd);

const IDEAS = {
    A: ['Document', 'One reading column with the outline beside it, like a Spec or Plan page. The story is prose, the steps are a line down the margin, facts are a line of metadata.'],
    B: ['Record', 'Dense and IDE-native. Property rows, tables and hairlines, monospace for facts and paths, colour only where it is a state.'],
    C: ['Editorial', 'The state is the headline. Section labels sit in the margin, sections part by space instead of borders, and the one accent points at the next step.'],
} as const;

type Letter = keyof typeof IDEAS;

function Stage({ letter, page, children }: { letter: Letter; page: string; children: ComponentChildren }) {
    const [name, idea] = IDEAS[letter];
    return (
        <div class="ps-stage">
            <p class="ps-stage__caption">
                <strong>
                    {letter} · {name}, {page}.
                </strong>{' '}
                {idea}
            </p>
            <div class="ps-stage__body">{children}</div>
        </div>
    );
}

function story(letter: Letter, page: string, render: () => ComponentChildren): Story {
    return {
        name: `${letter} · ${IDEAS[letter][0]} — ${page}`,
        render: () => (
            <Stage letter={letter} page={page}>
                {render()}
            </Stage>
        ),
    };
}

function stack(letter: Letter, pages: Array<[string, () => ComponentChildren]>): Story {
    return {
        name: `${letter} · ${IDEAS[letter][0]} — All three`,
        render: () => (
            <div class="ps-stack">
                {pages.map(([page, render]) => (
                    <Stage key={page} letter={letter} page={page}>
                        {render()}
                    </Stage>
                ))}
            </div>
        ),
    };
}

export const ADocumentBug = story('A', 'Bug', () => <BugA bug={bug} />);
export const ADocumentAnalysis = story('A', 'Analysis', () => <AnalysisA report={report} />);
export const ADocumentIdea = story('A', 'Idea', () => <IdeaA idea={idea} />);
export const ADocumentAll = stack('A', [
    ['Bug', () => <BugA bug={bug} />],
    ['Analysis', () => <AnalysisA report={report} />],
    ['Idea', () => <IdeaA idea={idea} />],
]);

export const BRecordBug = story('B', 'Bug', () => <BugB bug={bug} />);
export const BRecordAnalysis = story('B', 'Analysis', () => <AnalysisB report={report} />);
export const BRecordIdea = story('B', 'Idea', () => <IdeaB idea={idea} />);
export const BRecordAll = stack('B', [
    ['Bug', () => <BugB bug={bug} />],
    ['Analysis', () => <AnalysisB report={report} />],
    ['Idea', () => <IdeaB idea={idea} />],
]);

export const CEditorialBug = story('C', 'Bug', () => <BugC bug={bug} />);
export const CEditorialAnalysis = story('C', 'Analysis', () => <AnalysisC report={report} />);
export const CEditorialIdea = story('C', 'Idea', () => <IdeaC idea={idea} />);
export const CEditorialAll = stack('C', [
    ['Bug', () => <BugC bug={bug} />],
    ['Analysis', () => <AnalysisC report={report} />],
    ['Idea', () => <IdeaC idea={idea} />],
]);
