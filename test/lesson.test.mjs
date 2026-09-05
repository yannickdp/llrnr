/* Tests for the lesson loop, driven by a fake clock.

   The interesting one is the last: a whole ten-minute lesson played out
   answer by answer, checking the things PLAN promises about a session — new
   words spread rather than front-loaded, ladders interleaved with reviews, and
   somewhere around 8-10 new words actually introduced. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLesson } from '../js/lesson.js';
import { parseList } from '../js/parse.js';
import { MICRO_STEPS_MS } from '../js/schedule.js';

const S = 1000, MIN = 60_000;
const START = new Date('2026-09-04T15:00:00').getTime();

const LIST = `
pater   | patris, m.   | vader
mater   | matris, f.   | moeder / mama
filius  | filii, m.    | zoon
filia   | filiae, f.   | dochter
frater  | fratris, m.  | broer
soror   | sororis, f.  | zus
puer    | pueri, m.    | jongen
puella  | puellae, f.  | meisje
vir     | viri, m.     | man
femina  | feminae, f.  | vrouw
domus   | domus, f.    | huis
liber   | libri, m.    | boek
`;

const corpus = (text = LIST) =>
  new Map(parseList(text, { listId: 'test' }).words.map(w => [w.id, w]));

/** A lesson with the randomness pinned, so option order is deterministic. */
const lesson = (opts = {}) =>
  createLesson({ words: corpus(), now: START, random: () => 0.5, ...opts });

/* ================================================== the opening move ==== */

test('a lesson with nothing learned yet opens by introducing a word', () => {
  const l = lesson();
  const step = l.next(START);
  assert.equal(step.kind, 'present');
  assert.ok(step.word.term);
});

test('next() is idempotent — asking twice shows the same step', () => {
  const l = lesson();
  assert.deepEqual(l.next(START), l.next(START));
});

test('a presented word enters the ladder five seconds later', () => {
  const l = lesson();
  l.next(START);
  l.acknowledge(START);

  assert.equal(l.next(START + 1 * S).kind, 'wait');
  const step = l.next(START + 5 * S);
  assert.equal(step.kind, 'ask');
  assert.equal(step.card.phase, 'acquire');
});

/* ================================================== first contact ======= */

test('the first check after a presentation is multiple choice, and only that one', () => {
  const l = lesson();
  l.next(START);
  l.acknowledge(START);

  const first = l.next(START + 5 * S);
  assert.equal(first.mode, 'choice');
  assert.equal(first.options.length, 4);
  assert.ok(first.options.includes(first.direction === 'fwd' ? first.word.answer : first.word.term),
    'the right answer must be among the options');

  l.answer(first.options[0], START + 5 * S);

  /* Whatever comes next for that word is typed, never multiple choice again. */
  let t = START + 5 * S;
  for (let i = 0; i < 6; i++) {
    const step = l.next(t);
    if (step.kind === 'ask' && step.id === first.id) {
      assert.equal(step.mode, 'typed');
      return;
    }
    t += 30 * S;
  }
  assert.fail('the word never came back');
});

test('a wrong multiple-choice answer still costs nothing lasting', () => {
  const l = lesson();
  l.next(START);
  l.acknowledge(START);

  const step = l.next(START + 5 * S);
  const wrong = step.options.find(o => o !== (step.direction === 'fwd' ? step.word.answer : step.word.term));
  const result = l.answer(wrong, START + 5 * S);

  assert.equal(result.grade, 'wrong');
  assert.equal(result.outcome, 'reset');
});

/* ======================================================== priority ====== */

test('a ladder repeat outranks a review that is far more overdue', () => {
  const words = corpus();
  const [ladderId, reviewId] = [...words.keys()];

  const cards = new Map([
    /* Three days late, but only a box review. */
    [reviewId, {
      term: words.get(reviewId).term, lists: [], phase: 'retain', micro: 0, box: 2,
      dueAt: new Date(START - 3 * 24 * 60 * MIN).toISOString(),
      cleanDays: { fwd: [], rev: [] }, seen: 4, correct: 4, slips: 0,
      dirOk: { fwd: true, rev: false },
    }],
    /* One second late, but mid-ladder. */
    [ladderId, {
      term: words.get(ladderId).term, lists: [], phase: 'acquire', micro: 1, box: 0,
      dueAt: new Date(START - 1 * S).toISOString(),
      cleanDays: { fwd: [], rev: [] }, seen: 2, correct: 1, slips: 0,
      dirOk: { fwd: false, rev: false },
    }],
  ]);

  const step = createLesson({ words, cards, now: START, random: () => 0.5 }).next(START);
  assert.equal(step.kind, 'ask');
  assert.equal(step.id, ladderId, 'the 5-second step is the one with a real deadline');
});

