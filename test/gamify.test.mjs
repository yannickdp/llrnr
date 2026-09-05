/* Tests for XP, stages and the streak.

   The first one is the one that matters: XP must not be payable by answering
   the same word repeatedly, or the app teaches her to farm it. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  XP, STAGES, stageFor, xpForResults, advanceStreak, goalMetToday, awardLesson, weekKey,
} from '../js/gamify.js';
import { emptyProgress } from '../js/store.js';

const AT = (day, hour = 15) =>
  new Date(`2026-09-${day}T${String(hour).padStart(2, '0')}:00:00`).getTime();

const results = (over = {}) => ({
  presented: 0, answered: 0, correct: 0,
  graduated: 0, promoted: 0, held: 0, dropped: 0, learned: 0, parked: 0,
  droppedWords: [], graduatedWords: [], learnedWords: [], heldBack: 0,
  ...over,
});

/* ================================================================ xp ===== */

test('answering pays nothing on its own', () => {
  /* Forty correct answers, nothing moved: a word answered four times in ten
     minutes must not be worth four times anything. */
  assert.equal(xpForResults(results({ answered: 40, correct: 40 })), XP.lesson);
});

test('lasting progress is what pays', () => {
  assert.equal(xpForResults(results({ answered: 1, graduated: 1 })), XP.graduated + XP.lesson);
  assert.equal(xpForResults(results({ answered: 1, promoted: 2 })), XP.promoted * 2 + XP.lesson);
  assert.equal(xpForResults(results({ answered: 1, learned: 1 })), XP.learned + XP.lesson);
});

test('a lesson with no answers earns nothing at all', () => {
  assert.equal(xpForResults(results()), 0, 'opening and closing a lesson is not work');
});

test('mistakes never cost XP', () => {
  const bad = results({ answered: 10, correct: 2, dropped: 5, held: 3 });
  assert.ok(xpForResults(bad) >= 0);
  assert.equal(xpForResults(bad), XP.lesson, 'a lost box is re-earnable, so nothing is deducted');
});

test('parking a one-way word pays nothing extra', () => {
  assert.equal(xpForResults(results({ answered: 1, parked: 3 })), XP.lesson,
    'it climbed no box; the promotion into box 5 was already paid for');
});

/* ============================================================ stages ===== */

test('everyone starts at Roma Quadrata', () => {
  const at = stageFor(0);
  assert.equal(at.stage.name, 'Roma Quadrata');
  assert.equal(at.index, 0);
  assert.equal(at.next.name, 'Regnum');
});

test('a stage is reached exactly at its threshold', () => {
  for (const [i, stage] of STAGES.entries()) {
    assert.equal(stageFor(stage.xp).index, i, stage.name);
    if (i > 0) assert.equal(stageFor(stage.xp - 1).index, i - 1, `just below ${stage.name}`);
  }
});

test('progress within a stage is a fraction of the way to the next', () => {
  const half = STAGES[0].xp + (STAGES[1].xp - STAGES[0].xp) / 2;
  const at = stageFor(half);
  assert.equal(at.fraction, 0.5);
  assert.equal(at.xpToNext, STAGES[1].xp - half);
});

test('the last stage is complete, not stuck at zero', () => {
  const at = stageFor(STAGES.at(-1).xp + 5000);
  assert.equal(at.stage.name, 'Roma Aeterna');
  assert.equal(at.next, null);
  assert.equal(at.fraction, 1);
  assert.equal(at.xpToNext, 0);
});

test('the stages are the Latin ones PLAN names', () => {
  assert.deepEqual(STAGES.map(s => s.name),
    ['Roma Quadrata', 'Regnum', 'Res Publica', 'Imperium', 'Roma Aeterna']);
});

/* ============================================================ streak ===== */

const fresh = () => emptyProgress().streak;

test('a first lesson starts the streak at one', () => {
  const { streak, extended } = advanceStreak(fresh(), AT('04'));
  assert.equal(streak.current, 1);
  assert.equal(streak.best, 1);
  assert.equal(extended, true);
});

