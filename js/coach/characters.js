/* characters.js — six pixel Romans, one per rank.

   The art is the demo's (plans/roman-coach.html), ported coordinate for
   coordinate rather than redrawn. That is the whole point of having built a
   demo: the risk that a hand-authored bust would not read at phone size is
   already retired, and re-deciding a single pixel here would un-retire it.

   Three things did change, all of them plumbing rather than art:

   1. The demo's `P` and `bloom` closed over a module-global ctx and SCALE.
      These take a painter from engine.js instead, so the reveal's bust and the
      Results screen's rank-up bust can be two canvases without sharing state —
      the same reason the city's primitives are bound rather than global.
   2. The demo's `K` palette is gone; every colour comes from palette.js. Four
      of its entries were this file's duplicates. See the note there.
   3. The torso is drawn as three rectangles a row rather than thirty
      one-pixel calls. Six hundred fillRects a frame for a shoulder is the kind
      of thing PLAN-ROMA section 8 means by "a loop nobody is looking at".

   Coordinates are the demo's 64-grid throughout. `BUST` is the window of it
   that anything is ever drawn in, and `fitBust` is what puts that window on a
   canvas — so the art keeps its familiar numbers and the canvas stays the size
   of a bust rather than of a mostly empty square. */

import { C } from '../roma/palette.js';

/**
 * The occupied region of the 64-grid, as a logical box.
 *
 * Measured from the extremes the sprites actually reach: the centurion's crest
 * at row 8, the servus's raised thumb at column 20, the magister's scroll at
 * column 46, and the three-row lift the victory flourish adds to everything
 * above the waist.
 */
export const BUST = Object.freeze({ x: 19, y: 4, w: 30, h: 58 });

/** Low to high. The ladder that maps these to XP lives in coach.js. */
export const TYPES = Object.freeze([
  'servus', 'gladiator', 'centurio', 'magister', 'senator', 'imperator',
]);

/* ------------------------------------------------------------- cloth ----- */

/* What each rank is made of, in the three-tone rule's terms. Read by `torso`
   and by the sleeves, so a rank's identity is one row of this table rather
   than a chain of ternaries in four places — which is how the demo had it. */
const CLOTH = Object.freeze({
  servus: { lite: C.drab, base: C.drab, dark: C.drabDark },
  gladiator: { lite: C.skinLite, base: C.skin, dark: C.skinShade },
  centurio: { lite: C.ironLite, base: C.iron, dark: C.ironDark },
  magister: { lite: C.toga, base: C.toga, dark: C.togaShade },
  senator: { lite: C.toga, base: C.toga, dark: C.togaShade },
  imperator: { lite: C.purpleLite, base: C.purple, dark: C.purple },
});

/* The sleeve is not always the torso: a centurion's arms come out of a red
   tunic worn under the lorica, and a gladiator's come out of nothing at all. */
const SLEEVE = Object.freeze({
  servus: { base: C.drab, dark: C.drabDark },
  gladiator: { base: C.skin, dark: C.skinShade },
  centurio: { base: C.tunicR, dark: C.tunicRDark },
  magister: { base: C.toga, dark: C.togaShade },
  senator: { base: C.toga, dark: C.togaShade },
  imperator: { base: C.purpleLite, dark: C.purple },
});

const HAIR = Object.freeze({ servus: C.hairDark, magister: C.hairGrey });

const hairOf = type => HAIR[type] ?? C.hair;

/* ------------------------------------------------------------- parts ----- */

