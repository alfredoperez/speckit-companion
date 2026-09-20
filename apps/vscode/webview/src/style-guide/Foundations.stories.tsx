/**
 * STYLE GUIDE · FOUNDATIONS
 * ─────────────────────────────────────────────────────────────────────────
 * The colours, type, and marks the three surfaces share, rendered from their
 * sources rather than retyped: the capture palettes come from
 * `.storybook/capture-theme.ts`, the fonts from the files the clip
 * compositions embed, the mascot from `website/public/mascot/`. If a swatch
 * here is wrong, the source is wrong. The words are in DESIGN.md at the root.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import type { ComponentChildren } from 'preact';
import {
    beardedMonokaiBlack,
    constellationLight,
    constellationViolet,
    type CapturePalette,
} from '../../../../../.storybook/capture-theme';
import { GEIST_FACES, MASCOT_POSES, T, Wordmark } from '../spec-viewer/__stories__/figure';

import figtree from '../../../../../content/media/feature-clips/step-rail/assets/fonts/Figtree.ttf';
import jetbrains from '../../../../../content/media/landing-video/hf/assets/fonts/JetBrainsMono-400.woff2';
import fraunces from '../../../../../content/media/landing-video/hf/assets/fonts/Fraunces-400.ttf';

const meta: Meta = {
    title: 'Core/Foundations',
    parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

const FACES = `
${GEIST_FACES}
@font-face { font-family: 'Figtree'; src: url('${figtree}') format('truetype'); font-weight: 300 800; }
@font-face { font-family: 'JetBrains Mono'; src: url('${jetbrains}') format('woff2'); font-weight: 400; }
@font-face { font-family: 'Fraunces'; src: url('${fraunces}') format('truetype'); font-weight: 400; }
`;

const PAGE = `min-height: 100vh; padding: 40px 48px 64px; box-sizing: border-box; background: ${T.ground}; color: ${T.textPrimary}; font-family: Geist, system-ui, sans-serif;`;
const H1 = `font: 600 30px/1.1 Geist, system-ui, sans-serif; letter-spacing: -0.02em; margin: 0 0 8px;`;
const H2 = `font: 600 18px/1.2 Geist, system-ui, sans-serif; margin: 40px 0 14px; color: ${T.textPrimary};`;
const LEDE = `font: 400 16px/1.5 Geist, system-ui, sans-serif; color: ${T.textBody}; max-width: 64ch; margin: 0;`;
const KICK = `font: 500 11px/1 'JetBrains Mono', monospace; letter-spacing: 0.18em; text-transform: uppercase; color: ${T.textMuted};`;

function Page({ title, lede, children }: { title: string; lede: string; children: ComponentChildren }) {
    return (
        <div style={PAGE}>
            <style>{FACES}</style>
            <h1 style={H1}>{title}</h1>
            <p style={LEDE}>{lede}</p>
            {children}
        </div>
    );
}

// ── Palettes ──────────────────────────────────────────────────────────────

const ROLE_ORDER: (keyof CapturePalette['roles'])[] = [
    'editorGround',
    'sidebarGround',
    'raisedSurface',
    'controlSurface',
    'inputSurface',
    'hairline',
    'hairlineStrong',
    'paneEdge',
    'textPrimary',
    'textBody',
    'textMuted',
    'textDim',
    'accent',
    'primaryAction',
    'focus',
    'hoverWash',
    'pass',
    'warn',
    'error',
    'running',
];

function Swatches({ name, palette, note }: { name: string; palette: CapturePalette; note: string }) {
    return (
        <div style="margin-bottom: 28px;">
            <div style="display: flex; align-items: baseline; gap: 14px; margin-bottom: 10px;">
                <span style={`font: 600 15px/1 Geist, system-ui, sans-serif;`}>{name}</span>
                <span style={`font: 400 13px/1.4 Geist, system-ui, sans-serif; color: ${T.textMuted};`}>{note}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 8px;">
                {ROLE_ORDER.map((role) => {
                    const hex = palette.roles[role];
                    return (
                        <div key={role} style={`border: 1px solid ${T.borderPanel}; border-radius: 8px; overflow: hidden; background: ${T.panel};`}>
                            <div style={`height: 44px; background: ${hex};`} />
                            <div style="padding: 7px 8px 8px;">
                                <div style={`font: 500 11px/1.2 Geist, system-ui, sans-serif; color: ${T.textPrimary}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`}>{role}</div>
                                <div style={`font: 400 11px/1.2 'JetBrains Mono', monospace; color: ${T.textMuted}; margin-top: 3px;`}>{hex}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export const Palettes: Story = {
    name: 'Palettes',
    render: () => (
        <Page
            title="Palettes"
            lede="Every capture, clip, and figure is painted from one of these. A palette is twenty named roles; the fifty VS Code variables are derived. The site's own tokens are the violet cut of the same ramp."
        >
            <h2 style={H2}>Where each one is used</h2>
            <Swatches name="Constellation Violet" palette={constellationViolet} note="the brand's dark cut · article figures, always · the site's ground and accent" />
            <Swatches name="Constellation Light" palette={constellationLight} note="the active capture palette · README and docs screenshots, clips, GIFs" />
            <Swatches name="Bearded Monokai Black" palette={beardedMonokaiBlack} note="the theme every capture used before the retheme · preserved, not used" />
            <h2 style={H2}>The frame's own colours</h2>
            <p style={LEDE}>
                A figure's chrome does not follow the capture palette. It is the site's Constellation tokens, transcribed: ground {T.ground}, panel {T.panel}, borders {T.borderPanel} and {T.borderStrong}, text {T.textPrimary} / {T.textBody} / {T.textMuted}, accent {T.accent}, green {T.green}.
            </p>
        </Page>
    ),
};

// ── Type ──────────────────────────────────────────────────────────────────

function Specimen({ face, role, where, sample, style }: { face: string; role: string; where: string; sample: string; style: string }) {
    return (
        <div style={`display: grid; grid-template-columns: 220px 1fr; gap: 24px; padding: 18px 0; border-bottom: 1px solid ${T.borderPanel}; align-items: start;`}>
            <div>
                <div style={`font: 600 14px/1.3 Geist, system-ui, sans-serif;`}>{face}</div>
                <div style={`font: 400 13px/1.4 Geist, system-ui, sans-serif; color: ${T.textMuted}; margin-top: 4px;`}>{role}</div>
                <div style={`${KICK} margin-top: 8px;`}>{where}</div>
            </div>
            <div style={`${style} color: ${T.textPrimary};`}>{sample}</div>
        </div>
    );
}

export const Type: Story = {
    name: 'Type',
    render: () => (
        <Page
            title="Type"
            lede="Three surfaces, three reading faces, one metadata face. A figure crosses two of them on purpose: Geist because it is read on the blog, JetBrains Mono for its kicker because that is the product's metadata voice."
        >
            <div style="margin-top: 24px;">
                <Specimen face="Figtree" role="The site's sans. Body and headings on speckit-companion.dev." where="website" sample="Give Spec Kit superpowers. One page per run, the spec as rows, a comment under the line it is about." style="font: 500 26px/1.25 Figtree, system-ui, sans-serif;" />
                <Specimen face="Geist" role="The blog's reading face, and the figure frame's caption and title." where="alfredo-perez.dev · figures · clips" sample="Not tests pass as a sentence. Five rows, each with the command that ran and what came back." style="font: 400 26px/1.3 Geist, system-ui, sans-serif;" />
                <Specimen face="Host editor font" role="The webview inherits VS Code's font. Captures show whatever the palette's font variables say." where="vs code extension" sample="A member can upload a profile photo from their own profile page." style="font: 400 24px/1.35 var(--vscode-font-family, system-ui);" />
                <Specimen face="JetBrains Mono" role="Metadata only: kickers, ids, counts, rail labels. Uppercase, wide tracking. Never body copy, never a button." where="website · extension · figures" sample="OVERVIEW · 3/5   FR-002   54m 36s elapsed" style="font: 400 18px/1.4 'JetBrains Mono', monospace; letter-spacing: 0.12em; text-transform: uppercase;" />
                <Specimen face="Fraunces" role="The landing video's serif accent, one word at a time. Not for figures, not for captions." where="landing video only" sample="what the run actually checked" style="font: 400 28px/1.2 Fraunces, Georgia, serif; font-style: italic;" />
            </div>
            <h2 style={H2}>Rules</h2>
            <p style={LEDE}>Sentence case everywhere. No italics in a figure. Bold lifts one phrase in a caption, never a sentence. Mono is uppercase and tracked, and it is the only place uppercase appears.</p>
        </Page>
    ),
};

// ── Marks ─────────────────────────────────────────────────────────────────

export const Marks: Story = {
    name: 'Marks and mascot',
    render: () => (
        <Page
            title="Marks and mascot"
            lede="Two marks, two jobs. The chevron wordmark is the product and goes on anything that shows the product. The mascot is the brand's character and goes on heroes, banners, and the caption of a figure. They never merge into one lockup."
        >
            <h2 style={H2}>The wordmark</h2>
            <div style={`display: flex; align-items: center; gap: 48px; padding: 28px 32px; background: ${T.panel}; border: 1px solid ${T.borderPanel}; border-radius: 12px; width: fit-content;`}>
                <Wordmark />
                <span style={`font: 400 13px/1.5 Geist, system-ui, sans-serif; color: ${T.textMuted}; max-width: 44ch;`}>
                    Double chevron with a check inside the right one, then "SpecKit Companion" as one word, weight 600, letter-spacing -0.01em. Path data from website/src/components/LogoMark.astro. Always top right on a figure, always this size.
                </span>
            </div>
            <h2 style={H2}>The mascot, by pose</h2>
            <div style="display: flex; gap: 28px; flex-wrap: wrap;">
                {(Object.keys(MASCOT_POSES) as (keyof typeof MASCOT_POSES)[]).map((pose) => (
                    <div key={pose} style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                        <div style={`width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; background: ${T.panel}; border: 1px solid ${T.borderPanel}; border-radius: 12px;`}>
                            <img src={MASCOT_POSES[pose]} alt="" style="height: 96px; width: auto; display: block;" />
                        </div>
                        <span style={KICK}>{pose}</span>
                    </div>
                ))}
            </div>
            <p style={`${LEDE} margin-top: 18px;`}>
                Fourteen poses ship in website/public/mascot; these five are the ones a figure or a hero reaches for. The mascot is a caretaker in a scene, never the subject. On a figure it stands at the caption, pointing. The "Spec Kit · Companion" lockup with the mascot beside it belongs to the ivory hero profile only.
            </p>
        </Page>
    ),
};
