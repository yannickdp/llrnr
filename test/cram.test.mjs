/* Tests for test-date mode: readiness counting, interval compression and
   weakest-first ordering, all against a fake clock. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeTest, activeTest, isActive, daysLeft, inScope, recallsNeeded, isReady,
  compress, byWeakestFirst, directionsOf, DAY_MS, SAME_DAY_INTERVAL_MS,
} from '../js/cram.js';
import { newCard } from '../js/schedule.js';

const AT = (day, hour = 15) =>
  new Date(`2026-09-${day}T${String(hour).padStart(2, '0')}:00:00`).getTime();

const exam = (over = {}) => makeTest({
  id: 't1', title: 'Latijn SO h. 4-5', date: '2026-09-11',
  lists: ['latin-ch04', 'latin-ch05'], ...over,
});

/** A retain card in scope, with the clean days given. */
function card({ fwd = [], rev = [], lists = ['latin-ch04'], box = 2, dueAt = AT('04') } = {}) {
  return {
    ...newCard({ term: 'mater', lists }, { now: AT('01') }),
    phase: 'retain', box,
    dueAt: new Date(dueAt).toISOString(),
    cleanDays: { fwd: [...fwd], rev: [...rev] },
    dirOk: { fwd: fwd.length > 0, rev: rev.length > 0 },
  };
}

/* ============================================================== tests ==== */

test('a test needs a real date', () => {
  assert.throws(() => makeTest({ id: 't', date: 'friday', lists: [] }), /bad test date/);
  assert.throws(() => makeTest({ id: 't', lists: [] }), /bad test date/);
});

test('a test examines both directions by default', () => {
  assert.deepEqual(directionsOf(exam()), ['fwd', 'rev']);
  assert.deepEqual(directionsOf(exam({ directions: 'rev' })), ['rev']);
});

test('days left counts whole days, and goes negative afterwards', () => {
  assert.equal(daysLeft(exam(), AT('04')), 7);
  assert.equal(daysLeft(exam(), AT('10')), 1);
  assert.equal(daysLeft(exam(), AT('11')), 0, 'the day itself');
  assert.equal(daysLeft(exam(), AT('12')), -1);
});

test('a test stops shaping anything once its date has passed', () => {
  assert.equal(isActive(exam(), AT('11')), true, 'still active on the day');
  assert.equal(isActive(exam(), AT('12')), false);
});

test('the nearest deadline is the one that shapes a lesson', () => {
  const soon = exam({ id: 'soon', date: '2026-09-08' });
  const later = exam({ id: 'later', date: '2026-09-20' });
  const past = exam({ id: 'past', date: '2026-09-01' });

  assert.equal(activeTest([later, soon, past], AT('04')).id, 'soon');
  assert.equal(activeTest([past], AT('04')), null);
  assert.equal(activeTest([], AT('04')), null);
});

test('scope follows the chapters, and a word in two chapters counts for either', () => {
  assert.equal(inScope(card({ lists: ['latin-ch04'] }), exam()), true);
  assert.equal(inScope(card({ lists: ['latin-ch01'] }), exam()), false);
  assert.equal(inScope(card({ lists: ['latin-ch01', 'latin-ch05'] }), exam()), true);
});

/* ========================================================== readiness ==== */

test('test-ready means three clean days in each direction', () => {
  const three = ['2026-09-01', '2026-09-02', '2026-09-03'];

  assert.equal(isReady(card({ fwd: three, rev: three }), exam()), true);
  assert.equal(isReady(card({ fwd: three, rev: ['2026-09-01'] }), exam()), false,
    'recognising it is not the same as being able to write it');
  assert.equal(isReady(card({ fwd: three }), exam()), false);
  assert.equal(isReady(card(), exam()), false);
});

test('the recalls still owed are counted per direction', () => {
  const needed = recallsNeeded(card({ fwd: ['2026-09-01', '2026-09-02'] }), exam());
  assert.deepEqual(needed, { fwd: 1, rev: 3, total: 4 });
});

