/**
 * SpecKit Companion - Editor Module
 * Exports inline editor functionality
 */

export {
    showInlineEditor,
    closeInlineEditor,
    showInlineEditorForRow,
    showInlineEdit,
    setupLineActions
} from './inlineEditor';

export {
    addRefinement,
    removeRefinement,
    renderInlineComment,
    addRefinementForRow,
    renderInlineCommentForRow,
    removeRefinementForRow,
    updateRefineButton,
    submitAllRefinements,
    clearAllRefinements
} from './refinements';

export {
    detectLineType,
    getContextActions,
    handleContextAction
} from './lineActions';
