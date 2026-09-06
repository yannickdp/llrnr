/* palette.js — the one shared palette for the city.

   Twenty-five buildings get authored independently, over weeks, and they have
   to end up looking like one place rather than a street of borrowed houses.
   The mechanism for that is this file: every building imports its colours from
   here, and a building that hardcodes a hex is a bug. Re-theming the whole city
   (marble to sandstone, terracotta to slate) is then a matter of editing one
   module and touching no geometry.

   The values are the drawing spec's (plan-roma-updates.md section 4) and are
   deliberately copied exactly rather than improved on. They are already
   coordinated; a "nicer" blue picked in isolation is how a coherent palette
   stops being one.

   Written as "for the city" rather than "for the app" only because the coach
   that would have shared it is parked — see PLAN-ROMA section 9. If it is ever
   revived, its own palette merges into this file rather than living beside it. */

/**
 * Every colour in the city, flat and terse, because building recipes read
 * better as `P(x, y, 4, 1, C.marbleShade)` than as a nested lookup.
 *
 * Frozen: a recipe that assigns to `C.marble` would silently re-theme every
 * building drawn after it, which is a miserable bug to find.
 */
export const C = Object.freeze({
  /* ---- marble, travertine, stone -------------------------------------- */
  marbleLite: '#f8f4ea',
  marble: '#efe9db',
  marbleShade: '#d6ccb6',
  marbleDark: '#b7ac91',

  trav: '#e6d6b2',
  travShade: '#cbb98d',
  travDark: '#a8945f',

  stone: '#d8ccae',
  stoneShade: '#b7a984',
  stoneDark: '#8d7f5f',
  mortar: '#c1b48f',

  /* The inside of every opening. Nothing else should be this dark. */
  arc: '#2c281b',
  arcLite: '#4a4330',

  /* ---- terracotta and metal ------------------------------------------- */
  tile: '#b5502f',
  tileLite: '#cd6440',
  tileDark: '#8c3c22',

  gold: '#e6b64a',
  bronze: '#6f9c86', // patinated, not fresh: Roman bronze outdoors goes green

  /* ---- ground and nature ---------------------------------------------- */
  plaza: '#cfc2a2',
  plazaDark: '#b4a682',
  weed: '#7c8a4a',

  water: '#4f86a8',
  waterLite: '#83b6cd',
  waterDark: '#37627d',

  bank: '#6fae4f',
  bankDark: '#4f8a3a',
  hill: '#8fb08a',
  hillFar: '#a9c3aa', // the far depth band pulls toward this: free aerial perspective

  cypress: '#2f5e3a',
  cypressLite: '#3f7a49',
  cypressDark: '#214a2c',

  /* ---- figures, for scale --------------------------------------------- */
  skin: '#e0ac7e',
  toga: '#efe7d6',
  tunicR: '#b5402f',
  tunicB: '#3d5f9e',

  /* ---- fire and light -------------------------------------------------- */
  flameCore: '#fff2b0',
  flame: '#ffab38',
  flameDeep: '#f0631f',
  smoke: '#c9cccf',
  glow: '#ffce74',
  glowCore: '#fff3cf',

  /* ---- sky, day -------------------------------------------------------- */
  skyDayTop: '#7ec8ee',
  skyDayBot: '#dff2fb',
  sun: '#ffe14d',
  sunGlow: '#fff2a8',
  cloud: '#ffffff',
  cloudShad: '#dbe7ee',
  bird: '#3a4a63',

  /* ---- sky, night ------------------------------------------------------ */
  skyNightTop: '#0e1230',
  skyNightBot: '#2c2554',
  moon: '#f4f0d8',
  moonShad: '#d7d1b2',
  star: '#fff6d8',
});

/**
 * The three-tone rule, made explicit.
 *
 * Every surface that should read as having volume gets a *lit* tone up and to
 * the left, a *base* tone, and a *shadow* tone down and to the right. That one
 * habit is what stops flat rectangles reading as flat rectangles, and it is the
 * highest-leverage thing to get right in the whole art job.
 *
 * Stated as data rather than as a comment so a recipe can ask for a material by
 * name — `T.marble.shadow` — and so the test can check no material is missing a
 * tone. Two honest gaps, kept rather than papered over with invented colours:
 * `plaza`, `bank` and `hill` are two-tone in the spec, because ground read from
 * the side barely needs a lit face; and `flame` inverts the rule, its brightest
 * tone being the core rather than the upper-left.
 */
export const T = Object.freeze({
  marble: Object.freeze({
    lit: C.marbleLite, base: C.marble, shadow: C.marbleShade, deep: C.marbleDark,
  }),
  travertine: Object.freeze({
    lit: C.trav, base: C.travShade, shadow: C.travDark,
  }),
  stone: Object.freeze({
    lit: C.stone, base: C.stoneShade, shadow: C.stoneDark,
  }),
  tile: Object.freeze({
    lit: C.tileLite, base: C.tile, shadow: C.tileDark,
  }),
  water: Object.freeze({
    lit: C.waterLite, base: C.water, shadow: C.waterDark,
  }),
  cypress: Object.freeze({
    lit: C.cypressLite, base: C.cypress, shadow: C.cypressDark,
  }),

  /* Two-tone: ground planes seen edge-on. */
  plaza: Object.freeze({ base: C.plaza, shadow: C.plazaDark }),
  bank: Object.freeze({ base: C.bank, shadow: C.bankDark }),
  hill: Object.freeze({ base: C.hill, far: C.hillFar }),

  /* Inverted: lit from the middle outward. */
  flame: Object.freeze({ core: C.flameCore, base: C.flame, deep: C.flameDeep }),
});

/**
 * The two masonry materials are laid as a checkerboard of their lit and base
 * tones, which is what gives a big blank wall its texture. Every recipe that
 * fills a wall wants this, so it lives here rather than being retyped.
 *
 * Keyed off the coordinates themselves, so it is stable between renders — see
 * `hash` in engine.js for why that matters.
 *
 * @param {{lit: string, base: string}} material  a `T` entry
 * @param {number} x  logical column
 * @param {number} y  logical row
 * @returns {string} the tone for that block
 */
export function course(material, x, y) {
  return ((x + y) & 3) === 0 ? material.lit : material.base;
}
