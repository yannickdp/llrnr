/* buildings.js — all twenty-five sprites, behind one interface.

   Two authoring modes, and which one a building uses follows from the building
   rather than from a preference. Stage 1 is character grids: a thatched hut, a
   sheepfold, a palisade, a fig tree and an altar are organic, irregular and
   small, with no repeating structure worth parameterising, so a function would
   be sillier than a picture. Everything from the kings onward is a draw
   function, because Roman architecture is repetitive and an arcade of six
   identical arches wants a loop, not two thousand hand-placed characters.
   Nothing outside this file can tell which was used.

   This file was also the honest risk in the whole city (PLAN-ROMA §3): the
   drawing spec had proven recipes for the temple, the Colosseum, the aqueduct
   and the arch, all of them months away, and nothing at all for the rustic
   sprites she meets in her first ten minutes. That go/no-go passed on a phone
   after 4b.2, so the CC0-tileset fallback is retired — though the seam that
   made it cheap stays, because it is also what keeps render.js from knowing
   what a building means.

   Grids are authored top row first. Ground level is the last row: the scene
   draws the earth, so a sprite that painted its own would sit on a seam.

   Look at any of it with test/roma-city.html, on a phone. Geometry can be
   tested and proportion cannot. */

import { C, T, course } from './palette.js';
import { fromDraw, fromGrid } from './engine.js';

/* Straw and wattle, the two materials the whole of stage 1 is built from.
   Not in palette.js: the shared palette is marble, travertine and terracotta —
   the materials of the city Rome became. A shepherds' village is made of
   different stuff, and pretending otherwise would either wash stage 1 in
   marble tones or drag hut colours into every later building. */
const HUT = {
  '.': null,
  's': '#d8bd76', // thatch, lit
  'S': '#a8904f', // thatch, shadow
  'w': '#8c6a3f', // wattle and daub
  'W': '#6b4a3a', // wattle, shadow
  'd': C.arc,     // a doorway is a hole, and every hole in the city is this colour
};

/* ================================================ 1. Casa Romuli ========= */

/**
 * The hut of Romulus — the first building she ever unlocks, at 200 XP, inside
 * her first lesson. It carries more weight than anything else in the catalogue:
 * if the city does not visibly react before she finishes her first ten minutes,
 * it never will.
 *
 * A conical thatched roof almost to the ground, over daubed wattle walls, which
 * is what the iron-age huts on the Palatine actually looked like — their
 * post-holes are still cut into the rock up there.
 */
export const casaRomuli = fromGrid({
  id: 'casa-romuli',
  palette: HUT,
  px: [
    '.....ss.....',
    '....ssss....',
    '...ssssSS...',
    '..ssssssSS..',
    '.sssssssSSS.',
    'ssssssssSSSS',
    '.wwwwwwwWWW.',
    '.wwwddwwWWW.',
    '.wwwddwwWWW.',
  ],
});

/* ====================================================== 2. Ovile ========= */

/**
 * The sheepfold. Rome began as a village of shepherds, and a flock was what
 * wealth meant — the Latin for money, *pecunia*, comes from *pecus*, cattle.
 */
export const ovile = fromGrid({
  id: 'ovile',
  palette: { ...HUT, 'p': '#7a5c34', 'o': '#e8e2d0', 'O': '#c3bba4' },
  px: [
    '...sssss......',
    '..sssssSS.....',
    '.sssssssSS....',
    '.wwwwwwwWW....',
    '.wwwwwwwWWpppp',
    '.wwwwwwwWWp.p.',
    '.wwwwwwwWW.oO.',
    '.wwwwwwwWWoooO',
  ],
});

/* ============================================== 3. Murus ligneus ========= */

/**
 * The wooden palisade. The first wall around the city was not the stone one
 * she unlocks in stage 3 — it was a run of sharpened stakes, and saying so is
 * half the point of having both in the catalogue.
 *
 * Each log is two pixels: lit face, shadowed face. That is the three-tone rule
 * at the smallest scale it works at, and it is what stops twenty stakes reading
 * as one brown slab.
 */
export const murusLigneus = fromGrid({
  id: 'murus-ligneus',
  palette: {
    '.': null,
    'v': '#a8814d', // sharpened tip, catching the light
    'l': '#8c6a3f',
    'L': '#5f4327',
    'r': '#7a5c34', // the rails holding it together
  },
  px: [
    'v.v.v.v.v.v.v.v.v.v.',
    'lLlLlLlLlLlLlLlLlLlL',
    'lLlLlLlLlLlLlLlLlLlL',
    'rrrrrrrrrrrrrrrrrrrr',
    'lLlLlLlLlLlLlLlLlLlL',
    'lLlLlLlLlLlLlLlLlLlL',
    'rrrrrrrrrrrrrrrrrrrr',
    'lLlLlLlLlLlLlLlLlLlL',
    'lLlLlLlLlLlLlLlLlLlL',
  ],
});

/* ========================================== 4. Ficus Ruminalis ========== */

/**
 * The fig tree, and a decoration rather than a building — the catalogue
 * interleaves these so there is never a long stretch with nothing coming.
 *
 * It stands in the near band, just left of the hut, because this is the tree
 * the she-wolf is supposed to have found the twins under. A vocabulary reward
 * that happens to carry the founding myth is the whole argument of section 1.
 */
export const ficusRuminalis = fromGrid({
  id: 'ficus-ruminalis',
  palette: {
    '.': null,
    'g': '#5e8f43', // leaves, lit
    'G': '#3d6b30', // leaves, shadow
    't': '#7a6046', // trunk, lit
    'T': '#4f3b28', // trunk, shadow
  },
  px: [
    '...ggg.....',
    '..ggggGG...',
    '.gggggGGG..',
    'ggggggGGGG.',
    'gggggggGGGG',
    '.ggggggGGG.',
    '..gggGGG...',
    '....tT.....',
    '....tT.....',
    '...ttT.....',
    '...tTT.....',
    '..tttTT....',
  ],
});

