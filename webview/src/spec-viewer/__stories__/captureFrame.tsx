/**
 * Determinism harness for the video-capture stories.
 *
 * These stories get SCREEN-CAPTURED for the Spec Kit Companion video series,
 * so two renders a month apart must produce identical pixels. Three things in
 * the viewer break that on their own, and this module stops all three.
 *
 *  1. `relativeTime.ts` defaults its `now` argument to a live `new Date()`.
 *     Fixture timestamps would drift from "42m ago" to "5 months ago".
 *  2. `components/ElapsedTimer.tsx` re-reads `Date.now()` every second, so an
 *     in-flight step's elapsed span climbs while the frame is being captured.
 *  3. CSS transitions and animations mean a frame grabbed at t+0ms and one
 *     grabbed at t+400ms differ.
 *
 * `freezeClock()` swaps the global `Date` for one whose zero-argument
 * constructor and `Date.now()` both return one fixed instant, which covers
 * (1) and (2) at once — including any future code that reaches for the clock.
 * `installCaptureStyles()` covers (3), and also kills scrollbars so a frame
 * never shows a scroll gutter.
 */

import { useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

/**
 * The instant every capture is taken at. Chosen to sit a few minutes after the
 * end of the Teamboard fixture run, so the Activity panel reads in minutes and
 * hours rather than days.
 */
export const CAPTURE_NOW_ISO = '2026-05-19T14:05:00.000Z';

/**
 * The frame contract in `Episode 1 Storyboard.md` reserves x 96–1320,
 * y 152–928 of the 1920x1080 canvas for product UI ("STAGE MAIN"). Rendering
 * at exactly that size means a capture drops into the composition 1:1 with no
 * resampling — which is what keeps 12px viewer type readable. Capture at a
 * device pixel ratio of 2 for retina headroom; never scale a 1920-wide capture
 * down into the stage, because that shrinks every glyph by a third.
 */
export const STAGE_WIDTH = 1224;
export const STAGE_HEIGHT = 776;

let realDate: DateConstructor | null = null;

/**
 * Pin the global clock. Idempotent; pair with `unfreezeClock()`. Pass an
 * instant when a story needs the run to look freshly in flight rather than
 * finished an hour ago.
 */
export function freezeClock(iso: string = CAPTURE_NOW_ISO): void {
    if (realDate) return;
    const RealDate = globalThis.Date;
    const fixedMs = new RealDate(iso).getTime();
    realDate = RealDate;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    class FrozenDate extends (RealDate as any) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        constructor(...args: any[]) {
            if (args.length === 0) {
                super(fixedMs);
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                super(...(args as [any]));
            }
        }
        static now(): number {
            return fixedMs;
        }
    }

    globalThis.Date = FrozenDate as unknown as DateConstructor;
}

/** Restore the real clock. Safe to call when nothing was frozen. */
export function unfreezeClock(): void {
    if (!realDate) return;
    globalThis.Date = realDate;
    realDate = null;
}

const STYLE_ID = 'video-capture-determinism';

/** Kill motion and scrollbars so any two captures of a story agree. */
export function installCaptureStyles(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
            caret-color: transparent !important;
        }
        *::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
        * { scrollbar-width: none !important; }
        html, body { overflow: hidden !important; margin: 0 !important; }
        /* .viewer-container is 100vh in the extension, where it owns the whole
           webview. Inside a fixed capture box it has to be the box instead.
           .spec-editor (the Create New Spec webview) is 100vh for the same
           reason and needs the same correction. */
        .capture-stage, .capture-stage .viewer-container, .capture-stage .spec-editor { height: 100% !important; }
    `;
    document.head.appendChild(style);
}

export function removeCaptureStyles(): void {
    document.getElementById(STYLE_ID)?.remove();
}

/**
 * Wraps a capture story. Freezes the clock DURING RENDER — before any child
 * reads `new Date()` — and releases everything on unmount so the rest of the
 * catalog keeps a live clock.
 */
export function CaptureFrame({ children, at }: { children: ComponentChildren; at?: string }) {
    freezeClock(at ?? CAPTURE_NOW_ISO);
    installCaptureStyles();

    useEffect(
        () => () => {
            unfreezeClock();
            removeCaptureStyles();
        },
        [],
    );

    return <div class="capture-stage" style="width: 100%; height: 100%;">{children}</div>;
}
