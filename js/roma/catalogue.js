/* catalogue.js — what the twenty-five buildings are, and where each one stands.

   Data only. This file does not know how anything is drawn (buildings.js) and
   it does not know why anything unlocks (roma.js) — it knows the Latin name,
   the Dutch meaning, one line of real history, the XP it costs and the slot it
   occupies. That separation is what lets the art source be swapped wholesale
   without touching the progression, and vice versa.

   PLAN-ROMA section 5 asks for the whole slot map to be laid out before the
   second building is drawn, and this is it. On paper it would have been cheap
   and unverifiable; as data the test can check that nothing overlaps its
   neighbour and nothing hangs off the edge of the scene, which is the actual
   risk when twenty-five buildings are authored weeks apart. */

/**
 * The scene is a fixed logical size, scaled to the screen by a whole number.
 * Fixed dimensions mean slots never have to be recomputed for a different
 * phone.
 *
 * 560 wide rather than the 320 a phone shows: twenty-five buildings need more
 * frontage than one screen has, so the Home hero is a 320-wide window onto
 * this and the full-screen view pans across the whole thing.
 */
export const SCENE = Object.freeze({ w: 560, h: 180, window: 320 });

/**
 * Three depth bands, so buildings can overlap without colliding, and so the
 * back of the city can be drawn at half the detail.
 *
 * A slot is `(x, band)` and never `(x, y)`: every sprite's origin is its own
 * ground line, so vertical placement falls out of the band and never has to be
 * tuned per building.
 */
export const BANDS = Object.freeze({
  /* Behind the hill line. Reduced detail, colours pulled toward `hillFar` —
     which is aerial perspective for free, and lets these be half-width. */
  far: Object.freeze({ groundY: 126, z: 0 }),
  /* The main street. Most of the catalogue. */
  mid: Object.freeze({ groundY: 150, z: 1 }),
  /* The Tiber, the road, the cypresses, the citizens. */
  near: Object.freeze({ groundY: 166, z: 2 }),
});

/**
 * The catalogue, in unlock order.
 *
 * `xp` is cumulative and the order is fixed, both deliberately: a designed
 * composition always looks like Rome, where a player-chosen one looks like a
 * scrapyard. Decorations are interleaved so there is never a long stretch with
 * nothing to look forward to.
 *
 * `w` is the building's planned footprint, and it is not decoration — it is
 * what makes the scene composable at all. The test asserts that a sprite, once
 * drawn, actually fits the width claimed here.
 *
 * `lesson` is the design intent: which lesson this building should land on.
 * It is the field the eight-lesson rule is actually checked against, because
 * that rule is about *lessons* and only the XP is about XP. Keeping the intent
 * as data is what stopped the second retune being guesswork.
 *
 * ### Where the XP numbers come from
 *
 * Measured, not estimated. A simulation drives the real lesson loop — the real
 * ladder, the real boxes, the real award rules — one ten-minute lesson a day
 * with every answer correct, and reports the XP after each. The thresholds are
 * then read off that curve at the lesson each building should arrive on.
 *
 * Two things that measurement changed, both of which the earlier arithmetic had
 * backwards:
 *
 * 1. **XP per lesson is not flat.** It runs ~20 for the very first lesson, then
 *    520, 730, 860, and settles around 1000 once reviews are flowing. The first
 *    guess of "400–600 a lesson" was never true at either end.
 * 2. **The first lesson can only ever pay the finish bonus.** The acquire ladder
 *    is 12m35s long and the lesson box is ten minutes, so *no word can graduate
 *    inside a first lesson* — there is nothing else for it to pay for. 20 XP is
 *    the whole of it, doubled from 10 by the first-lesson-of-the-day rule, and
 *    that is exactly why `Casa Romuli` costs 20 and not 200. At 200 the hook
 *    could not land on day one however well she did.
 *
 * Tuned against a **500-word** pool, the pessimistic end of what she will have
 * this year, and against perfect play. Real play is slower than perfect and 600
 * words are faster than 500, so the two errors point in opposite directions.
 * The capstone lands on lesson 136 — a school year of steady use.
 *
 * Roughly chronological left to right, so the city reads as a timeline she
 * absorbs for free: the huts on the Palatine at the left end, the Capitoline
 * and its temple of Jupiter at the right.
 */
