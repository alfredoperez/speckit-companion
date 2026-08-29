/**
 * A PRESENTATIONAL RECREATION OF THE SPECS SIDEBAR. NOT THE SIDEBAR.
 * ─────────────────────────────────────────────────────────────────────────
 * The Specs view is a native VS Code `TreeView`. It has no webview, no Preact
 * component, and nothing here runs in the extension. This module draws markup
 * that LOOKS like that tree from a plain array of rows, so the video series has
 * a sidebar frame it can regenerate at any time without a human driving VS Code
 * and without shipping the author's real spec names.
 *
 * Nothing in this file reads a workspace, a `spec-context.json`, or
 * `specExplorerProvider.ts`. If the real tree changes, this does not follow on
 * its own — it is a demo surface and has to be re-measured by hand.
 *
 * WHERE THE NUMBERS COME FROM
 * `docs/reference/sidebar-snapshots/*.html`: two captures of the real sidebar
 * taken from VS Code's developer tools with every computed style inlined. Every
 * measurement below is read off those files, not guessed:
 *
 *   row height            22px, line-height 22px, font-size 13px
 *   row box               left 4px, width = pane - 8px, padding-right 12px
 *   indent step           4px, applied as the twistie's padding-left
 *                         (depth 0 → 8px, depth 1 → 12px, depth 2 → 16px, …)
 *   twistie               16px wide, padding-right 6px, font-size 16px,
 *                         flex-shrink 0 — a leaf still reserves the same box
 *   item icon             16px wide, padding-right 6px, font-size 16px
 *   description           font-size 11.7px (0.9em), margin-left 5.85px (0.45em),
 *                         opacity 0.7
 *   pane header           28px tall, margin 0 4px, padding-left 4px;
 *                         twisty 16px with 2px margins; title 12px/600,
 *                         text-transform capitalize
 *   viewlet title         32px tall, title padding-left 8px, 12px/600
 *
 * The snapshots were taken in a different color theme, so only geometry comes
 * from them. Color comes from the theme variables `.storybook/preview.tsx`
 * publishes, which default to Bearded Monokai Black.
 *
 * TWO DELIBERATE DEPARTURES FROM THE SNAPSHOT MARKUP
 *  1. Rows are laid out in normal flow at a fixed 22px, not absolutely
 *     positioned at `top: n * 22px`. Monaco does the latter because it
 *     virtualizes a list of thousands; a fixture of twenty rows does not need
 *     it, and flow layout cannot drift out of sync with the row order.
 *  2. The twistie chevron uses `codicon-chevron-down` / `codicon-chevron-right`
 *     rather than VS Code's `codicon-tree-item-expanded`, which is an alias
 *     defined in VS Code's own product CSS and is NOT a glyph in the
 *     `@vscode/codicons` font this repo ships. The structural class names
 *     (`monaco-tl-twistie collapsible collapsed`) are kept.
 *
 * ICON AND STATE VOCABULARY
 * Taken from `src/features/specs/specExplorerProvider.ts`, which wins over the
 * snapshots wherever they disagree:
 *
 *   group  Active      `pulse`, default icon color
 *   group  Completed   `pass-filled` in testing.iconPassed
 *   group  Archived    `archive`
 *   spec               `beaker`; testing.iconPassed when completed,
 *                      charts.yellow when implemented, charts.blue while a
 *                      step is current, uncolored otherwise
 *   document complete  `pass` in testing.iconPassed
 *   document running   `circle-filled` in charts.blue
 *   document pending   `circle-outline`
 *   document missing   NO ICON AT ALL, plus a dim "not created" description
 *   related doc        no icon (the tree relies on indentation alone)
 *
 * Living Specs rows come from `livingSpecsExplorerProvider.ts`: `folder` for a
 * directory group (the tree mirrors where each spec lives, built by
 * `buildCapabilityTree`), `symbol-namespace` for a capability that has a spec on
 * disk, `circle-outline` plus a "not created" suffix for one that does not,
 * list.warningForeground plus a "drift" suffix when the sources moved on, and a
 * trailing `question` group holding the orphan `*.spec.md` files no capability
 * claims. Steering rows come from `steeringExplorerProvider.ts` (`library`,
 * `law`, `terminal`, `files`; scripts and templates are icon-less leaves).
 *
 * ROW STATE
 * A third thing the real list draws, and the reason a clip can film a click:
 * `monaco-list-row:hover` takes list.hoverBackground, and a row the user picked
 * keeps `monaco-list-row.selected` afterwards. Once the document opens the
 * editor holds focus, so the tree is UNfocused and the selected row washes with
 * list.inactiveSelectionBackground, not the active blue. Both rules are read off
 * the DevTools snapshots, and both variables are published by the capture theme;
 * the active-selection and focus-outline variables are not, so nothing here
 * draws a focused row.
 */

