/**
 * STYLE GUIDE · FIGURE
 * ─────────────────────────────────────────────────────────────────────────
 * The article figure frame and every variation it allows, on one surface, so
 * a change to the frame is judged here before the eleven article figures are
 * reshot. The frame itself is `spec-viewer/__stories__/figure.tsx`. The rules
 * are in DESIGN.md at the root.
 *
 * Every story here is the same product surface (the completed run's verified
 * checks) so only the frame changes between stories.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import { CaptureFrame } from '../spec-viewer/__stories__/captureFrame';
import { vsFromContext, type SpecContextData } from '../spec-viewer/__stories__/viewerHarness';
import { B, Figure, type MascotPose } from '../spec-viewer/__stories__/figure';
import { IntentSection, VerifiedSection } from '../spec-viewer/components/OverviewDossier';
import ctxCompletedRaw from '../spec-viewer/__fixtures__/teamboard/041-profile-photo-upload/spec-context.completed.json?raw';

const meta: Meta = {
    title: 'Content/Figure',
    parameters: { layout: 'fullscreen' },
    // Figures are always violet; the toolbar can still switch it to see why.
    globals: { vscodeTheme: 'violet' },
};
export default meta;
type Story = StoryObj;

const ctx = JSON.parse(ctxCompletedRaw) as SpecContextData;
const vs = vsFromContext(ctx, []);
const SIZE = { width: 1240, height: 720 };
const DOSSIER_CSS = `.capture-stage .activity-panel { padding: 18px 30px; gap: 12px; max-width: none; }`;

function Verified() {
    return (
        <>
            <style>{DOSSIER_CSS}</style>
            <div class="activity-panel dossier" style="height: 100%; overflow: hidden;">
                <VerifiedSection state={vs} />
            </div>
        </>
    );
}

function Intent() {
    return (
        <>
            <style>{DOSSIER_CSS}</style>
            <div class="activity-panel dossier" style="height: 100%; overflow: hidden;">
                <IntentSection state={vs} />
            </div>
        </>
    );
}

const CAPTION = (
    <>
        Not "tests pass" as a sentence. <B>Five rows, each with the command that ran and what came back.</B>
    </>
);

export const Plain: Story = {
    name: '1 · Plain',
    parameters: { capture: SIZE },
    render: () => (
        <CaptureFrame>
            <Figure title="Overview: what was checked" caption={CAPTION}>
                <Verified />
            </Figure>
        </CaptureFrame>
    ),
};

export const HereOutline: Story = {
    name: '2 · Outline, "here"',
    parameters: { capture: SIZE },
    render: () => (
        <CaptureFrame>
            <Figure
                title="Overview: what was checked"
                caption={CAPTION}
                marks={[{ selector: '.dossier-verified__row, .dossier-check, li', kind: 'here', label: 'one check' }]}
            >
                <Verified />
            </Figure>
        </CaptureFrame>
    ),
};

export const PointOutline: Story = {
    name: '3 · Outline, "the point"',
    parameters: { capture: { width: 1240, height: 640 } },
    render: () => (
        <CaptureFrame>
            <Figure
                title="Overview: why the spec exists"
                caption={
                    <>
                        The reason in one sentence, then <B>how long each phase took</B>.
                    </>
                }
                marks={[{ selector: '.dossier-timing', kind: 'point', label: 'four phases, timed' }]}
            >
                <Intent />
            </Figure>
        </CaptureFrame>
    ),
};

export const TwoOutlines: Story = {
    name: '4 · Two outlines, one point',
    parameters: { capture: { width: 1240, height: 640 } },
    render: () => (
        <CaptureFrame>
            <Figure
                title="Overview: why the spec exists"
                caption={
                    <>
                        The rail says how long each phase took; the card says <B>which living specs the run folded back into</B>.
                    </>
                }
                marks={[
                    { selector: '.dossier-timing', kind: 'here', label: 'the rail' },
                    { selector: '.dossier-intent__living-specs', kind: 'point', label: 'folded back', pad: 8 },
                ]}
            >
                <Intent />
            </Figure>
        </CaptureFrame>
    ),
};

export const ShortCaption: Story = {
    name: '5 · Short caption',
    parameters: { capture: SIZE },
    render: () => (
        <CaptureFrame>
            <Figure title="Overview: what was checked" caption={<B>Each row names the command that ran.</B>}>
                <Verified />
            </Figure>
        </CaptureFrame>
    ),
};

export const LongCaption: Story = {
    name: '6 · Long caption (two lines)',
    parameters: { capture: { width: 1240, height: 760 } },
    render: () => (
        <CaptureFrame>
            <Figure
                title="Overview: what was checked"
                caption={
                    <>
                        Every check the run made, with the command that proves it and what it returned. If a check failed it sits here in red with its output, not buried in a terminal that closed with the session. <B>This is the part of the page to trust most.</B>
                    </>
                }
            >
                <Verified />
            </Figure>
        </CaptureFrame>
    ),
};

export const NoMascot: Story = {
    name: '7 · Without the mascot',
    parameters: { capture: SIZE },
    render: () => (
        <CaptureFrame>
            <Figure title="Overview: what was checked" caption={CAPTION} mascot={false}>
                <Verified />
            </Figure>
        </CaptureFrame>
    ),
};

export const MascotPoses: Story = {
    name: '8 · Mascot poses',
    parameters: { capture: { width: 1240, height: 1500 } },
    render: () => (
        <CaptureFrame>
            <div style="display: flex; flex-direction: column; gap: 18px; height: 100%;">
                {(['pointing', 'waving', 'reading', 'thinking', 'celebrating'] as MascotPose[]).map((pose) => (
                    <div key={pose} style="height: 280px;">
                        <Figure title={`Mascot: ${pose}`} caption={CAPTION} mascot={pose}>
                            <Verified />
                        </Figure>
                    </div>
                ))}
            </div>
        </CaptureFrame>
    ),
};

export const Portrait: Story = {
    name: '9 · Portrait (sidebar width)',
    parameters: { capture: { width: 760, height: 900 } },
    render: () => (
        <CaptureFrame>
            <Figure title="Overview: what was checked" caption={CAPTION}>
                <Verified />
            </Figure>
        </CaptureFrame>
    ),
};

export const WideArticleColumn: Story = {
    name: '10 · Wide (16:9, the viewer)',
    parameters: { capture: { width: 1600, height: 900 } },
    render: () => (
        <CaptureFrame>
            <Figure title="Overview: what was checked" caption={CAPTION}>
                <Verified />
            </Figure>
        </CaptureFrame>
    ),
};

export const TitleLengths: Story = {
    name: '11 · Title lengths',
    parameters: { capture: { width: 1240, height: 1100 } },
    render: () => (
        <CaptureFrame>
            <div style="display: flex; flex-direction: column; gap: 18px; height: 100%;">
                {['Overview', 'Overview: what was checked', 'Overview: what was checked, and what happened, with the command that proves each row'].map((title) => (
                    <div key={title} style="height: 340px;">
                        <Figure title={title} caption={CAPTION}>
                            <Verified />
                        </Figure>
                    </div>
                ))}
            </div>
        </CaptureFrame>
    ),
};
