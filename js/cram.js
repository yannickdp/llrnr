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

/** Sort comparator built from rankKey: weakest-first, most overdue to break ties. */
export function byWeakestFirst(test, now = Date.now()) {
  return (a, b) => {
    const ka = rankKey(a, test, now);
    const kb = rankKey(b, test, now);
    return (ka.inScope - kb.inScope)
      || (ka.needed - kb.needed)
      || (kb.overdue - ka.overdue);
  };
}
