/* engine.js — five primitives, and everything the city is drawn with.

   No sprite sheets, no image files, no export step from an art tool: every
   pixel of Rome comes out of a function. That follows the main plan's
   no-build-step rule, and it means the art lives in git as text that diffs.

   The five primitives are the drawing spec's (plan-roma-updates.md section 3).
   Roman architecture is repetitive, which is the whole reason this works:
   `arch` alone carries the aqueduct, the Colosseum, the triumphal arch, the
   basilica and the theatre, so twenty-five buildings need far less code than
   twenty-five buildings sounds like.

   Two departures from the spec, both deliberate:

   1. The spec's primitives close over a module-global `ctx` and `SCALE`. Here
      they are bound by `painter(ctx, scale)` instead. PLAN-ROMA section 7 has
      the city on the Home screen *and* in a full-screen view — two canvases —
      and module-global drawing state is how that turns into a bug that only
      shows up on a phone. It also matches the house style: schedule.js takes
      its clock, this takes its canvas.

   2. `P` rounds *edges*, not sizes. The spec rounds x, y, w and h separately,
      which is exact for integer coordinates but leaves hairline gaps for
      fractional ones — and the flame in section 7 of the spec is drawn at
      `cx - width / 2`, so fractional coordinates are not hypothetical.

   3. `arch` measures its radius at the centre of each pixel row. The spec's
      version gives every arch a one-pixel crown, which reads as a spike rather
      than a curve; see the note on the function. */

import { C } from './palette.js';

/* ==================================================== deterministic noise === */

/**
 * Stable 0..1 noise from a pair of integers.
 *
 * Every random-looking detail in the city — a cracked block, a scatter of
 * rubble, the height of a cypress — comes from here and never from
 * `Math.random()`. The city is the one screen she sees every single day, and a
 * place that rearranges itself each time she opens it is a screensaver, not a
 * place. Nothing needs storing either: the same coordinates always give the
 * same answer.
 *
 * Scope the rule to the art. The parked coach (PLAN-ROMA section 9) uses real
 * randomness on purpose, because a coach that says the same thing every time is
 * worthless. Don't "fix" either to match the other.
 *
 * @param {number} x
 * @param {number} y
 * @returns {number} 0 <= n < 1
 */