test('among reviews, the most overdue goes first', () => {
  const words = corpus();
  const ids = [...words.keys()];
  const card = (id, daysLate) => [id, {
    term: words.get(id).term, lists: [], phase: 'retain', micro: 0, box: 2,
    dueAt: new Date(START - daysLate * 24 * 60 * MIN).toISOString(),
    cleanDays: { fwd: [], rev: [] }, seen: 4, correct: 4, slips: 0,
    dirOk: { fwd: false, rev: false },
  }];

  const cards = new Map([card(ids[0], 1), card(ids[1], 9), card(ids[2], 4)]);
  const step = createLesson({ words, cards, now: START, random: () => 0.5 }).next(START);
  assert.equal(step.id, ids[1]);
});

/* ==================================================== the time box ====== */

test('the lesson ends when its time is up, mid-ladder or not', () => {
  const l = lesson({ minutes: 10 });
  l.next(START);
  l.acknowledge(START);

  /* The word presented at the start is long overdue by minute nine, so it is
     still being asked — and then the clock simply runs out. */
  assert.equal(l.next(START + 9 * MIN).kind, 'ask');
  assert.equal(l.next(START + 10 * MIN).kind, 'done');
  assert.equal(l.isFinished, true);
});

test('time left and progress track the clock', () => {
  const l = lesson({ minutes: 10 });
  assert.equal(l.timeLeftMs(START + 4 * MIN), 6 * MIN);
  assert.equal(l.elapsedFraction(START + 5 * MIN), 0.5);
  assert.equal(l.timeLeftMs(START + 30 * MIN), 0, 'never negative');
});

test('a lesson with no words at all finishes rather than hanging', () => {
  const l = createLesson({ words: new Map(), now: START });
  assert.equal(l.next(START).kind, 'done');
});

/* ================================================ pacing of new words === */

test('new words are spread through the lesson, not dealt out at the start', () => {
  const l = lesson({ minutes: 10, newPerLesson: 8 });

  /* Introduce one, then answer nothing: the second must not arrive at once. */
  l.next(START);
  l.acknowledge(START);

  const soon = l.next(START + 1 * S);
  assert.notEqual(soon.kind, 'present', 'a second new word so soon would front-load the lesson');
});

test('at most a few ladders run at once', () => {
  const l = lesson({ minutes: 10, newPerLesson: 8, maxInFlight: 2 });
  let t = START;

  for (let i = 0; i < 40; i++) {
    const step = l.next(t);
    if (step.kind === 'present') l.acknowledge(t);
    else if (step.kind === 'ask') l.answer('', t); // deliberately wrong: nothing graduates
    else if (step.kind === 'wait') t = step.untilMs;
    else break;
    t += 1 * S;

    const running = [...l.cards.values()].filter(c => c.phase === 'acquire').length;
    assert.ok(running <= 2, `${running} ladders at once`);
  }
});

/* ================================================== the whole lesson ==== */

/** Play a lesson through, answering every question correctly. */
function playPerfectly(l, { minutes = 10 } = {}) {
  let t = START;
  const events = [];
  const guard = 2000;

  for (let i = 0; i < guard; i++) {
    const step = l.next(t);

    if (step.kind === 'done') break;
    if (step.kind === 'wait') { t = step.untilMs; continue; }

    if (step.kind === 'present') {
      events.push({ t: t - START, kind: 'present', term: step.word.term });
      l.acknowledge(t);
    } else {
      const right = step.direction === 'fwd' ? step.word.translations[0] : step.word.term;
      const result = l.answer(right, t);
      assert.equal(result.grade, 'correct', `"${right}" should be accepted for ${step.word.term}`);
      events.push({ t: t - START, kind: 'ask', term: step.word.term, outcome: result.outcome });
    }
    t += 2 * S; // she takes a couple of seconds to answer
  }
  assert.ok(t - START <= minutes * MIN + 5 * S, 'the lesson must not run over');
  return events;
}

test('a full ten-minute lesson introduces 8-10 new words', () => {
  const l = lesson({ minutes: 10, newPerLesson: 8 });
  const events = playPerfectly(l);

  const presented = events.filter(e => e.kind === 'present').length;
  assert.ok(presented >= 6 && presented <= 10, `${presented} new words in ten minutes`);

  const results = l.results();
  assert.equal(results.presented, presented);
  assert.equal(results.correct, results.answered, 'every answer was right');
  assert.equal(results.dropped, 0);
});

