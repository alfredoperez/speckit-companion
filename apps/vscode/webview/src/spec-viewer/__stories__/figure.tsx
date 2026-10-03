/**
 * The article figure frame. The figure style guide as code: see DESIGN.md at
 * the repo root and Style Guide/Figure in Storybook for the variations. Used by
 * FigureCapture.stories.tsx (the shots the docs script captures) and by the
 * style guide stories.
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

import mascotPointing from '../../../../../website/public/mascot/pointing-256.png';
import mascotWaving from '../../../../../website/public/mascot/waving-256.png';
import mascotReading from '../../../../../website/public/mascot/reading-256.png';
import mascotThinking from '../../../../../website/public/mascot/thinking-256.png';
import mascotCelebrating from '../../../../../website/public/mascot/celebrating-256.png';
import mossMark from '../../../../../../assets/icons/moss.svg';
import geistRegular from '../../../../../../content/media/feature-clips/step-rail/assets/fonts/Geist-Regular.ttf';
import geistMedium from '../../../../../../content/media/feature-clips/step-rail/assets/fonts/Geist-Medium.ttf';
import geistSemiBold from '../../../../../../content/media/feature-clips/step-rail/assets/fonts/Geist-SemiBold.ttf';

export const MASCOT_POSES = {
    pointing: mascotPointing,
    waving: mascotWaving,
    reading: mascotReading,
    thinking: mascotThinking,
    celebrating: mascotCelebrating,
} as const;
export type MascotPose = keyof typeof MASCOT_POSES;

// ── The frame's own colours: Constellation, transcribed from tokens.css. ──
// Literal on purpose. The frame IS the site's identity; it never follows the
// capture palette (see the header comment).
export const T = {
    ground: '#0a0913',
    panel: '#0d0b1a',
    borderPanel: '#2a2545',
    borderStrong: '#3a3357',
    textPrimary: '#edeaf6',
    textBody: '#b6b0d2',
    textMuted: '#9d97bd',
    accent: '#a78bfa',
    accentSolid: '#8b5cf6',
    green: '#7cc98a',
};

export const GEIST_FACES = `
@font-face { font-family: 'Geist'; src: url('${geistRegular}') format('truetype'); font-weight: 400; font-style: normal; }
@font-face { font-family: 'Geist'; src: url('${geistMedium}') format('truetype'); font-weight: 500; font-style: normal; }
@font-face { font-family: 'Geist'; src: url('${geistSemiBold}') format('truetype'); font-weight: 600; font-style: normal; }
`;

export const FIGURE_FONT = "'Geist', system-ui, sans-serif";

// The site's mark, the moss mascot; its 32 box pads the creature, hence the size and negative margin.
export function Wordmark() {
    return (
        <div style={`display: flex; align-items: center; gap: 12px; font: 600 17px/1 ${FIGURE_FONT}; letter-spacing: -0.01em; color: ${T.textPrimary}; white-space: nowrap; flex-shrink: 0;`}>
            <img src={mossMark} width={30} height={30} alt="" style="display: block; margin: -4px -3px -4px -4px;" />
            SpecKit Companion
        </div>
    );
}

export interface FigureMark {
    /** Selector, resolved inside the shot. The first match is outlined. */
    selector: string;
    /** `here` outlines in green (this is where it is); `point` in violet
     *  (this is the point). At most one `point` per figure. */
    kind: 'here' | 'point';
    label?: string;
    /** Extra padding around the measured rect, px. */
    pad?: number;
}

interface Rect {
    l: number;
    t: number;
    w: number;
    h: number;
}

/** Draw the outlines from measured rects. The shot's own content renders
 *  asynchronously (the viewer scrolls on a double rAF), so the measurement
 *  waits a beat and re-measures once more before the capture script's
 *  fonts.ready await resolves. */