/* ======================================================== 5. Ara ========= */

/**
 * The altar — and the reason the fire system is built now rather than with the
 * rest of the city's "life" much later. This is the fifth unlock, inside the
 * first week, and until stage 2 arrives its flame is the only thing in the
 * whole city that moves.
 *
 * The fire is registered, not drawn. The sprite says "there is a fire here, of
 * about this size"; the flame and the smoke are painted later by the animated
 * pass, and the night pass blooms it, and this sprite knows about none of that.
 */
export const ara = fromGrid({
  id: 'ara',
  palette: {
    '.': null,
    'l': C.marbleLite,
    'b': C.marble,
    'B': C.marbleShade,
    'd': C.marbleDark,
  },
  px: [
    'lllllll',
    '.bbbbb.',
    '.bBBBb.',
    '.bBBBb.',
    'ddddddd',
  ],
  lights: (g, x, groundY) => {
    /* Burning from the top slab, which is the sprite's first row. */
    g.fire(x + 3, groundY - 4, 1.6, 3);
  },
});

/* ========================================== stages 2 and 3: stone ======== */

/* Where stage 1 was thatch and wattle, the kings and the republic build in
   travertine and marble under terracotta roofs — which is why almost all of
   these are draw functions. An arcade of identical arches wants a loop; a hut
   wanted a picture. `arch` alone carries the drain, the basilica and the city
   gate.

   One lesson from 4b.2 is applied throughout: **an arch reads as curved from
   seven pixels wide, not five.** At five the head has three rows to turn
   through and steps 3-5-5, which is blunt; at seven it steps 3-5-7-7. Where a
   width will not take seven, the opening is drawn square on purpose rather
   than as a bad arch. */

/** A column, two pixels wide: lit face, shadowed face. */
function column(g, x, top, bottom) {
  g.P(x, top, 2, bottom - top + 1, T.marble.base);
  g.P(x, top, 1, bottom - top + 1, T.marble.lit);
  g.dot(x + 1, bottom, T.marble.shadow);
}

/**
 * A run of masonry: checkerboarded, mortar courses, the odd cracked block.
 *
 * `from` is the datum the courses are counted off, and it defaults to the top
 * of this run. Two adjacent runs need to share it or their courses do not line
 * up — which is what the city wall's towers did against its curtain wall, and
 * a wall whose courses jog where a tower meets it reads as a mistake rather
 * than as two structures.
 */
function masonry(g, x, y, w, h, material, { mortar = 3, from = y } = {}) {
  for (let cx = x; cx < x + w; cx++) {
    for (let cy = y; cy < y + h; cy++) {
      const n = g.hash(cx, cy);
      g.dot(cx, cy, n > 0.965 ? material.shadow : course(material, cx, cy));
    }
  }
  if (!mortar) return;
  for (let cy = from + mortar; cy < y + h; cy += mortar) {
    if (cy >= y) g.P(x, cy, w, 1, C.mortar);
  }
}

/* ------------------------------------------------- 6. Forum ------------- */

/**
 * The market square: a colonnade along the back, a stylobate, and two stalls
 * with awnings in front of it. The Forum was a drained marsh before it was the
 * heart of the city, which is why the Cloaca has to exist for it to.
 */
export const forum = fromDraw({
  id: 'forum', w: 26, h: 18,
  paint(g, x, gy) {
    const { P, dot } = g;
    const top = gy - 17;

    P(x + 1, top, 24, 1, C.tileLite);
    P(x, top + 1, 26, 1, C.tile);
    P(x, top + 2, 26, 1, C.tileDark);
    P(x + 1, top + 3, 24, 1, T.marble.lit);
    P(x + 1, top + 4, 24, 1, T.marble.shadow);

    /* The shaded interior goes down first, so the gaps between the columns
       read as depth rather than as sky. */
    P(x + 2, top + 5, 22, 9, C.arcLite);
    for (let i = 0; i < 6; i++) column(g, x + 2 + i * 4, top + 5, top + 13);

    P(x, top + 14, 26, 1, T.marble.lit);
    P(x, top + 15, 26, 1, T.marble.base);
    P(x, top + 16, 26, 1, T.marble.shadow);
    P(x, top + 17, 26, 1, T.marble.deep);

    /* Two stalls, because a market with nobody selling anything is a portico. */
    for (const [sx, cloth] of [[x + 4, C.tunicR], [x + 16, C.tunicB]]) {
      P(sx, top + 11, 6, 1, cloth);
      dot(sx, top + 12, C.scaffold);
      dot(sx + 5, top + 12, C.scaffold);
      P(sx + 1, top + 12, 4, 2, T.travertine.shadow);
    }
    dot(x + 12, top + 12, C.skin);
    P(x + 12, top + 13, 1, 2, C.toga);
  },
});

/* ---------------------------------------- 7. Cloaca Maxima ------------- */

/**
 * The great drain where it empties into the Tiber: a stone-faced bank with one
 * big arched outlet. It drained the Forum and parts of it are still doing the
 * job, which is the fact worth putting on the card.
 *
 * In the water band, so it stands at the river rather than on the pavement —
 * this is one of the two buildings that made that band necessary.
 */
export const cloacaMaxima = fromDraw({
  id: 'cloaca-maxima', w: 12, h: 14,
  paint(g, x, gy) {
    const top = gy - 13;
    masonry(g, x, top, 12, 14, T.stone, { mortar: 3 });
    g.arch(x + 5, top + 6, 9, 8, C.arc);
    g.P(x, top, 12, 1, T.stone.lit);
  },
});