test('a one-way test only counts the direction it examines', () => {
  const oneWay = exam({ directions: 'fwd' });
  const three = ['2026-09-01', '2026-09-02', '2026-09-03'];
  assert.equal(isReady(card({ fwd: three }), oneWay), true);
  assert.deepEqual(recallsNeeded(card({ fwd: three }), oneWay), { fwd: 0, rev: 0, total: 0 });
});

test('a higher target raises the bar', () => {
  const strict = exam({ targetRecalls: 5 });
  const three = ['2026-09-01', '2026-09-02', '2026-09-03'];
  assert.equal(recallsNeeded(card({ fwd: three, rev: three }), strict).total, 4);
});

/* ======================================================== compression ==== */

const NORMAL = 21 * DAY_MS;   // a box-4 interval

test('an interval is squeezed to fit the days remaining', () => {
  /* Seven days left, six recalls owed: one a day. */
  assert.equal(compress(NORMAL, card(), exam(), AT('04')), 1 * DAY_MS);

  /* Two recalls owed with seven days left can be spread further apart. */
  const nearlyThere = card({
    fwd: ['2026-09-01', '2026-09-02'], rev: ['2026-09-01', '2026-09-02'],
  });
  assert.equal(compress(NORMAL, nearlyThere, exam(), AT('04')), 3 * DAY_MS);
});

test('compression never lengthens an interval', () => {
  const short = 1 * DAY_MS;
  assert.equal(compress(short, card(), exam(), AT('04')), short);
});

test('a word already ready keeps its normal interval', () => {
  const three = ['2026-09-01', '2026-09-02', '2026-09-03'];
  const ready = card({ fwd: three, rev: three });
  assert.equal(compress(NORMAL, ready, exam(), AT('04')), NORMAL,
    'no point drilling what she can already do both ways');
});

test('a word out of scope is untouched', () => {
  assert.equal(compress(NORMAL, card({ lists: ['latin-ch01'] }), exam(), AT('04')), NORMAL);
});

test('with the test today everything collapses into the session', () => {
  assert.equal(compress(NORMAL, card(), exam(), AT('11')), SAME_DAY_INTERVAL_MS);
});

test('the day before, intervals are a single day at most', () => {
  assert.equal(compress(NORMAL, card(), exam(), AT('10')), 1 * DAY_MS);
});

test('after the test the normal intervals come straight back', () => {
  assert.equal(compress(NORMAL, card(), exam(), AT('12')), NORMAL,
    'nothing is lost — the boxes carry on from where they reached');
});

test('with no test at all nothing is compressed', () => {
  assert.equal(compress(NORMAL, card(), null, AT('04')), NORMAL);
});

/* ============================================================ ordering === */

test('weakest first: the word owing the most clean recalls goes first', () => {
  const now = AT('04');
  const almost = card({ fwd: ['2026-09-01', '2026-09-02'], rev: ['2026-09-01', '2026-09-02'] });
  const shaky = card({ fwd: ['2026-09-01'] });
  const untouched = card();

  const sorted = [almost, untouched, shaky].sort(byWeakestFirst(exam(), now));
  assert.deepEqual(sorted.map(c => recallsNeeded(c, exam()).total), [6, 5, 2]);
});

test('in-scope words come before everything else', () => {
  const now = AT('04');
  /* The out-of-scope word is weaker *and* more overdue, and still loses. */
  const outside = card({ lists: ['latin-ch01'], dueAt: AT('01') });
  const inside = card({ fwd: ['2026-09-01', '2026-09-02'], rev: ['2026-09-01', '2026-09-02'] });

  const sorted = [outside, inside].sort(byWeakestFirst(exam(), now));
  assert.equal(inScope(sorted[0], exam()), true);
});

test('among equals, the longest-waiting goes first', () => {
  const now = AT('06');
  const early = card({ dueAt: AT('02') });
  const late = card({ dueAt: AT('05') });

  const sorted = [late, early].sort(byWeakestFirst(exam(), now));
  assert.equal(sorted[0].dueAt, early.dueAt);
});