function torso(g, type) {
  const { lite, base, dark } = CLOTH[type];

  /* Shoulders widening toward the cut-off, which is what makes a bust read as
     a bust rather than as a head on a post. */
  for (let y = 31; y <= 60; y++) {
    const tt = (y - 31) / 29;
    const L = Math.round(24 - tt * 3);
    const R = Math.round(40 + tt * 3);
    g.P(L, y, 2, 1, lite);
    if (R - L - 3 > 0) g.P(L + 2, y, R - L - 3, 1, base);
    g.P(R - 1, y, 2, 1, dark);
  }

  /* The neck. */
  g.P(30, 29, 4, 3, C.skinShade);
  g.P(30, 29, 4, 1, C.skin);

  if (type === 'centurio') {
    for (let y = 34; y <= 58; y += 3) {
      for (let x = 24; x <= 40; x++) g.dot(x, y, (x + y) % 2 ? C.ironDark : C.iron);
    }
    g.P(21, 32, 6, 3, C.ironLite);
    g.P(37, 32, 6, 3, C.ironLite);
    g.P(22, 33, 3, 20, C.tunicR);
  } else if (type === 'senator') {
    /* The latus clavus, the broad purple stripe that says senator and nothing
       else — the one mark separating him from the magister's identical wool. */
    for (let y = 33; y <= 58; y++) g.P(Math.round(27 + (y - 33) * 0.4), y, 2, 1, C.purple);
  } else if (type === 'imperator') {
    g.P(24, 32, 17, 1, C.goldLite);
    g.P(30, 34, 4, 3, C.gold);
    g.P(31, 35, 2, 1, C.goldLite);
  } else if (type === 'magister') {
    for (let y = 34; y <= 58; y += 4) g.P(26, y, 10, 1, C.togaShade);
  } else if (type === 'servus') {
    /* One bare shoulder: the tunic has slipped, and nobody has fixed it. */
    for (let y = 31; y <= 38; y++) {
      const L = Math.round(24 - ((y - 31) / 29) * 3);
      const bare = Math.max(0, 7 - (y - 31));
      for (let x = L; x < L + bare; x++) g.dot(x, y, x === L ? C.skinLite : C.skin);
    }
    g.P(24, 50, 15, 1, C.leatherDark);
  } else if (type === 'gladiator') {
    g.P(30, 40, 5, 1, C.skinShade);
    g.P(31, 41, 3, 1, C.skinShade);
    g.P(23, 47, 18, 3, C.leather);
    g.P(23, 47, 18, 1, C.leatherDark);
    for (let x = 24; x <= 40; x += 2) g.dot(x, 48, C.armour);
    g.P(21, 31, 6, 4, C.iron);
    g.P(21, 31, 6, 1, C.ironLite);
  }
}

function head(g, type, mood, t, talk, motion) {
  /* A blink every few seconds. It costs two rectangles and is most of what
     stops a face reading as a mask. */
  const blink = motion && Math.sin(t * 1.3) > 0.94;

  g.P(26, 16, 12, 13, C.skin);
  g.P(26, 16, 12, 1, C.skinLite);
  g.P(37, 17, 1, 12, C.skinShade);
  g.P(25, 22, 1, 2, C.skin);
  g.P(38, 22, 1, 2, C.skin);

  const eyeY = 22;
  if (blink) {
    g.P(29, eyeY, 2, 1, C.skinShade);
    g.P(34, eyeY, 2, 1, C.skinShade);
  } else {
    g.dot(29, eyeY, C.eyeWhite); g.dot(30, eyeY, C.eye);
    g.dot(34, eyeY, C.eyeWhite); g.dot(35, eyeY, C.eye);
  }

  /* Brows: one row higher for `improve`, which is the whole difference between
     a face that is pleased and a face that is rooting for you. */
  const brow = mood === 'improve' ? 20 : 21;
  const hc = hairOf(type);
  g.P(29, brow, 2, 1, hc);
  g.P(34, brow, 2, 1, hc);

  g.P(32, 23, 1, 2, C.skinShade);        // the nose

  const mouthY = 26;
  if (talk && motion && Math.sin(t * 13) > 0) {
    g.P(31, mouthY, 3, 2, C.mouth);
  } else if (mood === 'good' || mood === 'perfect') {
    g.dot(30, mouthY, C.mouth);
    g.P(31, mouthY + 1, 3, 1, C.mouth);
    g.dot(34, mouthY, C.mouth);
  } else {
    g.P(31, mouthY, 3, 1, C.mouth);
  }
}

