/**
 * VIDEO-OWNED STORIES. NOT A TEST CATALOG. NOT THE REAL SIDEBAR.
 * ─────────────────────────────────────────────────────────────────────────
 * The Specs view is a native VS Code `TreeView`, so unlike every other surface
 * in this catalog it has no webview component to mount. These stories draw a
 * PRESENTATIONAL RECREATION of it (`sidebarTree.tsx`) from the fixture rows
 * below. Nothing here talks to `specExplorerProvider.ts`, reads a workspace, or
 * proves anything about the extension's behaviour. It exists so the Spec Kit
 * Companion video series can regenerate a sidebar frame on demand instead of
 * re-capturing one out of a running VS Code by hand.
 *
 * WHY NOT A CAPTURE
 * The previous sidebar frame was a DevTools capture of the real tree with
 * computed styles inlined. It worked once. It could not be regenerated without
 * a human driving VS Code, it aged out the moment the tree changed, and it
 * carried the author's real spec names. Those two captures now live in
 * `docs/reference/sidebar-snapshots/` as the measuring stick for this file, and
 * `sidebarTree.tsx` documents every number read off them.
 *
 * THE WORKED EXAMPLE
 * Teamboard, the same internal staff directory the viewer fixtures use, and the
 * same feature: `041-profile-photo-upload` (see
 * `__fixtures__/teamboard/041-profile-photo-upload/`). Its siblings here are
 * invented, deliberately dull, and none of them is a real spec of anyone's.
 * Row labels are display names, not directory slugs, because that is what the
 * real tree shows: `specExplorerProvider` labels a spec with
 * `resolveSpecDisplayName(specContext.specName, dir)`, which title-cases the
 * recorded name. The slug survives as the row's `data-row` id.
 *
 * WHAT EACH MARK MEANS (all from `specExplorerProvider.ts`, not from the
 * snapshots, which are one version behind on colour)
 *   Active group      `pulse`
 *   Completed group   `pass-filled` in testing.iconPassed green
 *   feature           `beaker`, tinted by lifecycle
 *   document done     `pass` in the same green
 *   document running  `circle-filled` in charts.blue
 *   document absent   no icon at all, plus a dim "not created"
 *
 * DETERMINISM
 * Wrapped in `CaptureFrame`, which freezes the clock and disables every
 * transition and animation. Nothing in these rows reads a clock anyway — the
 * relative times are literal strings, so two captures a month apart are
 * identical to the pixel.
 *
 * ADDRESSABILITY
 * Every row carries `id="row-<slug>"` and `data-row="<slug>"`, so a composition
 * can highlight, mask, or morph one row without counting from the top.
 *
 * FRAME SIZE
 * 340 x 776. 340 is the sidebar's native width (`docs/screenshots/sidebar.png`
 * is 676px at dpr 2, so 338 CSS pixels) and 776 is STAGE_HEIGHT from the
 * episode-1 frame contract, so a sidebar frame and a viewer frame share a
 * baseline in the composition.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { CaptureFrame, STAGE_HEIGHT } from './captureFrame';
import {
    SidebarShell,
    SIDEBAR_WIDTH,
    type RowState,
    type SidebarPane,
    type SidebarRow,
} from './sidebarTree';

// ── Teamboard fixture rows ────────────────────────────────────────────────
// Boring on purpose. A demo sidebar that shows off clever feature names reads
// as marketing; this one has to read as somebody's Tuesday.

const activeGroup: SidebarRow = {
    id: 'group-active',
    depth: 0,
    label: 'Active (3)',
    icon: 'pulse',
    twistie: 'expanded',
};

const completedGroup: SidebarRow = {
    id: 'group-completed',
    depth: 0,
    label: 'Completed (2)',
    icon: 'pass-filled',
    tone: 'passed',
    twistie: 'expanded',
};

/** The feature the whole series is about. Mid-plan: spec done, plan running. */
const profilePhotoUpload: SidebarRow = {
    id: '041-profile-photo-upload',
    depth: 1,
    label: 'Profile Photo Upload',
    description: '12m ago',
    icon: 'beaker',
    tone: 'blue',
    twistie: 'collapsed',
};

/**
 * The documents under the expanded feature, one of each mark the tree can
 * draw: a finished document, one still being written, and one that does not
 * exist yet. The absent row has NO icon element, which is what pulls its label
 * left of its siblings — that shift is the tell, so it must not be faked with
 * a dim icon.
 */
