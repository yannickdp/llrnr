/* Tests for the scheduler, driven by a fake clock.

   PLAN Phase 1 item 3 asks for exactly one thing to be proven: that a word
   really does come back at 5s, 25s, 2m, 10m and then tomorrow. That is the
   first test below; the rest guard the transitions around it. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newCard, present, review, isDue, overdueBy, isOneWay, missingDirection,
  MICRO_STEPS_MS, BOX_DAYS, DAY_START_HOUR,
} from '../js/schedule.js';

/** A clock that only moves when told to. */
function fakeClock(start = '2026-09-04T15:00:00') {
  let t = new Date(start).getTime();
  return {
    get now() { return t; },
    advance(ms) { t += ms; return t; },
    toDay(iso) { return new Date(iso).toLocaleDateString('sv-SE'); },
  };
}

const S = 1000, MIN = 60 * S, DAY = 24 * 60 * MIN;
const word = { term: 'mater', lists: ['latin-ch01'] };

/** Wait exactly as long as the card asks, then answer. */
function answerWhenDue(card, grade, clock, direction = 'fwd') {
  const due = Date.parse(card.dueAt);
  assert.ok(due >= clock.now, 'a card must never be scheduled into the past');
  clock.advance(due - clock.now);
  assert.ok(isDue(card, clock.now));
  return review(card, { grade, direction, now: clock.now });
}

/* ===================================================== the ladder ======== */

test('a new word comes back at 5s, 25s, 2m, 10m, then tomorrow', () => {
  const clock = fakeClock();
  let card = newCard(word, { now: clock.now });

  assert.equal(card.phase, 'new');
  assert.ok(isDue(card, clock.now), 'a new word is available immediately');

  ({ card } = present(card, { now: clock.now }));
  assert.equal(card.phase, 'acquire');

  const waits = [];
  for (let step = 0; step < MICRO_STEPS_MS.length; step++) {
    const before = clock.now;
    const result = answerWhenDue(card, 'correct', clock);
    waits.push(clock.now - before);
    card = result.card;
  }

  assert.deepEqual(waits, [5 * S, 25 * S, 2 * MIN, 10 * MIN]);

  /* Clearing the 10-minute step graduates it into the boxes. */
  assert.equal(card.phase, 'retain');
  assert.equal(card.box, 1);

  const due = new Date(card.dueAt);
  assert.equal(clock.toDay(card.dueAt), '2026-09-05', 'due tomorrow, not in 24 hours');
  assert.equal(due.getHours(), DAY_START_HOUR);
});

test('the whole ladder fits inside one lesson', () => {
  const total = MICRO_STEPS_MS.reduce((a, b) => a + b, 0);
  assert.ok(total <= 15 * MIN, `${total}ms of ladder must fit a 15-minute lesson`);
});

test('a wrong answer in acquire goes back to step 1, not further', () => {
  const clock = fakeClock();
  let { card } = present(newCard(word, { now: clock.now }), { now: clock.now });

  ({ card } = answerWhenDue(card, 'correct', clock));
  ({ card } = answerWhenDue(card, 'correct', clock));
  assert.equal(card.micro, 2);

  const { card: after, outcome } = answerWhenDue(card, 'wrong', clock);
  assert.equal(outcome, 'reset');
  assert.equal(after.micro, 0);
  assert.equal(after.phase, 'acquire', 'a slip in acquire costs nothing lasting');
  assert.equal(Date.parse(after.dueAt) - clock.now, MICRO_STEPS_MS[0]);
});

test('an almost in acquire repeats the same step', () => {
  const clock = fakeClock();
  let { card } = present(newCard(word, { now: clock.now }), { now: clock.now });
  ({ card } = answerWhenDue(card, 'correct', clock));
  assert.equal(card.micro, 1);

  const { card: after, outcome } = answerWhenDue(card, 'almost', clock);
  assert.equal(outcome, 'repeated');
  assert.equal(after.micro, 1);
  assert.equal(Date.parse(after.dueAt) - clock.now, MICRO_STEPS_MS[1]);
  assert.equal(after.slips, 1);
});

/* ======================================================= the boxes ======= */

/**
 * Walk a word from new to a given box, answering everything correctly.
 * Alternating direction by default, so it arrives proven both ways round —
 * `oneWay` keeps it to a single direction, which is the interesting case.
 */
function toBox(box, clock, { oneWay = false } = {}) {
  let asked = 0;
  const dir = () => (oneWay ? 'fwd' : (asked++ % 2 ? 'rev' : 'fwd'));

  let { card } = present(newCard(word, { now: clock.now }), { now: clock.now });
  for (let i = 0; i < MICRO_STEPS_MS.length; i++) {
    ({ card } = answerWhenDue(card, 'correct', clock, dir()));
  }
  while (card.box < box) ({ card } = answerWhenDue(card, 'correct', clock, dir()));
  return card;
}

