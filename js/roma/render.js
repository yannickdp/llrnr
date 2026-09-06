/* render.js — the scene: sky, hills, ground, buildings, and what moves.

   This file knows how to paint the city and nothing about what any of it
   means. It never reads a Latin name and never decides what is unlocked; it is
   handed a list of ids and paints them at the slots the catalogue gives. That
   is the seam that lets the art be swapped for a CC0 tileset without the
   progression noticing.

   The one structural idea worth stating up front: the scene splits into a
   layer that changes only when a building unlocks, and a layer that changes
   every frame. The static half is the sky, the hills, the ground and every
   finished building — a few thousand rectangles, and there is no reason to
   repaint them sixty times a second for the sake of one flame. So it is cached
   to an offscreen canvas and blitted, and the per-frame work is fire, smoke and
   citizens only. At 560x180 with twenty-five buildings that is not an
   optimisation, it is the difference between a still picture and a warm phone.

   Reduced motion is honoured by simply never running the animated pass: the
   city is a static picture, which is what it mostly is anyway. */

import { C, T } from './palette.js';
import {
  painter, fitCanvas, chooseScale, drawFlame, drawCypress, drawFigure, smokeField, hash,
} from './engine.js';
import { SCENE, BANDS, inDrawOrder } from './catalogue.js';
import { SPRITES } from './buildings.js';

/* ============================================================== sky ====== */

/**
 * A vertical gradient, day or night. The only place in the city that is not
 * made of rectangles, because a gradient is what a sky is.
 */
export function drawSky(g, { night = false } = {}) {
  const { ctx, scale } = g;
  const grad = ctx.createLinearGradient(0, 0, 0, SCENE.h * scale);
  grad.addColorStop(0, night ? C.skyNightTop : C.skyDayTop);
  grad.addColorStop(1, night ? C.skyNightBot : C.skyDayBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SCENE.w * scale, SCENE.h * scale);
}

/* ============================================================ hills ====== */

/* The three hills that matter, placed under the stages that belong to them:
   the Palatine over the huts at the left end, the Aventine behind the Circus,
   the Capitoline at the right where the temple of Jupiter is the capstone.
   Rome had seven; drawing seven at this width would be a lumpy horizon. */
const HILLS = [
  { name: 'Palatinus', cx: 62, halfW: 78, rise: 30 },
  { name: 'Aventinus', cx: 340, halfW: 92, rise: 24 },
  { name: 'Capitolinus', cx: 522, halfW: 74, rise: 36 },
];

/** Where the far range sits at a given column — two sine waves, so it wanders. */
function rangeTop(x) {
  return BANDS.far.groundY - 10 - Math.sin(x / 37) * 6 - Math.sin(x / 13) * 3;
}

/**
 * The backdrop. A far range in the pale tone, then the three named hills in
 * the near tone with a lit rim along the top — which is the three-tone rule
 * doing the only thing that separates a hill from a green triangle.
 */
export function drawHills(g) {
  const farGround = BANDS.far.groundY;
  const midGround = BANDS.mid.groundY;

  /* The distant range. `hillFar` is the colour every far-band building will be
     pulled toward, so the back of the city and its backdrop agree. */
  for (let x = 0; x < SCENE.w; x++) {
    const top = Math.round(rangeTop(x));
    g.P(x, top, 1, farGround - top + 2, C.hillFar);
  }

  /* The named hills, as parabolas. Anything more elaborate is invisible at
     this size.

     Speckled rather than checkerboarded. `course` is the right texture for a
     masonry wall a few pixels across, and quite wrong here: over a slope
     thirty rows deep its one-in-four diagonal reads as a rug, not as ground.
     A sparse scatter from `hash` is what a hillside looks like, and it is
     stable between renders for the same reason everything else is. */
  for (const hill of HILLS) {
    for (let x = hill.cx - hill.halfW; x <= hill.cx + hill.halfW; x++) {
      if (x < 0 || x >= SCENE.w) continue;
      const u = (x - hill.cx) / hill.halfW;
      const top = Math.round(farGround - hill.rise * (1 - u * u));
      if (top >= farGround) continue;

      g.P(x, top, 1, midGround - top, C.hill);
      for (let y = top + 1; y < midGround; y++) {
        const n = hash(x, y);
        if (n > 0.93) g.dot(x, y, C.weed);
        else if (n < 0.07) g.dot(x, y, C.hillFar);
      }
      /* Lit rim: brighter where the slope faces up and left. */
      g.dot(x, top, u < 0.35 ? C.hillFar : C.hill);
    }
  }

  /* A few cypresses on the ridges, for depth and because they are the one
     plant that says "Italy" in three pixels. Positions from `hash`, so the
     skyline is varied and identical every time she opens the app. */
  for (const hill of HILLS) {
    for (let i = 0; i < 3; i++) {
      const x = Math.round(hill.cx + (hash(hill.cx, i) - 0.5) * hill.halfW * 1.4);
      if (x < 2 || x > SCENE.w - 3) continue;
      const u = (x - hill.cx) / hill.halfW;
      const top = Math.round(farGround - hill.rise * (1 - u * u));
      drawCypress(g, x, top + 1);
    }
  }
}

/* =========================================================== ground ====== */

/**
 * The earth each band stands on, and the Tiber along the bottom edge.
 *
 * Sprites never paint their own ground — a building that did would sit on a
 * visible seam, and the same sprite has to work in any band.
 */