test('practising on consecutive days extends it', () => {
  let streak = fresh();
  for (const day of ['04', '05', '06']) ({ streak } = advanceStreak(streak, AT(day)));
  assert.equal(streak.current, 3);
  assert.equal(streak.best, 3);
});

test('a second lesson the same day changes nothing', () => {
  let streak = fresh();
  ({ streak } = advanceStreak(streak, AT('04', 9)));
  const { streak: after, extended, doubled } = advanceStreak(streak, AT('04', 20));

  assert.equal(after.current, 1);
  assert.equal(extended, false);
  assert.equal(doubled, false, 'the double is the *first* lesson of the day only');
});

test('one busy day is forgiven, and costs the week its freeze', () => {
  let streak = fresh();
  ({ streak } = advanceStreak(streak, AT('07')));   // Monday
  ({ streak } = advanceStreak(streak, AT('08')));   // Tuesday
  assert.equal(streak.freezes, 1);

  /* Nothing on Wednesday; back on Thursday. */
  const { streak: after, frozen } = advanceStreak(streak, AT('10'));
  assert.equal(frozen, true);
  assert.equal(after.current, 3, 'a thirty-day streak must survive one busy Wednesday');
  assert.equal(after.freezes, 0);
});

test('a second missed day in the same week breaks it', () => {
  let streak = fresh();
  ({ streak } = advanceStreak(streak, AT('07')));
  ({ streak } = advanceStreak(streak, AT('09')));   // frozen
  assert.equal(streak.freezes, 0);

  const { streak: after, frozen } = advanceStreak(streak, AT('11'));
  assert.equal(frozen, false);
  assert.equal(after.current, 1);
  assert.equal(after.best, 2, 'the best is remembered even when the run ends');
});

test('two missed days break it even with a freeze in hand', () => {
  let streak = fresh();
  ({ streak } = advanceStreak(streak, AT('07')));
  const { streak: after } = advanceStreak(streak, AT('10'));
  assert.equal(after.current, 1, 'a freeze covers one day, not a holiday');
});

test('the freeze comes back the following week', () => {
  let streak = fresh();
  ({ streak } = advanceStreak(streak, AT('07')));
  ({ streak } = advanceStreak(streak, AT('09')));
  assert.equal(streak.freezes, 0);

  /* The next Monday is a new week. */
  ({ streak } = advanceStreak(streak, AT('14')));
  assert.equal(streak.freezes, 1);
  assert.notEqual(weekKey(AT('09')), weekKey(AT('14')));
});

test('the daily goal is met once a lesson is finished that day', () => {
  let streak = fresh();
  assert.equal(goalMetToday(streak, AT('04')), false);
  ({ streak } = advanceStreak(streak, AT('04')));
  assert.equal(goalMetToday(streak, AT('04', 22)), true);
  assert.equal(goalMetToday(streak, AT('05')), false);
});

/* =========================================================== awarding ==== */

test('the first lesson of the day is worth double', () => {
  const progress = emptyProgress();
  const earned = results({ answered: 6, graduated: 2 });

  const first = awardLesson(progress, earned, AT('04', 9));
  assert.equal(first.gained, xpForResults(earned) * 2);
  assert.equal(first.doubled, true);

  const second = awardLesson({ ...progress, streak: first.streak }, earned, AT('04', 19));
  assert.equal(second.gained, xpForResults(earned));
  assert.equal(second.doubled, false);
});

test('awarding adds to what she already had', () => {
  const progress = { ...emptyProgress(), xp: 500 };
  const { xp } = awardLesson(progress, results({ answered: 1, promoted: 1 }), AT('04'));
  assert.equal(xp, 500 + (XP.promoted + XP.lesson) * 2);
});

test('a lesson that earned nothing is not announced as doubled', () => {
  const { gained, doubled } = awardLesson(emptyProgress(), results(), AT('04'));
  assert.equal(gained, 0);
  assert.equal(doubled, false, 'nothing doubled is still nothing');
});

test('awarding never mutates the progress it was given', () => {
  const progress = emptyProgress();
  const before = structuredClone(progress);
  awardLesson(progress, results({ answered: 3, learned: 1 }), AT('04'));
  assert.deepEqual(progress, before);
});
