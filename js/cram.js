/* cram.js — being ready by Friday.

   Every classic algorithm — Pimsleur, SM-2, FSRS — optimises for "remember
   forever with least effort". A schoolkid needs "be solid on chapters 4-5 by
   the eleventh", which is a different problem: there is a deadline, the scope
   is fixed, and after it passes none of it matters as much again.

   Pure arithmetic, like schedule.js, and deliberately separate from it: the
   normal intervals should stay readable without the exam logic tangled in.
   Nothing here touches storage or the DOM. */

import { studyDay } from './schedule.js';

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Three clean recalls on three separate days, in each direction. */
export const DEFAULT_TARGET_RECALLS = 3;

/**
 * With the test today there are no days left to spread revision over, so the
 * word simply keeps coming back inside the session. PLAN section 2.6: "with
 * the test tomorrow, everything collapses to within-session spacing".
 */
export const SAME_DAY_INTERVAL_MS = 10 * 60 * 1000;

const DIRECTIONS = ['fwd', 'rev'];

/** A test, with the defaults filled in. `date` is a local YYYY-MM-DD. */
export function makeTest({
  id, title, date, lists = [],
  targetRecalls = DEFAULT_TARGET_RECALLS,
  directions = 'both',
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw new Error(`bad test date: ${date}`);
  return { id, title, date, lists: [...lists], targetRecalls, directions };
}

/** Which directions this test examines. Both, because that is how she is examined. */
export function directionsOf(test) {
  return test.directions === 'both' ? DIRECTIONS : [test.directions];
}

const toDate = day => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Whole days from today to the test. Negative once it has passed. */
export function daysLeft(test, now = Date.now()) {
  return Math.round((toDate(test.date) - toDate(studyDay(now))) / DAY_MS);
}

/** A test still ahead of her — on the day itself included. */
export function isActive(test, now = Date.now()) {
  return daysLeft(test, now) >= 0;
}

/**
 * The test the app should be organising itself around: the soonest one still
 * ahead. More than one can exist; only the nearest deadline shapes a lesson.
 */
export function activeTest(tests = [], now = Date.now()) {
  return tests
    .filter(test => isActive(test, now))
    .sort((a, b) => daysLeft(a, now) - daysLeft(b, now))[0] ?? null;
}

/** Is this card's word in the test's chapters? */
export function inScope(card, test) {
  return card.lists?.some(list => test.lists.includes(list)) ?? false;
}

/**
 * How many clean recalls the word still owes, per direction and in total.
 *
 * This is the number the whole readiness display rests on, which is why
 * schedule.js is strict about what earns a clean day in the first place.
 */
export function recallsNeeded(card, test) {
  const needed = { fwd: 0, rev: 0, total: 0 };
  for (const dir of directionsOf(test)) {
    needed[dir] = Math.max(0, test.targetRecalls - card.cleanDays[dir].length);
    needed.total += needed[dir];
  }
  return needed;
}

export function isReady(card, test) {
  return recallsNeeded(card, test).total === 0;
}

/**
 * Shorten an interval so it cannot reach past the test date.
 *
 *     interval = clamp(floor(daysLeft / recallsStillNeeded), 1 day, normal)
 *
 * Never *lengthens* anything: a word she already knows keeps its normal
 * interval, and a word out of scope is untouched. Once the date passes the
 * cramming stops of its own accord and the boxes carry on from wherever they
 * reached — nothing is lost.
 */
export function compress(normalMs, card, test, now = Date.now()) {
  if (!test || !isActive(test, now) || !inScope(card, test)) return normalMs;

  const needed = recallsNeeded(card, test).total;
  if (needed === 0) return normalMs;

  const left = daysLeft(test, now);
  if (left <= 0) return Math.min(normalMs, SAME_DAY_INTERVAL_MS);

  const days = Math.max(1, Math.floor(left / needed));
  return Math.min(normalMs, days * DAY_MS);
}

/**
 * A due card's place in the queue while a test is running: in scope first,
 * then the weakest word, then the longest-waiting.
 *
 * "Weakest" is counted per direction rather than per word, so a word she can
 * recognise but not produce ranks as badly as one she barely knows — which is
 * exactly right, because the exam asks both ways.
 */
export function rankKey(card, test, now = Date.now()) {
  return {
    inScope: inScope(card, test) ? 0 : 1,
    needed: -recallsNeeded(card, test).total,
    overdue: card.dueAt === null ? -Infinity : now - Date.parse(card.dueAt),
  };
}

/**
 * Directions of this word she has not managed *once* yet.
 *
 * The breadth-before-depth measure: on a vocabulary test, partial credit across
 * forty words beats mastery of twenty, so when time runs short the goal drops
 * from "three clean recalls each way" to "one clean recall each way, for
 * everything" — and only then back to three.
 */
export function breadthNeeded(card, test) {
  return directionsOf(test)
    .filter(dir => card.cleanDays[dir].length === 0)
    .length;
}

/**
 * Sort comparator built from rankKey: weakest-first, most overdue to break ties.
 *
 * In `breadth` mode a word that has never been managed in some direction
 * outranks one that is merely part-way to three — which is a different order
 * from plain weakest-first, and the one that scores better when Friday is too
 * close to finish properly.
 */
export function byWeakestFirst(test, now = Date.now(), { breadth = false } = {}) {
  return (a, b) => {
    const ka = rankKey(a, test, now);
    const kb = rankKey(b, test, now);
    if (ka.inScope !== kb.inScope) return ka.inScope - kb.inScope;

    if (breadth) {
      const ba = breadthNeeded(a, test);
      const bb = breadthNeeded(b, test);
      if (ba !== bb) return bb - ba;
    }

    return (ka.needed - kb.needed) || (kb.overdue - ka.overdue);
  };
}

/* ========================================================== readiness ==== */

/**
 * How long one retrieval costs her, in seconds: the anticipation gap, typing an
 * answer, and reading the reveal. A tunable guess rather than a measurement —
 * PLAN section 8 expects the readiness numbers to be retuned against a real
 * mark, and this is the constant to turn.
 */
export const SECONDS_PER_RECALL = 12;

/**
 * Everything the readiness panel needs, for one test.
 *
 * @param {Map<string,object>} cards   the profile
 * @param {Map<string,object>} words   the corpus
 * @param {object} test
 * @param {number} [now]
 */
export function readiness(cards, words, test, now = Date.now()) {
  const scope = [...words.entries()].filter(([, word]) => inScope(word, test));
  const dirs = directionsOf(test);

  const counts = { total: scope.length, ready: 0, solidFwdOnly: 0, solidRevOnly: 0, shaky: 0, notStarted: 0 };
  const remaining = { fwd: 0, rev: 0, total: 0 };
  let longestRun = 0;   // the most clean days any single word still owes

  for (const [id] of scope) {
    const card = cards.get(id);

    if (!card) {
      counts.notStarted++;
      for (const dir of dirs) remaining[dir] += test.targetRecalls;
      remaining.total += dirs.length * test.targetRecalls;
      longestRun = Math.max(longestRun, test.targetRecalls);
      continue;
    }

    const needed = recallsNeeded(card, test);
    for (const dir of dirs) remaining[dir] += needed[dir];
    remaining.total += needed.total;
    longestRun = Math.max(longestRun, ...dirs.map(dir => needed[dir]));

    if (needed.total === 0) counts.ready++;
    else if (needed.fwd === 0 && needed.rev > 0) counts.solidFwdOnly++;
    else if (needed.rev === 0 && needed.fwd > 0) counts.solidRevOnly++;
    else counts.shaky++;
  }

  const left = daysLeft(test, now);

  return {
    test,
    ...counts,
    remaining,
    daysLeft: left,
    /* Which side is further behind, and so what the panel should offer to
       practise. Null when the two are level or nothing is owed. */
    weakest: remaining.fwd === remaining.rev ? null : (remaining.fwd > remaining.rev ? 'fwd' : 'rev'),
    minutesPerDay: minutesPerDay(remaining.total, left),
    /* A word cannot earn two clean days in one day, so if any word still owes
       more clean days than there are days left, three-recall readiness is out
       of reach however long she practises — and the lesson switches to breadth
       before depth, saying so on screen rather than reordering in silence. */
    feasible: longestRun <= Math.max(0, left),
  };
}

/**
 * Minutes a day to be ready in time.
 *
 * The load is *recalls per day*, not recalls: a word can earn only one clean
 * day per direction per day, so six recalls owed over six days is one touch a
 * day, not six today. An estimate that ignored that would tell her she is fine
 * three days before she is.
 */
export function minutesPerDay(remainingRecalls, left) {
  if (remainingRecalls <= 0) return 0;
  const days = Math.max(1, left);
  return Math.max(1, Math.round((remainingRecalls / days) * SECONDS_PER_RECALL / 60));
}

