#!/usr/bin/env node
// Builds a feature clip in caption style D: a dot-grid ground, the real VS Code window as a rounded card,
// a camera that zooms to one part at a time, a green ring on that part, and a "bold noun, grey phrase" pill beside it.
//
// The clip's words and order live in content/media/feature-clips/<id>/beats.json. Every picture and every box comes
// from desktop-check.mjs (a clip-* step saves <name>.png and <name>.rects.json), copied into the clip's assets/captures/.
//
//   node tooling/scripts/build-caption-clip.mjs review [--shots .shots-d]   # copies the pictures, writes index.html and timing.json
//   node tooling/scripts/build-caption-clip.mjs review --sheet               # after a render: one contact sheet, a frame per caption
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const id = process.argv[2];
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > -1 ? process.argv[at + 1] : fallback;
};
if (!id) {
    console.error('usage: build-caption-clip.mjs <clip id> [--shots <dir>] [--sheet]');
    process.exit(2);
}
const CLIP = join(ROOT, 'content', 'media', 'feature-clips', id);
const config = JSON.parse(readFileSync(join(CLIP, 'beats.json'), 'utf8'));

// ------------------------------------------------------------------ timing (seconds)
// Look and motion copied from style D of the caption comparison page; the camera move is option A's.
const T = {
    intro: 1.0, // the whole window at rest, the poster frame
    move: 0.9, // camera move, expo.out
    settle: 0.5, // into the move, the ring and pill come in
    inDur: 0.16, // ring and dim fade in
    pillDur: 0.3, // pill rises 8px, expo.out
    hold: 2.4,
    outDur: 0.16,
    fade: 0.3, // cross-fade between two pictures
    outro: 1.2, // back to the whole window, held
};

const FW = 1836, FH = 1164;
const CARD_W = Math.round((FW * 1500) / 1920);

if (process.argv.includes('--sheet')) sheet();
else build();

