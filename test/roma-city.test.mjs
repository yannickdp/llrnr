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

test('every building in the catalogue is drawn', () => {
  /* All twenty-five, as of 4b.4. Until then this asserted which stages were
     authored, because an entry with no sprite is simply absent from the scene
     and a half-finished catalogue was a working feature. Now the check is the
     stronger one: nothing in the catalogue is missing and nothing is drawn
     that is not in it. */
  for (const e of CATALOGUE) assert.ok(SPRITES[e.id], `${e.id} has no sprite`);
  assert.equal(Object.keys(SPRITES).length, CATALOGUE.length);
});

test('the whole city fits above its own ground, with sky to spare', () => {
  /* Every band's tallest building has to clear the top of the scene, and the
     hero monuments are the ones with any chance of not doing so. */
  for (const e of CATALOGUE) {
    const top = BANDS[e.band].groundY - SPRITES[e.id].h + 1;
    assert.ok(top >= 0, `${e.id} reaches row ${top}, above the scene`);
    assert.ok(top >= 4, `${e.id} tops out at row ${top} — no sky left above it`);
  }
});

test('the five stages have five distinct silhouettes', () => {
  /* A stage that looks like the one before it is a stage she will not notice
     crossing. Checked crudely, as the tallest thing each stage adds: the city
     should visibly get taller era by era. */
  const tallest = stage => Math.max(
    ...CATALOGUE.filter(e => e.stage === stage).map(e => SPRITES[e.id].h),
  );
  const heights = [0, 1, 2, 3, 4].map(tallest);
  assert.deepEqual(heights, [...heights].sort((a, b) => a - b),
    `stages do not grow taller in order: ${heights.join(', ')}`);
});

test('every band is used and none is empty', () => {
  /* The water band was added for the bridge and the drain; if a refactor ever
     empties a band, the geometry it defines is dead weight. */
  for (const band of Object.keys(BANDS)) {
    assert.ok(
      CATALOGUE.some(e => e.band === band),
      `nothing stands in the ${band} band`,
    );
  }
});