test('nothing graduates inside a ten-minute lesson, because the ladder is longer', () => {
  /* 5s + 25s + 2m + 10m is 12m35s, so a word met at minute zero has its last
     step due after the lesson has ended. This is a consequence of PLAN's own
     numbers, not a bug — but it does mean a first lesson always reports zero
     words learned, and graduation XP is earned in the *next* session. */
  const l = lesson({ minutes: 10, newPerLesson: 8 });
  playPerfectly(l);
  assert.equal(l.results().graduated, 0);
  assert.ok([...l.cards.values()].every(c => c.phase === 'acquire'));
});

test('the next lesson picks those words up and graduates them', () => {
  const words = corpus();
  const first = createLesson({ words, minutes: 10, newPerLesson: 8, now: START, random: () => 0.5 });
  playPerfectly(first);

  /* Same cards, next day. The overdue ladder steps are served first. */
  const tomorrow = START + 20 * 60 * MIN;
  const second = createLesson({
    words, cards: first.cards, minutes: 10, newPerLesson: 8,
    now: tomorrow, random: () => 0.5,
  });

  let t = tomorrow;
  for (let i = 0; i < 200; i++) {
    const step = second.next(t);
    if (step.kind === 'done') break;
    if (step.kind === 'wait') { t = step.untilMs; continue; }
    if (step.kind === 'present') { second.acknowledge(t); continue; }
    second.answer(step.direction === 'fwd' ? step.word.translations[0] : step.word.term, t);
    t += 2 * S;
  }

  assert.ok(second.results().graduated >= 5,
    'the words left mid-ladder yesterday should clear it early today');
});

test('the phases interleave — reviews and presentations fill the ladder gaps', () => {
  const l = lesson({ minutes: 10, newPerLesson: 8 });
  const events = playPerfectly(l);

  /* No gap longer than a minute of doing nothing: the 2- and 10-minute waits
     in one word's ladder are filled with other words. */
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].t - events[i - 1].t;
    assert.ok(gap <= 60 * S, `${Math.round(gap / 1000)}s of dead time in the lesson`);
  }

  /* And the ladder really did run at its own pace rather than being rushed. */
  const byTerm = new Map();
  for (const e of events.filter(e => e.kind === 'ask')) {
    byTerm.set(e.term, [...(byTerm.get(e.term) ?? []), e.t]);
  }
  const laddered = [...byTerm.values()].find(times => times.length >= 3);
  assert.ok(laddered, 'at least one word should have been asked three times');
  assert.ok(laddered[1] - laddered[0] >= MICRO_STEPS_MS[1] - 2 * S);
});

test('the results tally counts what actually happened', () => {
  /* Fifteen minutes, the longest setting, so one word's whole ladder fits. */
  const l = lesson({ minutes: 15, newPerLesson: 4 });
  let t = START;

  /* Introduce one word, clear its ladder, then get it wrong tomorrow. */
  l.next(t); l.acknowledge(t);
  for (let i = 0; i < 4; i++) {
    const step = l.next(t = Date.parse(l.cards.values().next().value.dueAt));
    l.answer(step.direction === 'fwd' ? step.word.translations[0] : step.word.term, t);
  }

  const results = l.results();
  assert.equal(results.presented, 1);
  assert.equal(results.graduated, 1);
  assert.equal(results.graduatedWords.length, 1);
  assert.equal(results.answered, 4);
});

test('a dropped word is named in the results', () => {
  const words = corpus();
  const [id] = [...words.keys()];
  const cards = new Map([[id, {
    term: words.get(id).term, lists: [], phase: 'retain', micro: 0, box: 3,
    dueAt: new Date(START - MIN).toISOString(),
    cleanDays: { fwd: [], rev: [] }, seen: 9, correct: 8, slips: 1,
    dirOk: { fwd: true, rev: true },
  }]]);

  const l = createLesson({ words, cards, now: START, random: () => 0.5 });
  l.next(START);
  const result = l.answer('volslagen onzin', START);

  assert.equal(result.outcome, 'dropped');
  assert.deepEqual(l.results().droppedWords, [words.get(id).term]);
});

/* ======================================================== the reveal ==== */

