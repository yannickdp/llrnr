/* Tests for the coach.

   Three of these are the ones that matter, and they are all about *placement*
   rather than about art — because placement is where this feature fails
   (PLAN-ROMA section 9):

   - "the coach is nowhere near the anticipation gap", which reads ui.js
     itself, because there is no other guard on the one rule that would quietly
     wreck the part of the app that actually teaches;
   - "no motto gives the card away", the answer-leak guard;
   - "every rank threshold is a building's XP", which is what makes the rank-up
     and the unlock one event instead of two, and which would break silently
     the next time the XP table is retuned.

   The drawing runs against a recording stub context, the same trick
   roma-engine.test.mjs uses. It tracks `translate` as well as `fillRect`,
   because the bob and the victory bounce are translations and a bust that
   bounces out of its own canvas is exactly the bug worth catching. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  RANK_XP, SHOW_ODDS, WAIT_MS,
  rankAt, rankUpBetween, moodFor, mayShow, leaks, pickMessage, castFor,
} from '../js/coach/coach.js';
import { MSG, RANKS, UNLOCK } from '../js/coach/messages.js';
import {
  BUST, TYPES, drawBust, fitBust, burst, stepBurst, drawBurst,
} from '../js/coach/characters.js';
import { painter } from '../js/roma/engine.js';
import { C } from '../js/roma/palette.js';
import { CATALOGUE, STAGE_XP } from '../js/roma/catalogue.js';

const fsRead = path => readFileSync(new URL(path, import.meta.url), 'utf8');

/* ------------------------------------------------------------ the stub ---- */

function fakeCtx() {
  const ops = [];
  const stack = [];
  let ty = 0;
  return {
    ops,
    fillStyle: null,
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    fillRect(x, y, w, h) {
      ops.push({ op: 'fillRect', x, y: y + ty, w, h, fill: this.fillStyle, alpha: this.globalAlpha });
    },
    clearRect(x, y, w, h) { ops.push({ op: 'clearRect', x, y, w, h }); },
    translate(dx, dy) { ty += dy; },
    save() { stack.push(ty); ops.push({ op: 'save' }); },
    restore() { ty = stack.pop() ?? 0; ops.push({ op: 'restore' }); },
    setTransform(...a) { ops.push({ op: 'setTransform', a }); },
  };
}

const rects = ctx => ctx.ops.filter(o => o.op === 'fillRect');

/** The box every rectangle drawn so far fits inside, at scale 1. */
function bounds(ctx) {
  const all = rects(ctx);
  if (all.length === 0) return null;
  return {
    x0: Math.min(...all.map(r => r.x)),
    y0: Math.min(...all.map(r => r.y)),
    x1: Math.max(...all.map(r => r.x + r.w)),
    y1: Math.max(...all.map(r => r.y + r.h)),
  };
}

/** A run of numbers that is not a lottery: pinned, so a draw is a decision. */
const feed = values => {
  let i = 0;
  return () => values[i++ % values.length];
};

const MOODS = ['good', 'improve', 'perfect'];

/* ================================================================ ranks == */

test('every rank threshold is a building, so a rank-up is never its own event', () => {
  /* The reason the rank-up rides on the unlock card. If this ever fails, the
     Results screen has a rank-up with no building under it and PLAN-ROMA §9's
     "one event, not three" is quietly false. */
  const buildingXp = new Set(CATALOGUE.map(entry => entry.xp));
  for (const xp of RANK_XP.slice(1)) {
    assert.ok(buildingXp.has(xp), `${xp} XP is a rank but not a building`);
  }
});

test('the rank ladder is the city stages, not a second ladder of its own', () => {
  /* PLAN section 1 trimmed the app to one progress scale. The spec's
     120/350/750/1600/3200 would be a third, and would be exhausted in two
     weeks — so these numbers must come from the catalogue and nowhere else. */
  assert.deepEqual([...RANK_XP], [
    0, CATALOGUE[0].xp, STAGE_XP[1], STAGE_XP[2], STAGE_XP[3], STAGE_XP[4],
  ]);
  assert.equal(RANK_XP.length, RANKS.length);
  assert.equal(RANKS.length, TYPES.length);

  for (let i = 1; i < RANK_XP.length; i++) {
    assert.ok(RANK_XP[i] > RANK_XP[i - 1], `rank ${i} does not cost more than ${i - 1}`);
  }
});

