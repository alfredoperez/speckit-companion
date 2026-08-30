/**
 * One node, read here rather than in the editor.
 *
 * Clicking a node used to open its `.md`, which starts with frontmatter and a
 * stack of empty comment fences — the authoring format, not the answer to "what
 * does this tell the assistant". The extension strips both and sends what is
 * left; this renders it, and keeps "Open the file" for when the editor is what
 * you actually wanted.
 */

import { useState } from 'preact/hooks';
import { PipelineNode } from '../../../src/protocol/pipeline';

interface Props {
    node: PipelineNode;
    step: string;
    /** The instruction text, or null while it is still being read. */
    body: string | null;
    /** The same text as stored, fences intact — what an edit starts from. */
    editable: string;
    /** Shared blocks the build stitches in here. */
    parts: string[];
    onClose: () => void;
    onOpenFile: () => void;
    onSave: (body: string) => void;
    onRestore: () => void;
    onAttach: () => void;
    /** Swap this node for one of its alternatives. */
    onUseVariant: (variantId: string) => void;
}

/** What each kind of node is for, said once, here, instead of as an abbreviation. */
const KIND_MEANS: Record<string, string> = {
    investigate: 'reads context and produces no file',
    author: 'owns and writes a deliverable',
    gate: 'a check that can stop or skip the run',
    control: 'sets up, routes, or finishes',
};

/**
 * Enough markdown for an instruction block.
 *
 * A node body is headings, lists, fenced code and inline code. Pulling the
 * viewer's full pipeline in for that would drag its owned palette along with it,
 * so this handles the shapes that actually appear and leaves the rest as text.
 */
