/**
 * STYLE GUIDE · HERO
 * ─────────────────────────────────────────────────────────────────────────
 * Heroes are generated, not rendered, so this page shows references and the
 * rules beside them rather than a component. The prompt profile lives in the
 * kaiju skill `create-image/references/branded-editorial-hero.md`; the
 * non-negotiables are repeated in DESIGN.md at the root. Two references ship
 * in docs/style-guide/.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import { GEIST_FACES, T } from '../spec-viewer/__stories__/figure';
import heroA from '../../../docs/style-guide/hero-brush-ivory.jpg';
import heroB from '../../../docs/style-guide/hero-brush-ivory-2.jpg';
import bannerArt from '../../../speckit-extension/assets/hero-draft-a.png';

const meta: Meta = {
    title: 'Content/Post Images',
    parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

const PAGE = `min-height: 100vh; padding: 40px 48px 64px; box-sizing: border-box; background: ${T.ground}; color: ${T.textPrimary}; font-family: Geist, system-ui, sans-serif;`;
const H1 = `font: 600 30px/1.1 Geist, system-ui, sans-serif; letter-spacing: -0.02em; margin: 0 0 8px;`;
const H2 = `font: 600 18px/1.2 Geist, system-ui, sans-serif; margin: 40px 0 14px;`;
const LEDE = `font: 400 16px/1.5 Geist, system-ui, sans-serif; color: ${T.textBody}; max-width: 64ch; margin: 0;`;
const KICK = `font: 500 11px/1 'JetBrains Mono', monospace; letter-spacing: 0.18em; text-transform: uppercase; color: ${T.textMuted};`;

function Reference({ src, kicker, title, note }: { src: string; kicker: string; title: string; note: string }) {
    return (
        <div style={`display: grid; grid-template-columns: 1fr 320px; gap: 24px; align-items: start; margin-bottom: 28px;`}>
            <img src={src} alt="" style={`width: 100%; height: auto; display: block; border: 1px solid ${T.borderPanel}; border-radius: 12px;`} />
            <div style="padding-top: 6px;">
                <div style={KICK}>{kicker}</div>
                <div style={`font: 600 16px/1.3 Geist, system-ui, sans-serif; margin: 8px 0 8px;`}>{title}</div>
                <div style={`font: 400 14px/1.5 Geist, system-ui, sans-serif; color: ${T.textBody};`}>{note}</div>
            </div>
        </div>
    );
}

export const BrushIvory: Story = {
    name: 'Brush-lettered ivory (articles)',
    render: () => (
        <div style={PAGE}>
            <style>{GEIST_FACES}</style>
            <h1 style={H1}>Article heroes</h1>
            <p style={LEDE}>
                The hero of a SpecKit article is the one place the brand goes warm: ivory paper, navy ink, black brush lettering for the headline, one scarce emerald, and the mascot as a caretaker in the scene. It is generated from the branded-editorial-hero profile in its ivory variant, and it is the only surface that carries the "Spec Kit · Companion" lockup with the mascot beside it.
            </p>
            <h2 style={H2}>References</h2>
            <Reference
                src={heroA}
                kicker="Article 22 · Give Spec Kit Superpowers"
                title="The lens on the terminal"
                note="A dense terminal and a viewfinder clipped on top showing the same lines as labeled rows with one green check. The metaphor is the article's claim: same files, a better way to read them. Headline exact, series line above, lockup bottom right, mascot holding the lens."
            />
            <Reference
                src={heroB}
                kicker="Article 17 · The Feature That Makes SDD Unstoppable"
                title="The plant that moved"
                note="A seedling lifted off a shelf of identical boxes and set down beside the one tool it belongs to, roots into the bench. The boxes recede in navy; the one leaf is the only green."
            />
            <h2 style={H2}>Non-negotiables</h2>
            <p style={LEDE}>
                Exact headline text and nothing else on the image. Generous clear space around every word and the lockup. Emerald is scarce: one leaf, one check, one pin. No neon, no glassmorphism, no decorative brackets or callouts on generated art. The mascot is never the subject. Aspect 16:9, rendered at 2k, filed at 1600 wide with a provenance sidecar beside it.
            </p>
        </div>
    ),
};

export const NightForest: Story = {
    name: 'Night forest (banners, marketplace)',
    render: () => (
        <div style={PAGE}>
            <style>{GEIST_FACES}</style>
            <h1 style={H1}>Banner and marketplace art</h1>
            <p style={LEDE}>
                The older generated identity, still the ground of the README cross-promo banners and the marketplace assets: a bioluminescent night forest as a developer tool, near-black navy lit by cyan, one scarce emerald. The Generated art section of DESIGN.md at the root is its source. It predates the Constellation violet the site and captures use; DESIGN.md says which surfaces still carry it.
            </p>
            <h2 style={H2}>Reference</h2>
            <Reference
                src={bannerArt}
                kicker="speckit-extension/assets/hero-draft-a.png"
                title="The moss sprite on its log"
                note="The mascot cradling its glowing seedling. Banners crop a band of this and set type over a scrim on the left. Type colours on this art are fixed literals, never palette variables, because the art does not follow the capture palette."
            />
        </div>
    ),
};