const profilePhotoUploadDocs: SidebarRow[] = [
    {
        id: '041-doc-specification',
        depth: 2,
        label: 'Specification',
        icon: 'pass',
        tone: 'passed',
        twistie: 'expanded',
    },
    { id: '041-doc-requirements', depth: 3, label: 'Requirements' },
    {
        id: '041-doc-plan',
        depth: 2,
        label: 'Plan',
        icon: 'circle-filled',
        tone: 'blue',
        twistie: 'collapsed',
    },
    { id: '041-doc-tasks', depth: 2, label: 'Tasks', description: 'not created' },
];

const activeSpecs: SidebarRow[] = [
    profilePhotoUpload,
    {
        id: '042-member-status-badges',
        depth: 1,
        label: 'Member Status Badges',
        // A per-task implement finish is the one history entry that puts a task
        // id on the row (`deriveLastTransition`), so one fixture row carries it.
        description: 'T004 · 2h ago',
        icon: 'beaker',
        tone: 'blue',
        twistie: 'collapsed',
    },
    {
        // No recorded context yet, so: plain beaker, no description.
        id: '043-export-directory-list',
        depth: 1,
        label: 'Export Directory List',
        icon: 'beaker',
        twistie: 'collapsed',
    },
];

const completedSpecs: SidebarRow[] = [
    {
        id: '038-team-invite-emails',
        depth: 1,
        label: 'Team Invite Emails',
        description: '2d ago',
        icon: 'beaker',
        tone: 'passed',
        twistie: 'collapsed',
    },
    {
        id: '037-avatar-placeholder-colors',
        depth: 1,
        label: 'Avatar Placeholder Colors',
        description: '5d ago',
        icon: 'beaker',
        tone: 'passed',
        twistie: 'collapsed',
    },
];

function specsRows(expandProfilePhoto: boolean): SidebarRow[] {
    return [
        activeGroup,
        ...(expandProfilePhoto
            ? [
                  { ...profilePhotoUpload, twistie: 'expanded' as const },
                  ...profilePhotoUploadDocs,
                  ...activeSpecs.slice(1),
              ]
            : activeSpecs),
        completedGroup,
        ...completedSpecs,
    ];
}

/**
 * Living Specs. Directory groups carry `folder`; a capability carries
 * `symbol-namespace`, turning list.warningForeground with a "drift" suffix once
 * its sources moved on past the spec's last commit
 * (`livingSpecsExplorerProvider.ts`).
 */
const livingSpecsRows: SidebarRow[] = [
    { id: 'ls-capabilities', depth: 0, label: 'capabilities', icon: 'folder', twistie: 'expanded' },
    {
        id: 'ls-member-profiles',
        depth: 1,
        label: 'member-profiles',
        description: '9/9 covered',
        icon: 'symbol-namespace',
        tone: 'foreground',
    },
    {
        id: 'ls-photo-storage',
        depth: 1,
        label: 'photo-storage',
        description: '7/9 covered · drift',
        icon: 'symbol-namespace',
        tone: 'warning',
    },
    {
        id: 'ls-team-invites',
        depth: 1,
        label: 'team-invites',
        description: '4/4 covered',
        icon: 'symbol-namespace',
        tone: 'foreground',
    },
    { id: 'ls-src', depth: 0, label: 'src', icon: 'folder', twistie: 'expanded' },
    {
        id: 'ls-directory-search',
        depth: 1,
        label: 'directory-search',
        description: '6/6 covered',
        icon: 'symbol-namespace',
        tone: 'foreground',
    },
    {
        id: 'ls-avatar-rendering',
        depth: 1,
        label: 'avatar-rendering',
        description: 'drift',
        icon: 'symbol-namespace',
        tone: 'warning',
    },
];

