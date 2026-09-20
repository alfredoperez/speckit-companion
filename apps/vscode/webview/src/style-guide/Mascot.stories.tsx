/**
 * STYLE GUIDE · MASCOT
 * ─────────────────────────────────────────────────────────────────────────
 * Every named pose the mascot ships in, rendered from the same derivatives
 * the site serves. Source is `assets/mascot/poses/`; `tooling/scripts/
 * build-mascot-assets.mjs` crops and resizes each one into `apps/website/
 * public/mascot/`, which is what this page reads. Add a pose there and it
 * shows up here on the next Storybook reload. Rules for how the mascot is
 * used are in DESIGN.md at the root.
 */

import type { Meta, StoryObj } from '@storybook/preact';

import jetbrains from '../../../../../content/media/landing-video/hf/assets/fonts/JetBrainsMono-400.woff2';
import { GEIST_FACES, T } from '../spec-viewer/__stories__/figure';

import building from '../../../../website/public/mascot/building-256.png';
import celebrating from '../../../../website/public/mascot/celebrating-256.png';
import errorPose from '../../../../website/public/mascot/error-256.png';
import experimenting from '../../../../website/public/mascot/experimenting-256.png';
import inspecting from '../../../../website/public/mascot/inspecting-256.png';
import lost from '../../../../website/public/mascot/lost-256.png';
import planting from '../../../../website/public/mascot/planting-256.png';
import pointing from '../../../../website/public/mascot/pointing-256.png';
import reading from '../../../../website/public/mascot/reading-256.png';
import running from '../../../../website/public/mascot/running-256.png';
import sleeping from '../../../../website/public/mascot/sleeping-256.png';
import tending from '../../../../website/public/mascot/tending-256.png';
import thinking from '../../../../website/public/mascot/thinking-256.png';
import waving from '../../../../website/public/mascot/waving-256.png';
import welcoming from '../../../../website/public/mascot/welcoming-256.png';
import writing from '../../../../website/public/mascot/writing-256.png';

const FACES = `${GEIST_FACES}
@font-face { font-family: 'JetBrains Mono'; src: url('${jetbrains}') format('woff2'); font-weight: 400; font-style: normal; }
`;

const meta: Meta = {
    title: 'Content/Mascot',
    parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

const PAGE = `min-height: 100vh; padding: 40px 48px 64px; box-sizing: border-box; background: ${T.ground}; color: ${T.textPrimary}; font-family: Geist, system-ui, sans-serif;`;
const H1 = `font: 600 30px/1.1 Geist, system-ui, sans-serif; letter-spacing: -0.02em; margin: 0 0 8px;`;
const LEDE = `font: 400 16px/1.5 Geist, system-ui, sans-serif; color: ${T.textBody}; max-width: 64ch; margin: 0;`;
const KICK = `font: 500 11px/1 'JetBrains Mono', monospace; letter-spacing: 0.18em; text-transform: uppercase; color: ${T.textMuted};`;

// Named for the pose file's own segment in assets/mascot/poses/.
const POSES: Record<string, string> = {
    building,
    celebrating,
    error: errorPose,
    experimenting,
    inspecting,
    lost,
    planting,
    pointing,
    reading,
    running,
    sleeping,
    tending,
    thinking,
    waving,
    welcoming,
    writing,
};

export const Poses: Story = {
    name: 'Poses',
    render: () => (
        <div style={PAGE}>
            <style>{FACES}</style>
            <h1 style={H1}>Mascot poses</h1>
            <p style={LEDE}>
                Sixteen named poses, each a moss creature with its glowing seedling. The mascot is a caretaker in a scene, never the subject: it stands at a figure's caption pointing, or beside a hero's headline, and it never carries the "Spec Kit · Companion" lockup outside the ivory hero profile. Every derivative here is a 256px crop to the pose's own alpha bounding box, built by `tooling/scripts/build-mascot-assets.mjs`; the site also serves 128 and 512px WebP/PNG pairs from the same source.
            </p>
            <div style="display: flex; flex-wrap: wrap; gap: 24px; margin-top: 28px;">
                {Object.entries(POSES).map(([pose, src]) => (
                    <div key={pose} style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                        <div style={`width: 132px; height: 132px; display: flex; align-items: center; justify-content: center; background: ${T.panel}; border: 1px solid ${T.borderPanel}; border-radius: 12px;`}>
                            <img src={src} alt="" style="height: 104px; width: auto; display: block;" />
                        </div>
                        <span style={KICK}>{pose}</span>
                    </div>
                ))}
            </div>
            <p style={`${LEDE} margin-top: 24px;`}>
                `tending` is the hero: the pose the landing page's hero cycles through, the only one generated rather than cropped from the original poses (DESIGN.md and `tooling/scripts/build-mascot-assets.mjs` say why). `pointing`, `waving`, `reading`, `thinking`, and `celebrating` are the ones an article figure reaches for today; the rest are available to any surface that names them.
            </p>
        </div>
    ),
};
