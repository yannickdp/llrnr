/* icons.js — small pixel-art glyphs for the results screen.

   Every line on the results screen ("+40 XP", "3 woorden geleerd", a badge)
   used to be text alone. These are 12x12 sprites built from the same five
   primitives the city is drawn with (`fromDraw`, from engine.js) rather than
   icon-font glyphs or SVG, so a coin or a flame here is drawn by exactly the
   same code that draws the temple, and stays crisp at any integer scale for
   the same reason the city does. */

import { fromDraw, fitCanvas } from './engine.js';
import { C } from './palette.js';

const SIZE = 12;

/** A 12x12 icon sprite, its own tiny painting the width and height of a coin. */
function icon(id, paint) {
  return fromDraw({ id, w: SIZE, h: SIZE, paint });
}

export const ICONS = Object.freeze({
  /** XP earned: a coin. */
  xp: icon('xp', g => {
    g.blob(6, 6, 5, C.gold, C.marbleLite, C.tileDark);
  }),

  /** Closer to test-ready: a pennant. */
  testReady: icon('testReady', g => {
    g.P(3, 1, 1, 10, C.stoneDark);
    for (let i = 0; i <= 4; i++) g.P(4, 1 + i, 5 - i, 1, C.tunicR);
  }),

  /** A word learned for good, both ways round: an open book. */
  learned: icon('learned', g => {
    g.P(1, 3, 4, 7, C.marble);
    g.P(7, 3, 4, 7, C.marble);
    g.P(5, 2, 2, 8, C.tileDark);
  }),

  /** A word graduated off the acquire ladder: the ladder itself, cleared. */
  graduated: icon('graduated', g => {
    g.P(2, 1, 1, 10, C.scaffold);
    g.P(8, 1, 1, 10, C.scaffold);
    for (let row = 2; row < 10; row += 2) g.P(2, row, 7, 1, C.scaffoldLite);
  }),

  /** A word promoted a box: an arrow climbing. */
  promoted: icon('promoted', g => {
    g.P(5, 1, 2, 1, C.gold);
    g.P(4, 2, 4, 1, C.gold);
    g.P(3, 3, 6, 1, C.gold);
    g.P(2, 4, 8, 1, C.gold);
    g.P(5, 5, 2, 6, C.gold);
  }),

  /** A new word presented for the first time: an eye. */
  presented: icon('presented', g => {
    g.blob(6, 6, 4, C.marble, C.marbleLite, C.marbleDark);
    g.blob(6, 6, 2, C.arc, C.arcLite, C.arc);
  }),

  /** A daily streak: a flame. */
  streak: icon('streak', g => {
    g.P(5, 1, 2, 2, C.gold);
    g.P(4, 3, 4, 2, C.tileLite);
    g.P(3, 5, 6, 2, C.tile);
    g.P(2, 7, 8, 3, C.tileDark);
  }),

  /** Words still waiting for a future lesson: an hourglass. */
  heldBack: icon('heldBack', g => {
    g.P(2, 1, 8, 1, C.stoneDark);
    g.P(3, 2, 6, 1, C.stone);
    g.P(4, 3, 4, 1, C.stone);
    g.P(5, 4, 2, 2, C.stone);
    g.P(4, 6, 4, 1, C.stone);
    g.P(3, 7, 6, 1, C.stone);
    g.P(2, 8, 8, 1, C.stoneDark);
  }),

  /** A word that dropped a box: an arrow falling back. */
  dropped: icon('dropped', g => {
    g.P(5, 1, 2, 6, C.tunicR);
    g.P(2, 6, 8, 1, C.tunicR);
    g.P(3, 7, 6, 1, C.tunicR);
    g.P(4, 8, 4, 1, C.tunicR);
    g.P(5, 9, 2, 1, C.tunicR);
  }),

  /** A word known only one way round: one filled circle, one still hollow. */
  parked: icon('parked', g => {
    g.blob(3, 6, 3, C.gold, C.marbleLite, C.tileDark);
    g.P(7, 3, 4, 1, C.stoneDark);
    g.P(7, 8, 4, 1, C.stoneDark);
    g.P(7, 3, 1, 6, C.stoneDark);
    g.P(10, 3, 1, 6, C.stoneDark);
  }),

  /** A new badge: a medal. */
  badge: icon('badge', g => {
    g.P(4, 0, 1, 3, C.tunicR);
    g.P(7, 0, 1, 3, C.tunicR);
    g.blob(6, 7, 4, C.gold, C.marbleLite, C.tileDark);
  }),

  /** The lesson's own score line: a checkmark. */
  correct: icon('correct', g => {
    g.P(2, 6, 2, 2, C.bronze);
    g.P(4, 8, 2, 2, C.bronze);
    g.P(6, 6, 2, 2, C.bronze);
    g.P(8, 4, 2, 2, C.bronze);
    g.P(10, 2, 2, 2, C.bronze);
  }),
});

/**
 * Draw one icon into a canvas, crisp at any integer scale — the same
 * `fitCanvas` the city uses, so a results-screen icon and a building agree on
 * what "crisp" means.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {keyof typeof ICONS} id
 * @param {object} [options]
 * @param {number} [options.scale]
 */
export function paintIcon(canvas, id, { scale = 3 } = {}) {
  const sprite = ICONS[id];
  if (!sprite) return;

  const dpr = globalThis.devicePixelRatio || 1;
  const ctx = fitCanvas(canvas, { w: sprite.w, h: sprite.h, scale, dpr });
  sprite.draw(ctx, 0, sprite.h - 1, { scale });
}