export function hash(x, y) {
  let h = (Math.round(x) * 374761393 + Math.round(y) * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return h / 4294967296;
}

/* =========================================================== the painter === */

/**
 * Bind the primitives to one canvas at one scale.
 *
 * Everything a building recipe is allowed to do lives on the returned object.
 * A recipe takes it as its first argument and destructures what it needs:
 *
 *     const { P, arch, fire } = g;
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} [scale]      logical pixels to canvas pixels; integer (see `chooseScale`)
 * @param {object} [options]
 * @param {boolean} [options.lights]  false makes `light`/`fire` no-ops — used
 *   while a building is still under construction, so a half-built temple does
 *   not glow through its unfinished wall
 * @returns {object} the painter
 */
export function painter(ctx, scale = 1, { lights = true } = {}) {
  const s = scale;

  /* Round the edges and take the difference, so adjacent rectangles always
     share an edge exactly and never leave a seam. */
  const span = (a, b) => Math.round(b * s) - Math.round(a * s);

  /** Paint one logical rectangle. A null or missing colour is a no-op, which is
      what makes a transparent character in a grid free. */
  const P = (x, y, w = 1, h = 1, col) => {
    if (!col) return;
    const pw = span(x, x + w);
    const ph = span(y, y + h);
    if (pw <= 0 || ph <= 0) return;
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x * s), Math.round(y * s), pw, ph);
  };

  /** One pixel. The commonest call by a wide margin, so it gets a short name. */
  const dot = (x, y, col) => P(x, y, 1, 1, col);

  /**
   * A filled circle in three tones, lit from the upper left. Domes, treetops,
   * the moon.
   */
  const blob = (cx, cy, r, main, lite, dark) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        let col = main;
        if (dx + dy < -r * 0.4) col = lite;
        else if (dx + dy > r * 0.6) col = dark;
        dot(cx + dx, cy + dy, col);
      }
    }
  };

  /**
   * A soft halo behind something lit: two translucent passes and a solid core.
   * Only ever used by the night pass, but it belongs with the primitives
   * because it is the one that needs the raw context.
   */
  const bloom = (lx, ly, lw, lh, col = C.glow, core = C.glowCore, k = 1) => {
    const x = lx * s;
    const y = ly * s;
    const w = lw * s;
    const h = lh * s;
    ctx.save();
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.15 * k;
    ctx.fillRect(x - 3 * s, y - 3 * s, w + 6 * s, h + 6 * s);
    ctx.globalAlpha = 0.28 * k;
    ctx.fillRect(x - 1.5 * s, y - 1.5 * s, w + 3 * s, h + 3 * s);
    ctx.globalAlpha = 1;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = core;
    ctx.fillRect(x + 0.6 * s, y + 0.6 * s, w - 1.2 * s, h - 1.2 * s);
    ctx.restore();
  };

  /**
   * The Roman primitive: a rounded-top opening, drawn as a shaft with a
   * semicircular head. Doorways, arcades, aqueduct tiers, gateways. Usually
   * painted in `C.arc`, because an opening is a hole and a hole is dark.
   *
   * The `+ 0.25` is the one place this file overrules the spec, and it earns
   * it. Measuring the radius at the *centre* of each pixel row rather than its
   * edge is the standard correction for drawing circles on a grid; without it
   * every crown comes out exactly one pixel wide, so a five-wide arch steps
   * 1-5-5 and reads as a keyhole with a spike on top instead of as a curve.
   * With it the same arch steps 3-5-5, and a seven-wide one 3-5-7-7. Six
   * buildings are mostly made of this primitive, so a wrong crown would be
   * wrong in a hundred places.
   *
   * @param {number} cx      centre column
   * @param {number} topY    top row of the arch head
   * @param {number} w       full width; even widths lose their rightmost pixel,
   *                         because a semicircle needs a centre column
   * @param {number} totalH  head plus shaft
   */
  const arch = (cx, topY, w, totalH, col = C.arc) => {
    const r = Math.floor((w - 1) / 2);
    if (totalH > r) P(cx - r, topY + r, r * 2 + 1, totalH - r, col);
    for (let dy = 0; dy <= r; dy++) {
      const dx = Math.round(Math.sqrt(r * r - dy * dy + 0.25));
      P(cx - dx, topY + r - dy, 2 * dx + 1, 1, col);
    }
  };

  /* ---- the light registries ------------------------------------------- */
  /* Buildings push; they never read. The night pass and the fire system are
     the only readers, which is why "add a lit window" stays one line anywhere
     and why section 6 of PLAN-ROMA does not leak into every recipe. */
  const glowTargets = [];
  const emitters = [];

  return {
    ctx,
    scale: s,
    P,
    dot,
    blob,
    bloom,
    arch,
    hash,

    glowTargets,
    emitters,

    /** Register a lit opening: warm at night, plain by day. */
    light(x, y, w, h) {
      if (lights) glowTargets.push({ x, y, w, h });
    },

    /** Register a fire — altar, torch, brazier. `by` is the row it burns from. */
    fire(x, by, size = 1, seed = 0) {
      if (lights) emitters.push({ x, by, size, seed });
    },

    /** Between frames. Both registries are per-frame, never cumulative. */
    reset() {
      glowTargets.length = 0;
      emitters.length = 0;
    },
  };
}

/* ============================================================== sprites === */

/* The one interface, fixed now on purpose.
 *
 *     sprite.draw(ctx, x, groundY, { scale, progress })
 *
 * `x` is the left edge and `groundY` is the bottom row the building stands on,
 * both inclusive, so the box is (x, groundY - h + 1, w, h). Origin at the
 * ground line rather than the top-left is what lets a slot be `(x, band)` and
 * keeps vertical placement out of every sprite (PLAN-ROMA section 5).
 *
 * `progress` runs 0 (nothing) to 1 (finished) and is the reason this signature
 * is settled before the second building exists: it drives the construction-site
 * teaser *and* the unlock reveal, and retrofitting a parameter into
 * twenty-five recipes is a day nobody wants.
 *
 * Two authoring modes compile to it — `fromDraw` for anything with repeating
 * structure, `fromGrid` for anything small, organic or irregular — and nothing
 * outside this module can tell which was used. That is the seam that lets the
 * art source be swapped wholesale for a CC0 tileset if the hand-authored
 * sprites disappoint (PLAN-ROMA section 3). */

function makeSprite({ id, w, h, paint }) {
  if (!id) throw new Error('sprite needs an id');
  if (!(w > 0) || !(h > 0)) throw new Error(`sprite ${id}: w and h must be positive`);

  return {
    id,
    w,
    h,

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x        left edge, logical
     * @param {number} groundY  bottom row, logical, inclusive
     * @param {object} [opts]
     * @param {number} [opts.scale]     integer; 1 when measuring rather than showing
     * @param {number} [opts.progress]  0..1; below 1 the building is under construction
     * @param {object} [opts.painter]   an existing painter, to share light registries
     *                                  across a whole scene instead of per building
     * @returns {object|null} the painter used, or null if nothing was drawn
     */
    draw(ctx, x, groundY, opts = {}) {
      const { scale = 1, progress = 1 } = opts;
      if (!(progress > 0)) return null;

      const done = progress >= 1;
      const g = opts.painter ?? painter(ctx, scale, { lights: done });

      if (done) {
        paint(g, x, groundY, { progress: 1 });
        return g;
      }

      /* Reveal the bottom fraction only. A clip rectangle rather than a
         per-recipe rule, so it works the same for a grid and for a draw
         function, and so the unlock animation in section 7 is free: it is this
         same call with progress sweeping to 1. */
      const rows = Math.max(1, Math.round(h * progress));
      ctx.save();
      ctx.beginPath();
      ctx.rect(
        Math.round(x * scale),
        Math.round((groundY - rows + 1) * scale),
        Math.round(w * scale),
        Math.round(rows * scale),
      );
      ctx.clip();
      paint(g, x, groundY, { progress });
      ctx.restore();
      return g;
    },
  };
}