test('the reveal carries the answer, its alternatives and the grammar form', () => {
  const words = corpus('mater | matris, f. | moeder / mama');
  const l = createLesson({ words, now: START, random: () => 0.5, direction: 'fwd' });

  l.next(START);
  l.acknowledge(START);
  const step = l.next(START + 5 * S);
  const reveal = l.answer('moeder', START + 5 * S);

  assert.equal(reveal.grade, 'correct');
  assert.equal(reveal.answer, 'moeder / mama', 'the canonical answer, as written in the list');
  assert.deepEqual(reveal.alternatives, ['moeder', 'mama']);
  assert.equal(reveal.form, 'matris, f.');
  assert.equal(step.prompt, 'mater');
});

test('either alternative counts, and so does sloppy case and accents', () => {
  const words = corpus('unus | una, unum | één / een');
  const l = createLesson({ words, now: START, random: () => 0.5, direction: 'fwd' });
  l.next(START); l.acknowledge(START);
  l.next(START + 5 * S);
  assert.equal(l.answer('  ÉÉN ', START + 5 * S).grade, 'correct');
});

test('in reverse, another word that the prompt also means is accepted', () => {
  const words = corpus('dicere | dico | zeggen\nnarrare | narro | vertellen / zeggen');
  const l = createLesson({ words, now: START, random: () => 0.5, direction: 'rev' });

  l.next(START); l.acknowledge(START);
  const step = l.next(START + 5 * S);
  assert.equal(step.prompt, 'zeggen');

  /* Whichever card was asked, both Latin words are right answers. */
  const reveal = l.answer(step.word.term === 'dicere' ? 'narrare' : 'dicere', START + 5 * S);
  assert.equal(reveal.grade, 'correct');
});

/* ======================================================== direction ===== */

test('a one-way lesson only ever asks that way round', () => {
  for (const direction of ['fwd', 'rev']) {
    const l = lesson({ direction });
    let t = START;
    for (let i = 0; i < 12; i++) {
      const step = l.next(t);
      if (step.kind === 'done') break;
      if (step.kind === 'wait') { t = step.untilMs; continue; }
      if (step.kind === 'present') { l.acknowledge(t); continue; }
      assert.equal(step.direction, direction);
      l.answer(step.direction === 'fwd' ? step.word.translations[0] : step.word.term, t);
      t += 2 * S;
    }
  }
});

test('both mode asks each way round', () => {
  const l = lesson({ direction: 'both' });
  const seen = new Set();
  let t = START;

  for (let i = 0; i < 30 && seen.size < 2; i++) {
    const step = l.next(t);
    if (step.kind === 'done') break;
    if (step.kind === 'wait') { t = step.untilMs; continue; }
    if (step.kind === 'present') { l.acknowledge(t); continue; }
    seen.add(step.direction);
    l.answer(step.direction === 'fwd' ? step.word.translations[0] : step.word.term, t);
    t += 2 * S;
  }
  assert.deepEqual([...seen].sort(), ['fwd', 'rev']);
});

/* ========================================================== misuse ====== */

test('answering when nothing was asked is a bug, not a silent no-op', () => {
  const l = lesson();
  assert.throws(() => l.answer('x', START), /nothing to answer/);
  l.next(START);
  assert.throws(() => l.answer('x', START), /nothing to answer/);
});

test('acknowledging when no card is showing is a bug too', () => {
  const l = lesson();
  assert.throws(() => l.acknowledge(START), /nothing to acknowledge/);
});

/* ================================================== the weaker side ===== */

/** A retain card with a given per-direction record, due now. */
function recorded(words, id, { fwd = [], rev = [], okFwd = false, okRev = false } = {}) {
  return new Map([[id, {
    term: words.get(id).term, lists: [], phase: 'retain', micro: 0, box: 2,
    dueAt: new Date(START - MIN).toISOString(),
    cleanDays: { fwd: [...fwd], rev: [...rev] },
    lastSlip: { fwd: null, rev: null },
    seen: 6, correct: 5, slips: 0,
    dirOk: { fwd: okFwd, rev: okRev },
  }]]);
}

test('both mode asks the side she is worse at', () => {
  const words = corpus();
  const [id] = [...words.keys()];

  /* She recognises it but has never produced it: ask the other way round. */
  const strongForward = createLesson({
    words, cards: recorded(words, id, { fwd: ['2026-09-01', '2026-09-02'], okFwd: true }),
    direction: 'both', now: START, random: () => 0.5,
  });
  assert.equal(strongForward.next(START).direction, 'rev');

  /* And the reverse case, so it is following the record and not a preference. */
  const strongReverse = createLesson({
    words, cards: recorded(words, id, { rev: ['2026-09-01', '2026-09-02'], okRev: true }),
    direction: 'both', now: START, random: () => 0.5,
  });
  assert.equal(strongReverse.next(START).direction, 'fwd');
});

