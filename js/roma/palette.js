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

   It began as "for the city" only, because the coach that would have shared it
   was parked (PLAN-ROMA section 9). The coach is now built, and its palette was
   merged in here rather than shipped beside this one — its demo carried a `K`
   table that overlapped this one heavily, and two near-identical palettes is
   how the two halves of one app drift apart. Four of its colours turned out to
   be duplicates and are gone: its skin and gold were this file's exactly, its
   red is `tunicR`, and its tunic and toga were two undyed wools a shade apart,
   now one. */

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

  /* Timber, and the one addition to the spec's list. Scaffolding is drawn by
     the renderer rather than by a sprite — it belongs to the plot, not to the
     building going up on it — so unlike the thatch and wattle of stage 1 it
     cannot live in a sprite's local palette. */
  scaffold: '#7a5c34',
  scaffoldLite: '#a8814d',

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

  /* Olive, the second addition to the spec's list and the counterpart to the
     cypress: where a cypress is a tall dark spike, an olive is low, broad and
     grey-green, so the two read as different plants rather than as more of the
     same. Silvery on purpose — it is what an olive looks like from a distance,
     and it separates the groves from the dark hills behind them. */
  olive: '#7e8f64',
  oliveLite: '#9fae86',
  oliveDark: '#5d6b46',
  oliveTrunk: '#6f6350',

  /* ---- figures, for scale --------------------------------------------- */
  skin: '#e0ac7e',
  toga: '#efe7d6',
  tunicR: '#b5402f',
  tunicB: '#3d5f9e',

  /* ---- the coach ------------------------------------------------------- */
  /* A citizen in the city is four pixels tall and needs one colour; the coach
     is a sixty-pixel bust and needs a face. Everything below exists for that,
     and reuses `skin`, `toga`, `tunicR`, `gold` and `glow` above rather than
     restating them a shade off. */

  skinLite: '#f0c79a',
  skinShade: '#c68b5e',

  hair: '#5a3a22',
  hairDark: '#33230f',
  hairGrey: '#bcb4a4',
  hairGreyDark: '#8f887c',

  eye: '#3a2a1a',
  eyeWhite: '#f6f1e6',
  mouth: '#8a3b2f',

  /* Armour. `iron` is the lorica and the helmets; `armour` is the polished
     fittings on them — and it is deliberately not `bronze` above, which is the
     green of bronze left outdoors for a century. A buckle is not a statue. */
  iron: '#b9c0c9',
  ironLite: '#e0e6ec',
  ironDark: '#7f8894',
  armour: '#c8912f',
  armourDark: '#8f6320',

  goldLite: '#ffd76b',
  tunicRDark: '#8f2c22',

  /* Undyed wool: the magister's tunic and the senator's toga are the same
     cloth, so they are the same two tones. What separates the two ranks is the
     purple stripe, the scroll and the hair — not a hex nobody could name. */
  togaShade: '#d5cab2',

  purple: '#6d2c72',
  purpleLite: '#8c3d92',

  leather: '#8a5a34',
  leatherDark: '#5f3c20',

  scroll: '#efe2be',
  scrollShade: '#d3c398',

  /* The servus's undyed, unbleached, unloved tunic. */
  drab: '#94855f',
  drabDark: '#6f6244',

  laurel: '#3f8f45',
  laurelLite: '#5cb35a',

  /* The halo behind the bust. Green for a right answer, and `glow` — the same
     warm light the city's braziers throw — for an encouraging one. */
  praise: '#8fe0a0',

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
 * tone. Three honest gaps, kept rather than papered over with invented colours:
 * `plaza`, `bank` and `hill` are two-tone in the spec, because ground read from
 * the side barely needs a lit face; `wool` is two-tone for the same reason, a
 * draped robe having no flat lit face to catch anything; and `flame` inverts the
 * rule, its brightest tone being the core rather than the upper-left.
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
  olive: Object.freeze({
    lit: C.oliveLite, base: C.olive, shadow: C.oliveDark,
  }),

  /* The coach's two volume surfaces. Its cloth is deliberately absent: undyed
     wool draped over a shoulder has a base and a shadow and no lit face worth
     a third hex, and inventing one to satisfy the rule would be the rule
     wearing the palette rather than the other way round. */
  skin: Object.freeze({
    lit: C.skinLite, base: C.skin, shadow: C.skinShade,
  }),
  iron: Object.freeze({
    lit: C.ironLite, base: C.iron, shadow: C.ironDark,
  }),

  /* Two-tone: ground planes seen edge-on, and the coach's cloth. */
  wool: Object.freeze({ base: C.toga, shadow: C.togaShade }),
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