test('she starts as nobody, and stops being nobody in the first lesson', () => {
  assert.equal(rankAt(0), 0, 'Servus at zero');
  assert.equal(RANKS[0].id, 'servus');
  assert.equal(rankAt(CATALOGUE[0].xp - 1), 0);
  assert.equal(rankAt(CATALOGUE[0].xp), 1, 'the first hut makes her a Gladiator');
  /* One finished lesson pays 10 for the lesson plus 25 for a graduated word,
     so the first threshold is inside the first session by design. */
  assert.ok(CATALOGUE[0].xp <= 35, 'Servus should not outlast the first lesson');
});

test('rank is read at the threshold, not one XP past it', () => {
  for (let i = 0; i < RANK_XP.length; i++) {
    assert.equal(rankAt(RANK_XP[i]), i);
    if (i + 1 < RANK_XP.length) assert.equal(rankAt(RANK_XP[i + 1] - 1), i);
  }
  assert.equal(rankAt(RANK_XP.at(-1) + 99999), RANK_XP.length - 1, 'Imperator is the top');
});

test('a threshold fires exactly once, and needs nothing stored to do it', () => {
  const at = RANK_XP[2];

  assert.equal(rankUpBetween(at - 1, at).to, 2);
  assert.equal(rankUpBetween(at, at + 500), null, 'already there');
  assert.equal(rankUpBetween(at, at), null);
  assert.equal(rankUpBetween(at + 1, at - 1), null, 'XP going backwards is not a rank-up');
});

test('a lesson big enough to skip a rank announces the one she landed on', () => {
  const crossed = rankUpBetween(0, RANK_XP[3]);
  assert.equal(crossed.from, 0);
  assert.equal(crossed.to, 3);
  assert.equal(crossed.rank, RANKS[3]);
  assert.equal(crossed.line, UNLOCK[RANKS[3].id]);
});

test('every rank above Servus has something to say when she reaches it', () => {
  for (const rank of RANKS.slice(1)) {
    const line = UNLOCK[rank.id];
    assert.ok(line?.nl, `${rank.id} has no unlock line`);
  }
  assert.equal(UNLOCK.servus, undefined, 'arriving where you started is not an unlock');
});

/* ================================================================= mood == */

test('almost and wrong are the same face, because the reveal does the correcting', () => {
  assert.equal(moodFor({ grade: 'almost' }), 'improve');
  assert.equal(moodFor({ grade: 'wrong' }), 'improve');
  /* Even on a repeat or a multiple choice: a miss is a miss. */
  assert.equal(moodFor({ grade: 'wrong', mode: 'choice', repeat: true }), 'improve');
});

test('a clean recall is the only thing that earns the flourish', () => {
  assert.equal(moodFor({ grade: 'correct', mode: 'typed', repeat: false }), 'perfect');
  assert.equal(moodFor({ grade: 'correct', mode: 'choice' }), 'good',
    'the answer was one of four on the screen');
  assert.equal(moodFor({ grade: 'correct', mode: 'typed', repeat: true }), 'good',
    'the fourth sighting in ten minutes is not a clean recall');
});

/* ============================================================== cadence == */

test('sixty appearances a lesson is wallpaper, so most answers get nothing', () => {
  const never = () => 0.99;
  assert.equal(mayShow({ mood: 'good', outcome: 'advanced', random: never }), false);
  assert.equal(mayShow({ mood: 'improve', outcome: 'repeated', random: never }), false);

  const always = () => 0;
  assert.equal(mayShow({ mood: 'good', outcome: 'advanced', random: always }), true);
  assert.ok(SHOW_ODDS > 0 && SHOW_ODDS <= 0.5, 'scarcity is the mechanism');
});

test('a clean recall and a drop-back always get one', () => {
  const never = () => 0.99;
  assert.equal(mayShow({ mood: 'perfect', outcome: 'advanced', random: never }), true);
  assert.equal(mayShow({ mood: 'improve', outcome: 'dropped', random: never }), true);
});

test('roughly one answer in four, over a lesson-sized run', () => {
  /* A real lesson is about sixty answers; this is what the odds actually do to
     one, so the number in the plan and the number on screen are the same. */
  let shown = 0;
  let roll = 0;
  const random = () => ((roll = (roll + 0.17) % 1), roll);
  for (let i = 0; i < 600; i++) {
    if (mayShow({ mood: 'good', outcome: 'advanced', random })) shown++;
  }
  assert.ok(Math.abs(shown / 600 - SHOW_ODDS) < 0.05, `showed ${shown} of 600`);
});