function render(body: string): preact.VNode[] {
    const out: preact.VNode[] = [];
    const lines = body.split('\n');
    let list: string[] = [];
    let code: string[] | null = null;
    let language = '';

    const flushList = () => {
        if (list.length === 0) { return; }
        out.push(
            <ul class="pb-doc-list" key={`l${out.length}`}>
                {list.map((item, i) => <li key={i}>{inline(item)}</li>)}
            </ul>,
        );
        list = [];
    };

    for (const line of lines) {
        const fence = line.match(/^\s*```(\w*)/);
        if (fence) {
            if (code) {
                out.push(
                    <pre class="pb-doc-code" key={`c${out.length}`}>
                        <code>{code.join('\n')}</code>
                    </pre>,
                );
                code = null;
            } else {
                flushList();
                code = [];
                language = fence[1];
            }
            continue;
        }
        if (code) { code.push(line); continue; }

        const heading = line.match(/^(#{1,4})\s+(.*)$/);
        if (heading) {
            flushList();
            out.push(
                <h4 class="pb-doc-heading" key={`h${out.length}`}>{inline(heading[2])}</h4>,
            );
            continue;
        }

        const item = line.match(/^\s*(?:[-*+]|\d+\.)\s+(.*)$/);
        if (item) { list.push(item[1]); continue; }

        flushList();
        if (line.trim()) {
            out.push(<p class="pb-doc-p" key={`p${out.length}`}>{inline(line)}</p>);
        }
    }
    flushList();
    if (code) {
        out.push(
            <pre class="pb-doc-code" key={`c${out.length}`}>
                <code>{code.join('\n')}</code>
            </pre>,
        );
    }
    void language;
    return out;
}

/** Inline code and bold, which is all the node bodies use. */
function inline(text: string): (string | preact.VNode)[] {
    const parts: (string | preact.VNode)[] = [];
    const pattern = /`([^`]+)`|\*\*([^*]+)\*\*/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
        if (match.index > last) { parts.push(text.slice(last, match.index)); }
        parts.push(match[1]
            ? <code class="pb-doc-inline" key={match.index}>{match[1]}</code>
            : <strong key={match.index}>{match[2]}</strong>);
        last = match.index + match[0].length;
    }
    if (last < text.length) { parts.push(text.slice(last)); }
    return parts;
}

export function Inspector(props: Props) {
    const { node, step, body, parts, editable } = props;
    // Editing is how a node becomes yours. There is no separate "make it mine":
    // the copy is written when you save, so the thing you wanted to do and the
    // thing you had to do first are the same action.
    const [draft, setDraft] = useState<string | null>(null);
    const editing = draft !== null;

    return (
        <aside class="pb-inspector" aria-label={`${node.name} instructions`}>
            <header class="pb-inspector-head">
                <h2 class="pb-inspector-title">{node.name}</h2>
                <button class="pb-inspector-close" onClick={props.onClose} title="Close">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
                        stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
                        aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                </button>
                <p class="pb-inspector-where">
                    <span class="pb-inspector-id">{node.id}</span>
                    {' · '}{step}{' / '}{node.kind}
                </p>
            </header>

            <dl class="pb-facts">
                <dt>Kind</dt>
                <dd>{KIND_MEANS[node.kind] ?? 'part of the step'}</dd>

                {node.writes.length > 0 && (
                    <>
                        <dt>Writes</dt>
                        <dd class="pb-facts-mono">{node.writes.join(', ')}</dd>
                    </>
                )}
                {node.reads.length > 0 && (
                    <>
                        <dt>Needs</dt>
                        <dd class="pb-facts-mono">{node.reads.join(', ')}</dd>
                    </>
                )}
                <dt>Order</dt>
                <dd>{node.pinned
                    ? `Held in place — ${node.pinned}.`
                    : 'Free to move, including into another phase.'}</dd>

                <dt>Source</dt>
                <dd>
                    {node.replaced ? 'Yours — this project replaced it.' : 'Ships with Companion.'}
                    <span class="pb-facts-path" title={node.source}>{node.source}</span>
                </dd>
            </dl>

            <div class="pb-doc">
                <h3 class="pb-doc-label">
                    {editing ? 'Edit what it tells the assistant' : 'What it tells the assistant'}
                </h3>
                {editing ? (
                    <>
                        <textarea class="pb-doc-edit" spellcheck={false} value={draft}
                            aria-label={`${node.name} instructions`}
                            onInput={event =>
                                setDraft((event.currentTarget as HTMLTextAreaElement).value)} />
                        <p class="pb-doc-parts">
                            {node.replaced
                                ? 'Saving overwrites your copy of this node.'
                                : 'Saving writes your own copy of this node. '
                                  + 'The shipped one is left alone, and you can go back to it.'}
                            {parts.length > 0 && (
                                <>
                                    {' '}Leave the <span class="pb-facts-mono">
                                        speckit-companion:part
                                    </span> lines where you want the shared blocks
                                    ({parts.join(', ')}) stitched in.
                                </>
                            )}
                        </p>
                    </>
                ) : (
                    <>
                        {body === null
                            ? <p class="pb-doc-p pb-doc-waiting">Reading…</p>
                            : body
                                ? render(body)
                                : (
                                    <p class="pb-doc-p pb-doc-waiting">
                                        This node has no instructions of its own — it exists to
                                        carry the shared blocks below.
                                    </p>
                                )}
                        {parts.length > 0 && (
                            <p class="pb-doc-parts">
                                Stitched in here at build time:{' '}
                                <span class="pb-facts-mono">{parts.join(', ')}</span>
                            </p>
                        )}
                    </>
                )}
            </div>

            <footer class="pb-inspector-actions">
                {editing ? (
                    <>
                        <button class="pb-inspector-action pb-inspector-action--yours"
                            onClick={() => { props.onSave(draft!); setDraft(null); }}>
                            Save
                        </button>
                        <button class="pb-inspector-action pb-inspector-action--quiet"
                            onClick={() => setDraft(null)}>Cancel</button>
                    </>
                ) : (
                    <>
                        <button class="pb-inspector-action pb-inspector-action--yours"
                            disabled={body === null}
                            onClick={() => setDraft(editable)}>
                            Edit
                        </button>
                        <button class="pb-inspector-action"
                            onClick={props.onAttach}>Add hook</button>
                        {node.variants.length > 0 && (
                            /* A pick, not a rewrite. Resets to blank so choosing
                               the same one twice still reads as an action. */
                            <select class="pb-inspector-action pb-inspector-variants"
                                title="Run a different block in this node's place"
                                onChange={event => {
                                    const select = event.currentTarget as HTMLSelectElement;
                                    const id = select.value;
                                    select.value = '';
                                    if (id) { props.onUseVariant(id); }
                                }}>
                                <option value="">Replace…</option>
                                {node.variants.map(variant => (
                                    <option key={variant.id} value={variant.id}
                                        title={variant.summary}>{variant.name}</option>
                                ))}
                            </select>
                        )}
                        {node.replaced && (
                            <button class="pb-inspector-action pb-inspector-action--remove"
                                onClick={props.onRestore}>Use the shipped node</button>
                        )}
                        <button class="pb-inspector-action pb-inspector-action--quiet"
                            onClick={props.onOpenFile}>Open the file</button>
                    </>
                )}
            </footer>
        </aside>
    );
}