/**
 * A building as a function — the default mode.
 *
 * @param {object} spec
 * @param {string} spec.id
 * @param {number} spec.w  authored width, logical
 * @param {number} spec.h  authored height, logical
 * @param {(g: object, x: number, groundY: number, state: {progress: number}) => void} spec.paint
 * @returns {object} sprite
 */
export function fromDraw({ id, w, h, paint }) {
  if (typeof paint !== 'function') throw new Error(`sprite ${id}: paint must be a function`);
  return makeSprite({ id, w, h, paint });
}

/**
 * A building as a character grid — for the small, the organic and the
 * irregular, where a function would be sillier than a picture. A hut is nine
 * rows of text; nobody wants that as a loop.
 *
 * Rows run top to bottom. A character missing from the palette throws here,
 * at construction, rather than drawing nothing at render time: a typo in a
 * hand-authored grid should be loud, the same way parse.js refuses to silently
 * drop a malformed line.
 *
 * @param {object} spec
 * @param {string} spec.id
 * @param {Object<string, string|null>} spec.palette  character to colour; null is transparent
 * @param {string[]} spec.px  the rows
 * @returns {object} sprite
 */
export function fromGrid({ id, palette, px }) {
  if (!Array.isArray(px) || px.length === 0) throw new Error(`sprite ${id}: px must be rows`);

  const h = px.length;
  const w = Math.max(...px.map(row => row.length));

  px.forEach((row, i) => {
    for (const ch of row) {
      if (!(ch in palette)) {
        throw new Error(`sprite ${id}: row ${i + 1} uses '${ch}', which is not in the palette`);
      }
    }
  });

  /* Coalesce runs of one colour into single rectangles. A 52-wide wall is one
     fillRect instead of fifty-two, which matters once the whole city redraws. */
  const paint = (g, x, groundY) => {
    const top = groundY - h + 1;
    for (let row = 0; row < h; row++) {
      const line = px[row];
      let col = 0;
      while (col < line.length) {
        const colour = palette[line[col]];
        let run = 1;
        while (col + run < line.length && palette[line[col + run]] === colour) run++;
        if (colour) g.P(x + col, top + row, run, 1, colour);
        col += run;
      }
    }
  };

  return makeSprite({ id, w, h, paint });
}

/* ========================================================= the canvas ===== */

/**
 * The largest integer scale that fits.
 *
 * Integer only, and this is the single most important line in the file for how
 * the city actually looks. A fractional scale resamples the art and turns crisp
 * pixels into a smear — it is the most common way this kind of thing goes
 * wrong, and it looks like bad art rather than like a bug.
 *
 * @param {number} logicalWidth  the scene's own width in logical pixels
 * @param {number} availableCss  CSS pixels available to fill
 * @param {object} [bounds]
 * @returns {number} integer >= min
 */
export function chooseScale(logicalWidth, availableCss, { min = 1, max = 8 } = {}) {
  if (!(logicalWidth > 0) || !(availableCss > 0)) return min;
  return Math.min(max, Math.max(min, Math.floor(availableCss / logicalWidth)));
}

/**
 * Size a canvas for crisp pixel art on a retina phone, and hand back a context
 * ready to paint in logical-times-scale units.
 *
 * The backing store is `logical x scale x dpr` while the CSS box is
 * `logical x scale` px; without the device-pixel-ratio term everything is soft
 * on every iPhone made in the last decade. Setting `width` resets the context,
 * so the transform and the smoothing flag go on afterwards — in that order.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} size
 * @param {number} size.w      logical width
 * @param {number} size.h      logical height
 * @param {number} size.scale  integer, from `chooseScale`
 * @param {number} [size.dpr]
 * @returns {CanvasRenderingContext2D}
 */
export function fitCanvas(canvas, { w, h, scale, dpr = globalThis.devicePixelRatio || 1 }) {
  canvas.width = Math.round(w * scale * dpr);
  canvas.height = Math.round(h * scale * dpr);
  canvas.style.width = `${w * scale}px`;
  canvas.style.height = `${h * scale}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