/**
 * The DEEPER Living Specs fixture, for the `living-specs` clip.
 *
 * Same provider, more of it. `livingSpecsRows` above is the short version the
 * small README frames use; this one is a whole repository's worth, because the
 * clip has to read as a work tree rather than as two rows, and because the
 * thing it films only shows up once there is depth to see.
 *
 * SHAPE, AND WHY IT IS THE SHAPE
 * `buildCapabilityTree` (livingSpecsModel.ts) groups a capability under the
 * PARENT of the folder its spec sits in, then sorts groups and leaves together
 * by name at every level. So the layout below is not a taste decision, it is
 * what these eight registered capabilities produce:
 *
 *   capabilities/member-profiles/spec.md            -> capabilities > member-profiles
 *   capabilities/photo-storage/spec.md              -> capabilities > photo-storage
 *   capabilities/team-invites/spec.md               -> capabilities > team-invites
 *   src/features/directory-search/directory-search.spec.md  -> src > features > ...
 *   src/features/saved-views/saved-views.spec.md            -> src > features > ...
 *   src/jobs/thumbnail-queue/thumbnail-queue.spec.md        -> src > jobs > ...
 *   src/services/avatar-rendering/avatar-rendering.spec.md  -> src > services > ...
 *   src/services/email-delivery/email-delivery.spec.md      -> src > services > ...
 *
 * The first three are `_location()` CENTRALIZED (resolve-spec-paths.py): their
 * spec is exactly `capabilities/<name>/spec.md`, the default when a capability
 * names no `spec:` path. The other five are COLOCATED: they named a path, so the
 * spec sits in the code and the tree puts it there. That contrast is the whole
 * reason this fixture is deep.
 *
 * Every row type here is one the provider really renders:
 *   folder group        `folder`, expanded (LivingSpecItem.dirGroup)
 *   capability          `symbol-namespace`, coverage and drift joined with " · "
 *   drifted capability  the same in list.warningForeground
 *   registered, unwritten  `circle-outline` and "not created" (cap.exists false)
 *   Orphans             a `question` group of `*.spec.md` files no capability
 *                       claims, appended after the tree
 *
 * A capability row is a LEAF: `capabilityItem` gives it a twistie only when it
 * has a tier sibling, and nothing in the product generates `.arch.md` or
 * `.coverage.md`, so none is drawn here.
 */
const livingWorkTreeRows: SidebarRow[] = [
    { id: 'lw-capabilities', depth: 0, label: 'capabilities', icon: 'folder', twistie: 'expanded' },
    {
        id: 'lw-member-profiles',
        depth: 1,
        label: 'member-profiles',
        description: '9/9 covered',
        icon: 'symbol-namespace',
        tone: 'foreground',
    },
    {
        id: 'lw-photo-storage',
        depth: 1,
        label: 'photo-storage',
        description: '7/9 covered · drift',
        icon: 'symbol-namespace',
        tone: 'warning',
    },
    {
        id: 'lw-team-invites',
        depth: 1,
        label: 'team-invites',
        description: '4/4 covered',
        icon: 'symbol-namespace',
        tone: 'foreground',
    },
    { id: 'lw-src', depth: 0, label: 'src', icon: 'folder', twistie: 'expanded' },
    { id: 'lw-features', depth: 1, label: 'features', icon: 'folder', twistie: 'expanded' },
    {
        id: 'lw-directory-search',
        depth: 2,
        label: 'directory-search',
        description: '6/6 covered',
        icon: 'symbol-namespace',
        tone: 'foreground',
    },
    {
        // Registered in the capability list, spec not written yet: no icon tint,
        // `circle-outline`, and the "not created" suffix.
        id: 'lw-saved-views',
        depth: 2,
        label: 'saved-views',
        description: 'not created',
        icon: 'circle-outline',
    },
    { id: 'lw-jobs', depth: 1, label: 'jobs', icon: 'folder', twistie: 'expanded' },
    {
        id: 'lw-thumbnail-queue',
        depth: 2,
        label: 'thumbnail-queue',
        description: '5/5 covered',
        icon: 'symbol-namespace',
        tone: 'foreground',
    },
    { id: 'lw-services', depth: 1, label: 'services', icon: 'folder', twistie: 'expanded' },
    {
        id: 'lw-avatar-rendering',
        depth: 2,
        label: 'avatar-rendering',
        description: 'drift',
        icon: 'symbol-namespace',
        tone: 'warning',
    },
    {
        id: 'lw-email-delivery',
        depth: 2,
        label: 'email-delivery',
        description: '3/3 covered',
        icon: 'symbol-namespace',
        tone: 'foreground',
    },
    { id: 'lw-orphans', depth: 0, label: 'Orphans', icon: 'question', twistie: 'expanded' },
    { id: 'lw-orphan-legacy-import', depth: 1, label: 'legacy-import.spec.md', icon: 'file' },
];

/**
 * The deep tree as a pane, optionally with one row under the pointer or picked.
 * `emphasis` is how the clip films a click without inventing chrome: the two
 * washes are the list's own (see sidebarTree.tsx ROW STATE).
 */
export function livingSpecsWorkTreePane(
    emphasis?: { row: string; state: RowState },
    fill = false,
): SidebarPane {
    return {
        id: 'living-specs',
        title: 'Living Specs',
        rows: emphasis
            ? livingWorkTreeRows.map(r => (r.id === emphasis.row ? { ...r, state: emphasis.state } : r))
            : livingWorkTreeRows,
        fill,
    };
}