import type { ComponentChildren } from 'preact';

/**
 * The sidebar's native width. `docs/screenshots/sidebar.png` is 676 device
 * pixels at a device pixel ratio of 2, so the pane was 338 CSS pixels wide;
 * the captured snapshots were docked slightly narrower at 290. 340 is the
 * round number the video composition reserves for the sidebar column, and the
 * row layout is width-independent — only the ellipsis point moves.
 */
export const SIDEBAR_WIDTH = 340;

/** Row height in the real tree, and therefore here. */
export const ROW_HEIGHT = 22;

/** Every level of depth adds this much to the twistie's padding-left. */
export const INDENT_STEP = 4;

/**
 * Icon colors, named for the `ThemeColor` the provider actually passes.
 * `none` is the icon-less case and must stay distinct from `default`: a
 * document that does not exist renders with no icon element at all, which
 * pulls its label 22px to the left. That shift is the tell in the real tree,
 * so it has to survive here.
 */
export type IconTone = 'default' | 'foreground' | 'passed' | 'blue' | 'warning';

export type Twistie = 'expanded' | 'collapsed' | 'leaf';

/**
 * What the list is doing to this row. `hover` is the pointer resting on it,
 * `selected` is the row that was clicked while focus has moved to the editor.
 * Absent is the resting row, which is what every row in a capture used to be.
 */
export type RowState = 'hover' | 'selected';

export interface SidebarRow {
    /**
     * Stable, hand-written id. It lands on the row as both `id="row-<id>"` and
     * `data-row="<id>"` so a video composition can address one row — highlight
     * it, mask it, morph it — without counting from the top of the list.
     * Feature rows use the spec's directory slug, which is what the rest of the
     * fixture set calls them.
     */
    id: string;
    /** 0 for a group header, 1 for a spec, 2 for a document, 3 for a sub-file. */
    depth: number;
    label: string;
    /** The dim trailing text: "42m ago", "not created", "drift". */
    description?: string;
    /** Codicon name without the `codicon-` prefix. Omit for an icon-less row. */
    icon?: string;
    tone?: IconTone;
    twistie?: Twistie;
    /** Pointer-over or picked. Omit for a resting row. */
    state?: RowState;
}

export interface SidebarPane {
    id: string;
    title: string;
    rows: SidebarRow[];
    /** A collapsed pane shows its header and nothing else, as in the real view. */
    collapsed?: boolean;
    /**
     * The pane that soaks up the leftover height. In the real split view the
     * last expanded pane does; setting it explicitly keeps a short fixture from
     * floating in the middle of the frame.
     */
    fill?: boolean;
}

const TONE_VAR: Record<IconTone, string> = {
    default: 'var(--vscode-icon-foreground)',
    foreground: 'var(--vscode-foreground)',
    passed: 'var(--vscode-testing-iconPassed)',
    blue: 'var(--vscode-charts-blue)',
    warning: 'var(--vscode-list-warningForeground)',
};

/**
 * Scoped to `.sk-sidebar` so importing this component never leaks styling into
 * the rest of the catalog. Values are the measurements in the file header.
 */