test('the river buildings stand in the water, not on the pavement', () => {
  /* The near street is above the waterline, so a bridge anchored there would
     span dry land — the reason the water band exists at all. */
  for (const id of ['pons-sublicius', 'cloaca-maxima']) {
    assert.equal(BY_ID[id].band, 'water', `${id} is not in the water band`);
  }
  assert.ok(BANDS.water.groundY > BANDS.near.groundY);
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

/* ==================================================== the viewer pages == */

/* The city is judged by eye on two HTML pages, and nothing else loads them —
   so when 4b.3 deleted the throwaway temple, the page that imported it stayed
   broken for two commits and would only have shown up as a blank screen on a
   phone. These check the one thing a unit test can check about a page it
   cannot run: that every module it imports is actually there. */

test('every module the viewer pages import exists', async () => {
  const { readFile } = await import('node:fs/promises');
  const { existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, resolve } = await import('node:path');

  const here = dirname(fileURLToPath(import.meta.url));

  for (const page of ['roma-probe.html', 'roma-city.html']) {
    const html = await readFile(resolve(here, page), 'utf8');
    const imports = [...html.matchAll(/from\s+'([^']+)'/g)].map(m => m[1]);
    assert.ok(imports.length > 0, `${page} imports nothing — has it been gutted?`);

    for (const spec of imports) {
      assert.ok(
        existsSync(resolve(here, spec)),
        `${page} imports ${spec}, which does not exist`,
      );
    }
  }
});

/* ====================================================== life and light == */

test('night follows the real clock, and the seasons', async () => {
  const { isNight } = await import('../js/roma/render.js');

  /* Homework happens in the evening, and in Belgium that is dark in December
     and broad daylight in June. A fixed cutoff would have the city sunlit on a
     black winter afternoon, which is the opposite of the intended effect. */
  assert.equal(isNight(new Date(2026, 5, 21, 14, 0)), false, 'midsummer afternoon');
  assert.equal(isNight(new Date(2026, 5, 21, 22, 30)), true, 'midsummer late evening');
  assert.equal(isNight(new Date(2026, 5, 21, 20, 0)), false, 'still light in June at 8pm');

  assert.equal(isNight(new Date(2026, 11, 21, 17, 30)), true, 'midwinter, dark by 5.30');
  assert.equal(isNight(new Date(2026, 11, 21, 9, 0)), false, 'midwinter mid-morning');
  assert.equal(isNight(new Date(2026, 11, 21, 7, 30)), true, 'not up yet in December');
});

test('night and day are each other, always', async () => {
  const { isNight } = await import('../js/roma/render.js');
  /* Deep night and the middle of the day, every month of the year. */
  for (let month = 0; month < 12; month++) {
    assert.equal(isNight(new Date(2026, month, 15, 2, 0)), true, `2am in month ${month}`);
    assert.equal(isNight(new Date(2026, month, 15, 13, 0)), false, `1pm in month ${month}`);
  }
});

test('the moon is drawn behind the buildings, not over them', async () => {
  /* The one ordering bug PLAN-ROMA §6 names. If the celestials ever move into
     the night pass, the moon floats in front of the Pantheon. Checked by
     ordering: everything drawn by drawStatic at night must come before the
     first rect a building paints. */
  const { drawStatic } = await import('../js/roma/render.js');
  const { painter } = await import('../js/roma/engine.js');
  const { C: palette } = await import('../js/roma/palette.js');

  const ops = [];
  const ctx = {
    fillStyle: null, globalAlpha: 1,
    fillRect() { ops.push(this.fillStyle); },
    createLinearGradient: () => ({ addColorStop() {} }),
    save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
  };
  drawStatic(painter(ctx, 1), CATALOGUE.map(e => e.id), { stage: 4, night: true });

  const lastMoon = ops.lastIndexOf(palette.moon);
  const firstMarble = ops.indexOf(palette.marbleLite);
  assert.ok(lastMoon >= 0, 'the moon was not drawn at all');
  assert.ok(firstMarble >= 0, 'no marble was drawn — did the city paint?');
  assert.ok(lastMoon < firstMarble, 'the moon is painted after the buildings');
});

test('the night pass dims once and blooms every light', async () => {
  const { nightPass } = await import('../js/roma/render.js');
  const { painter } = await import('../js/roma/engine.js');

  const ops = [];
  const ctx = {
    fillStyle: null, globalAlpha: 1,
    fillRect(x, y, w, h) { ops.push({ fill: this.fillStyle, alpha: this.globalAlpha, w, h }); },
    save() {}, restore() {},
  };
  const g = painter(ctx, 1);
  const lights = {
    glowTargets: [{ x: 10, y: 10, w: 4, h: 5 }, { x: 40, y: 12, w: 4, h: 5 }],
    emitters: [{ x: 20, by: 30, size: 2, seed: 0 }],
  };
  nightPass(g, lights, 1.5);

  const tint = ops.filter(o => typeof o.fill === 'string' && o.fill.startsWith('rgba'));
  assert.equal(tint.length, 1, 'the scene should be dimmed exactly once');
  assert.ok(ops.some(o => o.alpha < 1), 'the blooms should be translucent');
});

test('the crowd grows with the words she knows, and is capped', async () => {
  const { drawCitizens } = await import('../js/roma/render.js');
  const { painter } = await import('../js/roma/engine.js');

  const count = learned => {
    const seen = new Set();
    const ctx = {
      fillStyle: null, globalAlpha: 1,
      fillRect(x) { seen.add(x); },
      save() {}, restore() {},
    };
    drawCitizens(painter(ctx, 1), learned, 0);
    return seen.size;
  };

  assert.ok(count(0) > 0, 'an empty vocabulary still has a couple of people about');
  assert.ok(count(40) > count(0), 'the crowd should grow');
  assert.equal(count(400), count(4000), 'and stop growing — past a dozen it is a queue');
});

test('the same citizen stands in the same place as the crowd grows', async () => {
  /* Learning a word must not shuffle the street. Positions come from `hash`,
     so the first N are stable however many there are. */
  const { drawCitizens } = await import('../js/roma/render.js');
  const { painter } = await import('../js/roma/engine.js');

  const xs = learned => {
    const seen = [];
    const ctx = {
      fillStyle: null, globalAlpha: 1,
      fillRect(x, y, w, h) { if (h === 3) seen.push(x); },
      save() {}, restore() {},
    };
    drawCitizens(painter(ctx, 1), learned, 0);
    return seen;
  };

  const few = xs(8);
  const many = xs(80);
  assert.deepEqual(many.slice(0, few.length), few);
});

test('the boat, the birds and the water all move', async () => {
  const render = await import('../js/roma/render.js');
  const { painter } = await import('../js/roma/engine.js');

  const frame = (fn, t) => {
    const ops = [];
    const ctx = {
      fillStyle: null, globalAlpha: 1,
      fillRect(...a) { ops.push(a.join()); },
      save() {}, restore() {},
    };
    fn(painter(ctx, 1), t);
    return ops.join('|');
  };

  for (const fn of [render.drawBoat, render.drawBirds, render.drawWater]) {
    assert.notEqual(frame(fn, 0), frame(fn, 2.5), `${fn.name} is static`);
    assert.equal(frame(fn, 1), frame(fn, 1), `${fn.name} is not deterministic in t`);
  }
});

/* ====================================================== the backdrop === */

test('the ground has no holes in it', async () => {
  /* Reported from the phone as "blue rectangles between the hills", and that
     is exactly what it was: the far range stopped two rows below the far
     band's ground line, so between the named hills there was bare sky from
     row 128 down to the plaza at 150 — a hole with the sky showing through.

     The invariant is simple and worth keeping: from the far band's ground line
     down to the street, every column is solid. */
  const { drawStatic } = await import('../js/roma/render.js');
  const { painter } = await import('../js/roma/engine.js');

  const painted = new Set();
  const ctx = {
    fillStyle: null, globalAlpha: 1,
    fillRect(x, y, w, h) {
      /* The sky is a gradient object, not a colour string — skip it, or it
         would paint over the whole scene and hide every hole. */
      if (typeof this.fillStyle !== 'string') return;
      for (let i = Math.round(x); i < Math.round(x + w); i++) {
        for (let j = Math.round(y); j < Math.round(y + h); j++) painted.add(`${i},${j}`);
      }
    },
    createLinearGradient: () => ({ addColorStop() {} }),
    save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
  };
  drawStatic(painter(ctx, 1), CATALOGUE.map(e => e.id), { stage: 4 });

  const holes = [];
  for (let y = BANDS.far.groundY; y < BANDS.mid.groundY; y++) {
    for (let x = 0; x < SCENE.w; x++) {
      if (!painted.has(`${x},${y}`)) holes.push(`${x},${y}`);
    }
  }
  assert.deepEqual(holes.slice(0, 8), [], `${holes.length} bare cells below the skyline`);
});

test('each era puts its landmark on a single named hill', async () => {
  /* It used to choose with `era % 3`, which marched the aqueduct across the
     Palatine directly above Romulus's huts and crowned the Aventine with the
     temple that belongs to the Capitoline.

     The groves are a separate mechanism and are planted on more than one hill
     per era, so they are subtracted before the span is measured — the first
     version of this test failed the moment the olives arrived, for no fault of
     the thing it was checking. */
  const { drawHills, olivesAt } = await import('../js/roma/render.js');
  const { painter } = await import('../js/roma/engine.js');

  const collect = fn => {
    const seen = new Set();
    const ctx = {
      fillStyle: null, globalAlpha: 1,
      fillRect(x, y, w, h) {
        for (let i = Math.round(x); i < Math.round(x + w); i++) {
          for (let j = Math.round(y); j < Math.round(y + h); j++) seen.add(`${i},${j}`);
        }
      },
      save() {}, restore() {},
    };
    fn(painter(ctx, 1));
    return seen;
  };

  const HILL_XS = [62, 340, 522];
  for (const era of [1, 2, 3, 4]) {
    const before = collect(g => drawHills(g, { stage: era - 1 }));
    const after = collect(g => drawHills(g, { stage: era }));

    /* The trees this era planted, wherever they are, drawn wide so their whole
       footprint is excluded. */
    const grove = new Set();
    for (const tree of olivesAt(era, { onHill: true })) {
      if (tree.stage !== era) continue;
      for (let x = tree.x - 8; x <= tree.x + 8; x++) {
        for (let y = 60; y < 150; y++) grove.add(`${x},${y}`);
      }
    }

    const added = [...after].filter(c => !before.has(c) && !grove.has(c));
    assert.ok(added.length > 0, `era ${era} adds no landmark`);

    const xs = added.map(c => Number(c.split(',')[0]));
    const near = HILL_XS.filter(cx => Math.min(...xs) > cx - 100 && Math.max(...xs) < cx + 100);
    assert.equal(near.length, 1,
      `era ${era} spans x ${Math.min(...xs)}..${Math.max(...xs)}, not one hill`);
  }
});

test('what an era adds to the skyline is still there when the city is finished', async () => {
  /* The whole point of the hill details is that a stage crossing leaves a
     permanent mark, so one that later gets built over is worse than none —
     it would appear at the crossing and quietly vanish a few stages later.
     This is what moved the republic's farmstead off the Aventine: the real
     aqueduct lands across that crown in stage 4. */
  const { drawHills } = await import('../js/roma/render.js');
  const { painter } = await import('../js/roma/engine.js');

  const covered = new Set();
  for (const e of CATALOGUE) {
    const gy = BANDS[e.band].groundY;
    const h = SPRITES[e.id].h;
    for (let x = e.x; x < e.x + e.w; x++) {
      for (let y = gy - h + 1; y <= gy; y++) covered.add(`${x},${y}`);
    }
  }

  const cells = stage => {
    const seen = new Set();
    const ctx = {
      fillStyle: null, globalAlpha: 1,
      fillRect(x, y, w, h) {
        for (let i = Math.round(x); i < Math.round(x + w); i++) {
          for (let j = Math.round(y); j < Math.round(y + h); j++) seen.add(`${i},${j}`);
        }
      },
      save() {}, restore() {},
    };
    drawHills(painter(ctx, 1), { stage });
    return seen;
  };

  for (const era of [1, 2, 3, 4]) {
    const before = cells(era - 1);
    const added = [...cells(era)].filter(c => !before.has(c));
    const hidden = added.filter(c => covered.has(c));
    assert.ok(hidden.length / added.length < 0.25,
      `era ${era}: ${hidden.length} of ${added.length} cells end up behind buildings`);
  }
});

/* ========================================================== the olives == */

test('an olive and a cypress are opposite shapes', async () => {
  /* The whole reason for a second tree: a low silvery dome against a tall dark
     spike reads as two kinds of tree, where two spikes read as a fence. */
  const { drawOlive, drawCypress } = await import('../js/roma/engine.js');
  const { painter } = await import('../js/roma/engine.js');

  const box = fn => {
    const cells = [];
    const ctx = {
      fillStyle: null, globalAlpha: 1,
      fillRect(x, y, w, h) {
        for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) cells.push([i, j]);
      },
      save() {}, restore() {},
    };
    fn(painter(ctx, 1), 40, 60);
    const xs = cells.map(c => c[0]);
    const ys = cells.map(c => c[1]);
    return { w: Math.max(...xs) - Math.min(...xs) + 1, h: 60 - Math.min(...ys) + 1 };
  };

  const olive = box(drawOlive);
  const cypress = box(drawCypress);
  assert.ok(olive.w > cypress.w * 2, `olive ${olive.w} wide vs cypress ${cypress.w}`);
  assert.ok(olive.h < cypress.h, `olive ${olive.h} tall vs cypress ${cypress.h}`);
});

test('an olive stands on the ground it is given', async () => {
  const { drawOlive, painter } = await import('../js/roma/engine.js');
  const rows = [];
  const ctx = {
    fillStyle: null, globalAlpha: 1,
    fillRect(x, y, w, h) { rows.push(y + h - 1); },
    save() {}, restore() {},
  };
  drawOlive(painter(ctx, 1), 20, 90);
  assert.equal(Math.max(...rows), 90, 'the trunk should reach the ground line');
});

test('the groves grow with the city', async () => {
  const { olivesAt } = await import('../js/roma/render.js');
  let previous = -1;
  for (let stage = 0; stage <= 4; stage++) {
    const total = olivesAt(stage).length + olivesAt(stage, { onHill: true }).length;
    assert.ok(total > previous, `stage ${stage} adds no trees`);
    previous = total;
  }
  /* And a tree, once planted, is never felled. */
  for (let stage = 1; stage <= 4; stage++) {
    const before = olivesAt(stage - 1).map(t => t.x);
    const after = olivesAt(stage).map(t => t.x);
    assert.deepEqual(after.slice(0, before.length), before, `stage ${stage} moved a tree`);
  }
});

test('no olive stands inside a building', async () => {
  /* Checked against **every** band, not just the near one. The first pass
     placed a tree at x 150 from the near band's free gaps alone and put its
     roots through the deck of Pons Sublicius — which stands in the water band
     but rises two rows above the near street. */
  const { drawOlives } = await import('../js/roma/render.js');
  const { painter } = await import('../js/roma/engine.js');

  const occupied = new Map();
  for (const e of CATALOGUE) {
    const gy = BANDS[e.band].groundY;
    const h = SPRITES[e.id].h;
    for (let x = e.x; x < e.x + e.w; x++) {
      for (let y = gy - h + 1; y <= gy; y++) occupied.set(`${x},${y}`, e.id);
    }
  }

  const cells = new Set();
  const ctx = {
    fillStyle: null, globalAlpha: 1,
    fillRect(x, y, w, h) {
      for (let i = Math.round(x); i < Math.round(x + w); i++) {
        for (let j = Math.round(y); j < Math.round(y + h); j++) cells.add(`${i},${j}`);
      }
    },
    save() {}, restore() {},
  };
  drawOlives(painter(ctx, 1), 4);

  const clashes = [...cells].filter(c => occupied.has(c)).map(c => occupied.get(c));
  assert.deepEqual([...new Set(clashes)], [], 'an olive is growing through a building');
});

/* ======================================================== hit testing === */

test('a tap on a building finds it', async () => {
  const { hitTest } = await import('../js/roma/render.js');

  for (const id of ['casa-romuli', 'colosseum', 'templum-iovis', 'pons-sublicius']) {
    const entry = BY_ID[id];
    const groundY = BANDS[entry.band].groundY;
    const middle = {
      x: entry.x + Math.floor(entry.w / 2),
      y: groundY - Math.floor(SPRITES[id].h / 2),
    };
    assert.equal(hitTest(middle.x, middle.y)?.id, id, `${id} was not found at its own middle`);
  }
});

test('a tap on the sky or the empty street finds nothing', async () => {
  const { hitTest } = await import('../js/roma/render.js');
  assert.equal(hitTest(200, 20), null, 'open sky');
  assert.equal(hitTest(300, 60), null, 'above the hills');
  /* x 94..99 is the gap the slot map leaves between Ara and the Forum. */
  assert.equal(hitTest(96, 148), null, 'a gap in the street');
});

test('a tap resolves to the building in front', async () => {
  const { hitTest } = await import('../js/roma/render.js');

  /* The bands overlap on purpose, so some points are inside two slots. The one
     drawn last is the one a finger is pointing at. */
  const overlaps = [];
  for (const a of CATALOGUE) {
    for (const b of CATALOGUE) {
      if (a === b || a.band === b.band) continue;
      const aTop = BANDS[a.band].groundY - SPRITES[a.id].h + 1;
      const bTop = BANDS[b.band].groundY - SPRITES[b.id].h + 1;
      const x = Math.max(a.x, b.x);
      const y = Math.max(aTop, bTop);
      if (x < Math.min(a.x + a.w, b.x + b.w)
        && y <= Math.min(BANDS[a.band].groundY, BANDS[b.band].groundY)) {
        overlaps.push({ x, y, a, b });
      }
    }
  }
  assert.ok(overlaps.length > 0, 'no bands overlap — has the composition flattened?');

  for (const { x, y, a, b } of overlaps.slice(0, 20)) {
    const front = BANDS[a.band].z > BANDS[b.band].z ? a : b;
    assert.equal(hitTest(x, y)?.id, front.id,
      `at ${x},${y} the front-most is ${front.id} (${front.band})`);
  }
});

test('hit testing can be limited to what she has unlocked', async () => {
  const { hitTest } = await import('../js/roma/render.js');
  const entry = BY_ID.colosseum;
  const point = { x: entry.x + 10, y: BANDS.mid.groundY - 10 };

  assert.equal(hitTest(point.x, point.y)?.id, 'colosseum');
  assert.equal(hitTest(point.x, point.y, ['casa-romuli']), null,
    'a building she has not earned must not answer a tap');
});

test('a canvas tap maps to the scene through scale and pan', async () => {
  const { toScene } = await import('../js/roma/render.js');

  assert.deepEqual(toScene({ clientX: 0, clientY: 0, scale: 1, pan: 0 }), { x: 0, y: 0 });
  assert.deepEqual(toScene({ clientX: 60, clientY: 30, scale: 3, pan: 0 }), { x: 20, y: 10 });
  assert.deepEqual(toScene({ clientX: 60, clientY: 30, scale: 3, pan: 120 }), { x: 140, y: 10 });
});

/* ============================================================== zoom === */

test('zoom snaps to whole numbers and clamps at both ends', async () => {
  const { createScene } = await import('../js/roma/render.js');
  const { SCENE: scene } = await import('../js/roma/catalogue.js');

  const stub = () => ({
    fillStyle: null, globalAlpha: 1, fillRect() {}, drawImage() {}, clearRect() {},
    createLinearGradient: () => ({ addColorStop() {} }), setTransform() {},
    getTransform: () => ({}), save() {}, restore() {}, translate() {},
    beginPath() {}, rect() {}, clip() {},
  });
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ style: {}, getContext: stub, width: 0, height: 0 }) };

  try {
    const canvas = { style: {}, clientWidth: 390, getContext: stub, width: 390, height: 180 };
    const view = createScene(canvas, { cssWidth: 390, scale: 1, motion: false, maxScale: 4 });
    view.show(CATALOGUE.map(e => e.id), { stage: 4 });

    /* Fractional scales are banned outright — they resample the art. */
    assert.equal(view.setScale(2.4), 2);
    assert.equal(view.setScale(2.6), 3);

    assert.equal(view.setScale(99), 4, 'clamped to the ceiling');
    assert.equal(view.setScale(-5), 1, 'clamped to the floor');

    /* Zooming in narrows the window onto the scene. */
    view.setScale(1);
    const wide = view.viewWidth;
    view.setScale(4);
    assert.ok(view.viewWidth < wide, 'the window should narrow as she zooms in');
    assert.ok(view.viewWidth >= 1);
    assert.ok(view.pan + view.viewWidth <= scene.w, 'the pan should stay inside the scene');
  } finally {
    globalThis.document = previous;
  }
});

