/* Tests for the city's drawing engine.

   There is no canvas in Node, so these run against a recording stub context
   that keeps every fillRect — the same trick lists.test.mjs uses to test the
   loader without a server. That turns out to be better than a real canvas
   would be: a rectangle's exact position and size is the thing worth asserting,
   and reading pixels back would only tell us the colour landed somewhere.

   The two that matter most are the determinism of `hash` (a city that
   rearranges itself between renders is a screensaver) and the `progress` clip
   (it drives both the teaser and the unlock reveal, and it is the parameter the
   whole sprite interface was settled early to accommodate). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hash, painter, fromDraw, fromGrid, chooseScale, fitCanvas,
} from '../js/roma/engine.js';
import { C, T, course } from '../js/roma/palette.js';
import { probeArcade, probeHut } from '../js/roma/probe.js';

/* ------------------------------------------------------------ the stub ---- */

function fakeCtx() {
  const ops = [];
  return {
    ops,
    fillStyle: null,
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    fillRect(x, y, w, h) {
      ops.push({ op: 'fillRect', x, y, w, h, fill: this.fillStyle, alpha: this.globalAlpha });
    },
    rect(x, y, w, h) { ops.push({ op: 'rect', x, y, w, h }); },
    beginPath() { ops.push({ op: 'beginPath' }); },
    clip() { ops.push({ op: 'clip' }); },
    save() { ops.push({ op: 'save' }); },
    restore() { ops.push({ op: 'restore' }); },
    setTransform(...a) { ops.push({ op: 'setTransform', a }); },
  };
}

const rects = ctx => ctx.ops.filter(o => o.op === 'fillRect');

/** Every logical pixel a sprite painted, as an "x,y" set. Scale 1 only. */
function painted(ctx) {
  const cells = new Set();
  for (const r of rects(ctx)) {
    for (let x = r.x; x < r.x + r.w; x++) {
      for (let y = r.y; y < r.y + r.h; y++) cells.add(`${x},${y}`);
    }
  }
  return cells;
}

/* ================================================================ hash ==== */

test('hash is stable for the same coordinates', () => {
  /* The point of the whole thing: the city looks identical every time she
     opens it. If this ever fails, the art has become a screensaver. */
  for (const [x, y] of [[0, 0], [3, 7], [61, 179], [-4, 12]]) {
    assert.equal(hash(x, y), hash(x, y));
  }
});

test('hash stays in 0..1 and varies across the scene', () => {
  const seen = new Set();
  for (let x = 0; x < 60; x++) {
    for (let y = 0; y < 40; y++) {
      const n = hash(x, y);
      assert.ok(n >= 0 && n < 1, `hash(${x},${y}) = ${n} is out of range`);
      seen.add(n);
    }
  }
  /* Not a distribution test — just proof it is not returning a constant, which
     would make every wall crack in the same place. */
  assert.ok(seen.size > 2000, `only ${seen.size} distinct values from 2400 cells`);
});

test('hash does not mirror x and y', () => {
  /* A symmetric hash makes diagonal patterns show up in masonry. */
  assert.notEqual(hash(3, 8), hash(8, 3));
});

/* ============================================================= painter ==== */

test('P paints one logical rectangle, scaled', () => {
  const ctx = fakeCtx();
  painter(ctx, 3).P(2, 5, 4, 1, C.marble);
  assert.deepEqual(rects(ctx)[0], {
    op: 'fillRect', x: 6, y: 15, w: 12, h: 3, fill: C.marble, alpha: 1,
  });
});

test('a missing colour paints nothing', () => {
  /* This is what makes a transparent character in a grid free. */
  const ctx = fakeCtx();
  const g = painter(ctx, 2);
  g.P(0, 0, 4, 4, null);
  g.P(0, 0, 4, 4, undefined);
  g.dot(1, 1, null);
  assert.equal(rects(ctx).length, 0);
});

test('adjacent rectangles share an edge exactly, even at fractional coords', () => {
  /* The spec rounds x, y, w and h separately, which leaves a hairline gap
     between neighbours once coordinates are fractional — and the flame is
     drawn at cx - width/2, so they are. Edges are rounded here instead. */
  const ctx = fakeCtx();
  const g = painter(ctx, 3);
  g.P(1.5, 0, 2, 1, C.marble);
  g.P(3.5, 0, 2, 1, C.marbleShade);
  const [a, b] = rects(ctx);
  assert.equal(a.x + a.w, b.x, 'a gap or an overlap between neighbours');
});