export function drawGround(g) {
  const mid = BANDS.mid.groundY;
  const near = BANDS.near.groundY;

  /* The plaza, from the mid street down to the near one.
     Flat fill plus a sparse scatter of the shadow tone and the odd weed. The
     first version checkerboarded it with `course`, which is right for a wall
     and badly wrong for an expanse this size — five hundred pixels of
     one-in-four diagonal reads as a woven rug under the whole city. */
  g.P(0, mid, SCENE.w, near + 4 - mid, T.plaza.base);
  for (let x = 0; x < SCENE.w; x++) {
    for (let y = mid + 1; y < near + 4; y++) {
      const n = hash(x + 977, y);
      if (n > 0.94) g.dot(x, y, T.plaza.shadow);
      else if (n < 0.03) g.dot(x, y, C.weed);
    }
  }

  /* A kerb where the near street starts, so the two levels read as two. */
  g.P(0, near, SCENE.w, 1, T.plaza.shadow);

  /* The Tiber. Its highlights move, so it is drawn by the animated pass; this
     is the still water underneath it. */
  const water = near + 4;
  for (let y = water; y < SCENE.h; y++) {
    const shade = y < water + 2 ? T.water.lit : y < water + 7 ? T.water.base : T.water.shadow;
    g.P(0, y, SCENE.w, 1, shade);
  }
  for (let x = 0; x < SCENE.w; x++) g.dot(x, water - 1, C.bankDark);
}

/* ======================================================== buildings ====== */

/**
 * Paint a set of buildings at their slots.
 *
 * @param {object} g          painter
 * @param {string[]} ids      which buildings exist
 * @param {object} [options]
 * @param {Object<string, number>} [options.progress]  id to 0..1, for anything
 *   still under construction; missing means finished
 * @returns {string[]} the ids that had a sprite and were actually drawn
 */
export function drawBuildings(g, ids, { progress = {} } = {}) {
  const wanted = new Set(ids);
  const drawn = [];

  for (const entry of inDrawOrder()) {
    if (!wanted.has(entry.id)) continue;
    const sprite = SPRITES[entry.id];
    if (!sprite) continue;                       // not authored yet; simply absent

    sprite.draw(g.ctx, entry.x, BANDS[entry.band].groundY, {
      scale: g.scale,
      progress: progress[entry.id] ?? 1,
      painter: g,                                // one shared set of light registries
    });
    drawn.push(entry.id);
  }

  return drawn;
}

/* ============================================================ scene ====== */

/**
 * The whole city, still. Everything here changes only when a building unlocks,
 * which is why it can be painted once into an offscreen canvas and then
 * blitted for free.
 *
 * @returns {object} the painter used, carrying the light and fire registries
 *   that the animated pass and the night pass read
 */
export function drawStatic(g, ids, options = {}) {
  drawSky(g, options);
  drawHills(g);
  drawGround(g);
  drawBuildings(g, ids, options);
  return g;
}

/**
 * A scene bound to a canvas: paints the static layer once, caches it, and then
 * repaints only what moves.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} [options]
 * @param {number} [options.scale]   omit to fit the element's width
 * @param {boolean} [options.motion] false for a still frame (reduced motion)
 * @returns {object} the scene
 */
export function createScene(canvas, { scale, motion = true, night = false } = {}) {
  const chosen = scale ?? chooseScale(SCENE.w, canvas.clientWidth || SCENE.w);
  const ctx = fitCanvas(canvas, { w: SCENE.w, h: SCENE.h, scale: chosen });

  const smoke = smokeField();
  let cache = null;         // the static layer, as an offscreen canvas
  let lights = { glowTargets: [], emitters: [] };
  let ids = [];
  let progress = {};
  let running = false;
  let last = 0;

  /** Repaint the static layer. Called on unlock, not per frame. */
  function invalidate() {
    /* OffscreenCanvas landed in Safari 16.4, which is the floor this app
       already assumes — but a cache is an optimisation, and an optimisation
       that can throw is worse than none. A plain detached canvas caches just
       as well. */
    const off = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(canvas.width, canvas.height)
      : Object.assign(document.createElement('canvas'),
        { width: canvas.width, height: canvas.height });
    const offCtx = off.getContext('2d');
    offCtx.setTransform(ctx.getTransform());
    offCtx.imageSmoothingEnabled = false;

    const g = painter(offCtx, chosen);
    drawStatic(g, ids, { night, progress });
    lights = { glowTargets: [...g.glowTargets], emitters: [...g.emitters] };
    cache = off;
  }

  /** Blit the cached city, then paint the handful of things that move. */
  function paint(t) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (cache) ctx.drawImage(cache, 0, 0);
    ctx.restore();

    const g = painter(ctx, chosen);
    for (const emitter of lights.emitters) drawFlame(g, emitter, t);
    smoke.draw(g);
  }

  return {
    get scale() { return chosen; },
    get lights() { return lights; },

    /** Which buildings exist, and how far along any unfinished one is. */
    show(nextIds, nextProgress = {}) {
      ids = [...nextIds];
      progress = nextProgress;
      invalidate();
      paint(0);
    },

    /** One frame, for a caller driving its own loop. */
    frame(t, dt = 0) {
      if (motion && dt > 0) smoke.update(dt, lights.emitters);
      paint(motion ? t : 0);
    },

    /**
     * Run the animated pass. Suspended on `visibilitychange` and by an
     * IntersectionObserver by the caller: on a phone, a render loop nobody is
     * looking at is just battery.
     */
    start() {
      if (running || !motion) {
        if (!motion) paint(0);
        return;
      }
      running = true;
      last = performance.now();
      const tick = now => {
        if (!running) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        smoke.update(dt, lights.emitters);
        paint(now / 1000);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },

    stop() {
      running = false;
    },
  };
}

/* Re-exported so a caller needs one import to place a citizen or a tree. */
export { drawCypress, drawFigure };
