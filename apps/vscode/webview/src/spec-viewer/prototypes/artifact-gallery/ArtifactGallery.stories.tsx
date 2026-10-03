/**
 * One real artifact from every Spec Kit command, opened in the real viewer.
 * "Today" is the shipped rendering, untouched. "Proposed" is a prototype built
 * from the shared pieces in ./components, kept out of the shipped bundle.
 * Where each file came from is recorded in the fixture folder's README.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import { GalleryViewer, type GalleryArtifact, type RailDoc } from './galleryHarness';
import * as recipes from './recipes';
import type { Recipe } from './ArtifactView';
import './artifact-gallery.css';

import constitutionMd from '../../__fixtures__/artifact-gallery/tiny-todo/.specify/memory/constitution.md?raw';
import specMd from '../../__fixtures__/artifact-gallery/tiny-todo/specs/001-dark-mode-toggle/spec.md?raw';
import planMd from '../../__fixtures__/artifact-gallery/tiny-todo/specs/001-dark-mode-toggle/plan.md?raw';
import tasksMd from '../../__fixtures__/artifact-gallery/tiny-todo/specs/001-dark-mode-toggle/tasks.md?raw';
import researchMd from '../../__fixtures__/artifact-gallery/tiny-todo/specs/001-dark-mode-toggle/research.md?raw';
import dataModelMd from '../../__fixtures__/artifact-gallery/tiny-todo/specs/001-dark-mode-toggle/data-model.md?raw';
import quickstartMd from '../../__fixtures__/artifact-gallery/tiny-todo/specs/001-dark-mode-toggle/quickstart.md?raw';
import contractUiMd from '../../__fixtures__/artifact-gallery/tiny-todo/specs/001-dark-mode-toggle/contracts/toggle-ui.md?raw';
import contractApiMd from '../../__fixtures__/artifact-gallery/tiny-todo/specs/001-dark-mode-toggle/contracts/theme-store-api.md?raw';
import requirementsMd from '../../__fixtures__/artifact-gallery/tiny-todo/specs/001-dark-mode-toggle/checklists/requirements.md?raw';
import uxChecklistMd from '../../__fixtures__/artifact-gallery/tiny-todo/specs/001-dark-mode-toggle/checklists/ux.md?raw';
import analyzeMd from '../../__fixtures__/artifact-gallery/tiny-todo/printed/analyze.md?raw';
import convergeMd from '../../__fixtures__/artifact-gallery/tiny-todo/printed/converge.md?raw';
import issuesMd from '../../__fixtures__/artifact-gallery/template-filled/taskstoissues.md?raw';
import intakeMd from '../../__fixtures__/artifact-gallery/tiny-todo/.specify/assessments/shared-lists/intake.md?raw';
import ideaResearchMd from '../../__fixtures__/artifact-gallery/tiny-todo/.specify/assessments/shared-lists/research.md?raw';
import problemMd from '../../__fixtures__/artifact-gallery/tiny-todo/.specify/assessments/shared-lists/problem.md?raw';
import conceptMd from '../../__fixtures__/artifact-gallery/tiny-todo/.specify/assessments/shared-lists/concept.md?raw';
import decisionMd from '../../__fixtures__/artifact-gallery/tiny-todo/.specify/assessments/shared-lists/decision.md?raw';
import bugAssessmentMd from '../../../../../tests/fixtures/bug-reports/.specify/bugs/cart-total-skips-first/assessment.md?raw';
import bugFixMd from '../../../../../tests/fixtures/bug-reports/.specify/bugs/cart-total-skips-first/fix.md?raw';
import bugTestMd from '../../../../../tests/fixtures/bug-reports/.specify/bugs/cart-total-skips-first/test.md?raw';

const FEATURE_DIR = '/workspace/specs/001-dark-mode-toggle';
const FEATURE_CORE: RailDoc[] = [
    { type: 'spec', label: 'Specification' },
    { type: 'plan', label: 'Plan' },
    { type: 'tasks', label: 'Tasks' },
];
const FEATURE_RELATED: RailDoc[] = [
    { type: 'requirements', label: 'Checklist: Requirements', parentStep: 'spec' },
    { type: 'ux', label: 'Checklist: Ux', parentStep: 'spec' },
    { type: 'research', label: 'Research', parentStep: 'plan' },
    { type: 'data-model', label: 'Data Model', parentStep: 'plan' },
    { type: 'quickstart', label: 'Quickstart', parentStep: 'plan' },
    { type: 'toggle-ui', label: 'Contracts: Toggle Ui', parentStep: 'plan' },
    { type: 'theme-store-api', label: 'Contracts: Theme Store Api', parentStep: 'plan' },
];

function feature(doc: string, docLabel: string, file: string, md: string, recipe?: Recipe): GalleryArtifact {
    return {
        title: 'Dark Mode Toggle',
        badge: 'ACTIVE',
        filePath: `${FEATURE_DIR}/${file}`,
        doc,
        docLabel,
        md,
        core: FEATURE_CORE,
        related: FEATURE_RELATED,
        recipe,
    };
}

function family(title: string, badge: string, dir: string, docs: Array<[type: string, label: string]>) {
    const core = docs.map(([type, label]) => ({ type, label }));
    return (doc: string, md: string, recipe?: Recipe, origin?: string): GalleryArtifact => ({
        title,
        badge,
        filePath: `${dir}/${doc}.md`,
        doc,
        docLabel: core.find((d) => d.type === doc)?.label ?? doc,
        md,
        core,
        recipe,
        origin,
    });
}

const bug = family('cartTotal skips the first cart item', 'VERIFIED', '/workspace/.specify/bugs/cart-total-skips-first', [
    ['assessment', 'Assessment'],
    ['fix', 'Fix'],
    ['test', 'Test'],
]);
const idea = family('Shared todo lists', 'KILL', '/workspace/.specify/assessments/shared-lists', [
    ['intake', 'Intake'],
    ['research', 'Research'],
    ['problem', 'Problem'],
    ['concept', 'Concept'],
    ['decision', 'Decision'],
]);
const memory = family('Tiny Todo Constitution', 'V1.0.0', '/workspace/.specify/memory', [['constitution', 'Constitution']]);
const printed = family('Dark Mode Toggle', 'PRINTED', '/workspace/specs/001-dark-mode-toggle', [
    ['analyze', 'Analyze report'],
    ['converge', 'Converge report'],
    ['taskstoissues', 'Tasks to issues'],
]);

const ARTIFACTS = {
    constitution: memory('constitution', constitutionMd, recipes.constitution),
    spec: feature('spec', 'Specification', 'spec.md', specMd),
    clarify: feature('spec', 'Specification', 'spec.md', specMd, recipes.clarify),
    checklistRequirements: feature('requirements', 'Checklist: Requirements', 'checklists/requirements.md', requirementsMd, recipes.checklist),
    checklistUx: feature('ux', 'Checklist: Ux', 'checklists/ux.md', uxChecklistMd, recipes.checklist),
    plan: feature('plan', 'Plan', 'plan.md', planMd),
    research: feature('research', 'Research', 'research.md', researchMd, recipes.research),
    dataModel: feature('data-model', 'Data Model', 'data-model.md', dataModelMd, recipes.dataModel),
    quickstart: feature('quickstart', 'Quickstart', 'quickstart.md', quickstartMd, recipes.quickstart),
    contractUi: feature('toggle-ui', 'Contracts: Toggle Ui', 'contracts/toggle-ui.md', contractUiMd, recipes.contract),
    contractApi: feature('theme-store-api', 'Contracts: Theme Store Api', 'contracts/theme-store-api.md', contractApiMd, recipes.contract),
    tasks: feature('tasks', 'Tasks', 'tasks.md', tasksMd),
    analyze: printed('analyze', analyzeMd, recipes.analyze, 'Printed in the chat only. Spec Kit writes no file for this report.'),
    converge: printed('converge', convergeMd, recipes.converge, 'Printed in the chat. The only file it changes is tasks.md, where it appends a Convergence phase.'),
    tasksToIssues: printed(
        'taskstoissues',
        issuesMd,
        recipes.tasksToIssues,
        'Not run. The command writes no file and creates GitHub issues, so this is the list it would create from the real tasks.md.',
    ),
    bugAssessment: bug('assessment', bugAssessmentMd, recipes.bugAssessment),
    bugFix: bug('fix', bugFixMd, recipes.bugFix),
    bugTest: bug('test', bugTestMd, recipes.bugTest),
    ideaIntake: idea('intake', intakeMd, recipes.assessStage),
    ideaResearch: idea('research', ideaResearchMd, recipes.assessStage),
    ideaProblem: idea('problem', problemMd, recipes.assessStage),
    ideaConcept: idea('concept', conceptMd, recipes.assessConcept),
    ideaDecision: idea('decision', decisionMd, recipes.assessDecision),
} satisfies Record<string, GalleryArtifact>;

const meta: Meta = {
    title: 'VS Code Extension/Spec Viewer/Artifact gallery',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Every kind of file a Spec Kit command produces, from one real run on a tiny todo app. ' +
                    'Each kind has a Today story (the shipped viewer, unchanged) and, where that reads badly, a Proposed prototype.',
            },
        },
    },
};
export default meta;
type Story = StoryObj;

const today = (name: string, artifact: GalleryArtifact): Story => ({
    name: `${name} · Today`,
    render: () => <GalleryViewer artifact={artifact} />,
});
const proposed = (name: string, artifact: GalleryArtifact): Story => ({
    name: `${name} · Proposed`,
    render: () => <GalleryViewer artifact={artifact} proposed />,
});

export const ConstitutionToday = today('Constitution', ARTIFACTS.constitution);
export const ConstitutionProposed = proposed('Constitution', ARTIFACTS.constitution);
export const SpecToday = today('Specify', ARTIFACTS.spec);
export const ClarifyToday = today('Clarify', ARTIFACTS.clarify);
export const ClarifyProposed = proposed('Clarify', ARTIFACTS.clarify);
export const ChecklistRequirementsToday = today('Checklist (requirements)', ARTIFACTS.checklistRequirements);
export const ChecklistRequirementsProposed = proposed('Checklist (requirements)', ARTIFACTS.checklistRequirements);
export const ChecklistToday = today('Checklist (ux)', ARTIFACTS.checklistUx);
export const ChecklistProposed = proposed('Checklist (ux)', ARTIFACTS.checklistUx);
export const PlanToday = today('Plan', ARTIFACTS.plan);
export const ResearchToday = today('Research', ARTIFACTS.research);
export const ResearchProposed = proposed('Research', ARTIFACTS.research);
export const DataModelToday = today('Data model', ARTIFACTS.dataModel);
export const DataModelProposed = proposed('Data model', ARTIFACTS.dataModel);
export const QuickstartToday = today('Quickstart', ARTIFACTS.quickstart);
export const QuickstartProposed = proposed('Quickstart', ARTIFACTS.quickstart);
export const ContractUiToday = today('Contract (UI)', ARTIFACTS.contractUi);
export const ContractUiProposed = proposed('Contract (UI)', ARTIFACTS.contractUi);
export const ContractApiToday = today('Contract (API)', ARTIFACTS.contractApi);
export const ContractApiProposed = proposed('Contract (API)', ARTIFACTS.contractApi);
export const TasksToday = today('Tasks, implement, converge', ARTIFACTS.tasks);
export const AnalyzeToday = today('Analyze', ARTIFACTS.analyze);
export const AnalyzeProposed = proposed('Analyze', ARTIFACTS.analyze);
export const ConvergeToday = today('Converge', ARTIFACTS.converge);
export const ConvergeProposed = proposed('Converge', ARTIFACTS.converge);
export const TasksToIssuesToday = today('Tasks to issues', ARTIFACTS.tasksToIssues);
export const TasksToIssuesProposed = proposed('Tasks to issues', ARTIFACTS.tasksToIssues);
export const BugAssessmentToday = today('Bug assessment', ARTIFACTS.bugAssessment);
export const BugAssessmentProposed = proposed('Bug assessment', ARTIFACTS.bugAssessment);
export const BugFixToday = today('Bug fix', ARTIFACTS.bugFix);
export const BugFixProposed = proposed('Bug fix', ARTIFACTS.bugFix);
export const BugTestToday = today('Bug test', ARTIFACTS.bugTest);
export const BugTestProposed = proposed('Bug test', ARTIFACTS.bugTest);
export const IdeaIntakeToday = today('Idea intake', ARTIFACTS.ideaIntake);
export const IdeaIntakeProposed = proposed('Idea intake', ARTIFACTS.ideaIntake);
export const IdeaResearchToday = today('Idea research', ARTIFACTS.ideaResearch);
export const IdeaResearchProposed = proposed('Idea research', ARTIFACTS.ideaResearch);
export const IdeaProblemToday = today('Idea problem', ARTIFACTS.ideaProblem);
export const IdeaProblemProposed = proposed('Idea problem', ARTIFACTS.ideaProblem);
export const IdeaConceptToday = today('Idea concept', ARTIFACTS.ideaConcept);
export const IdeaConceptProposed = proposed('Idea concept', ARTIFACTS.ideaConcept);
export const IdeaDecisionToday = today('Idea decision', ARTIFACTS.ideaDecision);
export const IdeaDecisionProposed = proposed('Idea decision', ARTIFACTS.ideaDecision);
