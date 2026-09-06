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

import { C } from './palette.js';
import { fromGrid } from './engine.js';

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

/* ============================================================ index ===== */

/**
 * Sprites by catalogue id. The catalogue deliberately does not reference these
 * — it holds names, history and slots and knows nothing about drawing — so the
 * renderer is what joins the two, and an id with no sprite yet simply is not
 * drawn.
 */
export const SPRITES = Object.freeze({
  'casa-romuli': casaRomuli,
  'ovile': ovile,
  'murus-ligneus': murusLigneus,
  'ficus-ruminalis': ficusRuminalis,
  'ara': ara,
});
