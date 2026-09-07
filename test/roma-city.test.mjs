/* Tests for the catalogue, the slot map and stage 1's sprites.

   The slot map is the reason this file exists. PLAN-ROMA section 5 asks for all
   twenty-five slots to be laid out before the second building is drawn, because
   the composition is designed once and retrofitting it is expensive. On paper
   that plan would be cheap and unverifiable; as data these tests can check the
   thing that actually goes wrong when buildings are authored weeks apart —
   two of them quietly claiming the same ground. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENE, BANDS, CATALOGUE, BY_ID, groundFor, inDrawOrder,
} from '../js/roma/catalogue.js';
import { SPRITES } from '../js/roma/buildings.js';
import { painter, smokeField, drawFlame, drawCypress, drawFigure } from '../js/roma/engine.js';
import { C } from '../js/roma/palette.js';

function fakeCtx() {
  const ops = [];
  return {
    ops,
    fillStyle: null,
    globalAlpha: 1,
    fillRect(x, y, w, h) {
      ops.push({ op: 'fillRect', x, y, w, h, fill: this.fillStyle, alpha: this.globalAlpha });
    },
    rect() {}, beginPath() {}, clip() {}, save() {}, restore() {}, setTransform() {},
  };
}
const rects = ctx => ctx.ops.filter(o => o.op === 'fillRect');

/* =========================================================== catalogue === */

test('the catalogue holds twenty-five buildings', () => {
  assert.equal(CATALOGUE.length, 25);
});

test('every entry is complete', () => {
  for (const e of CATALOGUE) {
    for (const field of ['id', 'latin', 'dutch', 'note', 'xp', 'lesson', 'stage', 'band', 'x', 'w']) {
      assert.ok(e[field] !== undefined, `${e.id} is missing ${field}`);
    }
    assert.ok(e.band in BANDS, `${e.id} is in unknown band ${e.band}`);
    assert.ok(e.stage >= 0 && e.stage <= 4, `${e.id} has stage ${e.stage}`);
  }
});

test('ids are unique', () => {
  assert.equal(new Set(CATALOGUE.map(e => e.id)).size, 25);
});

test('XP thresholds rise strictly, in catalogue order', () => {
  /* Unlock order is the catalogue order, so a threshold out of sequence would
     make a building unreachable or make two land at once. */
  for (let i = 1; i < CATALOGUE.length; i++) {
    assert.ok(
      CATALOGUE[i].xp > CATALOGUE[i - 1].xp,
      `${CATALOGUE[i].id} (${CATALOGUE[i].xp}) does not exceed ${CATALOGUE[i - 1].id}`,
    );
  }
});

test('stages do not interleave', () => {
  /* Stage is derived from position in the list, so the stages have to run in
     blocks or the stage-crossing moment fires more than once. */
  const stages = CATALOGUE.map(e => e.stage);
  for (let i = 1; i < stages.length; i++) {
    assert.ok(stages[i] >= stages[i - 1], `stage goes backwards at ${CATALOGUE[i].id}`);
  }
  assert.deepEqual([...new Set(stages)], [0, 1, 2, 3, 4]);
});

test('the first building is reachable by a first lesson', () => {
  /* PLAN-ROMA section 2's first tuning rule: if the city does not react on day
     one, the hook does not land at all.

     And a first lesson pays exactly 20 XP, which is the whole reason this
     number is 20 and not 200. The acquire ladder is 12m35s long against a
     ten-minute box, so no word can graduate inside a first lesson and the
     finish bonus — 10, doubled for being the first of the day — is all there
     is to earn. The old 200 was unreachable on day one however well she did. */
  assert.ok(CATALOGUE[0].xp <= 20, `first unlock at ${CATALOGUE[0].xp} XP cannot land on day one`);
});

test('no gap runs longer than eight lessons', () => {
  /* The second tuning rule, checked in the unit it is written in.

     It used to divide the XP gap by a flat 500 a lesson, and that assumption
     was wrong at both ends: a first lesson pays 20, a settled one pays ~1000,
     and against an exhausted word pool it falls back toward nothing. Under the
     flat figure a run of 8000-XP steps looked like sixteen lessons in one place
     and four in another. The intended lesson is data now, so the rule is
     checked against it directly. */
  for (let i = 0; i < CATALOGUE.length; i++) {
    const previous = i === 0 ? 0 : CATALOGUE[i - 1].lesson;
    const gap = CATALOGUE[i].lesson - previous;
    assert.ok(gap >= 1, `${CATALOGUE[i].id} lands on or before its predecessor`);
    assert.ok(gap <= 8, `${CATALOGUE[i].id} is ${gap} lessons after the one before it`);
  }
});