test('a fixed-view scene ignores zoom', async () => {
  /* The Home hero sizes itself from a fixed window width, so its scale belongs
     to the element and not to a gesture. */
  const { createScene } = await import('../js/roma/render.js');
  const stub = () => ({
    fillStyle: null, globalAlpha: 1, fillRect() {}, drawImage() {}, clearRect() {},
    createLinearGradient: () => ({ addColorStop() {} }), setTransform() {},
    getTransform: () => ({}), save() {}, restore() {}, translate() {},
    beginPath() {}, rect() {}, clip() {},
  });
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ style: {}, getContext: stub, width: 0, height: 0 }) };

  try {
    const canvas = { style: {}, clientWidth: 358, getContext: stub, width: 358, height: 180 };
    const hero = createScene(canvas, { view: SCENE.window, motion: false });
    const was = hero.scale;
    assert.equal(hero.setScale(4), was, 'the hero must not zoom');
    assert.equal(hero.viewWidth, SCENE.window);
  } finally {
    globalThis.document = previous;
  }
});

/* ====================================================== the module seam = */

test('the module seam holds', async () => {
  /* PLAN-ROMA §8: `render.js` must not know what a building means,
     `catalogue.js` must not know how anything is drawn, and `buildings.js`
     must not know why anything unlocks. That is what lets the art source be
     swapped wholesale, and it is only ever one careless import away from
     being untrue — so it is checked rather than trusted. */
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { dirname, resolve } = await import('node:path');

  const roma = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'roma');
  const importsOf = async file => {
    const source = await readFile(resolve(roma, file), 'utf8');
    return [...source.matchAll(/from\s+'\.\/([\w-]+)\.js'/g)].map(m => m[1]);
  };

  const forbidden = {
    /* The drawing layer must not reach for the unlock rules. */
    render: ['roma'],
    /* Names, history and slots — and nothing about pixels. */
    catalogue: ['engine', 'buildings', 'render', 'roma'],
    /* Sprites know how to draw themselves and nothing else. */
    buildings: ['catalogue', 'render', 'roma'],
    /* The unlock rules know the catalogue and nothing about drawing. */
    roma: ['engine', 'buildings', 'render'],
    /* The primitives are the bottom of the stack. */
    engine: ['catalogue', 'buildings', 'render', 'roma'],
    palette: ['engine', 'catalogue', 'buildings', 'render', 'roma'],
  };

  for (const [file, banned] of Object.entries(forbidden)) {
    const imports = await importsOf(`${file}.js`);
    for (const bad of banned) {
      assert.ok(!imports.includes(bad),
        `${file}.js imports ${bad}.js — the seam in PLAN-ROMA §8 is broken`);
    }
  }
});