/* -------------------------------------- 8. Templum Vestae -------------- */

/**
 * The temple of Vesta, and it is round — a tholos rather than the usual
 * rectangular temple, which makes it the most recognisable silhouette in the
 * Forum.
 *
 * It carries the eternal fire, and that is the payoff the fire system was
 * built in stage 1 for: the card says the flame was never allowed to go out,
 * and it is burning in the doorway while she reads that.
 */
export const templumVestae = fromDraw({
  id: 'templum-vestae', w: 22, h: 24,
  paint(g, x, gy) {
    const { P, dot } = g;
    const top = gy - 23;
    const cx = x + 11;

    /* Conical roof, widening by two each side per row. */
    for (let row = 0; row < 6; row++) {
      const half = 1 + row * 2;
      P(cx - half, top + row, half * 2, 1, row < 2 ? C.tileLite : C.tile);
      dot(cx + half - 1, top + row, C.tileDark);
    }
    P(x, top + 6, 22, 1, T.marble.lit);
    P(x, top + 7, 22, 1, T.marble.shadow);

    /* The drum, then the doorway on it, then the ring of columns *over* both.
       That order is the whole trick: a tholos is peripteral, so the cella door
       is seen through the colonnade rather than beside it, and painting the
       columns last is what makes the dark of the interior read as being behind
       them. Painting the door last instead — which is what this did first —
       put a flat black slot in front of the columns.

       Six columns at a pitch of four span the full twenty-two exactly. Seven
       at three did not: they ran to the right edge and left the leftmost two
       pixels bare, with the last column standing off the end of the drum. */
    P(x, top + 8, 22, 12, C.arcLite);
    P(x + 7, top + 12, 8, 8, C.arc);
    for (let i = 0; i < 6; i++) column(g, x + i * 4, top + 8, top + 19);

    g.light(x + 7, top + 12, 8, 8);
    g.fire(x + 11, top + 19, 1.3, 8);

    P(x, top + 20, 22, 1, T.marble.lit);
    P(x, top + 21, 22, 1, T.marble.base);
    P(x + 1, top + 22, 20, 1, T.marble.shadow);
    P(x, top + 23, 22, 1, T.marble.deep);
  },
});

/* -------------------------------------- 9. Pons Sublicius ------------- */

/**
 * The oldest bridge in Rome: timber, on trestles, and built without iron
 * nails so it could be taken apart in a hurry.
 *
 * Water band, so its piles stand in the Tiber rather than on the street.
 */
export const ponsSublicius = fromDraw({
  id: 'pons-sublicius', w: 24, h: 16,
  paint(g, x, gy) {
    const { P, dot } = g;
    const top = gy - 15;

    /* Handrail, then the deck. */
    P(x, top, 24, 1, C.scaffoldLite);
    for (let i = 0; i < 24; i += 3) dot(x + i, top + 1, C.scaffold);
    P(x, top + 2, 24, 1, C.scaffoldLite);
    P(x, top + 3, 24, 1, C.scaffold);

    /* Four braced trestles down into the water. */
    for (const px of [x + 2, x + 8, x + 14, x + 20]) {
      P(px, top + 4, 2, 12, C.scaffold);
      dot(px, top + 4, C.scaffoldLite);
      P(px - 1, top + 8, 4, 1, C.scaffoldLite);
    }
  },
});

/* ------------------------------------------------ 10. Carcer ---------- */

/**
 * The Tullianum: windowless but for one barred slot, and thoroughly
 * unpleasant. A grid rather than a function — nothing about it repeats, and
 * grim little buildings are what grids are for.
 */
export const carcer = fromGrid({
  id: 'carcer',
  palette: {
    '.': null,
    'l': C.stone,
    's': C.stoneShade,
    'm': C.stoneDark,
    'a': C.arc,
  },
  px: [
    'llllllllllll',
    'ssssssssssss',
    '.mmmmmmmmmm.',
    '.mmmmmmmmmm.',
    '.mmmmaaammm.',
    '.mmmmaaammm.',
    '.mmmmmmmmmm.',
    '.mmmmmmmmmm.',
    '.mmmmmmmmmm.',
    '.mmmmmmmmmm.',
    '.mmmmaaammm.',
    '.mmmmaaammm.',
    '.mmmmaaammm.',
    'ssssssssssss',
  ],
  lights: (g, x, groundY) => g.light(x + 4, groundY - 9, 3, 2),
});

/* ------------------------------------------------- 11. Curia ---------- */

/**
 * The Senate house — tall, plain and deliberately severe, with the great
 * bronze doors that are the only thing about it anybody remembers. *Curia*
 * just means a meeting hall, which is the gloss on the card.
 */
export const curia = fromDraw({
  id: 'curia', w: 24, h: 28,
  paint(g, x, gy) {
    const { P, dot } = g;
    const top = gy - 27;

    /* Low gable. */
    P(x + 8, top, 8, 1, C.tileLite);
    P(x + 5, top + 1, 14, 1, C.tile);
    P(x + 2, top + 2, 20, 1, C.tile);
    P(x, top + 3, 24, 1, C.tileDark);
    P(x, top + 4, 24, 1, T.marble.lit);
    P(x, top + 5, 24, 1, T.marble.shadow);

    masonry(g, x, top + 6, 24, 20, T.travertine, { mortar: 0 });

    /* Three high windows, lit at night. */
    for (const wx of [x + 3, x + 10, x + 17]) {
      P(wx, top + 9, 4, 5, C.arc);
      g.light(wx, top + 9, 4, 5);
    }

    /* The doors. Patinated bronze, which is what Roman bronze outdoors goes.
       Two leaves with one panel line each and a stud on each — banding them
       every second row, which is what this did first, turned the famous doors
       into a humbug stripe. */
    P(x + 9, top + 18, 6, 8, C.bronze);
    P(x + 11, top + 18, 1, 8, C.arc);
    P(x + 9, top + 22, 6, 1, C.arc);
    dot(x + 10, top + 20, C.gold);
    dot(x + 13, top + 20, C.gold);

    P(x, top + 26, 24, 1, T.marble.lit);
    P(x, top + 27, 24, 1, T.marble.deep);
  },
});