test('the intended lessons and the XP thresholds agree on the order', () => {
  /* The XP is read off a measured curve at each intended lesson, so if the two
     ever disagree about the order, one of them was hand-edited. */
  for (let i = 1; i < CATALOGUE.length; i++) {
    assert.ok(
      CATALOGUE[i].lesson > CATALOGUE[i - 1].lesson,
      `${CATALOGUE[i].id} is out of order by lesson`,
    );
  }
});

test('the capstone lands within a school year of steady use', () => {
  /* Four or five lessons a week over a school year is roughly 140-180 of them.
     Finishing much earlier makes the last temple a formality; much later and it
     is unreachable, which is worse. */
  const last = CATALOGUE.at(-1).lesson;
  assert.ok(last >= 100 && last <= 170, `the city finishes on lesson ${last}`);
});

test('every stage contains at least one decoration or small building', () => {
  /* So no stage is a run of five monuments with nothing quick in it. */
  for (const stage of [0, 1, 2, 3, 4]) {
    const inStage = CATALOGUE.filter(e => e.stage === stage);
    assert.ok(inStage.some(e => e.w <= 16), `stage ${stage} has nothing small in it`);
  }
});

test('BY_ID agrees with the catalogue', () => {
  assert.equal(Object.keys(BY_ID).length, 25);
  for (const e of CATALOGUE) assert.equal(BY_ID[e.id], e);
});

test('the catalogue cannot be edited at runtime', () => {
  assert.throws(() => { CATALOGUE.push({}); });
  assert.throws(() => { 'use strict'; CATALOGUE[0].xp = 1; }, TypeError);
});

/* ============================================================ the slots == */

test('every building fits inside the scene', () => {
  for (const e of CATALOGUE) {
    assert.ok(e.x >= 0, `${e.id} starts at ${e.x}`);
    assert.ok(e.x + e.w <= SCENE.w, `${e.id} ends at ${e.x + e.w}, past ${SCENE.w}`);
  }
});

test('no two buildings in the same band overlap', () => {
  /* The whole reason the slot map is data. Two buildings sharing ground is
     invisible until both are drawn, which may be months apart. */
  for (const band of Object.keys(BANDS)) {
    const inBand = CATALOGUE.filter(e => e.band === band).sort((a, b) => a.x - b.x);
    for (let i = 1; i < inBand.length; i++) {
      const prev = inBand[i - 1];
      const here = inBand[i];
      assert.ok(
        here.x >= prev.x + prev.w,
        `${band}: ${here.id} at ${here.x} overlaps ${prev.id} (${prev.x}..${prev.x + prev.w - 1})`,
      );
    }
  }
});

test('the bands are ordered back to front and do not collide', () => {
  assert.ok(BANDS.far.groundY < BANDS.mid.groundY);
  assert.ok(BANDS.mid.groundY < BANDS.near.groundY);
  assert.ok(BANDS.near.groundY < SCENE.h);
  assert.deepEqual([BANDS.far.z, BANDS.mid.z, BANDS.near.z], [0, 1, 2]);
});

test('the city reads left to right as a timeline', () => {
  /* Roughly chronological, so the progression is a timeline she absorbs for
     free. Compared by stage average rather than per building, since a
     decoration may sit beside an earlier one. */
  const centre = stage => {
    const inStage = CATALOGUE.filter(e => e.stage === stage);
    return inStage.reduce((sum, e) => sum + e.x + e.w / 2, 0) / inStage.length;
  };
  for (let s = 1; s <= 4; s++) {
    assert.ok(centre(s) > centre(s - 1), `stage ${s} sits left of stage ${s - 1}`);
  }
});

test('the first stage is inside the first window', () => {
  /* Home shows a 320-wide window. Everything she can unlock in her first weeks
     has to be visible in it without panning. */
  for (const e of CATALOGUE.filter(e => e.stage === 0)) {
    assert.ok(e.x + e.w <= SCENE.window, `${e.id} needs panning to see`);
  }
});

test('groundFor resolves a band and rejects a typo', () => {
  assert.equal(groundFor('mid'), BANDS.mid.groundY);
  assert.throws(() => groundFor('middle'), /unknown band/);
});

test('draw order is back band first, then left to right', () => {
  const order = inDrawOrder();
  for (let i = 1; i < order.length; i++) {
    const a = order[i - 1];
    const b = order[i];
    const za = BANDS[a.band].z;
    const zb = BANDS[b.band].z;
    assert.ok(za < zb || (za === zb && a.x <= b.x), `${a.id} then ${b.id} is wrong`);
  }
  assert.equal(inDrawOrder().length, 25, 'draw order must not drop or add entries');
});