test('the boxes are 1, 3, 7, 21 and 60 days', () => {
  const clock = fakeClock();
  let card = toBox(1, clock);
  const gaps = [];

  for (let i = 0; i < BOX_DAYS.length - 1; i++) {
    /* Measured from the moment she answers, which answerWhenDue has just
       advanced the clock to — not from before the wait. */
    ({ card } = answerWhenDue(card, 'correct', clock));
    gaps.push(Math.round((Date.parse(card.dueAt) - clock.now) / DAY));
  }

  /* Rounded, because each hop also lands on the 04:00 boundary. */
  assert.deepEqual(gaps, [3, 7, 21, 60]);
});

test('clearing box 5 marks the word learned and stops scheduling it', () => {
  const clock = fakeClock();
  const card = toBox(5, clock);
  assert.deepEqual(card.dirOk, { fwd: true, rev: true }, 'proven both ways round');

  const { card: after, outcome } = answerWhenDue(card, 'correct', clock, 'rev');

  assert.equal(outcome, 'learned');
  assert.equal(after.phase, 'learned');
  assert.equal(after.dueAt, null);
  assert.equal(isDue(after, clock.now + 100 * DAY), false);
});

test('an almost holds the box and asks again tomorrow', () => {
  const clock = fakeClock();
  const card = toBox(3, clock);
  const { card: after, outcome } = answerWhenDue(card, 'almost', clock);

  assert.equal(outcome, 'held');
  assert.equal(after.box, 3, 'an almost neither promotes nor demotes');
  assert.equal(clock.toDay(after.dueAt), clock.toDay(new Date(clock.now + DAY).toISOString()));
});

/* ============================================ the repair, and the drop === */

test('a forgotten word drops into acquire in the current session', () => {
  const clock = fakeClock();
  const card = toBox(4, clock);
  const { card: after, outcome } = answerWhenDue(card, 'wrong', clock);

  assert.equal(outcome, 'dropped');
  assert.equal(after.phase, 'acquire');
  assert.equal(after.micro, 0);
  assert.equal(
    Date.parse(after.dueAt) - clock.now, MICRO_STEPS_MS[0],
    'it must come back in five seconds, not tomorrow — that is the point',
  );
});

test('a dropped word re-enters the boxes at box 1', () => {
  const clock = fakeClock();
  let card = toBox(4, clock);
  ({ card } = answerWhenDue(card, 'wrong', clock));

  for (let i = 0; i < MICRO_STEPS_MS.length; i++) {
    ({ card } = answerWhenDue(card, 'correct', clock));
  }
  assert.equal(card.phase, 'retain');
  assert.equal(card.box, 1, 'the days of evidence are gone, so the boxes restart');
});

test('a learned word that is somehow missed drops back like any other', () => {
  const clock = fakeClock();
  let card = toBox(5, clock);
  ({ card } = answerWhenDue(card, 'correct', clock));
  assert.equal(card.phase, 'learned');

  const { card: after, outcome } = review(card, { grade: 'wrong', now: clock.now });
  assert.equal(outcome, 'dropped');
  assert.equal(after.phase, 'acquire');
});

/* ========================================================= the rules ===== */

test('day-scale reviews land on the day boundary, whatever time she practised', () => {
  const late = fakeClock('2026-09-04T23:30:00');
  const early = fakeClock('2026-09-04T07:00:00');

  const a = toBox(1, late);
  const b = toBox(1, early);
  assert.equal(new Date(a.dueAt).getHours(), DAY_START_HOUR);
  assert.equal(new Date(b.dueAt).getHours(), DAY_START_HOUR);
});

test('a card is never scheduled into the past', () => {
  const clock = fakeClock();
  let card = toBox(1, clock);
  for (const grade of ['correct', 'almost', 'wrong', 'correct', 'correct']) {
    ({ card } = review(card, { grade, now: clock.now }));
    if (card.dueAt !== null) assert.ok(Date.parse(card.dueAt) > clock.now, grade);
  }
});

test('review never mutates the card it was given', () => {
  const clock = fakeClock();
  const card = toBox(2, clock);
  const before = structuredClone(card);
  review(card, { grade: 'wrong', now: clock.now });
  assert.deepEqual(card, before);
});