function build() {
    const shotsDir = resolve(arg('shots', join(ROOT, '.shots-d')));
    const captures = join(CLIP, 'assets', 'captures');
    mkdirSync(captures, { recursive: true });
    const shots = config.shots.map((name) => {
        for (const ext of ['png', 'rects.json']) {
            const from = join(shotsDir, `${name}.${ext}`);
            if (existsSync(from)) copyFileSync(from, join(captures, `${name}.${ext}`));
        }
        const rects = JSON.parse(readFileSync(join(captures, `${name}.rects.json`), 'utf8'));
        return { name, ...rects };
    });
    const [WW, WH] = shots[0].window;
    if (shots.some((s) => s.window[0] !== WW || s.window[1] !== WH)) throw new Error('every picture of a clip must come from the same window size');
    const k = CARD_W / WW;
    const CARD_H = Math.round(WH * k);
    const CX = Math.round((FW - CARD_W) / 2), CY = Math.round((FH - CARD_H) / 2);
    const REST = { x: 0, y: 0, z: 1 };

    // The camera: the card scales by z about the frame's origin and moves by (x, y).
    // Today's zoom (option A): the part ends about 1243 px wide or 535 px tall, centred a little above the middle.
    const camFor = (r) => {
        const w = r[2] * k, h = r[3] * k;
        let z = Math.min(1243 / w, 535 / h, config.maxZoom ?? 2.4);
        z = Math.max(1, z);
        const px = CX + (r[0] + r[2] / 2) * k, py = CY + (r[1] + r[3] / 2) * k;
        let x = FW / 2 - z * px, y = FH * 0.44 - z * py;
        // keep the card covering the frame once it is bigger than the frame, and centred while it is not
        const left = x + z * CX, top = y + z * CY, cw = z * CARD_W, ch = z * CARD_H;
        if (cw >= FW) x += left > 0 ? -left : left + cw < FW ? FW - (left + cw) : 0;
        else x += (FW - cw) / 2 - left;
        if (ch >= FH) y += top > 0 ? -top : top + ch < FH ? FH - (top + ch) : 0;
        else y += (FH - ch) / 2 - top;
        return { x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(4) };
    };

    let t = T.intro;
    let prevCam = REST, prevShot = 0;
    const beats = config.beats.map((b, i) => {
        const shotIndex = config.shots.indexOf(b.shot);
        if (shotIndex < 0) throw new Error(`beat ${i}: no picture named ${b.shot}`);
        const r = shots[shotIndex].rects[b.part];
        if (!r) throw new Error(`beat ${i}: ${b.shot} has no box for ${b.part}`);
        const cam = camFor(r);
        const start = t;
        const fadeAt = shotIndex !== prevShot ? start : null;
        const inAt = start + T.settle;
        const outAt = inAt + T.pillDur + T.hold;
        const frame = { x: cam.x + cam.z * (CX + r[0] * k), y: cam.y + cam.z * (CY + r[1] * k), w: cam.z * r[2] * k, h: cam.z * r[3] * k };
        const beat = { i, shotIndex, prevShot, fadeAt, start, inAt, outAt, from: prevCam, cam, r, frame, noun: b.noun, rest: b.rest };
        prevCam = cam;
        prevShot = shotIndex;
        t = outAt + T.outDur + 0.1;
        return beat;
    });
    const endAt = t;
    const duration = +(endAt + T.move + T.outro).toFixed(2);

    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const html = `<!doctype html>
<html lang="en" data-resolution="landscape">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${FW}, height=${FH}" />
    <title>${esc(config.title)}</title>
    <!-- Generated by tooling/scripts/build-caption-clip.mjs from beats.json and the capture boxes. Edit those, not this file. -->
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      @font-face { font-family:"Figtree"; src:url("assets/fonts/Figtree.ttf") format("truetype"); font-weight:300 900; font-style:normal; font-display:block; }
      * { margin:0; padding:0; box-sizing:border-box; }
      :root {
        --ground: #121019;
        --ground-dot: rgba(237,234,246,.09);
        --dim: rgba(18,16,25,.45);
        --ring: #4cc25e;
        --ring-halo: rgba(76,194,94,.15);
        --pill-bg: #2a2733;
        --pill-fg: #ecece6;
        --pill-muted: #9a9a94;
        --sans: "Figtree", system-ui, sans-serif;
      }
      html, body { width:${FW}px; height:${FH}px; overflow:hidden; background:var(--ground); }
      #root { position:relative; width:${FW}px; height:${FH}px; overflow:hidden;
              background:var(--ground) radial-gradient(circle, var(--ground-dot) 1.2px, transparent 1.2px) 0 0/40px 40px; }
      #stage, #anno { position:absolute; left:0; top:0; width:${FW}px; height:${FH}px; }
      #world { position:absolute; left:0; top:0; width:${FW}px; height:${FH}px; transform-origin:0 0; }
      #card { position:absolute; left:${CX}px; top:${CY}px; width:${CARD_W}px; height:${CARD_H}px; border-radius:12px; overflow:hidden;
              box-shadow:0 24px 60px rgb(0 0 0/.5); }
      .shot { position:absolute; left:0; top:0; width:${CARD_W}px; height:${CARD_H}px; display:block; }
      /* the dim covers the window except the part named: a hole whose shadow is clipped by the card */
      .hole { position:absolute; box-shadow:0 0 0 6000px var(--dim); }
      .ring { position:absolute; border:2px solid var(--ring); border-radius:10px; box-shadow:0 0 0 4px var(--ring-halo); }
      .pill { position:absolute; padding:14px 24px; border-radius:12px; background:var(--pill-bg); font:600 36px var(--sans);
              color:var(--pill-fg); white-space:nowrap; box-shadow:0 12px 30px rgb(0 0 0/.45); }
      .pill span { font-weight:400; color:var(--pill-muted); }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${duration}" data-fps="30" data-width="${FW}" data-height="${FH}">
      <div id="stage" class="clip" data-start="0" data-duration="${duration}" data-track-index="0">
        <div id="world" data-layout-allow-overflow>
          <div id="card" data-layout-allow-overflow>
${shots.map((s, i) => `            <img class="shot" id="sh${i}" src="assets/captures/${s.name}.png" alt="" />`).join('\n')}
${beats.map((b) => `            <div class="hole" id="hole${b.i}" data-layout-allow-overlap></div>`).join('\n')}
          </div>
        </div>
      </div>
      <div id="anno" class="clip" data-start="0" data-duration="${duration}" data-track-index="1">
${beats.map((b) => `        <div class="ring" id="ring${b.i}" data-layout-allow-overlap></div>
        <div class="pill" id="pill${b.i}" data-layout-allow-overlap data-layout-allow-occlusion>${esc(b.noun)} <span>${esc(b.rest)}</span></div>`).join('\n')}
      </div>
    </div>
    <script>
      var T = ${JSON.stringify(T)};
      var FW = ${FW}, FH = ${FH}, K = ${k.toFixed(6)};
      var REST = ${JSON.stringify(REST)};
      var BEATS = ${JSON.stringify(beats.map(({ i, shotIndex, prevShot, fadeAt, start, inAt, outAt, from, cam, r, frame }) => ({ i, shotIndex, prevShot, fadeAt, start, inAt, outAt, from, cam, r, frame })))};
      var END = ${endAt.toFixed(3)};
      var EASE = "expo.out";

      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });
      gsap.set("#world", { x: REST.x, y: REST.y, scale: REST.z });
      gsap.set(".shot", { autoAlpha: 0 });
      gsap.set("#sh0", { autoAlpha: 1 });
      gsap.set(".hole, .ring, .pill", { autoAlpha: 0 });

      BEATS.forEach(function (b) {
        var f = b.frame;
        /* the hole lives in card space, so it is placed once and rides the camera; its corner reads 10px on screen */
        gsap.set("#hole" + b.i, { left: b.r[0] * K - 6 / b.cam.z, top: b.r[1] * K - 6 / b.cam.z,
          width: b.r[2] * K + 12 / b.cam.z, height: b.r[3] * K + 12 / b.cam.z, borderRadius: 10 / b.cam.z });
        gsap.set("#ring" + b.i, { left: f.x - 6, top: f.y - 6, width: f.w + 12, height: f.h + 12 });
        /* the pill sits just under the part, aligned to its left edge; above it when there is no room below */
        var pill = document.getElementById("pill" + b.i);
        var pw = pill.offsetWidth, ph = pill.offsetHeight;
        var top = f.y + f.h + 22;
        if (top + ph > FH - 28) top = f.y - 22 - ph;
        if (top < 28) top = Math.min(FH - 28 - ph, f.y + 28);
        var left = Math.max(40, Math.min(f.x, FW - 40 - pw));
        gsap.set(pill, { left: left, top: top });

        tl.fromTo("#world", { x: b.from.x, y: b.from.y, scale: b.from.z },
          { x: b.cam.x, y: b.cam.y, scale: b.cam.z, duration: T.move, ease: EASE, immediateRender: false }, b.start);
        if (b.fadeAt !== null) {
          tl.fromTo("#sh" + b.prevShot, { autoAlpha: 1 }, { autoAlpha: 0, duration: T.fade, ease: "power1.inOut", immediateRender: false }, b.fadeAt);
          tl.fromTo("#sh" + b.shotIndex, { autoAlpha: 0 }, { autoAlpha: 1, duration: T.fade, ease: "power1.inOut", immediateRender: false }, b.fadeAt);
        }
        tl.fromTo("#hole" + b.i, { autoAlpha: 0 }, { autoAlpha: 1, duration: T.inDur, immediateRender: false }, b.inAt);
        tl.fromTo("#ring" + b.i, { autoAlpha: 0 }, { autoAlpha: 1, duration: T.inDur, immediateRender: false }, b.inAt);
        tl.fromTo("#pill" + b.i, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: T.pillDur, ease: EASE, immediateRender: false }, b.inAt + 0.05);
        tl.fromTo(["#hole" + b.i, "#ring" + b.i, "#pill" + b.i], { autoAlpha: 1 }, { autoAlpha: 0, duration: T.outDur, immediateRender: false }, b.outAt);
      });
      var last = BEATS[BEATS.length - 1].cam;
      tl.fromTo("#world", { x: last.x, y: last.y, scale: last.z },
        { x: REST.x, y: REST.y, scale: REST.z, duration: T.move, ease: EASE, immediateRender: false }, END);
      tl.to({}, { duration: T.outro }, END + T.move);
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
    writeFileSync(join(CLIP, 'index.html'), html);
    const timing = { duration, captions: beats.map((b) => ({ t: +(b.inAt + T.pillDur + 0.6).toFixed(2), noun: b.noun, rest: b.rest })) };
    writeFileSync(join(CLIP, 'timing.json'), JSON.stringify(timing, null, 2) + '\n');
    console.log(`${id}: ${beats.length} beats, ${duration} s`);
}

/** One picture of the clip to judge it without playing it: frame zero, then a frame at each caption. */
function sheet() {
    const renders = join(CLIP, 'renders');
    const mp4 = arg('mp4') ?? join(renders, readdirSync(renders).filter((f) => f.endsWith('.mp4')).sort().pop());
    const timing = JSON.parse(readFileSync(join(CLIP, 'timing.json'), 'utf8'));
    const times = [0, ...timing.captions.map((c) => c.t)];
    const tmp = join(renders, '.sheet');
    mkdirSync(tmp, { recursive: true });
    times.forEach((time, i) => {
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(time), '-i', mp4, '-frames:v', '1', '-vf', 'scale=918:-2', join(tmp, `f${String(i).padStart(2, '0')}.png`)]);
    });
    const cols = 3, rows = Math.ceil(times.length / cols);
    const out = join(renders, `${id}-contact-sheet.png`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', join(tmp, 'f%02d.png'),
        '-vf', `pad=iw+16:ih+16:8:8:color=0x06050c,tile=${cols}x${rows}:color=0x06050c`, '-frames:v', '1', out]);
    console.log(out);
}
