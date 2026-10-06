import { BuilderToExtensionMessage } from '../../../protocol/pipeline';
import { stockRefusal } from '../stockGuard';

type MessageType = BuilderToExtensionMessage['type'];

/**
 * Every message the board can send. Listed rather than derived so a new one has
 * to be considered here: the default is refusal, and this says which ones are
 * not, in a project that has nothing to run a Companion pipeline.
 */
const EVERY_MESSAGE: MessageType[] = [
    'ready', 'build', 'preview', 'openConfig', 'repair', 'saveNode', 'openNode',
    'restoreNode', 'useVariant', 'setTemplateSection', 'reorderNodes', 'setPhases',
    'addHook', 'moveHook', 'removeHook', 'readNode', 'readFrame', 'replaceStep',
    'addNode', 'newStep', 'selectWorkflow', 'newWorkflow', 'undo', 'removeNode',
    'moveNode', 'dismissFirstRun', 'setStockHook', 'openStockFile',
    'selectStockWorkflow', 'runStockCommand',
];

const ALLOWED: MessageType[] = [
    'ready', 'dismissFirstRun', 'setStockHook', 'openStockFile',
    'selectStockWorkflow', 'runStockCommand',
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