function headgear(g, type, t, motion) {
  const hc = hairOf(type);

  if (type === 'magister') {
    g.P(25, 16, 2, 9, C.hairGrey);
    g.P(37, 16, 2, 9, C.hairGrey);
    g.P(26, 15, 12, 1, C.hairGreyDark);
    g.P(28, 28, 8, 2, C.hairGreyDark);   // the beard
    g.P(29, 29, 6, 1, C.hairGrey);
    return;
  }

  if (type === 'servus') {
    g.P(25, 15, 14, 2, C.hairDark);
    g.P(25, 16, 2, 7, C.hairDark);
    g.P(37, 16, 2, 7, C.hairDark);
    return;
  }

  if (type === 'centurio') {
    g.P(24, 13, 16, 5, C.iron);
    g.P(24, 13, 16, 1, C.ironLite);
    g.P(24, 17, 16, 1, C.armour);
    g.P(24, 18, 2, 6, C.iron);
    g.P(38, 18, 2, 6, C.iron);
    /* The transverse crest, which is the rank. It sways. */
    const sway = motion ? Math.round(Math.sin(t * 2.5)) : 0;
    g.P(23 + sway, 9, 18, 4, C.tunicR);
    for (let x = 24; x <= 40; x += 2) g.P(x + sway, 8, 1, 2, C.tunicRDark);
    return;
  }

  if (type === 'gladiator') {
    g.P(24, 13, 16, 4, C.iron);
    g.P(24, 13, 16, 1, C.ironLite);
    g.P(23, 16, 18, 1, C.armour);
    g.P(24, 17, 2, 7, C.iron);
    g.P(38, 17, 2, 7, C.iron);
    g.P(32, 17, 1, 4, C.ironDark);       // the nose guard
    g.P(30, 8, 4, 5, C.tunicR);          // the plume
    g.P(31, 7, 2, 1, C.tunicRDark);
    for (let y = 9; y <= 12; y++) g.dot(29, y, C.tunicRDark);
    return;
  }

  /* Senator and imperator: hair, and a wreath — laurel for one, gold for the
     other, which is the only difference between earning the city's respect and
     owning it. */
  g.P(25, 15, 14, 2, hc);
  g.P(25, 16, 2, 8, hc);
  g.P(37, 16, 2, 8, hc);

  const leaf = type === 'imperator' ? C.gold : C.laurel;
  const leafLite = type === 'imperator' ? C.goldLite : C.laurelLite;
  for (let x = 25; x <= 39; x += 2) {
    g.dot(x, 14, leaf);
    g.dot(x + 1, 13, leafLite);
  }
  g.P(24, 15, 1, 2, leaf);
  g.P(39, 15, 1, 2, leaf);
  if (type === 'imperator') g.P(31, 12, 2, 1, C.goldLite);
}

/** A hand, in one of three shapes: a thumbs-up, a raised finger, or open. */
function hand(g, hx, hy, kind) {
  g.P(hx, hy + 2, 3, 3, C.skin);
  g.P(hx, hy + 2, 1, 3, C.skinLite);

  if (kind === 'thumb') {
    g.P(hx - 1, hy + 1, 1, 2, C.skin);
    g.dot(hx - 1, hy + 1, C.skinLite);
  } else if (kind === 'index') {
    g.P(hx + 1, hy - 2, 1, 3, C.skin);
    g.dot(hx + 1, hy - 2, C.skinLite);
  } else {
    g.P(hx, hy - 1, 3, 1, C.skin);
    g.dot(hx, hy - 2, C.skin);
    g.dot(hx + 2, hy - 2, C.skin);
  }
}

function raisedArm(g, x, type, kind) {
  if (type === 'gladiator') {
    /* A manica: banded arm armour, so the gladiator's raised arm reads as
       protected rather than as a bare limb. */
    for (let y = 24; y <= 33; y++) g.P(x, y, 3, 1, y % 2 ? C.ironDark : C.iron);
    g.P(x, 24, 3, 1, C.ironLite);
  } else {
    const { base, dark } = SLEEVE[type];
    g.P(x, 24, 3, 10, base);
    g.P(x, 24, 1, 10, dark);
    g.P(x, 24, 3, 1, dark);
  }
  hand(g, x, 18, kind);
}

function arms(g, type, mood, t, motion, flourish) {
  const { base, dark } = SLEEVE[type];
  const { ctx, scale } = g;
  const bob = motion ? Math.round(Math.abs(Math.sin(t * 3))) : 0;

  if (flourish) {
    /* Both arms up. The bounce is faster than the idle bob on purpose: this is
       the one moment in the lesson that is allowed to be loud. */
    const extra = motion ? Math.round(Math.abs(Math.sin(t * 10)) * 1.5) : 0;
    ctx.save();
    ctx.translate(0, -(bob + extra) * scale);
    raisedArm(g, 21, type, 'open');
    if (type === 'gladiator') {
      for (let y = 24; y <= 33; y++) g.P(40, y, 3, 1, y % 2 ? C.ironDark : C.iron);
      g.P(40, 24, 3, 1, C.ironLite);
    } else {
      g.P(40, 24, 3, 10, base);
      g.P(42, 24, 1, 10, dark);
    }
    hand(g, 40, 18, 'open');
    ctx.restore();
    return;
  }

  /* The resting arm, and whatever the rank is holding in it. */
  g.P(41, 34, 3, 16, base);
  g.P(43, 34, 1, 16, dark);
  g.P(42, 49, 3, 3, C.skin);

  if (type === 'magister') {
    g.P(44, 45, 2, 9, C.scroll);
    g.P(44, 45, 1, 9, C.scrollShade);
    g.P(43, 44, 4, 1, C.leather);
    g.P(43, 54, 4, 1, C.leather);
  } else if (type === 'centurio') {
    g.P(45, 32, 1, 20, C.leather);       // the vine staff
  } else if (type === 'gladiator') {
    g.P(42, 49, 4, 1, C.armour);
    g.P(43, 50, 2, 9, C.iron);
  }

  ctx.save();
  ctx.translate(0, -bob * scale);
  raisedArm(g, 21, type, mood === 'improve' ? 'index' : 'thumb');
  ctx.restore();
}

