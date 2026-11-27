import { BuilderToExtensionMessage } from '../../../protocol/pipeline';
import { stockRefusal } from '../stockGuard';

type MessageType = BuilderToExtensionMessage['type'];

/**
 * Every message the board can send. A record over the union, so a new message
 * fails the type check until it is considered here: the default is refusal,
 * and ALLOWED says which ones are not on a project with no Companion pipeline.
 */
const EVERY: Record<MessageType, true> = {
    ready: true, build: true, preview: true, openConfig: true, repair: true,
    saveNode: true, openNode: true, restoreNode: true, useVariant: true, setTemplateSection: true,
    reorderNodes: true, setPhases: true, addHook: true, moveHook: true, removeHook: true,
    readNode: true, readFrame: true, replaceStep: true, addNode: true, newStep: true,
    selectWorkflow: true, newWorkflow: true, undo: true, removeNode: true, moveNode: true,
    setDecision: true, restoreDecision: true, dismissFirstRun: true, setStockHook: true,
    openStockFile: true, selectStockWorkflow: true, runStockCommand: true, addStockHook: true,
    updateStockHook: true, removeStockHook: true, installCompanion: true, presetSearch: true,
    presetAdd: true, presetUpdate: true, presetRemove: true, readHookRuns: true,
    viewStockFile: true, overrideStockTemplate: true, removeStockOverride: true,
};
const EVERY_MESSAGE = Object.keys(EVERY) as MessageType[];

const ALLOWED: MessageType[] = [
    'ready', 'dismissFirstRun', 'setStockHook', 'openStockFile',
    'selectStockWorkflow', 'runStockCommand', 'addStockHook', 'updateStockHook',
    'removeStockHook', 'installCompanion', 'presetSearch', 'presetAdd',
    'presetUpdate', 'presetRemove', 'readHookRuns', 'viewStockFile',
    'overrideStockTemplate', 'removeStockOverride',
];

describe('what the builder may do on a stock Spec Kit project', () => {
    it('refuses every message but the stock ones', () => {
        for (const type of EVERY_MESSAGE) {
            const refusal = stockRefusal('stock', type);
            if (ALLOWED.includes(type)) {
                expect(refusal).toBeNull();
            } else {
                expect(refusal).toEqual(expect.stringContaining('stock Spec Kit'));
            }
        }
    });

    it('refuses a message type nobody has written yet', () => {
        expect(stockRefusal('stock', 'imagined' as MessageType)).not.toBeNull();
    });

    it('names building as having nothing to build', () => {
        expect(stockRefusal('stock', 'build')).toContain('nothing to build');
        expect(stockRefusal('stock', 'preview')).toContain('nothing to build');
    });

    it('never refuses writing a node or a hook on a Companion project', () => {
        for (const type of EVERY_MESSAGE) {
            expect(stockRefusal('companion', type)).toBeNull();
        }
    });

    it('leaves a folder with no Spec Kit at all as it was', () => {
        for (const type of EVERY_MESSAGE) {
            expect(stockRefusal('none', type)).toBeNull();
        }
    });
});