/* ========================================================= the mottos ==== */

test('the wait is a cap, and a short one', () => {
  /* Sixty answers times the demo's five seconds is five minutes of a
     ten-minute lesson. The number is the fix, so the number is the test. */
  assert.ok(WAIT_MS <= 1500, `${WAIT_MS}ms is long enough to eat the lesson`);
});

test('there are enough messages to last more than a week', () => {
  /* The one honest weakness, and the one fix: 21 messages is the whole
     repertoire inside two lessons. This is data, so more is always cheap. */
  const total = MOODS.reduce((n, mood) => n + MSG[mood].length, 0);
  assert.ok(total >= 55, `only ${total} messages — see PLAN-ROMA §9 on decay`);

  for (const mood of MOODS) {
    assert.ok(MSG[mood].length >= 15, `${mood} has only ${MSG[mood].length}`);
  }
});

test('every motto is a complete quotation', () => {
  /* A Latin line with no translation is a decoration; the translation is the
     entire reason the mottos are worth carrying. */
  for (const mood of MOODS) {
    for (const m of MSG[mood]) {
      assert.ok(m.nl, `a ${mood} message has no Dutch`);
      if (m.la) assert.ok(m.tr, `"${m.la}" has no translation`);
      if (m.tr) assert.ok(m.la, `"${m.tr}" translates nothing`);
    }
  }
  for (const [id, m] of Object.entries(UNLOCK)) {
    assert.ok(m.nl, `${id} unlock has no Dutch`);
    if (m.la) assert.ok(m.tr, `${id} unlock motto has no translation`);
  }
});

test('no motto gives the card away', () => {
  /* The plan's own example, and it is not hypothetical: "Repetitio mater
     studiorum" on the card for mater hands her the answer. */
  const mater = {
    term: 'mater', form: 'matris, f.', answer: 'moeder / mama',
    alternatives: ['moeder', 'mama'],
  };

  const latinLeak = MSG.improve.find(m => m.la === 'Repetitio mater studiorum');
  assert.ok(latinLeak, 'the motto this test is about has been edited away');
  assert.equal(leaks(latinLeak, mater), true);

  /* And the other way round: in the reverse direction the Dutch is the answer,
     so a Dutch collision leaks just as hard. */
  assert.equal(leaks({ nl: 'Herhaling is de moeder van de studie.' }, mater), true);
  assert.equal(leaks({ nl: 'Allez, goe bezig!' }, mater), false);
});

test('the guard ignores punctuation, case and accents', () => {
  const card = { term: 'Vici', form: null, answer: 'ik overwon', alternatives: [] };
  assert.equal(leaks({ nl: 'x', la: 'Veni, vidi, vici', tr: 'y' }, card), true);
});

test('a card with nothing on it cannot be leaked', () => {
  assert.equal(leaks(MSG.good[0], null), false);
});

test('picking never returns a message that leaks', () => {
  const card = {
    term: 'mater', form: 'matris, f.', answer: 'moeder / mama',
    alternatives: ['moeder', 'mama'],
  };
  for (const mood of MOODS) {
    for (let i = 0; i < 200; i++) {
      const picked = pickMessage(mood, card, { random: () => i / 200 });
      assert.equal(leaks(picked, card), false, `${mood}: "${picked.la ?? picked.nl}"`);
    }
  }
});

test('when every line collides the motto goes, not the coach', () => {
  /* A card built to collide with the whole pool — she still gets encouraged,
     just without a quotation attached. */
  const everything = {
    term: 'x',
    form: null,
    answer: [...new Set(
      MOODS.flatMap(m => MSG[m]).flatMap(m => [m.nl, m.la, m.tr]).join(' ')
        .toLowerCase().match(/[\p{L}\p{N}]+/gu),
    )].join(' '),
    alternatives: [],
  };

  const picked = pickMessage('good', everything, { random: () => 0 });
  assert.ok(picked.nl, 'she got nothing at all');
  assert.equal(picked.la, undefined, 'a colliding motto survived');
});

test('the same line is not said twice in a row', () => {
  const first = pickMessage('good', null, { random: () => 0 });
  const second = pickMessage('good', null, { random: () => 0, avoid: first });
  assert.notEqual(second, first);
});

/* =============================================================== cast ==== */

