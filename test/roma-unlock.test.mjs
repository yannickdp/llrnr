/* Tests for the unlock logic — what the city has, from what she earned.

   The rule these exist to protect is that **total XP wins**. The stored
   `roma.unlocked` list is a cache kept only so "what is new since she last
   looked?" is answerable; if it ever disagrees with the XP it is recomputed and
   thrown away. Nothing in this app is allowed to take a building away, and a
   botched write is not an exception. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  unlockedAt, stageAt, nextAt, newSince, unlockedBy, reconcile, markSeen, cityProgress,
  entryFor,
} from '../js/roma/roma.js';
import { CATALOGUE, STAGE_XP } from '../js/roma/catalogue.js';
import { STAGES, stageFor } from '../js/gamify.js';

const FIRST = CATALOGUE[0];      // casa-romuli, 200
const SECOND = CATALOGUE[1];     // ovile, 600

/* ============================================================ unlocked === */

test('nothing is built before the first threshold', () => {
  assert.deepEqual(unlockedAt(0), []);
  assert.deepEqual(unlockedAt(FIRST.xp - 1), []);
});

test('a building appears exactly on its threshold', () => {
  assert.deepEqual(unlockedAt(FIRST.xp), [FIRST.id]);
});

test('unlocking is cumulative and in catalogue order', () => {
  const built = unlockedAt(SECOND.xp);
  assert.deepEqual(built, [FIRST.id, SECOND.id]);
});

test('the whole city is standing at the capstone', () => {
  assert.equal(unlockedAt(CATALOGUE.at(-1).xp).length, CATALOGUE.length);
});

test('the city can only ever grow', () => {
  /* PLAN's rule is that nothing is ever taken away, so more XP must never
     mean fewer buildings. */
  let previous = 0;
  for (let xp = 0; xp <= CATALOGUE.at(-1).xp; xp += 250) {
    const count = unlockedAt(xp).length;
    assert.ok(count >= previous, `${xp} XP lost a building`);
    previous = count;
  }
});

/* ============================================================== stages === */

test('stageAt agrees with gamify, at every threshold', () => {
  /* The two used to carry their own numbers. If this ever fails, the stage
     name has drifted away from the skyline again. */
  for (const [i, threshold] of STAGE_XP.entries()) {
    assert.equal(stageAt(threshold), i);
    assert.equal(stageFor(threshold).index, i, STAGES[i].name);
  }
});

test('Roma Quadrata starts at nought, not at the first hut', () => {
  /* She is in the founding era from the moment she opens the app; the hut
     arrives a couple of hundred XP into it. */
  assert.equal(stageAt(0), 0);
  assert.equal(STAGE_XP[0], 0);
});

test('a stage begins with its own first building', () => {
  for (let stage = 1; stage < STAGE_XP.length; stage++) {
    const first = CATALOGUE.find(e => e.stage === stage);
    assert.equal(STAGE_XP[stage], first.xp, `stage ${stage} starts elsewhere`);
    assert.equal(stageAt(first.xp), stage);
    assert.equal(stageAt(first.xp - 1), stage - 1, 'the stage turns one XP early');
  }
});

/* ================================================= the teaser (nextAt) === */

test('the first building is the first thing teased', () => {
  const next = nextAt(0);
  assert.equal(next.entry.id, FIRST.id);
  assert.equal(next.remaining, FIRST.xp);
  assert.equal(next.progress, 0);
  assert.equal(next.from, 0);
});

test('progress runs from the previous threshold to the next', () => {
  /* This is what makes the teaser a construction site instead of a
     silhouette: it moves a little after every lesson. */
  const half = FIRST.xp + (SECOND.xp - FIRST.xp) / 2;
  const next = nextAt(half);
  assert.equal(next.entry.id, SECOND.id);
  assert.equal(next.progress, 0.5);
  assert.equal(next.remaining, SECOND.xp - half);
});

test('progress rises monotonically and never leaves 0..1', () => {
  let last = -1;
  let lastId = null;
  for (let xp = 0; xp < CATALOGUE.at(-1).xp; xp += 137) {
    const next = nextAt(xp);
    assert.ok(next.progress >= 0 && next.progress <= 1, `${xp} XP gave ${next.progress}`);
    if (next.entry.id === lastId) {
      assert.ok(next.progress >= last, `progress went backwards at ${xp} XP`);
    }
    last = next.progress;
    lastId = next.entry.id;
  }
});