/** Steering. Categories carry an icon; the files under them never do. */
const steeringRows: SidebarRow[] = [
    {
        id: 'st-speckit-files',
        depth: 0,
        label: 'SpecKit Project Files',
        icon: 'library',
        twistie: 'expanded',
    },
    { id: 'st-constitution', depth: 1, label: 'Constitution', icon: 'law' },
    { id: 'st-scripts', depth: 1, label: 'Scripts', icon: 'terminal', twistie: 'collapsed' },
    { id: 'st-templates', depth: 1, label: 'Templates', icon: 'files', twistie: 'expanded' },
    { id: 'st-template-spec', depth: 2, label: 'spec-template.md' },
    { id: 'st-template-plan', depth: 2, label: 'plan-template.md' },
    { id: 'st-template-tasks', depth: 2, label: 'tasks-template.md' },
];

// Exported (and named in `excludeStories` below) so the README composites in
// ReadmeCapture.stories.tsx reuse these fixture rows instead of forking them.
export function specsPane(expandProfilePhoto: boolean, fill = true): SidebarPane {
    return { id: 'specs', title: 'Specs', rows: specsRows(expandProfilePhoto), fill };
}

export const livingSpecsPane = (fill = false): SidebarPane => ({
    id: 'living-specs',
    title: 'Living Specs',
    rows: livingSpecsRows,
    fill,
});

export const steeringPane = (fill = false): SidebarPane => ({
    id: 'steering',
    title: 'Steering',
    rows: steeringRows,
    fill,
});

const meta: Meta = {
    title: 'Video Capture/Specs Sidebar (Recreation)',
    excludeStories: ['specsPane', 'livingSpecsPane', 'livingSpecsWorkTreePane', 'steeringPane'],
    parameters: {
        layout: 'fullscreen',
        capture: { width: SIDEBAR_WIDTH, height: STAGE_HEIGHT },
        docs: {
            description: {
                component:
                    'A presentational recreation of the native VS Code Specs TreeView, not the ' +
                    'view itself: it renders fixture rows with the tree markup and ' +
                    'geometry so the video series can regenerate a sidebar frame without ' +
                    'driving VS Code. Measured against the DevTools captures in ' +
                    'docs/reference/sidebar-snapshots/; icon and state vocabulary follows ' +
                    'src/features/specs/specExplorerProvider.ts.',
            },
        },
    },
};
export default meta;
type Story = StoryObj;

// ── B1 · everything closed ────────────────────────────────────────────────
// The resting state: two group headers, five features, nothing opened. This is
// the frame a beat cuts to before anything has been clicked.

export const B1Collapsed: Story = {
    name: 'B1 · Features collapsed',
    render: () => (
        <CaptureFrame>
            <SidebarShell
                panes={[
                    specsPane(false),
                    { ...livingSpecsPane(), collapsed: true },
                    { ...steeringPane(), collapsed: true },
                ]}
            />
        </CaptureFrame>
    ),
};

// ── B2 · one feature opened ───────────────────────────────────────────────
// Profile Photo Upload opened onto its documents: Specification done, Plan
// running, Tasks not created. The three marks in one frame is the whole point
// of this story, so do not "tidy" the Tasks row into having an icon.

export const B2Expanded: Story = {
    name: 'B2 · Profile Photo Upload expanded',
    render: () => (
        <CaptureFrame>
            <SidebarShell
                panes={[
                    specsPane(true),
                    { ...livingSpecsPane(), collapsed: true },
                    { ...steeringPane(), collapsed: true },
                ]}
            />
        </CaptureFrame>
    ),
};

// ── B3 · the other two sections ───────────────────────────────────────────
// Specs collapsed out of the way so Living Specs and Steering carry the frame.

export const B3LivingSpecsAndSteering: Story = {
    name: 'B3 · Living Specs and Steering',
    render: () => (
        <CaptureFrame>
            <SidebarShell
                panes={[
                    { ...specsPane(false), collapsed: true },
                    livingSpecsPane(),
                    steeringPane(true),
                ]}
            />
        </CaptureFrame>
    ),
};

// ── B4 · the whole sidebar ────────────────────────────────────────────────
// All three sections open at once, which is the establishing shot: this is
// what the extension puts in the activity bar.

export const B4FullSidebar: Story = {
    name: 'B4 · All three sections',
    render: () => (
        <CaptureFrame>
            <SidebarShell
                panes={[specsPane(true, false), livingSpecsPane(), steeringPane(true)]}
            />
        </CaptureFrame>
    ),
};


// ── B5 · README triptych ──────────────────────────────────────────────────
// The landscape sidebar image for the README's "A sidebar that scales"
// section: the three sections side by side as cards, each with a heading and
// one explainer line, instead of one tall silent portrait. Captured by
// scripts/capture-docs-images.mjs into docs/screenshots/generated/
// sidebar-triptych.png. One highlight per panel at most.

