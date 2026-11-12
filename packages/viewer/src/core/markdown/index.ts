/**
 * SpecKit Companion - Markdown Module
 * Exports markdown rendering functionality
 */

export { renderMarkdown, setCurrentTask, setHasSpecContext, setReportMode, setTaskSummaries, slugify } from './renderer';
export { setSpecLedgerTasks } from './ledger/specDoc';
export { renderScreenByName } from './screenCard';
export { markClarifications, writtenQuestion } from './clarifications';
export { parseInline, escapeHtml, escapeHtmlInScenario } from './inline';
export {
    preprocessSpecMetadata,
    preprocessUserStories,
    preprocessTaskPhases,
    preprocessRequirements,
    preprocessEntities,
    preprocessChecklist,
    preprocessTechnicalContext,
    preprocessConstitution,
    preprocessDecisions,
    preprocessCallouts
} from './preprocessors';
export { parseAcceptanceScenarios, resetScenarioTableCounter } from './scenarios';
