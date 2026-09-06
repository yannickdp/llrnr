/* probe.js — the one hardcoded sprite, and it is not a building.

   PLAN-ROMA step 1 asks for a single sprite whose only job is to prove the
   pixels come out crisp on a real phone before anything real gets drawn. This
   is that sprite, and it is deliberately a calibration pattern rather than a
   catalogue entry: `Casa Romuli` and the rest of stage 1 arrive in 4b.2, and
   they are also the go/no-go on whether the hand-authored art is good enough at
   all. Nothing here should survive into the city.

   What it is for, concretely — open test/roma-probe.html on the phone and
   check:

     - every primitive paints (P, dot, blob, bloom, arch)
     - the three-tone rule reads as volume rather than as flat rectangles
     - nothing is blurred, which means the integer scale and the
       device-pixel-ratio sizing are both right
     - `progress` reveals bottom-up, for the construction teaser
     - both authoring modes land in the same place at the same size

   Two sprites, because "both modes compile to one interface" is a claim worth
   being able to see rather than only assert in a test. */

import { C, T, course } from './palette.js';
import { fromDraw, fromGrid } from './engine.js';

/* ================================================== mode A: a function ==== */

/**
 * A little arcade monument. Not Roman history — just the shapes the real
 * recipes are made of, at a size where a mistake is obvious.
 */
export const probeArcade = fromDraw({
  id: 'probe-arcade',
  w: 26,
  h: 24,

  paint(g, x, gy) {
    const { P, dot, blob, arch } = g;

    /* Every row named against the top of the declared box, so the layout can
       be checked by reading it. Anything drawn outside 0..23 would be clipped
       wrongly by `progress` and would overlap its neighbour's slot, so the
       arithmetic is not cosmetic — the test asserts the art stays inside. */
    const top = gy - 23;
    const FINIAL = top;
    const DOME = top + 4;         // centre; radius 3, so rows top+1..top+7
    const CORNICE = top + 8;      // two courses
    const WALL = top + 10;
    const ARCH_TOP = top + 12;
    const WALL_FOOT = top + 20;
    const PODIUM = top + 21;      // three courses down to gy

    /* Podium: lit tone on top, shadow underneath. The whole three-tone rule in
       three lines, and the thing that makes it read as a solid block. */
    P(x, PODIUM, 26, 1, T.marble.lit);
    P(x, PODIUM + 1, 26, 1, T.marble.base);
    P(x, PODIUM + 2, 26, 1, T.marble.deep);

    /* Travertine wall, checkerboarded so a blank face has texture, with the
       occasional cracked block. Both come from the coordinates, so the same
       block is cracked every time she opens the app. */
    for (let cx = x + 2; cx <= x + 23; cx++) {
      for (let cy = WALL; cy <= WALL_FOOT; cy++) {
        const cracked = g.hash(cx, cy) > 0.94;
        dot(cx, cy, cracked ? T.travertine.shadow : course(T.travertine, cx, cy));
      }
    }

    /* Arches carved out of it. One primitive, and a blank wall reads as
       architecture.

       Two lessons here that the catalogue will need. Seven wide, not five: at
       five the head has only three rows to curve through and steps 3-5-5,
       legible but blunt, where seven steps 3-5-7-7 and actually looks round.
       And two arches, not three: three sevens plus the piers between them need
       a twenty-nine pixel wall, and forcing them into twenty-two butts the
       openings together into a row of slots. An arcade needs solid wall
       between its arches more than it needs another arch. */
    for (const cx of [x + 7, x + 18]) arch(cx, ARCH_TOP, 7, 9, C.arc);

    /* Piers between and beside the openings, then the cornice over the lot.
       The cornice overhangs the wall by a pixel each side, as a cornice does. */
    for (const px of [x + 2, x + 12, x + 13, x + 23]) {
      P(px, WALL, 1, WALL_FOOT - WALL + 1, T.travertine.lit);
    }
    P(x + 1, CORNICE, 24, 1, T.marble.lit);
    P(x + 1, CORNICE + 1, 24, 1, T.marble.shadow);

    /* A dome and its finial, to exercise `blob`. */
    blob(x + 13, DOME, 3, T.marble.base, T.marble.lit, T.marble.shadow);
    dot(x + 13, FINIAL, C.gold);

    /* The middle arch is a lit passage; the altar in front of it burns. Both
       are registrations, not drawings — the night pass and the fire system read
       them later, and this sprite has no idea either exists. */
    g.light(x + 4, ARCH_TOP, 7, 7);
    P(x + 12, PODIUM - 3, 3, 3, T.marble.shadow);
    g.fire(x + 13, PODIUM - 3, 1.8, 1);

    /* Two figures, standing on the podium. Nothing sells "this is a big
       building" like a person who is four pixels tall. */
    for (const [fx, robe] of [[x + 2, C.toga], [x + 23, C.tunicR]]) {
      dot(fx, PODIUM - 4, C.skin);
      P(fx, PODIUM - 3, 1, 3, robe);
    }
  },
});

/* ================================================ mode B: a character grid = */

/**
 * A thatched hut, the shape stage 1 is made of. Here to prove the grid path
 * renders identically through the same interface — and to be the first honest
 * look at whether hand-drawn rustic pixel art is going to work at all, which is
 * the question 4b.2 has to answer.
 */
export const probeHut = fromGrid({
  id: 'probe-hut',
  palette: {
    '.': null,
    's': '#c9b070', // straw, lit
    'S': '#a8904f', // straw, shadow
    'w': '#8c6a3f', // wattle wall
    'W': '#6b4a3a', // wattle, shadow
    'd': C.arc,     // the doorway is a hole like any other
    'g': C.plazaDark,
  },
  px: [
    '.....ss.....',
    '....ssSS....',
    '...ssssSS...',
    '..ssssssSS..',
    '.sssssssSSS.',
    'ssssssssSSSS',
    '.wwwwwwwWWW.',
    '.wwwddwwWWW.',
    '.wwwddwwWWW.',
    'gggggggggggg',
  ],
});

/** Everything the probe page shows, in the order it shows it. */
export const PROBE_SPRITES = [probeArcade, probeHut];
