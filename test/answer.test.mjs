/* Tests for answer matching and the clean-recall rule.

   Two separable questions live here: what counts as right (answer.js), and
   what an answer proves about the word (schedule.js's evidence recording).
   The second is the foundation of the whole readiness display in Phase 3, so
   it is worth being strict about. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, withinOneEdit, promptFor, MIN_ALMOST_LENGTH } from '../js/answer.js';
import { newCard, present, review, studyDay, MAX_CLEAN_DAYS } from '../js/schedule.js';
import { parseList } from '../js/parse.js';

const word = (line = 'mater | matris, f. | moeder / mama') => parseList(line).words[0];
const pool = lines => new Map(parseList(lines).words.map(w => [w.id, w]));

const grade = (typed, w = word(), direction = 'fwd', p = null) =>
  check({ typed, word: w, direction, pool: p });

/* ========================================================== forgiving ==== */

test('case, accents and stray spaces are forgiven', () => {
  const w = word('unus | una, unum | één');
  assert.equal(grade('één', w), 'correct');
  assert.equal(grade('  EEN  ', w), 'correct');
  assert.equal(grade('Één', w), 'correct');
});

test('any of the alternatives counts', () => {
  assert.equal(grade('moeder'), 'correct');
  assert.equal(grade('mama'), 'correct');
});

test('an empty answer is wrong, not almost', () => {
  assert.equal(grade(''), 'wrong');
  assert.equal(grade('   '), 'wrong');
  assert.equal(grade(null), 'wrong');
});

test('a different word is wrong', () => {
  assert.equal(grade('vader'), 'wrong');
});

/* ============================================================= almost ==== */

test('one letter out is almost', () => {
  assert.equal(grade('moder'), 'almost', 'a dropped letter');
  assert.equal(grade('moederr'), 'almost', 'a doubled letter');
  assert.equal(grade('moedar'), 'almost', 'a mistyped letter');
  assert.equal(grade('moadar'), 'wrong', 'two edits is not almost');
});

test('almost applies to the Latin side too', () => {
  assert.equal(grade('mate', word(), 'rev'), 'almost');
  assert.equal(grade('mater', word(), 'rev'), 'correct');
});

test('short words are never almost — one letter is the whole word', () => {
  /* ad/ab, et/ex, sed/sub: calling these "almost" would tell her she nearly
     had it when she wrote a different word entirely. */
  const ad = word('ad | naar');
  assert.equal(grade('ab', ad, 'rev'), 'wrong');
  assert.equal(grade('ad', ad, 'rev'), 'correct');
  assert.ok(MIN_ALMOST_LENGTH >= 4);
});

test('withinOneEdit handles insertion, deletion, substitution and neither', () => {
  assert.equal(withinOneEdit('mater', 'mater'), true);
  assert.equal(withinOneEdit('mater', 'mate'), true);
  assert.equal(withinOneEdit('mate', 'mater'), true);
  assert.equal(withinOneEdit('mater', 'mator'), true);
  assert.equal(withinOneEdit('mater', 'motor'), false);
  assert.equal(withinOneEdit('mater', 'ma'), false);
  assert.equal(withinOneEdit('', 'a'), true);
});

test('an exact match of another accepted word beats a near miss', () => {
  const w = word('mater | matris, f. | moeder / moede');
  assert.equal(grade('moede', w), 'correct', 'never grade an exact answer as almost');
});

/* ==================================================== reverse collisions == */

test('in reverse, any word the prompt also means is accepted', () => {
  const p = pool('dicere | dico | zeggen\nnarrare | narro | vertellen / zeggen');
  const [dicere, narrare] = [...p.values()];

  assert.equal(promptFor(dicere, 'rev'), 'zeggen');
  assert.equal(grade('narrare', dicere, 'rev', p), 'correct',
    'both are right answers to "zeggen"; the asked card takes the credit');
});

test('the collision rule follows the prompt, not the pair of words', () => {
  const p = pool('dicere | dico | zeggen\nnarrare | narro | vertellen / zeggen');
  const [, narrare] = [...p.values()];

  /* narrare is prompted with its *first* translation, "vertellen" — and dicere
     does not mean that. Accepting it because the two words overlap on some
     other translation would mark a genuinely wrong answer right. */
  assert.equal(promptFor(narrare, 'rev'), 'vertellen');
  assert.equal(grade('dicere', narrare, 'rev', p), 'wrong');
});

test('a near miss on a shared translation is still almost', () => {
  const p = pool('dicere | dico | zeggen\nnarrare | narro | vertellen / zeggen');
  const [dicere] = [...p.values()];
  assert.equal(grade('narrre', dicere, 'rev', p), 'almost');
});

test('without the pool, only the card asked is accepted', () => {
  const p = pool('dicere | dico | zeggen\nnarrare | narro | zeggen');
  const [dicere] = [...p.values()];
  assert.equal(grade('narrare', dicere, 'rev'), 'wrong');
});

/* ====================================================== clean recalls ==== */

const AT = (day, hour = 15) => new Date(`2026-09-${day}T${String(hour).padStart(2, '0')}:00:00`).getTime();