const SIDEBAR_CSS = `
.sk-sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    box-sizing: border-box;
    background: var(--vscode-sideBar-background);
    color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
    font-family: var(--vscode-font-family);
    font-size: 13px;
    line-height: 22px;
    user-select: none;
    cursor: default;
}
.sk-sidebar .composite.title {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
    height: 32px;
    padding: 0 4px;
    box-sizing: border-box;
}
.sk-sidebar .composite.title .title-label h2 {
    margin: 0;
    padding-left: 8px;
    font-size: 12px;
    font-weight: 600;
    line-height: 32px;
    text-transform: capitalize;
    color: var(--vscode-sideBarTitle-foreground, var(--vscode-foreground));
}
.sk-sidebar .composite.title .title-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    padding-right: 3px;
    color: var(--vscode-icon-foreground);
}

.sk-sidebar .pane {
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
    min-height: 0;
}
.sk-sidebar .pane.fill { flex: 1 1 auto; }
.sk-sidebar .pane-header {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
    box-sizing: border-box;
    height: 28px;
    margin: 0 4px;
    padding-left: 4px;
    overflow: hidden;
    background: var(--vscode-sideBarSectionHeader-background, var(--vscode-sideBar-background));
}
.sk-sidebar .pane-header .twisty-container {
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    margin: 0 2px;
    font-size: 16px;
    line-height: 16px;
    color: var(--vscode-icon-foreground);
}
.sk-sidebar .pane-header h3.title {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    line-height: 28px;
    text-transform: capitalize;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground));
}
.sk-sidebar .pane-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
}

.sk-sidebar .monaco-list-row {
    position: relative;
    box-sizing: border-box;
    height: ${ROW_HEIGHT}px;
    line-height: ${ROW_HEIGHT}px;
    margin-left: 4px;
    margin-right: 4px;
    padding-right: 12px;
}
/* The two washes the real list paints. Hover is the pointer; selected is the
   row that was clicked, drawn INACTIVE because opening the document moves focus
   to the editor. Both variables come from the capture theme. */
.sk-sidebar .monaco-list-row.hovered {
    background-color: var(--vscode-list-hoverBackground);
}
.sk-sidebar .monaco-list-row.selected {
    background-color: var(--vscode-list-inactiveSelectionBackground);
}
.sk-sidebar .monaco-tl-row {
    display: flex;
    align-items: center;
    height: 100%;
    position: relative;
}
.sk-sidebar .monaco-tl-indent {
    position: absolute;
    top: 0;
    left: 16px;
    height: 100%;
    pointer-events: none;
}
/* VS Code paints an indent guide only down the branch that currently has focus
   or hover, so an unfocused pane shows none — which is the state a capture
   should be in. The markup is here anyway, and the .show-indent-guides class on
   the root turns it on if a composition wants the line down an opened feature.
   (No backticks in here: this whole block is one template literal.) */
.sk-sidebar .indent-guide {
    display: inline-block;
    width: 4px;
    height: 100%;
    opacity: 0;
    border-left: 1px solid var(--vscode-tree-indentGuidesStroke, transparent);
}
.sk-sidebar.show-indent-guides .indent-guide { opacity: 1; }
.sk-sidebar .monaco-tl-twistie {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    /* See the icon rule below: content-box keeps padding outside the 16px box. */
    box-sizing: content-box;
    width: 16px;
    height: 100%;
    padding-right: 6px;
    font-size: 16px;
    line-height: 16px;
    color: var(--vscode-icon-foreground);
}
.sk-sidebar .monaco-tl-contents {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
}
.sk-sidebar .monaco-icon-label {
    display: flex;
    align-items: center;
    flex: 1 1 0;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
}
.sk-sidebar .custom-view-tree-node-item-icon {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
    /* content-box, so the 6px gutter sits OUTSIDE the 16px glyph box exactly as
       it does in the captured tree. The webview stylesheet this catalog loads
       sets border-box globally, which would eat the gutter and shove every
       label into its icon. */
    box-sizing: content-box;
    width: 16px;
    height: 100%;
    padding-right: 6px;
    font-size: 16px;
    line-height: 16px;
}
.sk-sidebar .monaco-icon-label-container {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.sk-sidebar .label-name { color: inherit; text-decoration: none; }
.sk-sidebar .label-description {
    /* 0.9em of 13px is 11.7px, and 0.5em of THAT is the 5.85px gap the capture
       measures — the em resolves against the shrunken size, not the row's. */
    font-size: 0.9em;
    margin-left: 0.5em;
    opacity: 0.7;
}
`;

/**
 * The chevron column. Indentation lives here, exactly as it does in the real
 * tree: VS Code indents a row by growing this element's padding-left, never by
 * moving the row. A leaf gets the same box with no glyph, which is what keeps
 * a file's label aligned with its collapsible siblings.
 */