/* ------------------------------------------------ 12. Rostra ---------- */

/**
 * The speakers' platform, hung with the bronze rams cut from captured
 * warships — *rostra*, which is where the word for a podium comes from.
 */
export const rostra = fromGrid({
  id: 'rostra',
  palette: {
    '.': null,
    'l': C.marbleLite,
    's': C.marbleShade,
    'm': C.marble,
    'd': C.marbleDark,
    'b': C.bronze,
  },
  px: [
    '..llllllllll..',
    '..ssssssssss..',
    '.llllllllllll.',
    'llllllllllllll',
    '.mbmmbmmbmmbm.',
    '.mbmmbmmbmmbm.',
    '.mmmmmmmmmmmm.',
    '.mmmmmmmmmmmm.',
    '.ssssssssssss.',
    'dddddddddddddd',
  ],
});

/* ---------------------------------------------- 13. Basilica ---------- */

/**
 * Not a church — that meaning came centuries later. A basilica was a covered
 * hall for law and business, and two storeys of arcade is what one looks
 * like. Three arches a storey rather than five, because seven pixels is what
 * an arch needs and three sevens is what twenty-six will take.
 */
export const basilica = fromDraw({
  id: 'basilica', w: 26, h: 26,
  paint(g, x, gy) {
    const { P } = g;
    const top = gy - 25;

    P(x + 1, top, 24, 1, C.tileLite);
    P(x, top + 1, 26, 1, C.tile);
    P(x, top + 2, 26, 1, C.tileDark);
    P(x, top + 3, 26, 1, T.marble.lit);
    P(x, top + 4, 26, 1, T.marble.shadow);

    masonry(g, x + 1, top + 5, 24, 9, T.travertine, { mortar: 0 });
    for (const cx of [x + 5, x + 13, x + 21]) g.arch(cx, top + 6, 7, 8, C.arc);

    P(x, top + 14, 26, 1, T.marble.lit);
    P(x, top + 15, 26, 1, T.marble.shadow);

    masonry(g, x + 1, top + 16, 24, 8, T.travertine, { mortar: 0 });
    for (const cx of [x + 5, x + 13, x + 21]) g.arch(cx, top + 16, 7, 8, C.arc);
    g.light(x + 10, top + 17, 7, 7);

    P(x, top + 24, 26, 1, T.marble.lit);
    P(x, top + 25, 26, 1, T.marble.deep);
  },
});

/* ------------------------------------------ 14. Murus Servii ---------- */

/**
 * King Servius's wall — eleven kilometres of it around the city. A hundred and
 * ten pixels in the far band, which is where the haze earns its keep: the same
 * code as everything else, pulled toward the hill colour, reading as distance
 * without one extra decision here.
 */
export const murusServii = fromDraw({
  id: 'murus-servii', w: 110, h: 14,
  paint(g, x, gy) {
    const { P } = g;
    const top = gy - 13;

    masonry(g, x, top + 3, 110, 11, T.stone, { mortar: 4 });

    /* Crenellations along the parapet. */
    for (let cx = x; cx < x + 110; cx += 4) P(cx, top + 2, 2, 1, T.stone.lit);

    /* Two towers, rising above the walk. Their courses are counted off the
       curtain wall's datum, not their own, so the stonework runs through. */
    for (const tx of [x + 18, x + 83]) {
      masonry(g, tx, top, 10, 14, T.stone, { mortar: 4, from: top + 3 });
      for (let cx = tx; cx < tx + 10; cx += 3) P(cx, top, 2, 1, T.stone.lit);
    }

    /* And a gate, because a wall with no way through is a cliff. */
    g.arch(x + 55, top + 6, 9, 8, C.arc);
    P(x + 49, top + 4, 13, 1, T.stone.lit);
  },
});

/* --------------------------------------------- 15. Via Appia ---------- */

/**
 * The queen of roads, and a decoration rather than a building. Drawn as what
 * it looked like leaving the city: paving, a milestone, and the tombs that
 * lined it — burial inside the walls was forbidden, so Romans buried their
 * dead along the roads out.
 */
export const viaAppia = fromDraw({
  id: 'via-appia', w: 90, h: 10,
  paint(g, x, gy) {
    const { P, dot } = g;
    const top = gy - 9;

    /* The tombs, which are the only things tall enough to set the height. */
    for (const tx of [x + 6, x + 68]) {
      P(tx + 1, top, 6, 1, T.marble.lit);
      P(tx, top + 1, 8, 1, T.marble.shadow);
      masonry(g, tx, top + 2, 8, 7, T.travertine, { mortar: 0 });
      P(tx, top + 9, 8, 1, T.marble.deep);
    }

    /* A milestone. Every Roman mile, all the way to Brundisium. */
    P(x + 40, top + 5, 2, 4, T.marble.base);
    dot(x + 40, top + 5, T.marble.lit);

    /* Paving, in irregular blocks the way it really was laid. */
    for (let cx = x; cx < x + 90; cx++) {
      const n = g.hash(cx, 7);
      dot(cx, top + 8, n > 0.6 ? T.travertine.lit : T.travertine.base);
      dot(cx, top + 9, n > 0.8 ? T.travertine.shadow : T.travertine.base);
    }
  },
});