/**
 * Draw one measured ring (plus an optional label chip) around the union rect
 * of the named rows. Measured with getBoundingClientRect after layout, never
 * eyeballed, same idea as the capture script's annotation pass.
 */
function PanelHighlight({ rowIds, chip }: { rowIds: string[]; chip?: string }) {
    const holder = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState<{ l: number; t: number; w: number; h: number } | null>(null);
    useLayoutEffect(() => {
        const card = holder.current?.parentElement;
        if (!card) return;
        const cardRect = card.getBoundingClientRect();
        const rects = rowIds
            .map((id) => card.querySelector(`#row-${id}`)?.getBoundingClientRect())
            .filter((r): r is DOMRect => !!r);
        if (rects.length === 0) return;
        const l = Math.min(...rects.map((r) => r.left)) - cardRect.left;
        const t = Math.min(...rects.map((r) => r.top)) - cardRect.top;
        const right = Math.max(...rects.map((r) => r.right)) - cardRect.left;
        const bottom = Math.max(...rects.map((r) => r.bottom)) - cardRect.top;
        setBox({ l, t, w: right - l, h: bottom - t });
    }, []);
    const PAD = 3;
    return (
        <div ref={holder} style="position: absolute; inset: 0; pointer-events: none;">
            {box ? (
                <div
                    style={`position: absolute; left: ${box.l - PAD}px; top: ${box.t - PAD}px; width: ${box.w + PAD * 2}px; height: ${box.h + PAD * 2}px; border: 2px solid #78dce8; border-radius: 6px; box-sizing: border-box;`}
                />
            ) : null}
            {box && chip ? (
                <div
                    style={`position: absolute; left: ${box.l + box.w - PAD - 8}px; top: ${box.t + box.h / 2}px; transform: translate(-100%, -50%); background: #78dce8; color: #101416; font: 600 11px/1 var(--vscode-font-family); padding: 4px 7px; border-radius: 4px; white-space: nowrap;`}
                >
                    {chip}
                </div>
            ) : null}
        </div>
    );
}

function TriptychPanel({
    heading,
    caption,
    pane,
    highlight,
}: {
    heading: string;
    caption: string;
    pane: SidebarPane;
    highlight?: ComponentChildren;
}) {
    return (
        <div style="width: 340px; display: flex; flex-direction: column;">
            <div style="font: 600 17px/1.3 var(--vscode-font-family); color: #e2e2e2; margin-bottom: 6px;">
                {heading}
            </div>
            <div style="font: 400 12.5px/1.5 var(--vscode-font-family); color: #9a9a9a; margin-bottom: 14px; min-height: 56px;">
                {caption}
            </div>
            <div style="position: relative; border: 1px solid #2e2e2e; border-radius: 8px; overflow: hidden; background: var(--vscode-sideBar-background); height: 286px; flex-shrink: 0;">
                <SidebarShell panes={[{ ...pane, fill: false }]} />
                {highlight}
            </div>
        </div>
    );
}

export const B5ReadmeTriptych: Story = {
    name: 'B5 · README triptych',
    parameters: { capture: { width: 1176, height: 458 } },
    render: () => (
        <CaptureFrame>
            <style>{'.sk-triptych .sk-sidebar .composite.title { display: none !important; }'}</style>
            <div
                class="sk-triptych"
                style="display: flex; gap: 38px; justify-content: center; align-items: flex-start; width: 100%; height: 100%; box-sizing: border-box; padding: 36px 40px; background: var(--vscode-editor-background);"
            >
                <TriptychPanel
                    heading="Every feature at a glance"
                    caption="Each feature is a row in the Specs view. The marks show how far every document has moved: done, still being written, or not created yet."
                    pane={specsPane(true, false)}
                    highlight={
                        <PanelHighlight
                            rowIds={[
                                '041-doc-specification',
                                '041-doc-requirements',
                                '041-doc-plan',
                                '041-doc-tasks',
                            ]}
                            chip="done · running · not created"
                        />
                    }
                />
                <TriptychPanel
                    heading="The rules the AI follows"
                    caption="Steering holds the standing files every run obeys: the constitution, the project scripts, and the templates specs are built from."
                    pane={steeringPane(false)}
                />
                <TriptychPanel
                    heading="Docs that track the code"
                    caption="Living Specs are durable, one per capability, with test coverage counts and a drift flag the moment the code moves on."
                    pane={livingSpecsPane(false)}
                    highlight={<PanelHighlight rowIds={['ls-photo-storage']} />}
                />
            </div>
        </CaptureFrame>
    ),
};
