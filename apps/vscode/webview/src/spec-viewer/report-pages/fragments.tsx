import { parseInline } from '../markdown/inline';

type Block =
    | { kind: 'paragraph'; text: string; strong?: boolean }
    | { kind: 'list'; ordered: boolean; items: string[] }
    | { kind: 'code'; language: string; text: string };

const FENCE = /^\s*(`{3,}|~{3,})\s*([^\s`]*)/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(\S.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;

function toBlocks(md: string): Block[] {
    const blocks: Block[] = [];
    const lines = md.replace(/\r\n?/g, '\n').split('\n');
    let open: Block | undefined;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const fence = line.match(FENCE);
        if (fence) {
            const marker = fence[1];
            const code: string[] = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith(marker)) {
                code.push(lines[i]);
                i++;
            }
            blocks.push({ kind: 'code', language: fence[2], text: code.join('\n') });
            open = undefined;
            continue;
        }

        if (!line.trim()) {
            open = undefined;
            continue;
        }

        const heading = line.match(HEADING);
        if (heading) {
            blocks.push({ kind: 'paragraph', text: heading[1].trimEnd().replace(/#+$/, '').trimEnd(), strong: true });
            open = undefined;
            continue;
        }

        const bullet = line.match(BULLET);
        const numbered = bullet ? null : line.match(NUMBERED);
        const item = bullet ?? numbered;
        if (item) {
            const ordered = !bullet;
            if (open?.kind === 'list' && open.ordered === ordered) {
                open.items.push(item[1]);
            } else {
                open = { kind: 'list', ordered, items: [item[1]] };
                blocks.push(open);
            }
            continue;
        }

        const quote = line.match(QUOTE);
        const text = (quote ? quote[1] : line).trim();
        if (!text) {
            open = undefined;
            continue;
        }
        if (open?.kind === 'list') {
            open.items[open.items.length - 1] += ` ${text}`;
        } else if (open?.kind === 'paragraph') {
            open.text += ` ${text}`;
        } else {
            open = { kind: 'paragraph', text };
            blocks.push(open);
        }
    }

    return blocks;
}

export function Inline({ md }: { md: string }) {
    return <span dangerouslySetInnerHTML={{ __html: parseInline(md) }} />;
}

export function Prose({ md }: { md?: string }) {
    if (!md || !md.trim()) return null;

    return (
        <>
            {toBlocks(md).map((block, index) => {
                if (block.kind === 'code') {
                    const language = block.language || undefined;
                    return (
                        <pre key={index} class="code-block" data-language={language}>
                            <code class={language ? `language-${language}` : undefined}>{block.text}</code>
                        </pre>
                    );
                }
                if (block.kind === 'list') {
                    const List = block.ordered ? 'ol' : 'ul';
                    return (
                        <List key={index}>
                            {block.items.map((item, itemIndex) => (
                                <li key={itemIndex} dangerouslySetInnerHTML={{ __html: parseInline(item) }} />
                            ))}
                        </List>
                    );
                }
                if (block.strong) {
                    return (
                        <p key={index}>
                            <strong dangerouslySetInnerHTML={{ __html: parseInline(block.text) }} />
                        </p>
                    );
                }
                return <p key={index} dangerouslySetInnerHTML={{ __html: parseInline(block.text) }} />;
            })}
        </>
    );
}
