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
import { SCENE, BANDS, BY_ID, inDrawOrder } from './catalogue.js';
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

    const p = progress[entry.id] ?? 1;
    sprite.draw(g.ctx, entry.x, BANDS[entry.band].groundY, {
      scale: g.scale,
      progress: p,
      /* One shared set of light registries for the whole scene, so the night
         pass reads twenty-five buildings' lights in one list — but only from
         finished ones. Handing an unfinished building the shared painter would
         let it register a fire it has not built the altar for yet; letting it
         make its own throwaway painter suppresses that, and dropping those
         registrations is exactly what should happen to them. */
      painter: p >= 1 ? g : undefined,
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

/* ======================================================= scaffolding ===== */

/**
 * Scaffolding over a building that is still going up.
 *
 * The teaser is a construction site rather than a dim silhouette, and this is
 * what says so. Without it a half-drawn building just looks like a bug — a
 * chopped-off temple — where poles and a plank read as *not finished yet*,
 * which is the entire message.
 *
 * Drawn only strictly between 0 and 1, so a finished building never carries it.
 */
export function drawScaffold(g, entry, progress) {
  if (!(progress > 0) || progress >= 1) return;

  const { x, w, band } = entry;
  const groundY = BANDS[band].groundY;

  /* The sprite's own height when it exists, and a plausible one when it does
     not. Most of the catalogue is unauthored until 4b.4, and the teaser still
     has to read as a plot with work happening on it. */
  const height = SPRITES[entry.id]?.h ?? Math.min(28, Math.round(w * 0.8));
  const built = Math.max(1, Math.round(height * progress));
  const top = groundY - height;

  /* Two uprights just outside the footprint, so they frame the work rather
     than hide it, and a plank at the top of the frame. */
  for (const px of [x - 1, x + w]) {
    g.P(px, top, 1, groundY - top + 1, C.scaffold);
  }
  g.P(x - 1, top, w + 2, 1, C.scaffold);

  /* A working platform at the height the build has actually reached. This is
     the part that moves between lessons, and the reason the teaser is worth
     more than a silhouette. */
  g.P(x - 1, groundY - built, w + 2, 1, C.scaffoldLite);
}

/* ============================================================= a view ==== */

/**
 * A view onto the city, bound to one canvas.
 *
 * The scene is 560 logical pixels wide and a phone is not, so a view shows a
 * window onto it and pans. The static layer — sky, hills, ground, finished
 * buildings — is cached at full scene width once per unlock; the window is a
 * blit out of that cache, which makes panning free. Only fire and smoke are
 * repainted per frame.
 *
 * Two of these exist at once: the Home hero and the unlock moment on the
 * Results screen. That is exactly why the painter is bound per canvas rather
 * than being module-global.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} [options]
 * @param {number} [options.view]    logical width of the window; default the whole scene
 * @param {number} [options.scale]   omit to fit the element's width
 * @param {boolean} [options.motion] false for a still frame (reduced motion)
 * @returns {object} the view
 */
export function createScene(canvas, {
  view = SCENE.w, scale, motion = true, night = false,
} = {}) {
  const viewW = Math.min(view, SCENE.w);
  const chosen = scale ?? chooseScale(viewW, canvas.clientWidth || viewW);
  const ctx = fitCanvas(canvas, { w: viewW, h: SCENE.h, scale: chosen });
  const dpr = canvas.width / (viewW * chosen);

  const smoke = smokeField();
  let cache = null;         // the whole scene, as an offscreen canvas
  let lights = { glowTargets: [], emitters: [] };
  let ids = [];
  let progress = {};
  let live = null;          // {id, progress} drawn per frame, not cached
  let panX = 0;
  let panTarget = 0;
  let running = false;
  let last = 0;

  const maxPan = Math.max(0, SCENE.w - viewW);
  const clampPan = x => Math.min(maxPan, Math.max(0, x));

  /** Repaint the static layer. Called on unlock, not per frame. */
  function invalidate() {
    /* OffscreenCanvas landed in Safari 16.4, which is the floor this app
       already assumes — but a cache is an optimisation, and an optimisation
       that can throw is worse than none. A plain detached canvas caches just
       as well. */
    const w = Math.round(SCENE.w * chosen * dpr);
    const h = Math.round(SCENE.h * chosen * dpr);
    const off = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const offCtx = off.getContext('2d');
    offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    offCtx.imageSmoothingEnabled = false;

    const g = painter(offCtx, chosen);
    const shown = live ? ids.filter(id => id !== live.id) : ids;
    drawStatic(g, shown, { night, progress });

    /* Scaffolding over whatever is under construction. */
    for (const [id, p] of Object.entries(progress)) {
      const entry = BY_ID[id];
      if (entry && p > 0 && p < 1) drawScaffold(g, entry, p);
    }

    lights = { glowTargets: [...g.glowTargets], emitters: [...g.emitters] };
    cache = off;
  }

  /** Blit the visible slice of the cache, then paint what moves. */
  function paint(t) {
    const sliceX = Math.round(panX * chosen * dpr);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (cache) {
      ctx.drawImage(cache, sliceX, 0, canvas.width, canvas.height,
        0, 0, canvas.width, canvas.height);
    }
    ctx.restore();

    /* Everything after this is in scene coordinates, shifted by the pan. */
    ctx.save();
    ctx.translate(-panX * chosen, 0);
    const g = painter(ctx, chosen);

    /* The building being revealed is drawn here rather than cached, because it
       changes every frame for the ~800 ms the reveal lasts. */
    if (live) {
      const entry = BY_ID[live.id];
      const sprite = SPRITES[live.id];
      if (entry && sprite) {
        sprite.draw(ctx, entry.x, BANDS[entry.band].groundY, {
          scale: chosen,
          progress: live.progress,
          /* Same rule as the static pass: it lights up on the frame it is
             finished, not while it is still rising. Which is the right moment
             anyway — the altar catching is the end of the animation. */
          painter: live.progress >= 1 ? g : undefined,
        });
      }
    }

    for (const emitter of [...lights.emitters, ...g.emitters]) drawFlame(g, emitter, t);
    smoke.draw(g);
    ctx.restore();
  }

  return {
    get scale() { return chosen; },
    get lights() { return lights; },
    get pan() { return panX; },
    get viewWidth() { return viewW; },

    /** Which buildings exist, and how far along any unfinished one is. */
    show(nextIds, nextProgress = {}) {
      ids = [...nextIds];
      progress = nextProgress;
      invalidate();
      paint(0);
    },

    /** Move the window. Clamped, so it can be handed a raw building x. */
    panTo(x, { animate = false } = {}) {
      panTarget = clampPan(x);
      if (!animate || !motion) {
        panX = panTarget;
        paint(0);
      }
      return panTarget;
    },

    /** Centre the window on a slot, which is what a caller actually wants. */
    focus(entry, options) {
      return this.panTo(entry.x + entry.w / 2 - viewW / 2, options);
    },

    /**
     * The unlock moment: pan to the slot, then complete the building from the
     * ground up.
     *
     * Resolves when it has finished, so a lesson that landed two buildings can
     * await them one after another rather than playing both at once.
     *
     * @param {object} entry     catalogue entry
     * @param {object} [options]
     * @param {number} [options.duration]  ms; PLAN-ROMA section 7 says ~800
     * @returns {Promise<void>}
     */
    async reveal(entry, { duration = 800 } = {}) {
      /* Reduced motion gets the finished building and no animation at all —
         it is a celebration, not information, so there is nothing to lose. */
      if (!motion) {
        live = null;
        ids = [...new Set([...ids, entry.id])];
        this.focus(entry);
        this.show(ids, progress);
        return;
      }

      this.focus(entry);
      live = { id: entry.id, progress: 0 };
      ids = [...new Set([...ids, entry.id])];
      invalidate();

      await new Promise(resolve => {
        const started = performance.now();
        const step = now => {
          const p = Math.min(1, (now - started) / duration);
          live.progress = p;
          paint(now / 1000);
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });

      /* Fold it into the cache now that it is finished, so the per-frame path
         goes back to fire and smoke only. */
      live = null;
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
        /* Ease toward the pan target, so a jump to a new building glides. */
        if (Math.abs(panTarget - panX) > 0.4) panX += (panTarget - panX) * 0.12;
        else panX = panTarget;
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