/** A card sitting in retain, so each review is one independent question. */
function retained(now) {
  let { card } = present(newCard({ term: 'mater', lists: [] }, { now }), { now });
  card = { ...card, phase: 'retain', box: 2, micro: 0 };
  return card;
}

test('a correct first answer records a clean day for that direction only', () => {
  const now = AT('04');
  const { card } = review(retained(now), { grade: 'correct', direction: 'fwd', now });

  assert.deepEqual(card.cleanDays.fwd, [studyDay(now)]);
  assert.deepEqual(card.cleanDays.rev, [], 'the other way round is unproven');
  assert.deepEqual(card.dirOk, { fwd: true, rev: false });
});

test('an almost is not a clean recall', () => {
  const now = AT('04');
  const { card } = review(retained(now), { grade: 'almost', direction: 'fwd', now });

  assert.deepEqual(card.cleanDays.fwd, []);
  assert.equal(card.dirOk.fwd, false, 'a near miss does not prove she can produce it');
  assert.equal(card.lastSlip.fwd, studyDay(now));
});

test('a hinted answer is not a clean recall either', () => {
  const now = AT('04');
  const { card } = review(retained(now), { grade: 'correct', direction: 'fwd', hint: true, now });

  assert.deepEqual(card.cleanDays.fwd, []);
  assert.equal(card.dirOk.fwd, true, 'she did produce it, just not unaided');
});

test('the same day twice counts once', () => {
  let card = retained(AT('04'));
  ({ card } = review(card, { grade: 'correct', direction: 'fwd', now: AT('04', 9) }));
  ({ card } = review(card, { grade: 'correct', direction: 'fwd', now: AT('04', 20) }));

  assert.equal(card.cleanDays.fwd.length, 1, 'three clean *days*, not three answers');
});

test('getting it wrong first means the day does not count, however often she then gets it right', () => {
  let card = retained(AT('05'));
  ({ card } = review(card, { grade: 'wrong', direction: 'fwd', now: AT('05', 9) }));
  ({ card } = review(card, { grade: 'correct', direction: 'fwd', now: AT('05', 9) }));
  ({ card } = review(card, { grade: 'correct', direction: 'fwd', now: AT('05', 10) }));

  assert.deepEqual(card.cleanDays.fwd, [],
    'the ladder repairs the word; it does not manufacture evidence');

  /* The next day is a fresh start. */
  ({ card } = review(card, { grade: 'correct', direction: 'fwd', now: AT('06') }));
  assert.deepEqual(card.cleanDays.fwd, [studyDay(AT('06'))]);
});

test('slipping later the same day takes the day back', () => {
  let card = retained(AT('05'));
  ({ card } = review(card, { grade: 'correct', direction: 'fwd', now: AT('05', 9) }));
  assert.equal(card.cleanDays.fwd.length, 1);

  ({ card } = review(card, { grade: 'wrong', direction: 'fwd', now: AT('05', 20) }));
  assert.deepEqual(card.cleanDays.fwd, [],
    'a word she got wrong at eight is not one she knew at nine');
});

test('a slip one way round leaves the other way alone', () => {
  let card = retained(AT('05'));
  ({ card } = review(card, { grade: 'correct', direction: 'fwd', now: AT('05', 9) }));
  ({ card } = review(card, { grade: 'wrong', direction: 'rev', now: AT('05', 10) }));

  assert.equal(card.cleanDays.fwd.length, 1, 'she still knows it that way round');
  assert.deepEqual(card.cleanDays.rev, []);
});

test('three clean days in a direction is three separate days', () => {
  let card = retained(AT('04'));
  for (const day of ['04', '06', '09']) {
    ({ card } = review(card, { grade: 'correct', direction: 'rev', now: AT(day) }));
  }
  assert.equal(card.cleanDays.rev.length, 3);
});

test('a session running past midnight is one day, not two', () => {
  let card = retained(AT('05'));
  ({ card } = review(card, { grade: 'correct', direction: 'fwd', now: AT('05', 23) }));
  /* 01:00 the next morning is still that evening's practice. */
  ({ card } = review(card, { grade: 'correct', direction: 'fwd', now: AT('06', 1) }));

  assert.equal(card.cleanDays.fwd.length, 1,
    'a late Sunday session must not hand her two of her three days');
});

test('clean days are capped, keeping the most recent', () => {
  let card = retained(AT('01'));
  const last = String(MAX_CLEAN_DAYS + 3).padStart(2, '0');
  for (let day = 1; day <= MAX_CLEAN_DAYS + 3; day++) {
    const now = AT(String(day).padStart(2, '0'));
    ({ card } = review(card, { grade: 'correct', direction: 'fwd', now }));
  }
  assert.equal(card.cleanDays.fwd.length, MAX_CLEAN_DAYS);
  assert.equal(card.cleanDays.fwd.at(-1), studyDay(AT(last)));
});

test('recording evidence never mutates the card it was given', () => {
  const now = AT('04');
  const card = retained(now);
  const before = structuredClone(card);
  review(card, { grade: 'correct', direction: 'fwd', now });
  assert.deepEqual(card, before);
});