test('there is nothing left to tease once the city is finished', () => {
  assert.equal(nextAt(CATALOGUE.at(-1).xp), null);
  assert.equal(nextAt(999999), null);
});

test('the teased building is never one that already exists', () => {
  for (const xp of [0, 200, 3999, 4000, 26500, 50001]) {
    const next = nextAt(xp);
    if (!next) continue;
    assert.ok(!unlockedAt(xp).includes(next.entry.id), `${xp} XP teases a built building`);
  }
});

/* ============================================================ by lesson == */

test('a lesson reports what it built', () => {
  const { buildings, stageCrossed } = unlockedBy(0, 700);
  assert.deepEqual(buildings.map(b => b.id), [FIRST.id, SECOND.id]);
  assert.equal(stageCrossed, null, 'stage 1 was already the starting stage');
});

test('a lesson that built nothing says so', () => {
  const { buildings, stageCrossed } = unlockedBy(210, 240);
  assert.deepEqual(buildings, []);
  assert.equal(stageCrossed, null);
});

test('crossing into a new stage is reported separately', () => {
  const forum = CATALOGUE.find(e => e.stage === 1);
  const { buildings, stageCrossed } = unlockedBy(forum.xp - 100, forum.xp);
  assert.deepEqual(buildings.map(b => b.id), [forum.id]);
  assert.deepEqual(stageCrossed, { from: 0, to: 1 });
});

test('a lesson is counted on the XP either side, not on the stored list', () => {
  /* The stored list can be wrong; these two numbers cannot. */
  const { buildings } = unlockedBy(FIRST.xp, SECOND.xp);
  assert.deepEqual(buildings.map(b => b.id), [SECOND.id]);
});

/* ============================================================ new since == */

test('newSince is everything past the watermark', () => {
  const fresh = newSince({ seenXp: FIRST.xp }, SECOND.xp);
  assert.deepEqual(fresh.map(e => e.id), [SECOND.id]);
});

test('newSince spans several lessons if she has not looked', () => {
  /* The watermark is not per lesson: four buildings ago still counts as new
     if she has not opened the city since. */
  assert.equal(newSince({ seenXp: 0 }, CATALOGUE[3].xp).length, 4);
});

test('a city she has already seen has nothing new in it', () => {
  assert.deepEqual(newSince({ seenXp: 5000 }, 5000), []);
});

test('markSeen moves the watermark and touches nothing else', () => {
  const roma = { unlocked: ['casa-romuli'], stage: 0, seenXp: 100 };
  const after = markSeen(roma, 4200);
  assert.equal(after.seenXp, 4200);
  assert.deepEqual(after.unlocked, ['casa-romuli']);
  assert.equal(roma.seenXp, 100, 'markSeen must not mutate');
});

/* =========================================================== reconcile === */

test('a fresh profile reconciles to an empty city', () => {
  const city = reconcile({ unlocked: [], seenXp: 0 }, 0);
  assert.deepEqual(city.unlocked, []);
  assert.equal(city.stage, 0);
  assert.equal(city.changed, false);
});

test('XP wins when the cache has too few buildings', () => {
  /* The failure that must never cost her anything: a write that did not land. */
  const city = reconcile({ unlocked: [], stage: 0, seenXp: 0 }, SECOND.xp);
  assert.deepEqual(city.unlocked, [FIRST.id, SECOND.id]);
  assert.equal(city.changed, true, 'the drift should be reported');
});

test('XP wins when the cache has too many buildings', () => {
  /* And the other direction, which would otherwise show a building she has
     not earned and then take it away — worse than never showing it. */
  const city = reconcile(
    { unlocked: CATALOGUE.map(e => e.id), stage: 4, seenXp: 0 },
    FIRST.xp,
  );
  assert.deepEqual(city.unlocked, [FIRST.id]);
  assert.equal(city.stage, 0);
  assert.equal(city.changed, true);
});