test('a zero-width rectangle is skipped rather than drawn', () => {
  const ctx = fakeCtx();
  painter(ctx, 1).P(4, 4, 0, 3, C.marble);
  assert.equal(rects(ctx).length, 0);
});

test('blob is a filled circle in three tones', () => {
  const ctx = fakeCtx();
  painter(ctx, 1).blob(10, 10, 3, 'base', 'lit', 'dark');
  const cells = rects(ctx);

  /* Round: the corner of the bounding box is outside the radius. */
  const at = (x, y) => cells.find(c => c.x === x && c.y === y);
  assert.ok(!at(7, 7), 'the corner should be outside the circle');
  assert.ok(at(10, 10), 'the centre should be filled');

  /* Lit up and to the left, shadowed down and to the right. */
  assert.equal(at(9, 9).fill, 'lit');
  assert.equal(at(12, 11).fill, 'dark');
  assert.equal(at(10, 10).fill, 'base');
});

test('arch is a shaft under a semicircular head', () => {
  const ctx = fakeCtx();
  painter(ctx, 1).arch(10, 4, 5, 9, C.arc);
  const cells = painted(ctx);

  /* Width 5 means radius 2, so the head occupies rows 4..6 and the shaft
     runs from row 6 to row 12 inclusive. */
  assert.ok(cells.has('10,4'), 'the crown should be filled');
  assert.ok(!cells.has('8,4'), 'the head should be narrow at the crown');
  assert.ok(cells.has('8,6'), 'the head should be full width at the spring line');
  assert.ok(cells.has('8,12') && cells.has('12,12'), 'the shaft should reach the ground');
  assert.ok(!cells.has('8,13'), 'and stop there');
});

test('an arch crown is three pixels wide, not one', () => {
  /* The bug this file exists to prevent. Measuring the radius at the edge of
     each pixel row rather than its centre gives every arch a single-pixel
     crown: a five-wide opening steps 1-5-5 and reads as a keyhole with a spike
     on it. `arch` carries six of the twenty-five buildings, so getting this
     wrong would be getting it wrong in a hundred places. */
  const widths = w => {
    const ctx = fakeCtx();
    painter(ctx, 1).arch(20, 0, w, 12, C.arc);
    const byRow = new Map();
    for (const r of rects(ctx)) {
      for (let y = r.y; y < r.y + r.h; y++) byRow.set(y, Math.max(byRow.get(y) ?? 0, r.w));
    }
    return [...byRow.keys()].sort((a, b) => a - b).map(y => byRow.get(y));
  };

  assert.deepEqual(widths(5).slice(0, 3), [3, 5, 5]);
  assert.deepEqual(widths(7).slice(0, 4), [3, 5, 7, 7]);
});

test('an arch head only ever widens as it descends', () => {
  /* A head that narrows again partway down is a lump, not a curve. */
  for (const w of [3, 5, 7, 9, 11, 13]) {
    const ctx = fakeCtx();
    const r = Math.floor((w - 1) / 2);
    painter(ctx, 1).arch(30, 0, w, r + 1, C.arc);
    const head = rects(ctx).filter(o => o.h === 1).sort((a, b) => a.y - b.y).map(o => o.w);
    for (let i = 1; i < head.length; i++) {
      assert.ok(head[i] >= head[i - 1], `w=${w} narrows at row ${i}: ${head}`);
    }
  }
});

test('an arch shorter than its own head still draws', () => {
  /* Small decorative arches are authored this way; the shaft rect would have
     negative height and the whole sprite would be lost to an exception. */
  const ctx = fakeCtx();
  painter(ctx, 1).arch(6, 2, 7, 2, C.arc);
  assert.ok(rects(ctx).length > 0);
});

test('bloom leaves the context state as it found it', () => {
  /* It is the one primitive that touches globalAlpha, and a leaked alpha would
     make everything drawn afterwards semi-transparent. */
  const ctx = fakeCtx();
  painter(ctx, 2).bloom(4, 4, 3, 3, C.glow, C.glowCore, 1);
  assert.equal(ctx.ops.filter(o => o.op === 'save').length, 1);
  assert.equal(ctx.ops.filter(o => o.op === 'restore').length, 1);
  assert.ok(rects(ctx).some(r => r.alpha < 1), 'no translucent halo was drawn');
});

/* ========================================================== registries ==== */