/* ============================================================= sprites === */

test('every stage 1 building has a sprite', () => {
  /* And nothing later does yet, which is what makes a half-finished catalogue
     a working feature rather than a broken one. */
  for (const e of CATALOGUE.filter(e => e.stage === 0)) {
    assert.ok(SPRITES[e.id], `${e.id} has no sprite`);
  }
  assert.equal(Object.keys(SPRITES).length, 5);
});

test('every sprite id matches its catalogue entry', () => {
  for (const [id, sprite] of Object.entries(SPRITES)) {
    assert.ok(BY_ID[id], `${id} is not in the catalogue`);
    assert.equal(sprite.id, id, 'the sprite disagrees with its key');
  }
});

test('every sprite fits the width its slot reserves', () => {
  /* The slot map allocated frontage before the art existed. If a sprite grew
     past it, it would silently overlap its neighbour. */
  for (const [id, sprite] of Object.entries(SPRITES)) {
    assert.equal(sprite.w, BY_ID[id].w, `${id} is ${sprite.w} wide, slot reserves ${BY_ID[id].w}`);
  }
});

test('every sprite stays inside its own box', () => {
  for (const [id, sprite] of Object.entries(SPRITES)) {
    const ctx = fakeCtx();
    const gy = 100;
    sprite.draw(ctx, 50, gy, { scale: 1 });
    const cells = rects(ctx);
    assert.ok(cells.length > 0, `${id} drew nothing`);
    for (const r of cells) {
      assert.ok(r.x >= 50 && r.x + r.w <= 50 + sprite.w, `${id} paints outside its width`);
      assert.ok(r.y >= gy - sprite.h + 1, `${id} paints above its height`);
      assert.ok(r.y + r.h - 1 <= gy, `${id} paints below its ground line`);
    }
    assert.equal(Math.min(...cells.map(r => r.y)), gy - sprite.h + 1, `${id}: h overstated`);
    assert.equal(Math.max(...cells.map(r => r.y + r.h - 1)), gy, `${id} floats above the ground`);
  }
});

test('no sprite paints its own ground', () => {
  /* The scene draws the earth. A sprite that painted a ground row would sit on
     a visible seam, and the same sprite has to work in any band.

     Checked by colour rather than by geometry. The first version of this test
     asserted that the bottom row was not full width, and it flagged the
     palisade — whose base is twenty stakes and legitimately spans everything.
     The rule was never about geometry: it is that earth, road and water belong
     to the scene, and these are the colours they are made of. */
  const groundColours = new Set([
    C.plaza, C.plazaDark, C.bank, C.bankDark, C.hill, C.hillFar,
    C.water, C.waterLite, C.waterDark,
  ]);

  for (const [id, sprite] of Object.entries(SPRITES)) {
    const ctx = fakeCtx();
    sprite.draw(ctx, 0, 20, { scale: 1 });
    for (const r of rects(ctx)) {
      assert.ok(!groundColours.has(r.fill), `${id} paints ${r.fill}, which belongs to the scene`);
    }
  }
});

test('sprites are identical between renders', () => {
  for (const sprite of Object.values(SPRITES)) {
    const a = fakeCtx();
    const b = fakeCtx();
    sprite.draw(a, 3, 40, { scale: 2 });
    sprite.draw(b, 3, 40, { scale: 2 });
    assert.deepEqual(a.ops, b.ops, `${sprite.id} is not deterministic`);
  }
});

/* ================================================================ ara ==== */

test('the altar registers its fire on top of itself', () => {
  /* Ara is the fifth unlock and until stage 2 its flame is the only motion in
     the whole city, which is why the fire system is built now and not later. */
  const g = SPRITES.ara.draw(fakeCtx(), 10, 60, { scale: 1 });
  assert.equal(g.emitters.length, 1);
  const [fire] = g.emitters;
  assert.equal(fire.by, 60 - SPRITES.ara.h + 1, 'the fire should sit on the top slab');
  assert.ok(fire.x > 10 && fire.x < 10 + SPRITES.ara.w, 'the fire should be over the altar');
});

test('an unfinished altar does not burn', () => {
  const g = SPRITES.ara.draw(fakeCtx(), 0, 20, { scale: 1, progress: 0.5 });
  assert.equal(g.emitters.length, 0);
});

test('stage 1 has exactly one fire in it', () => {
  /* If this ever becomes zero, stage 1 is five static shapes on a hill. */
  const ctx = fakeCtx();
  const g = painter(ctx, 1);
  for (const e of CATALOGUE.filter(e => e.stage === 0)) {
    SPRITES[e.id]?.draw(ctx, e.x, groundFor(e.band), { scale: 1, painter: g });
  }
  assert.equal(g.emitters.length, 1);
});

