/**
 * SpecKit Companion - Markdown Module
 * Exports markdown rendering functionality
 */

export { renderMarkdown, setCurrentTask } from './renderer';
export { parseInline, escapeHtml, escapeHtmlInScenario } from './inline';
export {
    preprocessSpecMetadata,
    preprocessUserStories,
    preprocessCallouts
} from './preprocessors';
export { parseAcceptanceScenarios, resetScenarioTableCounter } from './scenarios';