test('buildings push lights and fires; the painter holds them', () => {
  const g = painter(fakeCtx(), 1);
  g.light(3, 4, 5, 6);
  g.fire(10, 20, 2, 7);
  assert.deepEqual(g.glowTargets, [{ x: 3, y: 4, w: 5, h: 6 }]);
  assert.deepEqual(g.emitters, [{ x: 10, by: 20, size: 2, seed: 7 }]);
});

test('reset empties both registries without replacing them', () => {
  /* The renderer may hold a reference across frames. */
  const g = painter(fakeCtx(), 1);
  const before = g.glowTargets;
  g.light(1, 1, 1, 1);
  g.fire(1, 1);
  g.reset();
  assert.equal(g.glowTargets.length, 0);
  assert.equal(g.emitters.length, 0);
  assert.equal(g.glowTargets, before, 'the array itself should be reused');
});

test('lights can be switched off, for a building still under construction', () => {
  const g = painter(fakeCtx(), 1, { lights: false });
  g.light(1, 1, 1, 1);
  g.fire(1, 1);
  assert.equal(g.glowTargets.length, 0, 'a half-built temple must not glow');
  assert.equal(g.emitters.length, 0);
});

/* ============================================================= sprites ==== */

const bar = fromDraw({
  id: 'test-bar',
  w: 4,
  h: 6,
  paint: (g, x, gy) => g.P(x, gy - 5, 4, 6, C.marble),
});

test('a sprite stands on its ground line', () => {
  /* groundY is the bottom row, inclusive: the box is (x, gy-h+1, w, h). Slots
     are (x, band) precisely because this is true of every sprite. */
  const ctx = fakeCtx();
  bar.draw(ctx, 10, 40, { scale: 1 });
  assert.deepEqual(rects(ctx)[0], {
    op: 'fillRect', x: 10, y: 35, w: 4, h: 6, fill: C.marble, alpha: 1,
  });
});

test('progress 1 draws the finished building with no clipping', () => {
  const ctx = fakeCtx();
  bar.draw(ctx, 0, 10, { scale: 1, progress: 1 });
  assert.equal(ctx.ops.filter(o => o.op === 'clip').length, 0);
  assert.equal(rects(ctx).length, 1);
});

test('progress 0 draws nothing at all', () => {
  const ctx = fakeCtx();
  assert.equal(bar.draw(ctx, 0, 10, { scale: 1, progress: 0 }), null);
  assert.equal(ctx.ops.length, 0);
});

test('progress between 0 and 1 clips to the bottom rows', () => {
  /* The construction site rising out of the ground, and the same call the
     unlock reveal sweeps to 1. */
  const ctx = fakeCtx();
  bar.draw(ctx, 0, 20, { scale: 1, progress: 0.5 });

  const clipRect = ctx.ops.find(o => o.op === 'rect');
  assert.deepEqual(clipRect, { op: 'rect', x: 0, y: 18, w: 4, h: 3 });

  assert.equal(ctx.ops.filter(o => o.op === 'clip').length, 1);
  assert.equal(ctx.ops.filter(o => o.op === 'save').length, 1);
  assert.equal(ctx.ops.filter(o => o.op === 'restore').length, 1, 'the clip must be undone');
});

test('a barely-started building still shows one row', () => {
  /* Rounding to zero would make the first lesson of a new building look
     broken rather than early. */
  const ctx = fakeCtx();
  bar.draw(ctx, 0, 20, { scale: 1, progress: 0.01 });
  assert.deepEqual(ctx.ops.find(o => o.op === 'rect'), { op: 'rect', x: 0, y: 20, w: 4, h: 1 });
});

test('an unfinished building registers no lights', () => {
  const ctx = fakeCtx();
  const lamp = fromDraw({
    id: 'lamp', w: 2, h: 2, paint: (g, x, gy) => { g.light(x, gy, 1, 1); g.fire(x, gy); },
  });
  assert.equal(lamp.draw(ctx, 0, 5, { progress: 1 }).glowTargets.length, 1);
  assert.equal(lamp.draw(ctx, 0, 5, { progress: 0.4 }).glowTargets.length, 0);
});

test('a caller can share one painter across a whole scene', () => {
  /* How the renderer will collect every building's lights into one night pass
     instead of twenty-five. */
  const ctx = fakeCtx();
  const shared = painter(ctx, 2);
  const lamp = fromDraw({ id: 'lamp', w: 1, h: 1, paint: (g, x, gy) => g.light(x, gy, 1, 1) });
  lamp.draw(ctx, 0, 0, { painter: shared });
  lamp.draw(ctx, 5, 0, { painter: shared });
  assert.equal(shared.glowTargets.length, 2);
});