/* ================================= stages 4 and 5: the empire =========== */

/* Where the drawing spec's own recipes finally get cashed in — the aqueduct
   (its §8.3), the Colosseum (§8.2), the triumphal arch (§8.4) and the temple
   front (§8.1). Adapted rather than copied: the spec draws one building per
   64x64 scene and these have to stand in a street with neighbours, at the
   widths the slot map reserved for them a hundred lessons ago.

   One deliberate departure. The spec draws the Colosseum **ruined**, with a
   `facadeTop(x)` that removes the upper tiers on the right, and it is right
   that the broken silhouette is the recognisable one. It is drawn intact here
   anyway: the stage is called *Roma Aeterna* and the city is being built up, so
   a half-collapsed monument at the top of the growth curve reads as damage. The
   ruin machinery was not wasted — generalised into the `progress` parameter, it
   is what draws every building under construction. */

/** A fluted column, three pixels wide — for the two hero temple fronts. */
function fatColumn(g, x, top, bottom) {
  g.P(x - 1, bottom, 5, 1, T.marble.deep);            // base
  g.P(x - 1, bottom - 1, 5, 1, T.marble.shadow);
  for (let y = top + 2; y < bottom - 1; y++) {        // fluted shaft
    g.dot(x, y, T.marble.lit);
    g.dot(x + 1, y, T.marble.base);
    g.dot(x + 2, y, T.marble.shadow);
  }
  g.P(x - 1, top + 1, 5, 1, T.marble.lit);            // capital
  g.P(x - 1, top, 5, 1, T.marble.base);
  g.dot(x, top + 1, T.marble.shadow);                 // a hint of Corinthian
  g.dot(x + 2, top + 1, T.marble.shadow);
}

/** A pediment: filled triangle, terracotta along the rakes, gilded rosette. */
function pediment(g, cx, top, rows, half) {
  for (let row = 0; row <= rows; row++) {
    const reach = Math.round((row / rows) * half);
    const y = top + row;
    g.P(cx - reach, y, reach * 2 + 1, 1, T.marble.shadow);
    g.dot(cx - reach, y, C.tile);
    g.dot(cx + reach, y, C.tileDark);
  }
  for (let row = 3; row <= rows - 2; row++) {
    const reach = Math.round((row / rows) * half) - 2;
    if (reach > 0) g.P(cx - reach, top + row, reach * 2 + 1, 1, T.marble.base);
  }
  g.dot(cx, top + rows - 4, C.gold);
}

/* -------------------------------------------- 16. Aqua Appia ---------- */

/**
 * The first aqueduct, two tiers of it, from the spec's Pont du Gard recipe.
 * Mostly underground in reality — this is the stretch that had to cross a
 * valley, which is the only part anybody draws.
 *
 * Far band, so the haze puts it a long way off, and it deliberately has no
 * finished end at either side: it reads as a length of aqueduct passing
 * through rather than as a monument with two ends.
 */
export const aquaAppia = fromDraw({
  id: 'aqua-appia', w: 96, h: 28,
  paint(g, x, gy) {
    const { P } = g;
    const top = gy - 27;

    /* The specus — the channel the water actually runs in, on top. */
    P(x, top, 96, 1, T.stone.lit);
    P(x, top + 1, 96, 1, C.mortar);
    P(x, top + 2, 96, 1, T.stone.shadow);

    /* Upper tier: many small arches. */
    masonry(g, x, top + 3, 96, 9, T.stone, { mortar: 4 });
    for (let cx = x + 4; cx < x + 96; cx += 8) g.arch(cx, top + 4, 7, 8, C.arc);

    P(x, top + 12, 96, 1, T.stone.lit);

    /* Lower tier: fewer, much taller, piers aligned under the small ones. */
    masonry(g, x, top + 13, 96, 15, T.stone, { mortar: 4 });
    for (let cx = x + 8; cx < x + 96; cx += 16) g.arch(cx, top + 14, 13, 14, C.arc);
  },
});

/* ---------------------------------------------- 17. Thermae ----------- */

/**
 * The baths: a domed hall over a great arched frontage, with lower wings. They
 * were free and everybody went, most days — which is the line on the card and
 * the reason the building is this big.
 */
export const thermae = fromDraw({
  id: 'thermae', w: 44, h: 38,
  paint(g, x, gy) {
    const { P, dot, blob } = g;
    const top = gy - 37;
    const cx = x + 22;

    /* Wings first, so the dome and the frontage sit over them. */
    masonry(g, x, top + 12, 13, 10, T.travertine, { mortar: 0 });
    masonry(g, x + 31, top + 12, 13, 10, T.travertine, { mortar: 0 });

    /* The dome, then the drum it stands on — and the drum has to come second.
       `blob` draws a whole sphere, so without something covering its lower half
       the dome tapered to a point in mid-air between the wings. Springing the
       drum at row 11 leaves ten rows of dome over nineteen of width, which is
       the shallow profile a Roman dome actually has from outside. */
    dot(cx, top, C.gold);
    blob(cx, top + 10, 9, T.marble.base, T.marble.lit, T.marble.shadow);
    masonry(g, x + 13, top + 11, 18, 11, T.travertine, { mortar: 0 });

    P(x, top + 20, 44, 1, T.marble.lit);
    P(x, top + 21, 44, 1, T.marble.shadow);

    /* The frontage, with the three great thermal windows. */
    masonry(g, x, top + 22, 44, 14, T.travertine, { mortar: 0 });
    for (const wx of [x + 8, x + 22, x + 36]) {
      g.arch(wx, top + 24, 9, 11, C.arc);
      g.light(wx - 4, top + 24, 9, 11);
    }

    P(x, top + 36, 44, 1, T.marble.lit);
    P(x, top + 37, 44, 1, T.marble.deep);
  },
});