test('having produced it once beats never having done so', () => {
  const words = corpus();
  const [id] = [...words.keys()];
  const lesson = createLesson({
    words, cards: recorded(words, id, { okFwd: true }),
    direction: 'both', now: START, random: () => 0.5,
  });
  assert.equal(lesson.next(START).direction, 'rev');
});

test('a tie alternates rather than favouring one side', () => {
  const words = corpus();
  const seen = [];
  const l = lesson({ direction: 'both' });
  let t = START;

  for (let i = 0; i < 20 && seen.length < 4; i++) {
    const step = l.next(t);
    if (step.kind === 'done') break;
    if (step.kind === 'wait') { t = step.untilMs; continue; }
    if (step.kind === 'present') { l.acknowledge(t); continue; }
    seen.push(step.direction);
    l.answer(step.direction === 'fwd' ? step.word.translations[0] : step.word.term, t);
    t += 2 * S;
  }
  assert.ok(seen.includes('fwd') && seen.includes('rev'),
    'with no record either way, Both must not settle on one side');
});

test('a one-way lesson ignores the record entirely', () => {
  const words = corpus();
  const [id] = [...words.keys()];
  const cards = recorded(words, id, { fwd: ['2026-09-01', '2026-09-02'], okFwd: true });

  const l = createLesson({ words, cards, direction: 'fwd', now: START, random: () => 0.5 });
  assert.equal(l.next(START).direction, 'fwd',
    'the picker is a practice tool: if she asks for one side, she gets it');
});

test('the results name the words that were learned outright', () => {
  const words = corpus();
  const [id] = [...words.keys()];
  const cards = recorded(words, id, { okFwd: true, okRev: true });
  cards.get(id).box = 5;

  const l = createLesson({ words, cards, direction: 'fwd', now: START, random: () => 0.5 });
  l.next(START);
  const result = l.answer(l.current.word.translations[0], START);

  assert.equal(result.outcome, 'learned');
  assert.deepEqual(l.results().learnedWords, [words.get(id).term]);
});

test('a word proven one way only is parked, and the results say so', () => {
  const words = corpus();
  const [id] = [...words.keys()];
  const cards = recorded(words, id, { okFwd: true });
  cards.get(id).box = 5;

  const l = createLesson({ words, cards, direction: 'fwd', now: START, random: () => 0.5 });
  l.next(START);
  const result = l.answer(l.current.word.translations[0], START);

  assert.equal(result.outcome, 'parked');
  assert.equal(l.results().parked, 1);
  assert.equal(l.results().learnedWords.length, 0);
});

/* ================================================ focused practice ====== */

test('a focused lesson drills the named words even though they are not due', () => {
  const words = corpus();
  const [id] = [...words.keys()];
  const cards = recorded(words, id, { fwd: ['2026-09-01'], okFwd: true });
  /* Parked at box 5: not due again for two months. */
  cards.get(id).box = 5;
  cards.get(id).dueAt = new Date(START + 60 * 24 * 60 * MIN).toISOString();

  const l = createLesson({
    words, cards, direction: 'rev', focusIds: [id], now: START, random: () => 0.5,
  });

  const step = l.next(START);
  assert.equal(step.kind, 'ask', 'the word it promised to practise must actually be asked');
  assert.equal(step.id, id);
  assert.equal(step.direction, 'rev');
});

test('a focused lesson introduces no new words — it is a repair, not a session', () => {
  const words = corpus();
  const [id] = [...words.keys()];
  const cards = recorded(words, id, { okFwd: true });
  cards.get(id).box = 5;
  cards.get(id).dueAt = new Date(START + 60 * 24 * 60 * MIN).toISOString();

  const l = createLesson({
    words, cards, direction: 'rev', focusIds: [id], now: START, random: () => 0.5,
  });

  l.next(START);
  l.answer(words.get(id).term, START);
  assert.equal(l.results().presented, 0);
});

test('answering the missing side releases the word', () => {
  const words = corpus();
  const [id] = [...words.keys()];
  const cards = recorded(words, id, { fwd: ['2026-09-01'], okFwd: true });
  cards.get(id).box = 5;
  cards.get(id).dueAt = new Date(START + 60 * 24 * 60 * MIN).toISOString();

  const l = createLesson({
    words, cards, direction: 'rev', focusIds: [id], now: START, random: () => 0.5,
  });
  l.next(START);
  const result = l.answer(words.get(id).term, START);

  assert.equal(result.outcome, 'learned');
  assert.equal(cards.get(id).phase, 'learned');
});
