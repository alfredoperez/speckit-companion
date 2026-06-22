/**
 * SpecKit Companion - Markdown Module
 * Exports markdown rendering functionality
 */

export { renderMarkdown, setCurrentTask, setHasSpecContext, setTaskSummaries } from './renderer';
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