/* ---------------------------------------- 18. Circus Maximus ---------- */

/**
 * The racetrack: a long low bank of seating over a ground-level arcade, with
 * one of the spina obelisks showing above it. Over a hundred thousand people,
 * which no other building here comes close to.
 */
export const circusMaximus = fromDraw({
  id: 'circus-maximus', w: 50, h: 26,
  paint(g, x, gy) {
    const { P, dot } = g;
    const top = gy - 25;
    const cx = x + 25;

    /* The obelisk on the spina, seen over the far side of the track. */
    P(cx, top, 2, 9, T.marble.base);
    dot(cx, top, C.gold);
    dot(cx, top + 1, T.marble.lit);

    /* The seating: horizontal courses the whole length, with only the top few
       drawn in from the ends.

       Insetting every course — which is what this did first — turned a
       building famous for being long into a stepped pyramid. The Circus is a
       bank of seating half a kilometre down one side; what reads is the
       length and the arcade under it, not a silhouette. */
    for (let row = 0; row < 10; row++) {
      const inset = Math.max(0, 3 - row);
      P(x + inset, top + 4 + row, 50 - inset * 2, 1,
        row % 2 ? T.travertine.base : T.travertine.lit);
    }

    P(x, top + 14, 50, 1, T.marble.lit);
    P(x, top + 15, 50, 1, T.marble.shadow);

    /* The arcade underneath, which is how the crowd got in and out. */
    masonry(g, x, top + 16, 50, 8, T.travertine, { mortar: 0 });
    for (let ax = x + 5; ax < x + 50; ax += 8) g.arch(ax, top + 16, 7, 8, C.arc);

    P(x, top + 24, 50, 1, T.marble.lit);
    P(x, top + 25, 50, 1, T.marble.deep);
  },
});

/* ---------------------------------------------- 19. Theatrum ---------- */

/**
 * The theatre of Pompey, the first in Rome built of stone rather than thrown
 * up in timber for the occasion. Semicircular, so what shows from the street
 * is the curved outer wall: two storeys of arcade.
 */
export const theatrum = fromDraw({
  id: 'theatrum', w: 26, h: 30,
  paint(g, x, gy) {
    const { P } = g;
    const top = gy - 29;

    P(x + 1, top, 24, 1, T.marble.lit);
    P(x, top + 1, 26, 1, T.marble.base);
    P(x, top + 2, 26, 1, T.marble.shadow);

    masonry(g, x + 1, top + 3, 24, 11, T.travertine, { mortar: 0 });
    for (const cx of [x + 5, x + 13, x + 21]) g.arch(cx, top + 5, 7, 9, C.arc);

    P(x, top + 14, 26, 1, T.marble.lit);
    P(x, top + 15, 26, 1, T.marble.shadow);

    masonry(g, x + 1, top + 16, 24, 12, T.travertine, { mortar: 0 });
    for (const cx of [x + 5, x + 13, x + 21]) g.arch(cx, top + 18, 7, 10, C.arc);
    g.light(x + 10, top + 19, 7, 9);

    P(x, top + 28, 26, 1, T.marble.lit);
    P(x, top + 29, 26, 1, T.marble.deep);
  },
});

/* ------------------------------------------------- 20. Horti ---------- */

/**
 * The gardens on the hills — a decoration, and the only entry in the catalogue
 * that is entirely plants. Cypresses, a clipped hedge and a fountain.
 */
export const horti = fromDraw({
  id: 'horti', w: 14, h: 14,
  paint(g, x, gy) {
    const { P, dot } = g;
    const top = gy - 13;

    /* Two cypresses, drawn here rather than with the engine's helper because
       that one picks its own height and this sprite has a box to stay inside. */
    for (const [tx, h] of [[x + 2, 14], [x + 11, 11]]) {
      for (let i = 0; i < h; i++) {
        const w = Math.max(1, Math.round(3 * (1 - i / h)));
        for (let d = 0; d < w; d++) {
          const colour = d === 0 ? C.cypressLite : d === w - 1 ? C.cypressDark : C.cypress;
          dot(tx - ((w - 1) >> 1) + d, gy - i, colour);
        }
      }
    }

    /* A clipped hedge, and a fountain catching the light. Two rows of hedge,
       not three — at three the jet came out *inside* the box hedge. */
    P(x + 4, top + 9, 6, 2, C.weed);
    P(x + 4, top + 9, 6, 1, C.cypressLite);
    P(x + 6, top + 12, 3, 1, T.marble.lit);
    /* The jet, in white rather than in the river's blue. Water at this size is
       spray, and the Tiber's tones belong to the scene — a sprite that borrowed
       them could not be moved to another band. */
    dot(x + 7, top + 11, C.marbleLite);
    P(x + 5, top + 13, 5, 1, T.marble.shadow);
  },
});

/* ---------------------------------------------- 21. Colosseum --------- */

/**
 * Three tiers of arcade under an attic storey, from the spec's recipe (§8.2)
 * but intact rather than ruined — see the note at the top of this section.
 *
 * Fifty thousand seats. The name is not Roman at all: it comes from the
 * colossal statue of Nero that stood next door.
 */
