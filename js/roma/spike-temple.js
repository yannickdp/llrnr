/* spike-temple.js — THROWAWAY. Delete after the 4b.2 go/no-go.

   This is not a building and it is not in the catalogue. Its only job is to
   answer one question while stage 1 is being judged: what is the ceiling of
   this engine?

   The reason it exists is that the go/no-go is being made on the wrong
   evidence otherwise. Stage 1 is five rustic grids — a hut, a sheepfold, a
   palisade, a tree, an altar — and they are the hardest kind of pixel art,
   with no recipe in the drawing spec and no repeating structure to lean on. If
   they come out mediocre it matters enormously whether that is *the engine* or
   *the subject*, because the answer decides between carrying on and buying a
   CC0 tileset. A temple takes ten minutes to write from the spec's own recipe
   (plan-roma-updates section 8.1) and settles it.

   So: look at this beside stage 1, then throw it away. `Templum Vestae` and
   `Templum Iovis` get their own proper recipes in 4b.4 and 4b.6, at the widths
   the catalogue reserves for them, and they will not be this. */

import { C, T, course } from './palette.js';
import { fromDraw } from './engine.js';

/**
 * A fluted column, three pixels wide: lit, base, shadowed. That single line of
 * shading is what makes six of them read as a colonnade instead of as a comb.
 */
function drawColumn(g, x, top, bottom) {
  g.P(x - 1, bottom, 5, 1, T.marble.deep);          // base
  g.P(x - 1, bottom - 1, 5, 1, T.marble.shadow);
  for (let y = top + 2; y < bottom - 1; y++) {      // shaft
    g.dot(x, y, T.marble.lit);
    g.dot(x + 1, y, T.marble.base);
    g.dot(x + 2, y, T.marble.shadow);
  }
  g.P(x - 1, top + 1, 5, 1, T.marble.lit);          // capital
  g.P(x - 1, top, 5, 1, T.marble.base);
  g.dot(x, top + 1, T.marble.shadow);               // a hint of Corinthian
  g.dot(x + 2, top + 1, T.marble.shadow);
}

/**
 * Hexastyle temple front, Maison Carrée type: pediment over an entablature
 * over six columns, a cella wall and doorway behind them, a podium with steps,
 * and an altar burning in front.
 */
export const spikeTemple = fromDraw({
  id: 'spike-temple',
  w: 46,
  h: 44,

  paint(g, x, gy) {
    const { P, dot, arch } = g;
    const top = gy - 43;

    const PEDIMENT = top + 1;      // apex; rakes fall to top+11. Row 0 is the
                                   // acroterion, and it has to touch the apex —
                                   // a gap between them reads as a floating dot.
    const EAVES = top + 11;
    const ENTAB = top + 12;        // three bands
    const COLTOP = top + 16;
    const COLBOT = gy - 6;
    const PODIUM = gy - 5;

    /* Cella wall first, in the shadow tone, so the gaps between the columns
       read as depth rather than as sky. Drawing it after them is the classic
       way to get a temple that looks like a fence. */
    P(x + 4, COLTOP, 38, COLBOT - COLTOP + 1, C.arcLite);

    /* Doorway, with a statue silhouette inside, and its glow registered. */
    arch(x + 23, gy - 20, 9, 15, C.arc);
    P(x + 21, gy - 12, 4, 7, T.marble.deep);
    g.light(x + 19, gy - 20, 9, 15);

    /* Six columns, evenly pitched. */
    for (let i = 0; i < 6; i++) drawColumn(g, x + 5 + i * 7, COLTOP, COLBOT);

    /* Entablature: architrave, frieze with triglyph ticks, cornice. */
    P(x + 2, ENTAB, 42, 1, T.marble.lit);
    P(x + 2, ENTAB + 1, 42, 1, T.marble.base);
    P(x + 2, ENTAB + 2, 42, 1, T.marble.shadow);
    P(x + 2, ENTAB + 3, 42, 1, T.marble.deep);
    for (let tx = x + 3; tx < x + 44; tx += 4) dot(tx, ENTAB + 1, T.marble.shadow);

    /* Pediment: a filled triangle with terracotta along the raking cornices,
       a shaded tympanum and a gilded rosette. The sima is the detail that
       stops it reading as a grey wedge. */
    for (let row = 0; row <= EAVES - PEDIMENT; row++) {
      const half = Math.round((row / (EAVES - PEDIMENT)) * 21);
      const y = PEDIMENT + row;
      P(x + 23 - half, y, half * 2 + 1, 1, T.marble.shadow);
      dot(x + 23 - half, y, C.tile);
      dot(x + 23 + half, y, C.tileDark);
    }
    for (let row = 3; row <= EAVES - PEDIMENT - 2; row++) {
      const half = Math.round((row / (EAVES - PEDIMENT)) * 21) - 2;
      P(x + 23 - half, PEDIMENT + row, half * 2 + 1, 1, T.marble.base);
    }
    dot(x + 23, top + 7, C.gold);
    dot(x + 23, top, C.marbleLite);                 // acroterion

    /* Podium, in courses, and the steps up the middle. */
    for (let y = PODIUM; y <= gy; y++) {
      for (let px = x; px < x + 46; px++) dot(px, y, course(T.marble, px, y));
    }
    for (let i = 0; i < 4; i++) {
      P(x + 15 - i, gy - 3 + i, 16 + i * 2, 1, i % 2 ? T.marble.shadow : T.marble.lit);
    }

    /* The altar, burning, and two braziers at the corners. */
    P(x + 21, gy - 8, 4, 3, T.marble.shadow);
    g.fire(x + 23, gy - 8, 2.2, 0);
    for (const bx of [x + 3, x + 42]) {
      P(bx, gy - 5, 2, 4, C.bronze);
      g.fire(bx + 0.5, gy - 6, 1.2, bx);
    }
  },
});