/* =============================================================== fire ==== */

test('a flame is drawn, tapers, and sways over time', () => {
  const at = t => {
    const ctx = fakeCtx();
    drawFlame(painter(ctx, 1), { x: 20, by: 40, size: 2, seed: 0 }, t);
    return rects(ctx);
  };

  const still = at(0);
  assert.ok(still.length > 6, 'a flame should be several rows of several layers');

  /* Widest at the base, narrowest at the tip. */
  const base = Math.max(...still.filter(r => r.y === 40).map(r => r.w));
  const top = Math.min(...still.map(r => r.w));
  assert.ok(base > top, 'the flame does not taper');

  assert.notDeepEqual(at(0), at(0.4), 'the flame does not move');
});

test('a flame stays above the row it burns from', () => {
  const ctx = fakeCtx();
  drawFlame(painter(ctx, 1), { x: 10, by: 30, size: 2 }, 1.3);
  for (const r of rects(ctx)) assert.ok(r.y <= 30, 'flame drawn below its own base');
});

test('smoke spawns from emitters, rises, and is culled', () => {
  const field = smokeField();
  const emitters = [{ x: 10, by: 40, size: 2.2, seed: 0 }];

  field.update(0.3, emitters);
  assert.equal(field.particles.length, 1, 'one puff per cadence per emitter');

  const start = field.particles[0].y;
  field.update(0.2, emitters);
  assert.ok(field.particles[0].y < start, 'smoke should rise');
  assert.ok(field.particles[0].size > 1, 'smoke should spread as it ages');

  for (let i = 0; i < 40; i++) field.update(0.2, []);
  assert.equal(field.particles.length, 0, 'dead particles should be culled');
});

test('smoke is capped, however long the tab is left open', () => {
  const field = smokeField({ max: 5 });
  const emitters = Array.from({ length: 9 }, (_, i) => ({ x: i, by: 40, size: 3, seed: i }));
  for (let i = 0; i < 50; i++) field.update(0.3, emitters);
  assert.ok(field.particles.length <= 5, `grew to ${field.particles.length}`);
});

test('smoke draws translucently and restores the context', () => {
  const field = smokeField();
  field.update(0.3, [{ x: 5, by: 20, size: 3, seed: 1 }]);
  const ctx = fakeCtx();
  field.draw(painter(ctx, 1));
  assert.ok(rects(ctx).every(r => r.alpha < 1), 'smoke should be translucent');
});

test('smoke with no emitters does nothing', () => {
  const field = smokeField();
  field.update(1, []);
  assert.equal(field.particles.length, 0);
  const ctx = fakeCtx();
  field.draw(painter(ctx, 1));
  assert.equal(ctx.ops.length, 0, 'an empty field should not even save the context');
});

/* ======================================================== scale props ==== */

test('a cypress is a tapering teardrop standing on the ground', () => {
  const ctx = fakeCtx();
  drawCypress(painter(ctx, 1), 20, 50);
  const cells = rects(ctx);
  assert.equal(Math.max(...cells.map(r => r.y)), 50, 'it should stand on the ground line');
  const widthAt = y => cells.filter(r => r.y === y).length;
  assert.ok(widthAt(50) >= widthAt(43), 'a cypress should be widest at its base');
});

test('cypress heights vary by position but never change between renders', () => {
  const heights = [10, 40, 80, 120].map(x => {
    const ctx = fakeCtx();
    drawCypress(painter(ctx, 1), x, 50);
    return 50 - Math.min(...rects(ctx).map(r => r.y));
  });
  assert.ok(new Set(heights).size > 1, 'every cypress is the same height');

  const ctx = fakeCtx();
  drawCypress(painter(ctx, 1), 40, 50);
  const again = fakeCtx();
  drawCypress(painter(again, 1), 40, 50);
  assert.deepEqual(ctx.ops, again.ops);
});

test('a figure bobs when time runs and stands still when it does not', () => {
  const at = t => {
    const ctx = fakeCtx();
    drawFigure(painter(ctx, 1), 30, 60, undefined, t, 0);
    return rects(ctx);
  };
  assert.deepEqual(at(0), at(0), 'a still frame should be stable');
  const moved = Array.from({ length: 8 }, (_, i) => JSON.stringify(at(i * 0.2)));
  assert.ok(new Set(moved).size > 1, 'the walk bob does nothing');
});/* =============================================================== spike === */

/* The throwaway temple that showed the engine's ceiling during the go/no-go has
   been deleted, along with the two tests that guarded it. `drawColumn` from it
   is worth recovering out of commit cbfb25d when Templum Vestae is drawn. */