function Marks({ marks }: { marks: FigureMark[] }) {
    const holder = useRef<HTMLDivElement>(null);
    const [rects, setRects] = useState<(Rect | null)[]>([]);
    const [shotW, setShotW] = useState(0);
    useLayoutEffect(() => {
        const shot = holder.current?.parentElement;
        if (!shot) return;
        const measure = () => {
            const base = shot.getBoundingClientRect();
            setShotW(base.width);
            setRects(
                marks.map((m) => {
                    const el = shot.querySelector<HTMLElement>(m.selector);
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    const pad = m.pad ?? 6;
                    return {
                        l: r.left - base.left - pad,
                        t: r.top - base.top - pad,
                        w: r.width + pad * 2,
                        h: r.height + pad * 2,
                    };
                }),
            );
        };
        let raf = 0;
        const t1 = setTimeout(() => (raf = requestAnimationFrame(measure)), 60);
        const t2 = setTimeout(measure, 400);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            cancelAnimationFrame(raf);
        };
    }, [marks]);
    return (
        <div ref={holder} style="position: absolute; inset: 0; pointer-events: none;">
            {marks.map((m, i) => {
                const r = rects[i];
                if (!r) return null;
                const colour = m.kind === 'point' ? T.accent : T.green;
                return (
                    <div key={i}>
                        <div style={`position: absolute; left: ${r.l}px; top: ${r.t}px; width: ${r.w}px; height: ${r.h}px; border: 3px solid ${colour}; border-radius: 8px; box-sizing: border-box;`} />
                        {m.label && (
                            <div style={`position: absolute; right: ${shotW - r.l - r.w + 12}px; top: ${r.t - 14}px; font: 600 14px/1 ${FIGURE_FONT}; color: ${T.ground}; background: ${colour}; padding: 7px 10px; border-radius: 6px; white-space: nowrap;`}>
                                {m.label}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

interface FigureProps {
    /** Names the screen, never the point: "What was checked". Omit it and the
     *  caption's `lead` carries the name instead, so only one text block sits
     *  outside the shot. */
    title?: string;
    /** Bold opener of the caption when there is no title chip: "Why the spec exists." */
    lead?: string;
    /** `window` draws an app title bar on the shot (traffic dots, a tab), so the
     *  reader sees an application window and not a texture. */
    chrome?: 'none' | 'window';
    /** The name in the window tab; defaults to "Spec Viewer". */
    windowName?: string;
    /** Lift the shot: lighter panel, accent-tinted border, soft glow. */
    lift?: boolean;
    /** Mobile-first layout: no header, the window is the top edge, the
     *  wordmark sits bottom right, and the caption is NOT baked in (it lives
     *  in the article as text). `zoom` scales the surface with real glyphs. */
    compact?: boolean;
    zoom?: number;
    /** The point of the figure, one sentence. <b> lifts the key phrase. */
    caption: ComponentChildren;
    marks?: FigureMark[];
    /** Padding inside the shot, for surfaces that need air (the comment card). */
    shotPadding?: string;
    /** Which mascot stands at the caption; `false` for none. */
    mascot?: MascotPose | false;
    children: ComponentChildren;
}

/** The frame. Header (title chip, wordmark), the shot, the caption with the
 *  mascot. The palette comes from the preview theme the entry is opened in. */
export function Figure({ title, lead, caption, marks = [], shotPadding, mascot = 'pointing', chrome = 'none', windowName = 'Spec Viewer', lift = false, compact = false, zoom = 1, children }: FigureProps) {
    useEffect(() => {
        document.fonts.load(`600 17px Geist`);
        document.fonts.load(`400 21px Geist`);
    }, []);
    if (compact) {
        return (
            <div style={`display: flex; flex-direction: column; width: 100%; height: 100%; box-sizing: border-box; padding: 18px 18px 14px; gap: 12px; background: ${T.ground}; font-family: ${FIGURE_FONT}; color: ${T.textPrimary};`}>
                <style>{GEIST_FACES}</style>
                <div style={`position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; border-radius: 12px; overflow: hidden; border: 1px solid rgba(167, 139, 250, 0.6); box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.18), 0 0 60px rgba(139, 92, 246, 0.28), 0 20px 50px rgba(0, 0, 0, 0.55); background: #16132a;`}>
                    <div style={`display: flex; align-items: center; gap: 12px; padding: 9px 14px; background: #1c1834; border-bottom: 1px solid ${T.borderPanel}; flex-shrink: 0;`}>
                        <span style="display: inline-flex; gap: 6px;">
                            <i style="width: 10px; height: 10px; border-radius: 50%; background: #ff5f57; display: block;" />
                            <i style="width: 10px; height: 10px; border-radius: 50%; background: #febc2e; display: block;" />
                            <i style="width: 10px; height: 10px; border-radius: 50%; background: #28c840; display: block;" />
                        </span>
                        <span style={`font: 500 13px/1 ${FIGURE_FONT}; color: ${T.textMuted};`}>{windowName}</span>
                    </div>
                    <div data-panel="shot" style={`position: relative; flex: 1; min-height: 0; overflow: hidden; ${shotPadding ? `padding: ${shotPadding};` : ''}`}>
                        <div style={`zoom: ${zoom}; height: ${100 / zoom}%;`}>{children}</div>
                        {marks.length > 0 && <Marks marks={marks} />}
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; flex-shrink: 0;">
                    <Wordmark />
                </div>
            </div>
        );
    }
    return (
        <div style={`display: flex; flex-direction: column; width: 100%; height: 100%; box-sizing: border-box; padding: 22px 26px 24px; gap: 16px; background: ${T.ground}; border: 1px solid ${T.borderPanel}; border-radius: 14px; font-family: ${FIGURE_FONT}; color: ${T.textPrimary};`}>
            <style>{GEIST_FACES}</style>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-shrink: 0;">
                {title ? (
                    <div style={`font: 600 18px/1 ${FIGURE_FONT}; padding: 9px 14px; border-radius: 9px; background: rgba(139, 92, 246, 0.25); border: 1px solid rgba(167, 139, 250, 0.5); color: ${T.textPrimary}; white-space: nowrap;`}>
                        {title}
                    </div>
                ) : (
                    <span />
                )}
                <Wordmark />
            </div>
            <div
                style={`position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; border-radius: 10px; overflow: hidden; ${
                    lift
                        ? `border: 1px solid rgba(167, 139, 250, 0.5); box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.12), 0 24px 60px rgba(0, 0, 0, 0.55); background: #16132a;`
                        : `border: 2px solid ${T.borderStrong}; background: ${T.panel};`
                }`}
            >
                {chrome === 'window' && (
                    <div style={`display: flex; align-items: center; gap: 14px; padding: 9px 14px; background: ${lift ? '#1c1834' : '#12101f'}; border-bottom: 1px solid ${T.borderPanel}; flex-shrink: 0;`}>
                        <span style="display: inline-flex; gap: 6px;">
                            <i style="width: 10px; height: 10px; border-radius: 50%; background: #ff5f57; display: block;" />
                            <i style="width: 10px; height: 10px; border-radius: 50%; background: #febc2e; display: block;" />
                            <i style="width: 10px; height: 10px; border-radius: 50%; background: #28c840; display: block;" />
                        </span>
                        <span style={`font: 500 12px/1 ${FIGURE_FONT}; color: ${T.textMuted}; letter-spacing: 0.01em;`}>{windowName}</span>
                    </div>
                )}
                <div data-panel="shot" style={`position: relative; flex: 1; min-height: 0; ${shotPadding ? `padding: ${shotPadding};` : ''}`}>
                    {children}
                    {marks.length > 0 && <Marks marks={marks} />}
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 16px; flex-shrink: 0;">
                {mascot && <img src={MASCOT_POSES[mascot]} alt="" style="width: 54px; height: 54px; flex: none; display: block;" />}
                <div style={`font: 400 21px/1.4 ${FIGURE_FONT}; color: ${T.textBody};`}>
                    {lead && <span style={`font-weight: 600; color: ${T.textPrimary};`}>{lead} </span>}
                    {caption}
                </div>
            </div>
        </div>
    );
}

/** The key phrase of a caption. */
export function B({ children }: { children: ComponentChildren }) {
    return <span style={`font-weight: 600; color: ${T.textPrimary};`}>{children}</span>;
}

