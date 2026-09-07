/* buildings.js — the sprites, behind one interface.

   Stage 1 only for now. These five are character grids rather than draw
   functions, and deliberately so: a thatched hut, a sheepfold, a palisade, a
   fig tree and an altar are organic, irregular and small, with no repeating
   structure worth parameterising. A function would be sillier than a picture.
   The later stages invert that — an arcade of seven identical arches wants a
   loop, not two thousand hand-placed characters — which is why both modes
   exist and why nothing outside this file can tell which was used.

   These are also the honest risk in the whole city (PLAN-ROMA section 3). The
   drawing spec supplies proven recipes for the temple, the Colosseum, the
   aqueduct and the arch — all of them stages 4 and 5, months away. It supplies
   nothing for what she sees in her first ten minutes, which is this file. So
   the go/no-go on hand-authored art versus a CC0 tileset is judged here, on
   test/roma-stage1.html, on a phone — not on the temple spike, which only
   exists to show what the engine can do later.

   Grids are authored top row first. Ground level is the last row: the scene
   draws the earth, so a sprite that painted its own would sit on a seam. */

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
});
