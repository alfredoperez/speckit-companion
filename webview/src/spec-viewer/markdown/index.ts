/**
 * SpecKit Companion - Markdown Module
 * Exports markdown rendering functionality
 */

export { renderMarkdown, setCurrentTask, setHasSpecContext, setLivingMode, setTaskSummaries } from './renderer';
export {
    setLivingCoverage,
    preprocessLivingDraftNotice,
    preprocessLivingPurpose,
    preprocessLivingScenarios,
    preprocessLivingRequirements,
    preprocessLivingUncovered
} from './livingComponents';
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