/* ================================================================ grids === */

test('a grid sprite takes its size from its rows', () => {
  const s = fromGrid({ id: 'g', palette: { '.': null, 'x': '#fff' }, px: ['xxx', 'x.x'] });
  assert.equal(s.w, 3);
  assert.equal(s.h, 2);
});

test('a grid paints its characters at the right place', () => {
  const ctx = fakeCtx();
  fromGrid({
    id: 'g', palette: { '.': null, 'x': '#fff' }, px: ['.x.', 'xxx'],
  }).draw(ctx, 10, 20, { scale: 1 });

  const cells = painted(ctx);
  assert.ok(cells.has('11,19'), 'the top row should sit h-1 above the ground line');
  assert.ok(cells.has('10,20') && cells.has('12,20'), 'the bottom row should be on it');
  assert.ok(!cells.has('10,19'), 'a dot should be transparent');
});

test('a grid coalesces runs into single rectangles', () => {
  /* A 52-wide Colosseum wall is one fillRect, not fifty-two. */
  const ctx = fakeCtx();
  fromGrid({ id: 'g', palette: { 'x': '#fff' }, px: ['xxxxxxxx'] }).draw(ctx, 0, 0);
  assert.equal(rects(ctx).length, 1);
  assert.equal(rects(ctx)[0].w, 8);
});

test('a run stops at a colour change', () => {
  const ctx = fakeCtx();
  fromGrid({
    id: 'g', palette: { 'a': '#111', 'b': '#222' }, px: ['aabb'],
  }).draw(ctx, 0, 0);
  assert.deepEqual(rects(ctx).map(r => [r.x, r.w, r.fill]), [[0, 2, '#111'], [2, 2, '#222']]);
});

test('a character missing from the palette throws at construction', () => {
  /* Loud, like parse.js refusing to drop a malformed line quietly. A typo in a
     hand-authored grid should not render as a hole. */
  assert.throws(
    () => fromGrid({ id: 'hut', palette: { '.': null }, px: ['..', '.?'] }),
    /hut: row 2 uses '\?'/,
  );
});

/* ============================================== both modes, one interface = */

test('both authoring modes present the same interface', () => {
  for (const s of [probeArcade, probeHut]) {
    assert.equal(typeof s.draw, 'function');
    assert.equal(typeof s.id, 'string');
    assert.ok(s.w > 0 && s.h > 0);
    assert.equal(s.draw.length, 3, 'draw(ctx, x, groundY, opts) with opts defaulted');
  }
});

test('both modes fill exactly the box they declare', () => {
  /* Two claims at once: that nothing outside the sprite module can tell which
     authoring mode was used, and that `w`/`h` are honest.

     An overstated height leaves a building floating above its slot and makes
     the progress clip reveal empty rows first; an understated one lets the art
     spill into the neighbour's slot and be clipped mid-dome. This caught the
     probe's own dome poking a row out of the top, which is exactly the mistake
     that would be invisible until twenty-five buildings were laid out. */
  for (const s of [probeArcade, probeHut]) {
    const ctx = fakeCtx();
    s.draw(ctx, 0, 50, { scale: 1 });
    const cells = rects(ctx);
    const lowest = Math.max(...cells.map(r => r.y + r.h - 1));
    const highest = Math.min(...cells.map(r => r.y));
    assert.equal(lowest, 50, `${s.id} should reach its ground line`);
    assert.equal(highest, 50 - s.h + 1, `${s.id}: declared h does not match the art`);
  }
});

test('the probe sprites stay inside their declared width', () => {
  for (const s of [probeArcade, probeHut]) {
    const ctx = fakeCtx();
    s.draw(ctx, 100, 50, { scale: 1 });
    for (const r of rects(ctx)) {
      assert.ok(r.x >= 100, `${s.id} paints left of its own box`);
      assert.ok(r.x + r.w <= 100 + s.w, `${s.id} paints right of its own box`);
    }
  }
});

test('the probe arcade registers its lit passage and its altar fire', () => {
  const g = probeArcade.draw(fakeCtx(), 0, 40, { scale: 1 });
  assert.equal(g.glowTargets.length, 1);
  assert.equal(g.emitters.length, 1);
});