export const colosseum = fromDraw({
  id: 'colosseum', w: 52, h: 38,
  paint(g, x, gy) {
    const { P } = g;
    const top = gy - 37;
    const centres = [x + 4, x + 12, x + 20, x + 28, x + 36, x + 44];

    /* The attic: solid wall, small square windows, pilasters between. */
    masonry(g, x, top, 52, 6, T.travertine, { mortar: 0 });
    for (const cx of centres) P(cx - 1, top + 2, 3, 3, C.arc);
    P(x, top + 6, 52, 1, T.travertine.shadow);

    /* Three tiers of arches, identical pitch on every tier — which is what
       makes the facade read as one building rather than three stacked ones.
       Five wide, and this is the one place the seven-pixel rule from 4b.2 is
       knowingly broken. Six sevens plus their piers need sixty-four pixels and
       the slot holds fifty-two, so seven-wide arches came out with one-pixel
       piers between them and the whole facade read as a colander. For *this*
       building the number of arches is what makes it recognisable and the crown
       curve is not, so the count wins and the arches step 3-5-5. */
    const tiers = [[top + 7, 10], [top + 18, 10], [top + 29, 8]];
    for (const [tierTop, height] of tiers) {
      masonry(g, x, tierTop, 52, height, T.travertine, { mortar: 0 });
      for (const cx of centres) g.arch(cx, tierTop, 5, height, C.arc);
      for (const cx of centres) P(cx + 4, tierTop, 1, height, T.travertine.lit);
      P(x, tierTop + height, 52, 1, T.travertine.shadow);
    }

    /* Torches in the ground-tier gateways, which is how it was lit. */
    for (const cx of [x + 13, x + 37]) g.fire(cx, gy - 1, 1.2, cx);
    g.light(x + 26, top + 30, 7, 7);

    P(x, top + 37, 52, 1, T.marble.deep);
  },
});

/* ----------------------------------------------- 22. Pantheon --------- */

/**
 * A dome behind a temple front, which is exactly what it is and exactly why it
 * looks so odd. The concrete dome is still the largest unreinforced one ever
 * built, nineteen centuries on.
 */
export const pantheon = fromDraw({
  id: 'pantheon', w: 44, h: 34,
  paint(g, x, gy) {
    const { P, dot, blob } = g;
    const top = gy - 33;
    const cx = x + 22;

    /* The dome, and the drum it sits on. Centred so the crown lands on row 0 —
       at top + 12 it left the top row of its own box empty, which floats the
       building and makes the reveal clip start on nothing. */
    blob(cx, top + 11, 11, T.marble.base, T.marble.lit, T.marble.shadow);
    dot(cx, top, C.arcLite);                           // the oculus, edge on
    masonry(g, x + 8, top + 18, 28, 12, T.travertine, { mortar: 0 });

    /* The portico in front of it: pediment, entablature, four columns. */
    pediment(g, cx, top + 9, 7, 12);
    P(x + 8, top + 17, 28, 1, T.marble.lit);
    P(x + 8, top + 18, 28, 1, T.marble.base);
    P(x + 8, top + 19, 28, 1, T.marble.shadow);

    P(x + 18, top + 22, 8, 8, C.arc);
    g.light(x + 18, top + 22, 8, 8);
    for (let i = 0; i < 4; i++) fatColumn(g, x + 11 + i * 7, top + 20, top + 30);

    P(x + 6, top + 31, 32, 1, T.marble.lit);
    P(x + 4, top + 32, 36, 1, T.marble.base);
    P(x, top + 33, 44, 1, T.marble.deep);
  },
});

/* ----------------------------------------- 23. Columna Traiani ------- */

/**
 * A comic strip in stone: the Dacian war spiralling twenty-three times around
 * the shaft, carved so high up that most of it can never have been legible
 * from the ground.
 *
 * Six pixels wide and forty tall, which makes it the one building in the city
 * whose whole character is its proportion.
 */
export const columnaTraiani = fromDraw({
  id: 'columna-traiani', w: 6, h: 40,
  paint(g, x, gy) {
    const { P, dot } = g;
    const top = gy - 39;

    /* Trajan on top, in bronze. */
    dot(x + 2, top, C.bronze);
    P(x + 2, top + 1, 2, 2, C.bronze);

    /* Capital. */
    P(x, top + 3, 6, 1, T.marble.lit);
    P(x, top + 4, 6, 1, T.marble.shadow);

    /* The shaft, with the relief running round it — one pixel stepping
       sideways per row is a helix, and at this width that is all a helix can
       be. */
    for (let row = 5; row < 35; row++) {
      P(x + 1, top + row, 4, 1, T.marble.base);
      dot(x + 1, top + row, T.marble.lit);
      dot(x + 1 + (row % 4), top + row, T.marble.shadow);
    }

    /* Pedestal. */
    P(x, top + 35, 6, 1, T.marble.lit);
    P(x, top + 36, 6, 3, T.marble.base);
    P(x, top + 39, 6, 1, T.marble.deep);
  },
});

/* -------------------------------------- 24. Arcus Triumphalis -------- */

/**
 * The triumphal arch: one great passage, four engaged columns, a gilded
 * inscription across the attic and a bronze quadriga on top.
 *
 * **Single-bay, not the spec's three.** The spec's Arch of Constantine recipe
 * (§8.4) puts a small opening either side of the main one, and it has
 * forty-six pixels to do it in; this slot has twenty-four. Three arches at
 * that width leave one- and two-pixel piers between them, so the thing reads
 * as a colander rather than as a mass with holes in it. Single-bay is also
 * perfectly Roman — the Arch of Titus is one of the most famous of them and has
 * exactly one opening.
 *
 * Only a general who had actually won a war was allowed under it, which is the
 * line on the card and the whole point of the building.
 */