function TwistieCell({ state, padLeft }: { state: Twistie; padLeft: number }) {
    const style = `padding-left: ${padLeft}px`;
    if (state === 'leaf') {
        return <div class="monaco-tl-twistie" style={style} />;
    }
    const collapsed = state === 'collapsed';
    return (
        <div
            class={
                'monaco-tl-twistie codicon collapsible ' +
                (collapsed ? 'collapsed codicon-chevron-right' : 'codicon-chevron-down')
            }
            style={style}
        />
    );
}

function Row({ row }: { row: SidebarRow }) {
    const twistie = row.twistie ?? 'leaf';
    const tone = row.tone ?? 'default';
    const guides = [];
    for (let i = 0; i < row.depth; i++) {
        guides.push(<div class="indent-guide" key={i} />);
    }
    return (
        <div
            class={`monaco-list-row${row.state === 'hover' ? ' hovered' : ''}${row.state === 'selected' ? ' selected' : ''}`}
            id={`row-${row.id}`}
            data-row={row.id}
            data-depth={row.depth}
        >
            <div class="monaco-tl-row">
                <div class="monaco-tl-indent" style={`width: ${Math.max(0, row.depth - 1) * INDENT_STEP}px`}>
                    {guides}
                </div>
                <TwistieCell state={twistie} padLeft={8 + row.depth * INDENT_STEP} />
                <div class="monaco-tl-contents custom-view-tree-node-item">
                    <div class="monaco-icon-label custom-view-tree-node-item-resourceLabel">
                        {row.icon ? (
                            <div
                                class={`custom-view-tree-node-item-icon codicon codicon-${row.icon}`}
                                style={`color: ${TONE_VAR[tone]}`}
                            />
                        ) : null}
                        <div class="monaco-icon-label-container">
                            <span class="monaco-icon-name-container">
                                <a class="label-name">
                                    <span class="monaco-highlighted-label">{row.label}</span>
                                </a>
                            </span>
                            {row.description ? (
                                <span class="monaco-icon-description-container">
                                    <span class="label-description">{row.description}</span>
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Pane({ pane }: { pane: SidebarPane }) {
    const collapsed = pane.collapsed === true;
    return (
        <div
            class={`pane ${collapsed ? 'collapsed' : 'expanded'}${pane.fill && !collapsed ? ' fill' : ''}`}
            data-pane={pane.id}
        >
            <div class={`pane-header ${collapsed ? 'collapsed' : 'expanded'}`}>
                <div
                    class={`twisty-container codicon ${collapsed ? 'codicon-chevron-right' : 'codicon-chevron-down'}`}
                />
                <h3 class="title">{pane.title}</h3>
            </div>
            {collapsed ? null : (
                <div class="pane-body">
                    <div class="monaco-list customview-tree">
                        <div class="monaco-list-rows">
                            {pane.rows.map((row) => (
                                <Row row={row} key={row.id} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * The whole sidebar: the SpecKit viewlet title plus one pane per section.
 * Rendered at `SIDEBAR_WIDTH` and never stretched — the frame is meant to drop
 * into a composition at 1:1.
 */
export function SidebarShell({
    panes,
    title = 'SpecKit',
    width = SIDEBAR_WIDTH,
    showIndentGuides = false,
}: {
    panes: SidebarPane[];
    title?: string;
    width?: number;
    /** Paint the tree's indent guides, which the real view only shows on the focused branch. */
    showIndentGuides?: boolean;
}): ComponentChildren {
    return (
        <>
            <style>{SIDEBAR_CSS}</style>
            <div
                class={`sk-sidebar${showIndentGuides ? ' show-indent-guides' : ''}`}
                style={`width: ${width}px`}
                data-sidebar="specs"
            >
                <div class="composite title">
                    <div class="title-label">
                        <h2>{title}</h2>
                    </div>
                    <div class="title-actions">
                        <span class="codicon codicon-ellipsis" style="font-size: 16px" />
                    </div>
                </div>
                {panes.map((pane) => (
                    <Pane pane={pane} key={pane.id} />
                ))}
            </div>
        </>
    );
}