test('she only ever sees a Roman she has earned', () => {
  for (let rank = 0; rank < RANKS.length; rank++) {
    const allowed = new Set(TYPES.slice(0, rank + 1));
    for (let i = 0; i < 100; i++) {
      const drawn = castFor(rank, () => i / 100);
      assert.ok(allowed.has(drawn), `rank ${rank} produced ${drawn}`);
    }
  }
});

test('the pool grows but leans on the newest rank', () => {
  /* Old coaches stay in rotation — nothing is ever taken away — while
     advancement still has to be visible. */
  const counts = Object.fromEntries(TYPES.map(t => [t, 0]));
  for (let i = 0; i < 1000; i++) counts[castFor(5, () => i / 1000)]++;

  assert.ok(TYPES.every(t => counts[t] > 0), 'a rank she earned has vanished');
  for (let i = 1; i < TYPES.length; i++) {
    assert.ok(counts[TYPES[i]] > counts[TYPES[i - 1]],
      `${TYPES[i]} is no more likely than ${TYPES[i - 1]}`);
  }
});

test('a Servus draws a Servus and nothing else', () => {
  for (let i = 0; i < 20; i++) assert.equal(castFor(0, () => i / 20), 'servus');
});

/* =============================================================== art ===== */

test('every rank draws something, and it is a different something', () => {
  const shapes = new Map();
  for (const type of TYPES) {
    const ctx = fakeCtx();
    drawBust(painter(ctx, 1), type, { mood: 'good', motion: false });
    const drawn = rects(ctx);
    assert.ok(drawn.length > 50, `${type} drew only ${drawn.length} rectangles`);
    shapes.set(type, JSON.stringify(drawn.map(r => [r.x, r.y, r.w, r.h, r.fill])));
  }
  assert.equal(new Set(shapes.values()).size, TYPES.length,
    'two ranks are drawn identically');
});

test('an unknown coach is a mistake, not a blank canvas', () => {
  assert.throws(() => drawBust(painter(fakeCtx(), 1), 'consul'), /unknown coach/);
});

test('no bust ever draws outside the canvas it is given', () => {
  /* The bob, the breath and the victory bounce are all translations, and the
     canvas is cropped to `BUST` — so an arm raised one row too far would be
     silently guillotined on the phone and nowhere else. */
  for (const type of TYPES) {
    for (const mood of MOODS) {
      for (const flourish of [false, true]) {
        const ctx = fakeCtx();
        for (const t of [0, 0.3, 0.7, 1.1, 1.9, 3.3, 7.7]) {
          drawBust(painter(ctx, 1), type, { mood, t, talk: true, flourish, motion: true });
        }
        const box = bounds(ctx);
        const where = `${type}/${mood}${flourish ? '/flourish' : ''}`;
        assert.ok(box.x0 >= BUST.x, `${where} reaches left to ${box.x0}`);
        assert.ok(box.y0 >= BUST.y, `${where} reaches up to ${box.y0}`);
        assert.ok(box.x1 <= BUST.x + BUST.w, `${where} reaches right to ${box.x1}`);
        assert.ok(box.y1 <= BUST.y + BUST.h, `${where} reaches down to ${box.y1}`);
      }
    }
  }
});

test('the halo never paints over the face', () => {
  /* engine.js's bloom fills an opaque core for a lit window. The coach passes
     null for it, and if that ever regresses the eyes disappear behind a
     rectangle — which is why the argument exists at all. */
  const ctx = fakeCtx();
  drawBust(painter(ctx, 1), 'senator', { mood: 'good', motion: false });

  const opaqueHalo = rects(ctx).filter(r =>
    r.alpha === 1 && (r.fill === C.praise || r.fill === C.glow || r.fill === C.goldLite)
    && r.w >= 6 && r.h >= 10);
  assert.equal(opaqueHalo.length, 0, 'the aura was painted solid');
  assert.ok(rects(ctx).some(r => r.alpha < 1), 'there is no halo at all');
});

test('reduced motion means one paint is the whole picture', () => {
  /* PLAN-ROMA §8: render once and stop. If any pixel still depended on the
     clock, the static render would be a frozen frame of an animation rather
     than a composition, and the 200ms loop the demo ran would be back. */
  for (const type of TYPES) {
    const draw = t => {
      const ctx = fakeCtx();
      drawBust(painter(ctx, 1), type, {
        mood: 'perfect', t, talk: true, flourish: true, motion: false,
      });
      return JSON.stringify(rects(ctx));
    };
    assert.equal(draw(0), draw(12.5), `${type} still moves under reduced motion`);
  }
});