export const arcusTriumphalis = fromDraw({
  id: 'arcus-triumphalis', w: 24, h: 26,
  paint(g, x, gy) {
    const { P, dot } = g;
    const top = gy - 25;

    /* The quadriga, and a statue at each corner. */
    P(x + 9, top, 6, 3, C.bronze);
    dot(x + 9, top + 1, C.gold);
    dot(x + 14, top + 1, C.gold);
    for (const sx of [x + 1, x + 21]) P(sx, top + 1, 2, 2, T.marble.lit);

    /* The attic, and the inscription nobody could read from down there either. */
    masonry(g, x, top + 3, 24, 7, T.marble, { mortar: 0 });
    P(x + 3, top + 5, 18, 3, T.marble.shadow);
    for (let cx = x + 4; cx < x + 20; cx += 2) dot(cx, top + 6, C.gold);

    /* Entablature. */
    P(x, top + 10, 24, 1, T.marble.lit);
    P(x, top + 11, 24, 1, T.marble.base);
    P(x, top + 12, 24, 1, T.marble.shadow);

    /* The mass, then the one passage cut through it. Eleven wide, which leaves
       a seven-pixel pier on the left and six on the right — enough to read as
       stone rather than as a frame. */
    masonry(g, x, top + 13, 24, 12, T.marble, { mortar: 0 });
    g.arch(x + 12, top + 14, 11, 11, C.arc);
    g.light(x + 7, top + 14, 11, 11);

    /* Two engaged columns on each pier, on their pedestals. */
    for (const cx of [x + 1, x + 4, x + 18, x + 21]) {
      column(g, cx, top + 14, top + 23);
      dot(cx, top + 14, C.gold);
      dot(cx + 1, top + 14, C.gold);
    }

    P(x, top + 25, 24, 1, T.marble.deep);
  },
});

/* ------------------------------------------- 25. Templum Iovis ------- */

/**
 * The temple of Jupiter Optimus Maximus on the Capitoline — the capstone of
 * the whole catalogue, and the biggest thing in the city. Every triumph ended
 * here; it was where the Roman state kept its heart.
 *
 * The spec's hexastyle temple front (§8.1) at the width the slot map has been
 * holding for it since 4b.2, on a high podium with steps up the middle and an
 * altar burning in front.
 */
export const templumIovis = fromDraw({
  id: 'templum-iovis', w: 48, h: 44,
  paint(g, x, gy) {
    const { P, dot } = g;
    const top = gy - 43;
    const cx = x + 24;

    dot(cx, top, C.marbleLite);                        // acroterion
    pediment(g, cx, top + 1, 11, 22);

    /* Entablature: architrave, frieze with triglyphs, cornice. */
    P(x + 1, top + 12, 46, 1, T.marble.lit);
    P(x + 1, top + 13, 46, 1, T.marble.base);
    P(x + 1, top + 14, 46, 1, T.marble.shadow);
    P(x + 1, top + 15, 46, 1, T.marble.deep);
    for (let tx = x + 3; tx < x + 46; tx += 4) dot(tx, top + 13, T.marble.shadow);

    /* The cella wall goes down before the columns, so the gaps between them
       read as depth instead of as sky.

       Six columns at a pitch of eight, starting three in: that spans 2..46 and
       puts the central intercolumniation exactly on the axis. At a pitch of
       seven it did not, and the doorway showed through four pixels of gap on
       one side and one on the other — which on the capstone of the whole
       catalogue is the last place to have the axis a pixel and a half out. */
    P(x + 2, top + 16, 44, 22, C.arcLite);
    P(x + 20, top + 24, 9, 14, C.arc);
    P(x + 22, top + 28, 4, 10, T.marble.deep);         // the cult statue
    g.light(x + 20, top + 24, 9, 14);

    for (let i = 0; i < 6; i++) fatColumn(g, x + 3 + i * 8, top + 16, top + 37);

    /* Podium, with the steps up the middle. */
    for (let row = 0; row < 6; row++) {
      P(x, top + 38 + row, 48, 1,
        row === 0 ? T.marble.lit : row === 5 ? T.marble.deep : T.marble.base);
    }
    for (let step = 0; step < 4; step++) {
      P(x + 16 - step, top + 40 + step, 16 + step * 2, 1,
        step % 2 ? T.marble.shadow : T.marble.lit);
    }

    /* The altar, and a brazier at each corner of the steps. */
    P(x + 22, top + 36, 4, 2, T.marble.shadow);
    g.fire(cx, top + 36, 2.2, 24);
    for (const bx of [x + 2, x + 44]) {
      P(bx, top + 39, 2, 4, C.bronze);
      g.fire(bx + 0.5, top + 38, 1.1, bx);
    }
  },
});

/* ============================================================ index ===== */

/**
 * Sprites by catalogue id. The catalogue deliberately does not reference these
 * — it holds names, history and slots and knows nothing about drawing — so the
 * renderer is what joins the two, and an id with no sprite yet simply is not
 * drawn.
 */
export const SPRITES = Object.freeze({
  /* Stage 1 — Roma Quadrata */
  'casa-romuli': casaRomuli,
  'ovile': ovile,
  'murus-ligneus': murusLigneus,
  'ficus-ruminalis': ficusRuminalis,
  'ara': ara,
  /* Stage 2 — Regnum */
  'forum': forum,
  'cloaca-maxima': cloacaMaxima,
  'templum-vestae': templumVestae,
  'pons-sublicius': ponsSublicius,
  'carcer': carcer,
  /* Stage 3 — Res Publica */
  'curia': curia,
  'rostra': rostra,
  'basilica': basilica,
  'murus-servii': murusServii,
  'via-appia': viaAppia,
  /* Stage 4 — Imperium */
  'aqua-appia': aquaAppia,
  'thermae': thermae,
  'circus-maximus': circusMaximus,
  'theatrum': theatrum,
  'horti': horti,
  /* Stage 5 — Roma Aeterna */
  'colosseum': colosseum,
  'pantheon': pantheon,
  'columna-traiani': columnaTraiani,
  'arcus-triumphalis': arcusTriumphalis,
  'templum-iovis': templumIovis,
});