export const CATALOGUE = Object.freeze([
  /* ---- Stage 1, Roma Quadrata: 753 BC, a village of shepherds ---------- */
  {
    id: 'casa-romuli', latin: 'Casa Romuli', dutch: 'hut van Romulus',
    note: 'Hier zou Romulus zelf gewoond hebben, op de Palatijn.',
    xp: 20, lesson: 1, stage: 0, band: 'mid', x: 28, w: 12,
  },
  {
    id: 'ovile', latin: 'Ovile', dutch: 'schaapskooi',
    note: 'Rome begon als een dorp van herders; schapen waren rijkdom.',
    xp: 300, lesson: 2, stage: 0, band: 'mid', x: 45, w: 14,
  },
  {
    id: 'murus-ligneus', latin: 'Murus ligneus', dutch: 'houten palissade',
    note: 'De eerste omheining van de stad was van hout, niet van steen.',
    xp: 1400, lesson: 4, stage: 0, band: 'mid', x: 62, w: 20,
  },
  {
    id: 'ficus-ruminalis', latin: 'Ficus Ruminalis', dutch: 'vijgenboom',
    note: 'Onder deze vijgenboom vond de wolvin Romulus en Remus.',
    xp: 2600, lesson: 6, stage: 0, band: 'near', x: 16, w: 11, decoration: true,
  },
  {
    id: 'ara', latin: 'Ara', dutch: 'altaar',
    note: 'Elke Romeinse stad had een altaar; het vuur hoorde te blijven branden.',
    xp: 4000, lesson: 8, stage: 0, band: 'mid', x: 87, w: 7,
  },

  /* ---- Stage 2, Regnum: the kings drain the valley --------------------- */
  {
    id: 'forum', latin: 'Forum', dutch: 'marktplein',
    note: 'Het Forum was eerst een moeras; drooggelegd werd het het hart van de stad.',
    xp: 7000, lesson: 12, stage: 1, band: 'mid', x: 100, w: 26,
  },
  {
    id: 'cloaca-maxima', latin: 'Cloaca Maxima', dutch: 'hoofdriool',
    note: 'De grote riool legde het Forum droog en doet vandaag nog dienst.',
    xp: 10500, lesson: 16, stage: 1, band: 'near', x: 100, w: 12,
  },
  {
    id: 'templum-vestae', latin: 'Templum Vestae', dutch: 'tempel van Vesta',
    note: 'Het heilige vuur van Rome mocht nooit uitgaan.',
    xp: 14000, lesson: 20, stage: 1, band: 'mid', x: 131, w: 22,
  },
  {
    id: 'pons-sublicius', latin: 'Pons Sublicius', dutch: 'eerste brug',
    note: 'De oudste brug van Rome, van hout en zonder ijzeren nagels.',
    xp: 17500, lesson: 24, stage: 1, band: 'near', x: 130, w: 24,
  },
  {
    id: 'carcer', latin: 'Carcer', dutch: 'gevangenis',
    note: 'De Tullianum was klein, donker en berucht.',
    xp: 21500, lesson: 29, stage: 1, band: 'mid', x: 158, w: 12,
  },

  /* ---- Stage 3, Res Publica: the republic builds in stone -------------- */
  {
    id: 'curia', latin: 'Curia', dutch: 'senaatsgebouw',
    note: 'Hier kwam de senaat samen; curia betekent vergaderzaal.',
    xp: 26000, lesson: 34, stage: 2, band: 'mid', x: 178, w: 24,
  },
  {
    id: 'rostra', latin: 'Rostra', dutch: 'spreekgestoelte',
    note: 'Versierd met de scheepsnebben van verslagen vijanden.',
    xp: 32500, lesson: 40, stage: 2, band: 'mid', x: 207, w: 14,
  },
  {
    id: 'basilica', latin: 'Basilica', dutch: 'rechtsgebouw',
    note: 'Geen kerk, maar een overdekte hal voor recht en handel.',
    xp: 38500, lesson: 46, stage: 2, band: 'mid', x: 228, w: 26,
  },
  {
    id: 'murus-servii', latin: 'Murus Servii', dutch: 'stadsmuur',
    note: 'De muur van koning Servius, elf kilometer rond de stad.',
    xp: 45000, lesson: 52, stage: 2, band: 'far', x: 150, w: 110,
  },
  {
    id: 'via-appia', latin: 'Via Appia', dutch: 'de Via Appia',
    note: 'De koningin der wegen, aangelegd in 312 v.Chr.',
    xp: 51000, lesson: 58, stage: 2, band: 'near', x: 170, w: 90, decoration: true,
  },

  /* ---- Stage 4, Imperium: the empire and its engineering -------------- */
  {
    id: 'aqua-appia', latin: 'Aqua Appia', dutch: 'aquaduct',
    note: 'Het eerste aquaduct van Rome, grotendeels ondergronds.',
    xp: 58500, lesson: 65, stage: 3, band: 'far', x: 300, w: 96,
  },
  {
    id: 'thermae', latin: 'Thermae', dutch: 'badhuis',
    note: 'De baden waren gratis: iedereen ging er bijna elke dag heen.',
    xp: 65500, lesson: 72, stage: 3, band: 'mid', x: 266, w: 44,
  },
  {
    id: 'circus-maximus', latin: 'Circus Maximus', dutch: 'wagenrenbaan',
    note: 'Wagenrennen voor meer dan honderdduizend mensen.',
    xp: 74000, lesson: 80, stage: 3, band: 'mid', x: 315, w: 50,
  },
  {
    id: 'theatrum', latin: 'Theatrum', dutch: 'theater',
    note: 'Het theater van Pompeius was het eerste in steen.',
    xp: 80500, lesson: 88, stage: 3, band: 'mid', x: 370, w: 26,
  },
  {
    id: 'horti', latin: 'Horti', dutch: 'tuinen',
    note: 'Rijke Romeinen legden tuinen aan op de heuvels rond de stad.',
    xp: 85000, lesson: 96, stage: 3, band: 'near', x: 300, w: 14, decoration: true,
  },

  /* ---- Stage 5, Roma Aeterna: the high empire ------------------------- */
  {
    id: 'colosseum', latin: 'Colosseum', dutch: 'amfitheater',
    note: 'Vijftigduizend plaatsen, en een naam die van een reuzenbeeld komt.',
    xp: 92000, lesson: 104, stage: 4, band: 'mid', x: 398, w: 52,
  },
  {
    id: 'pantheon', latin: 'Pantheon', dutch: 'Pantheon',
    note: 'De koepel is nog altijd de grootste van ongewapend beton.',
    xp: 98000, lesson: 112, stage: 4, band: 'mid', x: 455, w: 44,
  },
  {
    id: 'columna-traiani', latin: 'Columna Traiani', dutch: 'zuil van Trajanus',
    note: 'Een stripverhaal in steen, spiraalvormig rond de zuil.',
    xp: 104000, lesson: 120, stage: 4, band: 'near', x: 470, w: 6,
  },
  {
    id: 'arcus-triumphalis', latin: 'Arcus Triumphalis', dutch: 'triomfboog',
    note: 'Alleen wie een oorlog gewonnen had, mocht eronder door.',
    xp: 109000, lesson: 128, stage: 4, band: 'near', x: 430, w: 24,
  },
  {
    id: 'templum-iovis', latin: 'Templum Iovis', dutch: 'tempel van Jupiter',
    note: 'De tempel van Jupiter op het Capitool, het hart van de staat.',
    xp: 114000, lesson: 136, stage: 4, band: 'mid', x: 504, w: 48,
  },
].map(Object.freeze));