test('the mood is visible in the face, not only in the words', () => {
  const paint = mood => {
    const ctx = fakeCtx();
    drawBust(painter(ctx, 1), 'magister', { mood, motion: false });
    return JSON.stringify(rects(ctx));
  };
  assert.notEqual(paint('good'), paint('improve'), 'the brows and mouth do not move');
});

/* ---------------------------------------------------------- confetti ----- */

test('confetti is random on purpose, and burns out', () => {
  let parts = burst(feed([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]));
  assert.equal(parts.length, 26);
  assert.ok(parts.every(p => p.x === 32 && p.y === 24), 'it does not start at the head');

  /* Three seconds is past the longest life (1.4 + 0.8). */
  for (let i = 0; i < 60; i++) parts = stepBurst(parts, 0.05);
  assert.equal(parts.length, 0, 'confetti hangs in the air forever');
});

test('confetti fades rather than blinking out', () => {
  const ctx = fakeCtx();
  const parts = burst(() => 0.5);
  stepBurst(parts, 1.0);
  drawBurst(painter(ctx, 1), parts);
  assert.ok(rects(ctx).every(r => r.alpha < 1), 'no piece is fading');
});

/* ------------------------------------------------------------ canvas ----- */

test('the canvas is a bust, not a mostly empty square', () => {
  const canvas = { style: {}, width: 0, height: 0, getContext: () => fakeCtx() };
  fitBust(canvas, { scale: 2, dpr: 3 });

  assert.equal(canvas.width, BUST.w * 2 * 3);
  assert.equal(canvas.height, BUST.h * 2 * 3);
  assert.equal(canvas.style.width, `${BUST.w * 2}px`);
  assert.equal(canvas.style.height, `${BUST.h * 2}px`);
  assert.ok(BUST.w * BUST.h < 64 * 64 * 0.5, 'the crop is not saving anything');
});

test('the crop is applied by the transform, so the art keeps the demo grid', () => {
  const ctx = fakeCtx();
  const canvas = { style: {}, width: 0, height: 0, getContext: () => ctx };
  fitBust(canvas, { scale: 2, dpr: 1 });

  const set = ctx.ops.find(o => o.op === 'setTransform');
  assert.deepEqual(set.a, [1, 0, 0, 1, -BUST.x * 2, -BUST.y * 2]);
  assert.equal(ctx.imageSmoothingEnabled, false, 'the bust would be resampled soft');
});

/* ============================================================ the node ==== */

/* A DOM small enough to build a bubble in, the way roma-city.test.mjs stubs
   one to measure a canvas. `isConnected` is false throughout, which is exactly
   the guard `present` uses to decide there is nothing to animate — so these
   tests exercise the markup and start no loop. */
function stubElement(tag) {
  return {
    tag,
    className: '',
    textContent: '',
    children: [],
    attrs: {},
    style: {},
    isConnected: false,
    append(...nodes) { this.children.push(...nodes); },
    addEventListener() {},
    setAttribute(name, value) { this.attrs[name] = value; },
    get text() {
      return [this.textContent, ...this.children.map(c => c.text)].join(' ').trim();
    },
    find(className) {
      if (this.className.split(' ').includes(className)) return this;
      for (const child of this.children) {
        const hit = child.find?.(className);
        if (hit) return hit;
      }
      return null;
    },
  };
}

async function withDocument(run) {
  const previous = globalThis.document;
  globalThis.document = { createElement: stubElement };
  try {
    return await run();
  } finally {
    globalThis.document = previous;
  }
}

test('the coach comes back as one element, bust and bubble', async () => {
  const { createCoach } = await import('../js/coach/coach.js');

  await withDocument(() => {
    const coach = createCoach({ xp: RANK_XP[3], random: () => 0.99 });
    const node = coach.present({ mood: 'perfect', card: null });

    assert.match(node.className, /coach-perfect/);
    assert.ok(node.find('coach-bust'), 'no bust');
    assert.equal(node.find('coach-bust').attrs['aria-hidden'], 'true',
      'a screen reader should not be told there is a pixel Roman');
    assert.ok(node.find('coach-line').textContent, 'the coach said nothing');
    assert.ok(node.find('coach-rank').textContent, 'nobody is talking');
  });
});