/* -------------------------------------------------------------- draw ----- */

/**
 * Paint one bust.
 *
 * @param {object} g            a painter from engine.js, positioned by `fitBust`
 * @param {string} type         one of `TYPES`
 * @param {object} [opts]
 * @param {'good'|'improve'|'perfect'} [opts.mood]
 * @param {number} [opts.t]     seconds, for the idle motion
 * @param {boolean} [opts.talk] mouth moving
 * @param {boolean} [opts.flourish]  both arms up
 * @param {boolean} [opts.motion]    false under prefers-reduced-motion: every
 *   moving part freezes at its rest position and nothing else changes
 */
export function drawBust(g, type, {
  mood = 'good', t = 0, talk = false, flourish = false, motion = true,
} = {}) {
  if (!CLOTH[type]) throw new Error(`unknown coach: ${type}`);

  const { ctx, scale } = g;
  const breathe = motion ? Math.round(Math.sin(t * 2)) : 0;
  const bounce = flourish && motion ? Math.round(Math.abs(Math.sin(t * 8)) * 2) : 0;

  /* The halo. `null` for the core is the whole reason engine.js's bloom takes
     that argument — a solid middle would be painted straight over the face. */
  const aura = flourish
    ? C.goldLite
    : (mood === 'good' || mood === 'perfect') ? C.praise : C.glow;
  /* The pulse is gated on `motion` like every other moving part, so that under
     reduced motion one paint is genuinely the whole picture and re-rendering
     could not change it. */
  const pulse = motion ? 0.2 * Math.sin(t * 3) : 0;
  g.bloom(30, 18, 6, 10, aura, null, (flourish ? 0.9 : 0.5) + pulse);

  ctx.save();
  ctx.translate(0, (breathe - bounce) * scale);
  torso(g, type);
  arms(g, type, mood, t, motion, flourish);
  head(g, type, mood, t, talk, motion);
  headgear(g, type, t, motion);
  ctx.restore();
}

/* ---------------------------------------------------------- confetti ----- */

const CONFETTI = [C.gold, C.goldLite, C.laurelLite, C.tunicR];

/**
 * The victory flourish's particles, as plain data so the caller owns the clock
 * — the same shape the city's smoke field uses.
 *
 * `Math.random()` here is correct and is not an oversight. PLAN-ROMA section 4
 * bans it in the *city*, where a scene that rearranges itself between renders
 * is a screensaver. Confetti that fell the same way every time would be a
 * loop, which is worse. Do not "fix" either to match the other.
 *
 * @param {() => number} [random]  injected so the test can pin it
 */
export function burst(random = Math.random) {
  const parts = [];
  for (let i = 0; i < 26; i++) {
    const angle = random() * Math.PI * 2;
    const speed = 8 + random() * 14;
    parts.push({
      x: 32,
      y: 24,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      age: 0,
      life: 1.4 + random() * 0.8,
      col: CONFETTI[i % CONFETTI.length],
    });
  }
  return parts;
}

/** Advance the confetti and drop what has burned out. Gravity is 22/s². */
export function stepBurst(parts, dt) {
  for (const p of parts) {
    p.age += dt;
    p.vy += 22 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  return parts.filter(p => p.age < p.life);
}

/** Paint the confetti, fading each piece out over its own life. */
export function drawBurst(g, parts) {
  const { ctx } = g;
  ctx.save();
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
    g.dot(p.x, p.y, p.col);
  }
  ctx.restore();
}

/* ------------------------------------------------------------ canvas ----- */

/**
 * Size a canvas to hold exactly one bust, and hand back a context whose origin
 * is `BUST`'s corner — so every function above keeps the demo's 64-grid
 * numbers while the canvas stays 30x58 rather than a mostly empty 64x64.
 *
 * The dpr term is the same one `fitCanvas` needs and for the same reason:
 * without it the bust is soft on every iPhone made in the last decade.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} [opts]
 * @param {number} [opts.scale]  integer, logical pixels to CSS pixels
 * @returns {CanvasRenderingContext2D}
 */
export function fitBust(canvas, { scale = 2, dpr = globalThis.devicePixelRatio || 1 } = {}) {
  canvas.width = Math.round(BUST.w * scale * dpr);
  canvas.height = Math.round(BUST.h * scale * dpr);
  canvas.style.width = `${BUST.w * scale}px`;
  canvas.style.height = `${BUST.h * scale}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, -BUST.x * scale * dpr, -BUST.y * scale * dpr);
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
