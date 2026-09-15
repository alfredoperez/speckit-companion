/**
 * The article figure frame. The figure style guide as code: see DESIGN.md at
 * the repo root and Style Guide/Figure in Storybook for the variations. Used by
 * FigureCapture.stories.tsx (the shots the docs script captures) and by the
 * style guide stories.
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

import mascotPointing from '../../../../website/public/mascot/pointing-256.png';
import mascotWaving from '../../../../website/public/mascot/waving-256.png';
import mascotReading from '../../../../website/public/mascot/reading-256.png';
import mascotThinking from '../../../../website/public/mascot/thinking-256.png';
import mascotCelebrating from '../../../../website/public/mascot/celebrating-256.png';
import geistRegular from '../../../../media/feature-clips/step-rail/assets/fonts/Geist-Regular.ttf';
import geistMedium from '../../../../media/feature-clips/step-rail/assets/fonts/Geist-Medium.ttf';
import geistSemiBold from '../../../../media/feature-clips/step-rail/assets/fonts/Geist-SemiBold.ttf';

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

// The site's mark: a double chevron with a check tucked inside the right one.
// Path data copied from website/src/components/LogoMark.astro, the chosen
// artwork in a 678 box, untouched. Change it there first.
const MARK = {
    right: 'M315.34 2.18C357.67-2.1 377.91 28.2 404.93 55.31L482.8 133.14L584.21 234.53C601.87 252.07 622.52 271.31 638.57 289.69C653.83 307.16 658.46 343.01 650.95 364.47C648.62 371.12 645.39 380.51 640.87 385.94C624.36 405.78 605.54 424.08 587.31 442.34L491.88 537.59L413.56 616.25C397.49 632.33 378.97 652.1 361.28 665.59C353.78 670.27 348.83 673.06 340.12 675.38C323.13 679.82 305.08 677.36 289.9 668.53C276.51 660.64 266.85 647.7 263.09 632.62C258.98 616.27 261.62 598.96 270.42 584.58C275.97 575.34 297.94 555.48 307 546.47L425.48 430.74C443.2 413.37 470.93 389 484.23 369.28C494.14 354.6 493.56 326.31 484.76 310.65C474.11 291.72 448.59 270.61 432.2 255.13L340.5 167.44C319.08 147.2 295.75 125.87 276.08 103.89C270.29 97.42 266.87 89.05 264.67 80.64C260.26 63.99 262.77 46.26 271.63 31.49C281.68 14.84 296.99 6.45 315.34 2.18z',
    armTop: 'M170.9 232.63L89.44 153.61C72.98 137.67 46.88 115.02 34.44 96.61C9.21 59.25 36.58 2.46 82.89 1.29C113.53 0.52 130.63 23.82 150.46 43.28C156.76 49.48 162.92 55.91 169.12 62.22C197.56 91.23 226.29 119.94 255.31 148.36C265.23 158.37 331.99 223.45 332.76 229.72C327 240.01 262.65 300.94 250.99 310.16C225.07 285.72 196.37 257.63 170.9 232.63z',
    elbowTop: 'M255.31 148.36C265.23 158.37 331.99 223.45 332.76 229.72C327 240.01 262.65 300.94 250.99 310.16C225.07 285.72 196.37 257.63 170.9 232.63C182.57 222.24 194.88 208.93 205.94 197.69L255.31 148.36z',
    armBottom: 'M169.67 451.43C195.29 425.65 225.42 394.59 251.81 369.89C259.8 376.73 331.49 446.43 332.55 451.22C327.33 461.58 267.72 520.38 254.9 533.4C217.03 571.66 179.03 609.89 141.17 648.15C124.85 664.65 110.3 677.32 85.8 677.01C71.59 676.84 56.35 671.51 46.27 661.13C34.73 649.07 28.38 632.97 28.59 616.27C29.14 581.69 58.75 560.4 81.65 537.76L169.67 451.43z',
    elbowBottom: 'M169.67 451.43C195.29 425.65 225.42 394.59 251.81 369.89C259.8 376.73 331.49 446.43 332.55 451.22C327.33 461.58 267.72 520.38 254.9 533.4C247.76 528.06 238.53 518.09 231.94 511.6L198.44 478.94C188.92 469.52 180.03 459.91 169.67 451.43z',
    check: 'M403.53 293.71C410.8 296.72 428.95 311.41 420 319.53C410.87 327.82 352.9 390.82 345.5 391.67C337.78 389.59 326.89 376.49 320.97 370.33C305.4 355.01 285.95 346.93 316.27 328.27C321.28 325.19 339.21 345.41 344.31 349.18L345.51 350.05C357.26 337.99 391.83 301.3 403.53 293.71z',
};

export function Wordmark() {
    return (
        <div style={`display: flex; align-items: center; gap: 12px; font: 600 17px/1 ${FIGURE_FONT}; letter-spacing: -0.01em; color: ${T.textPrimary}; white-space: nowrap; flex-shrink: 0;`}>
            <svg width="24" height="24" viewBox="0 0 678 678" fill="none" aria-hidden="true" style="display: block;">
                <path fill={T.textPrimary} d={MARK.right} />
                <path fill={T.accent} d={MARK.armTop} />
                <path fill={T.textPrimary} d={MARK.elbowTop} />
                <path fill={T.accent} d={MARK.armBottom} />
                <path fill={T.textPrimary} d={MARK.elbowBottom} />
                <path fill={T.textPrimary} d={MARK.check} />
            </svg>
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
export function Figure({ title, lead, caption, marks = [], shotPadding, mascot = 'pointing', chrome = 'none', windowName = 'Spec Viewer', lift = false, children }: FigureProps) {
    useEffect(() => {
        document.fonts.load(`600 17px Geist`);
        document.fonts.load(`400 21px Geist`);
    }, []);
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