test('the bust she sees is one she has earned, and the name matches it', async () => {
  const { createCoach } = await import('../js/coach/coach.js');

  await withDocument(() => {
    /* A Servus can only ever be a Servus, which makes the pairing checkable. */
    const coach = createCoach({ xp: 0, random: () => 0.5 });
    assert.equal(coach.character, 'servus');
    const node = coach.present({ mood: 'good' });
    assert.equal(node.find('coach-rank').textContent, RANKS[0].latin);
    assert.equal(node.find('coach-gloss').textContent, RANKS[0].dutch);
  });
});

test('setXp moves the rank without saying a word about it', async () => {
  const { createCoach } = await import('../js/coach/coach.js');

  await withDocument(() => {
    const coach = createCoach({ xp: 0, random: () => 0 });
    assert.equal(coach.rankIndex, 0);

    coach.setXp(RANK_XP[4]);
    assert.equal(coach.rankIndex, 4);

    /* No unlock line anywhere: a rank-up mid-lesson would collide with the
       stage crossing the Results screen already owns. */
    const node = coach.present({ mood: 'good' });
    for (const line of Object.values(UNLOCK)) {
      assert.ok(!node.text.includes(line.nl), `${line.nl} escaped into a lesson`);
    }
  });
});

test('a motto is shown whole or not at all', async () => {
  const { createCoach } = await import('../js/coach/coach.js');

  await withDocument(() => {
    const coach = createCoach({ xp: 0, random: () => 0 });
    const node = coach.present({ mood: 'good' });
    const motto = node.find('coach-motto');
    if (!motto) return;
    assert.match(node.find('coach-la').textContent, /^« .+ »$/);
    assert.ok(node.find('coach-tr').textContent, 'a motto with no translation');
  });
});

test('the rank-up names the rank she reached and shows that Roman', async () => {
  const { createCoach } = await import('../js/coach/coach.js');

  await withDocument(() => {
    const coach = createCoach({ xp: 0, random: () => 0.99 });

    assert.equal(coach.rankUp(0, RANK_XP[1] - 1), null, 'nothing crossed');

    const up = coach.rankUp(0, RANK_XP[2]);
    assert.equal(up.rank.id, RANKS[2].id);
    assert.equal(up.character, TYPES[2],
      'a rank-up is announced by the rank, not by a draw from the pool');
    assert.equal(up.message, UNLOCK[RANKS[2].id]);
  });
});

/* ========================================================= placement ===== */

test('the coach is nowhere near the anticipation gap', async () => {
  /* The one hard rule (PLAN-ROMA §9, PLAN §2.3), and the only one here with no
     runtime guard: the gap is prompt, four seconds of nothing, then she types.
     A motto on screen during a Latin retrieval task is a distraction and, with
     sixty of them in rotation, eventually the answer itself.

     So it is checked at the source, the way the city's module seam is: the
     coach may be touched in `paintReveal` and in nothing else. */
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../js/ui.js', import.meta.url), 'utf8');

  const bodyOf = name => {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} is gone from ui.js`);
    const next = source.indexOf('\n  function ', start + 1);
    return source.slice(start, next === -1 ? source.length : next);
  };

  for (const fn of ['paintQuestion', 'paintPresentation', 'paintWait']) {
    assert.doesNotMatch(bodyOf(fn), /coach\s*[.?]/,
      `${fn} touches the coach — that is the anticipation gap`);
  }
  assert.match(bodyOf('paintReveal'), /coach\.present\(/,
    'the coach has fallen out of the reveal beat');
});

test('the probe page imports modules that exist', () => {
  /* Nothing else loads coach-probe.html, and the city's equivalent stayed
     broken for two commits once for exactly that reason. A unit test cannot
     run the page; it can check that every module it reaches for is there. */
  const html = fsRead('./coach-probe.html');
  const imports = [...html.matchAll(/from\s+'([^']+)'/g)].map(m => m[1]);

  assert.ok(imports.length > 0, 'the probe imports nothing — has it been gutted?');
  for (const spec of imports) {
    assert.doesNotThrow(() => fsRead(spec),
      `the probe imports ${spec}, which does not exist`);
  }
});

test('the reveal never waits for the coach to finish', () => {
  /* "Concurrent, not additional": the Verder button is created, appended and
     focused before the coach is even asked for, and nothing about the coach
     can disable it. */
  const source = fsRead('../js/ui.js');
  const body = source.slice(source.indexOf('function paintReveal('));
  const button = body.indexOf("body.replaceChildren(card, go)");
  const coach = body.indexOf('coach.present(');

  assert.ok(button !== -1 && coach !== -1);
  assert.ok(button < coach, 'the coach is built before the way forward is on screen');
});