/** By id, for the renderer and the unlock logic. */
export const BY_ID = Object.freeze(
  Object.fromEntries(CATALOGUE.map(entry => [entry.id, entry])),
);

/**
 * Where each growth stage begins, in XP — derived, never typed twice.
 *
 * A stage begins when its first building appears, which is the only definition
 * that keeps the name and the skyline saying the same thing: she is told
 * "Regnum" on the same lesson the Forum shows up. So the catalogue is the
 * single source of these numbers and `gamify.js` imports them rather than
 * carrying its own copy — the two used to disagree (0/400/1200/2800/6000
 * against these), which would have shown up as a stage name that changed
 * nowhere near a building.
 *
 * Stage 1 is the exception and starts at 0 rather than at 200: she is in
 * *Roma Quadrata* from the moment she opens the app, and the first hut arrives
 * a couple of hundred XP into it.
 */
export const STAGE_XP = Object.freeze(
  CATALOGUE.reduce((firsts, entry) => {
    if (firsts[entry.stage] === undefined) firsts[entry.stage] = entry.stage === 0 ? 0 : entry.xp;
    return firsts;
  }, []),
);

/**
 * The ground row a building in this band stands on.
 * @param {string} band
 * @returns {number}
 */
export function groundFor(band) {
  const found = BANDS[band];
  if (!found) throw new Error(`unknown band: ${band}`);
  return found.groundY;
}

/**
 * Painting order: back band first, and left to right inside a band so that a
 * building overlapping its neighbour is occluded by the one in front of it.
 * @returns {object[]} the catalogue, sorted for drawing
 */
export function inDrawOrder(entries = CATALOGUE) {
  return [...entries].sort((a, b) => (BANDS[a.band].z - BANDS[b.band].z) || (a.x - b.x));
}