test('counters follow the answers', () => {
  const clock = fakeClock();
  let { card } = present(newCard(word, { now: clock.now }), { now: clock.now });
  assert.equal(card.seen, 1, 'the presentation counts as having seen it');

  ({ card } = answerWhenDue(card, 'correct', clock));
  ({ card } = answerWhenDue(card, 'almost', clock));
  ({ card } = answerWhenDue(card, 'wrong', clock));

  assert.equal(card.seen, 4);
  assert.equal(card.correct, 1);
  assert.equal(card.slips, 1);
});

test('a new word cannot be reviewed before it has been presented', () => {
  const card = newCard(word, { now: Date.now() });
  assert.throws(() => review(card, { grade: 'correct' }), /must be presented/);
});

test('an unknown grade is refused rather than guessed at', () => {
  const clock = fakeClock();
  const card = toBox(1, clock);
  assert.throws(() => review(card, { grade: 'good', now: clock.now }), /unknown grade/);
});

test('overdueBy orders the queue by how late a card is', () => {
  const clock = fakeClock();
  const stale = { ...newCard(word), dueAt: new Date(clock.now - 3 * DAY).toISOString() };
  const fresh = { ...newCard(word), dueAt: new Date(clock.now - 1 * MIN).toISOString() };
  const learned = { ...newCard(word), dueAt: null };

  const queue = [fresh, learned, stale].sort((a, b) => overdueBy(b, clock.now) - overdueBy(a, clock.now));
  assert.deepEqual(queue, [stale, fresh, learned], 'most overdue first, learned last');
});

test('a card carries the shape the store expects', () => {
  const card = newCard({ term: 'mater', lists: ['latin-ch01', 'latin-ch07'] });
  assert.deepEqual(Object.keys(card).sort(), [
    'box', 'cleanDays', 'correct', 'dirOk', 'dueAt', 'lastSlip', 'lists',
    'micro', 'phase', 'seen', 'slips', 'term',
  ]);
  assert.deepEqual(card.cleanDays, { fwd: [], rev: [] });
  assert.deepEqual(card.dirOk, { fwd: false, rev: false });
  assert.deepEqual(card.lastSlip, { fwd: null, rev: null });
});

/* ==================================================== both directions ==== */

test('boxes climb on whatever direction was tested — no stalling at box 2', () => {
  /* The trap PLAN section 2.4 names: a run of one-way lessons must never leave
     every word stuck mid-ladder with no visible cause. */
  const clock = fakeClock();
  const card = toBox(5, clock, { oneWay: true });

  assert.equal(card.box, 5);
  assert.deepEqual(card.dirOk, { fwd: true, rev: false });
});

test('a word proven only one way parks at box 5 instead of being learned', () => {
  const clock = fakeClock();
  const card = toBox(5, clock, { oneWay: true });
  const { card: after, outcome } = answerWhenDue(card, 'correct', clock, 'fwd');

  assert.equal(outcome, 'parked');
  assert.equal(after.phase, 'retain', 'not learned — she cannot produce it yet');
  assert.equal(after.box, 5);
  assert.equal(isOneWay(after), true);
  assert.equal(missingDirection(after), 'rev');
});

test('a parked word keeps coming back rather than going quiet', () => {
  const clock = fakeClock();
  let card = toBox(5, clock, { oneWay: true });
  ({ card } = answerWhenDue(card, 'correct', clock, 'fwd'));

  assert.notEqual(card.dueAt, null);
  const days = (Date.parse(card.dueAt) - clock.now) / DAY;
  assert.ok(days > 30 && days < 70, `parked words return occasionally, not in ${days} days`);
});

test('the missing direction is what releases a parked word', () => {
  const clock = fakeClock();
  let card = toBox(5, clock, { oneWay: true });
  ({ card } = answerWhenDue(card, 'correct', clock, 'fwd'));
  assert.equal(isOneWay(card), true);

  const { card: after, outcome } = answerWhenDue(card, 'correct', clock, 'rev');
  assert.equal(outcome, 'learned');
  assert.equal(after.phase, 'learned');
  assert.equal(isOneWay(after), false);
  assert.equal(missingDirection(after), null);
});

test('an almost does not release a parked word', () => {
  const clock = fakeClock();
  let card = toBox(5, clock, { oneWay: true });
  ({ card } = answerWhenDue(card, 'correct', clock, 'fwd'));

  const { card: after } = answerWhenDue(card, 'almost', clock, 'rev');
  assert.equal(after.dirOk.rev, false, 'a near miss is not proof she can produce it');
  assert.equal(isOneWay(after), true);
});

test('isOneWay only marks words that have got all the way to box 5', () => {
  const clock = fakeClock();
  assert.equal(isOneWay(toBox(3, clock, { oneWay: true })), false,
    'a word still climbing is not "one-way", it is just unfinished');
});