test('a correct cache is left alone and reports no drift', () => {
  const good = reconcile({ unlocked: [FIRST.id], stage: 0, seenXp: 0 }, FIRST.xp);
  assert.equal(good.changed, false);
  const again = reconcile(good, FIRST.xp);
  assert.equal(again.changed, false, 'reconcile must be idempotent');
});

test('reconcile survives a missing or half-written blob', () => {
  for (const broken of [undefined, {}, { unlocked: null }, { seenXp: 'x' }]) {
    const city = reconcile(broken, FIRST.xp);
    assert.deepEqual(city.unlocked, [FIRST.id], `failed on ${JSON.stringify(broken)}`);
    assert.equal(typeof city.stage, 'number');
  }
});

test('a watermark ahead of the XP is pulled back', () => {
  /* A restored backup from a profile with more XP would otherwise mark
     everything as already seen, and she would never get an unlock moment. */
  assert.equal(reconcile({ seenXp: 99999 }, 4000).seenXp, 4000);
});

test('reconcile hands back only storable fields plus the drift flag', () => {
  const city = reconcile({}, 1000);
  assert.deepEqual(Object.keys(city).sort(), ['changed', 'seenXp', 'stage', 'unlocked']);
});

/* ============================================================== counts === */

test('cityProgress counts what is standing', () => {
  assert.deepEqual(cityProgress(0), { built: 0, total: 25, fraction: 0 });
  const all = cityProgress(CATALOGUE.at(-1).xp);
  assert.equal(all.built, 25);
  assert.equal(all.fraction, 1);
});

test('entryFor finds a building and shrugs at a typo', () => {
  assert.equal(entryFor('casa-romuli').latin, 'Casa Romuli');
  assert.equal(entryFor('casa-romvli'), undefined);
});

/* ====================================================== the render path == */

/* These are not about the unlock rules — they exercise `render.js` against a
   stub context, because a missing import in there throws only when a browser
   actually paints, and nothing else in the suite reaches it. One did. */

test('the static scene paints, with a building under construction', async () => {
  const { drawStatic, drawScaffold } = await import('../js/roma/render.js');
  const { painter } = await import('../js/roma/engine.js');
  const { BY_ID: catalogue } = await import('../js/roma/catalogue.js');

  const ops = [];
  const ctx = {
    fillStyle: null,
    globalAlpha: 1,
    fillRect: (...a) => ops.push(a),
    createLinearGradient: () => ({ addColorStop() {} }),
    save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
  };
  const g = painter(ctx, 1);
  drawStatic(g, ['casa-romuli', 'ovile', 'ara'], { progress: { ara: 0.4 } });

  assert.ok(ops.length > 1000, 'a whole scene should be thousands of rectangles');
  assert.equal(g.emitters.length, 0, 'a half-built altar must not burn');

  drawScaffold(g, catalogue.forum, 0.5);
  assert.ok(ops.length > 1000);
});

test('scaffolding appears only while a building is going up', async () => {
  const { drawScaffold } = await import('../js/roma/render.js');
  const { painter } = await import('../js/roma/engine.js');
  const { BY_ID: catalogue } = await import('../js/roma/catalogue.js');

  const run = progress => {
    const ops = [];
    const ctx = {
      fillStyle: null, globalAlpha: 1, fillRect: (...a) => ops.push(a),
      save() {}, restore() {},
    };
    drawScaffold(painter(ctx, 1), catalogue.forum, progress);
    return ops.length;
  };

  assert.equal(run(0), 0, 'nothing has started');
  assert.ok(run(0.5) > 0, 'work in progress');
  assert.equal(run(1), 0, 'finished buildings do not keep their scaffolding');
});

test('a finished altar burns and an unfinished one does not', async () => {
  const { drawBuildings } = await import('../js/roma/render.js');
  const { painter } = await import('../js/roma/engine.js');

  const emittersAt = progress => {
    const ctx = {
      fillStyle: null, globalAlpha: 1, fillRect() {},
      save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
    };
    const g = painter(ctx, 1);
    drawBuildings(g, ['ara'], { progress: { ara: progress } });
    return g.emitters.length;
  };

  assert.equal(emittersAt(1), 1);
  assert.equal(emittersAt(0.6), 0, 'a half-built altar has no fire to register');
});
