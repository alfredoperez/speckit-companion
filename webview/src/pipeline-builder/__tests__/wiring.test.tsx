/**
 * @jest-environment node
 */

/**
 * Every message the panel posts carries what its handler needs.
 *
 * The node pane's "Add hook" posted an `addHook` with no kind and no value,
 * because it sent the message itself instead of opening the form the way every
 * other route does. The write refused it with "unknown hook type 'undefined'",
 * and nothing caught it: the reviewers checked each message chain from the
 * extension's side, where the handler is fine, and the tests mount components
 * with callbacks rather than the wiring behind them.
 *
 * So this reads the source. Crude, and it is the only thing here that would
 * have failed.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const panel = readFileSync(join(__dirname, '..', 'index.tsx'), 'utf8');

/** Each `type: '<name>'` literal in the file, with the object around it. */
function posts(name: string): string[] {
    const out: string[] = [];
    const marker = `type: '${name}'`;
    for (let at = panel.indexOf(marker); at >= 0; at = panel.indexOf(marker, at + 1)) {
        // Back to the brace that opens this object, forward to the one that
        // closes it — enough to read which fields the message carries.
        const open = panel.lastIndexOf('{', at);
        let depth = 0;
        let close = open;
        for (let i = open; i < panel.length; i += 1) {
            if (panel[i] === '{') { depth += 1; }
            if (panel[i] === '}') { depth -= 1; if (depth === 0) { close = i; break; } }
        }
        out.push(panel.slice(open, close + 1));
    }
    return out;
}

describe('the panel posts nothing a handler cannot act on', () => {
    it('never asks to add a hook without saying what kind', () => {
        const sent = posts('addHook');
        expect(sent.length).toBeGreaterThan(0);
        for (const message of sent) {
            expect(message).toContain('hookType');
            expect(message).toContain('value');
        }
    });

    // The order and the grouping travel together, either named or spread from
    // the helper that computed them. A removal carrying one and not the other
    // writes a step that contradicts itself.
    const carriesTheShape = (message: string) =>
        (message.includes('order') && message.includes('phases')) || message.includes('...');

    it('says which node to remove, and the shape to write', () => {
        const sent = posts('removeNode');
        expect(sent.length).toBeGreaterThan(0);
        for (const message of sent) {
            expect(message).toContain('nodeId');
            expect(carriesTheShape(message)).toBe(true);
        }
    });

    it('says which node moved, and the shape to write', () => {
        const sent = posts('moveNode');
        expect(sent.length).toBeGreaterThan(0);
        for (const message of sent) {
            expect(message).toContain('nodeId');
            expect(carriesTheShape(message)).toBe(true);
        }
    });

    // Two messages, each routed on its own, meant two `config_write.py` runs
    // reading and rewriting `companion.yml` at the same time — and a refused
    // add left the hook gone with nothing offering it back.
    it('moves a hook in one message rather than a removal and an addition', () => {
        expect(posts('removeHook').length).toBeGreaterThan(0);
        for (const message of posts('addHook')) {
            expect(message).toContain('movedFrom');
        }
        // No `removeHook` sits inside the branch that handles an attachment.
        const attach = panel.slice(panel.indexOf('onAttach={(a: Attachment)'));
        const until = attach.slice(0, attach.indexOf('onRemove='));
        expect(until).not.toContain("type: 'removeHook'");
    });

    it('names the step whose whole document is being replaced', () => {
        const sent = posts('replaceStep');
        expect(sent.length).toBeGreaterThan(0);
        for (const message of sent) {
            expect(message).toContain('command');
        }
    });
});