test('the probe arcade is identical between renders', () => {
  /* hash-driven cracks, end to end. */
  const a = fakeCtx();
  const b = fakeCtx();
  probeArcade.draw(a, 0, 40, { scale: 1 });
  probeArcade.draw(b, 0, 40, { scale: 1 });
  assert.deepEqual(a.ops, b.ops);
});

/* ============================================================= palette ==== */

test('every colour is a valid hex', () => {
  for (const [name, hex] of Object.entries(C)) {
    assert.match(hex, /^#[0-9a-f]{6}$/, `${name} = ${hex}`);
  }
});

test('the palette cannot be reassigned by a recipe', () => {
  /* A recipe that wrote to C.marble would re-theme every building drawn after
     it, which is a miserable bug to find. */
  assert.throws(() => { 'use strict'; C.marble = '#000000'; }, TypeError);
});

test('every material names tones that actually exist', () => {
  const known = new Set(Object.values(C));
  for (const [material, tones] of Object.entries(T)) {
    for (const [tone, hex] of Object.entries(tones)) {
      assert.ok(known.has(hex), `${material}.${tone} is not a palette colour`);
    }
  }
});

test('every surface material has three tones', () => {
  /* The rule that makes flat pixels read as volume. The two-tone ground planes
     and the inverted flame are the documented exceptions. */
  const twoTone = new Set(['plaza', 'bank', 'hill', 'flame']);
  for (const [material, tones] of Object.entries(T)) {
    if (twoTone.has(material)) continue;
    for (const tone of ['lit', 'base', 'shadow']) {
      assert.ok(tones[tone], `${material} is missing its ${tone} tone`);
    }
  }
});

test('course alternates the two masonry tones and is stable', () => {
  assert.equal(course(T.marble, 0, 0), T.marble.lit);
  assert.equal(course(T.marble, 1, 0), T.marble.base);
  assert.equal(course(T.marble, 4, 0), T.marble.lit);
  assert.equal(course(T.marble, 7, 9), course(T.marble, 7, 9));
});

/* ============================================================== canvas ==== */

test('chooseScale returns whole numbers only', () => {
  /* The single most important line for how the city looks: a fractional scale
     resamples the art into a smear, and it reads as bad art, not as a bug. */
  for (const width of [320, 360, 390, 414, 430, 768]) {
    const scale = chooseScale(320, width);
    assert.equal(scale, Math.trunc(scale), `${width}px gave a fractional scale`);
  }
});

test('chooseScale takes the largest scale that fits', () => {
  assert.equal(chooseScale(100, 320), 3);
  assert.equal(chooseScale(100, 300), 3);
  assert.equal(chooseScale(100, 299), 2);
});

test('chooseScale never returns zero, however narrow the screen', () => {
  /* A 560-wide scene in a 390px window would floor to 0 and draw nothing. */
  assert.equal(chooseScale(560, 390), 1);
  assert.equal(chooseScale(560, 10), 1);
  assert.equal(chooseScale(0, 320), 1);
});

test('chooseScale respects its ceiling', () => {
  assert.equal(chooseScale(10, 4000, { max: 4 }), 4);
});

test('fitCanvas sizes the backing store by dpr and the box in CSS pixels', () => {
  /* Without the dpr term everything is soft on every iPhone made in the last
     decade; without the CSS size it is the wrong size on all of them. */
  const canvas = { style: {}, getContext: () => fakeCtx() };
  fitCanvas(canvas, { w: 320, h: 180, scale: 3, dpr: 3 });
  assert.equal(canvas.width, 2880);
  assert.equal(canvas.height, 1620);
  assert.equal(canvas.style.width, '960px');
  assert.equal(canvas.style.height, '540px');
});

test('fitCanvas turns smoothing off and sets the transform after sizing', () => {
  /* Assigning width resets the context, so the order is not cosmetic. */
  const ctx = fakeCtx();
  const canvas = { style: {}, getContext: () => ctx };
  const got = fitCanvas(canvas, { w: 64, h: 64, scale: 2, dpr: 2 });
  assert.equal(got.imageSmoothingEnabled, false);
  assert.deepEqual(ctx.ops.at(-1), { op: 'setTransform', a: [2, 0, 0, 2, 0, 0] });
});

test('fitCanvas copes with a device that reports no dpr', () => {
  const canvas = { style: {}, getContext: () => fakeCtx() };
  fitCanvas(canvas, { w: 10, h: 10, scale: 2 });
  assert.ok(canvas.width >= 20);
});
