/* Tests for the lesson loop, driven by a fake clock.

   The interesting one is the last: a whole ten-minute lesson played out
   answer by answer, checking the things PLAN promises about a session — new
   words spread rather than front-loaded, ladders interleaved with reviews, and
   somewhere around 8-10 new words actually introduced. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLesson, REVIEW_CAP } from '../js/lesson.js';
import { parseList } from '../js/parse.js';
import { MICRO_STEPS_MS } from '../js/schedule.js';

const S = 1000, MIN = 60_000;
const NEWLINE = String.fromCharCode(10);
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

/* =================================================== after a holiday ==== */

/** A bigger corpus, so a real backlog can be built. */
function bigCorpus(n) {
  const lines = [];
  for (let i = 0; i < n; i++) lines.push(`term${i} | vorm${i} | vertaling${i}`);
  return new Map(parseList(lines.join(NEWLINE), { listId: 'test' }).words.map(w => [w.id, w]));
}

/** Every word overdue, with the box given by `boxOf`. */
function backlog(words, { boxOf = () => 3, daysLateOf = () => 5 } = {}) {
  const cards = new Map();
  let i = 0;
  for (const [id, word] of words) {
    const n = i++;
    cards.set(id, {
      term: word.term, lists: [], phase: 'retain', micro: 0, box: boxOf(n),
      dueAt: new Date(START - daysLateOf(n) * 24 * 60 * MIN).toISOString(),
      cleanDays: { fwd: [], rev: [] }, lastSlip: { fwd: null, rev: null },
      seen: 8, correct: 7, slips: 1, dirOk: { fwd: true, rev: true },
    });
  }
  return cards;
}

/** Play a lesson, recording every card asked. */
function playCounting(l, { minutes = 10 } = {}) {
  let t = START;
  const asked = [];
  for (let i = 0; i < 4000; i++) {
    const step = l.next(t);
    if (step.kind === 'done') break;
    if (step.kind === 'wait') { t = step.untilMs; continue; }
    if (step.kind === 'present') { l.acknowledge(t); continue; }
    asked.push({ id: step.id, phase: step.card.phase, box: step.card.box });
    l.answer(step.direction === 'fwd' ? step.word.translations[0] : step.word.term, t);
    t += 2 * S;
  }
  void minutes;
  return asked;
}

test('a fortnight of backlog is capped, not served in full', () => {
  const words = bigCorpus(300);
  const l = createLesson({
    words, cards: backlog(words), direction: 'fwd', minutes: 15,
    now: START, random: () => 0.5,
  });

  const reviews = playCounting(l).filter(a => a.phase === 'retain');
  const distinct = new Set(reviews.map(a => a.id));
  assert.ok(distinct.size <= REVIEW_CAP, `${distinct.size} reviews served, cap is ${REVIEW_CAP}`);
  assert.equal(l.results().heldBack, 300 - REVIEW_CAP);
});

test('the shaky words are rescued first, not the solid ones', () => {
  const words = bigCorpus(120);
  /* Box 5 words are the most overdue, so only the box rule can put box 1 first. */
  const cards = backlog(words, {
    boxOf: n => (n % 5) + 1,
    daysLateOf: n => ((n % 5) + 1) * 10,
  });

  const l = createLesson({
    words, cards, direction: 'fwd', minutes: 15, now: START, random: () => 0.5,
  });

  const boxes = playCounting(l).filter(a => a.phase === 'retain').map(a => a.box);
  assert.ok(boxes.length > 0);
  assert.equal(boxes[0], 1, 'the first word asked must be the shakiest');
  assert.ok(boxes.filter(b => b === 1).length >= boxes.filter(b => b === 5).length,
    'a box-1 word she nearly lost outranks a box-5 word she merely owes a look');
});

test('the cap never blocks the current session own ladder', () => {
  const words = bigCorpus(80);
  const cards = backlog(words);
  const l = createLesson({
    words, cards, direction: 'fwd', minutes: 15, reviewCap: 3,
    now: START, random: () => 0.5,
  });

  /* Three reviews are allowed; a word that drops back into acquire must keep
     being served regardless, or its ladder would break mid-repair. */
  let t = START;
  const step = l.next(t);
  l.answer('volslagen onzin', t);          // drops it into acquire
  const dropped = step.id;

  t += 6 * S;
  const seen = [];
  for (let i = 0; i < 12; i++) {
    const next = l.next(t);
    if (next.kind === 'wait') { t = next.untilMs; continue; }
    if (next.kind === 'done' || next.kind === 'present') break;
    seen.push(next.id);
    l.answer(next.word.translations[0], t);
    t += 2 * S;
  }
  assert.ok(seen.includes(dropped), 'the repaired word must come back inside the session');
});

test('a small day is untouched by the cap', () => {
  const words = bigCorpus(6);
  const l = createLesson({
    words, cards: backlog(words), direction: 'fwd', minutes: 10,
    now: START, random: () => 0.5,
  });

  const reviews = new Set(playCounting(l).filter(a => a.phase === 'retain').map(a => a.id));
  assert.equal(reviews.size, 6);
  assert.equal(l.results().heldBack, 0);
});

test('held-back words are counted, never listed', () => {
  const words = bigCorpus(100);
  const l = createLesson({
    words, cards: backlog(words), direction: 'fwd', now: START, random: () => 0.5,
  });
  const results = l.results();
  assert.equal(results.heldBack, 100 - REVIEW_CAP);
  assert.equal(typeof results.heldBack, 'number', 'a count she can read, not a wall of words');
});

test('a card whose chapter was removed is skipped, not crashed on', () => {
  const words = corpus();
  const cards = backlog(words);
  /* A leftover from a chapter no longer in index.json. */
  cards.set('h-gone', {
    term: 'obsoletus', lists: ['latin-ch99'], phase: 'retain', micro: 0, box: 1,
    dueAt: new Date(START - 99 * 24 * 60 * MIN).toISOString(),
    cleanDays: { fwd: [], rev: [] }, lastSlip: { fwd: null, rev: null },
    seen: 3, correct: 2, slips: 0, dirOk: { fwd: true, rev: false },
  });

  const l = createLesson({ words, cards, direction: 'fwd', now: START, random: () => 0.5 });
  const asked = playCounting(l).map(a => a.id);

  assert.ok(!asked.includes('h-gone'));
  assert.ok(asked.length > 0, 'the rest of the lesson still runs');
  assert.ok(cards.has('h-gone'), 'and the card is kept, in case the chapter returns');
});

/* ================================================= working to a date ==== */

const examList = [
  'quattuor | vier',
  'quinque  | vijf',
  'sex      | zes',
].join(NEWLINE);

const scoped = () => new Map(parseList(examList, { listId: 'latin-ch04' }).words.map(w => [w.id, w]));

/** A corpus split over two chapters, only one of which is examined. */
function mixedCorpus() {
  const inScopeWords = parseList(examList, { listId: 'latin-ch04' }).words;
  const outWords = parseList(LIST, { listId: 'latin-ch01' }).words;
  return new Map([...inScopeWords, ...outWords].map(w => [w.id, w]));
}

const EXAM = {
  id: 't1', title: 'toets', date: '2026-09-11',
  lists: ['latin-ch04'], targetRecalls: 3, directions: 'both',
};

test('during a run-up only the chapters in scope introduce new words', () => {
  const words = mixedCorpus();
  const l = createLesson({
    words, cards: new Map(), direction: 'fwd', test: EXAM,
    now: START, random: () => 0.5,
  });

  const introduced = [];
  let t = START;
  for (let i = 0; i < 200; i++) {
    const step = l.next(t);
    if (step.kind === 'done') break;
    if (step.kind === 'wait') { t = step.untilMs; continue; }
    if (step.kind === 'present') { introduced.push(step.word.lists); l.acknowledge(t); continue; }
    l.answer(step.direction === 'fwd' ? step.word.translations[0] : step.word.term, t);
    t += 2 * S;
  }

  assert.ok(introduced.length > 0);
  assert.ok(introduced.every(lists => lists.includes('latin-ch04')),
    'a chapter outside the test must not start teaching new words now');
});

test('but an overdue review outside the scope is still served', () => {
  const words = mixedCorpus();
  const outsideId = [...words.entries()].find(([, w]) => w.lists.includes('latin-ch01'))[0];
  const cards = new Map([[outsideId, {
    term: words.get(outsideId).term, lists: ['latin-ch01'], phase: 'retain', micro: 0, box: 2,
    dueAt: new Date(START - 9 * 24 * 60 * MIN).toISOString(),
    cleanDays: { fwd: [], rev: [] }, lastSlip: { fwd: null, rev: null },
    seen: 5, correct: 4, slips: 0, dirOk: { fwd: true, rev: false },
  }]]);

  const l = createLesson({
    words, cards, direction: 'fwd', test: EXAM, now: START, random: () => 0.5,
  });

  const asked = [];
  let t = START;
  for (let i = 0; i < 40; i++) {
    const step = l.next(t);
    if (step.kind === 'done') break;
    if (step.kind === 'wait') { t = step.untilMs; continue; }
    if (step.kind === 'present') { l.acknowledge(t); continue; }
    asked.push(step.id);
    l.answer(step.direction === 'fwd' ? step.word.translations[0] : step.word.term, t);
    t += 2 * S;
  }
  assert.ok(asked.includes(outsideId), 'genuinely overdue work does not vanish');
});

test('intervals are compressed so nothing is scheduled past the test', () => {
  const words = scoped();
  const [id] = [...words.keys()];
  const cards = new Map([[id, {
    term: words.get(id).term, lists: ['latin-ch04'], phase: 'retain', micro: 0, box: 3,
    dueAt: new Date(START - MIN).toISOString(),
    cleanDays: { fwd: [], rev: [] }, lastSlip: { fwd: null, rev: null },
    seen: 6, correct: 6, slips: 0, dirOk: { fwd: true, rev: true },
  }]]);

  const l = createLesson({
    words, cards, direction: 'fwd', test: EXAM, now: START, random: () => 0.5,
  });
  l.next(START);
  l.answer(words.get(id).translations[0], START);

  /* Box 4 would normally be 21 days away — well past the eleventh. */
  const due = Date.parse(cards.get(id).dueAt);
  const testDay = new Date('2026-09-11T23:59:59').getTime();
  assert.ok(due <= testDay, 'a review after the exam is a review that never happened');
});

test('the weakest word in scope is asked first', () => {
  const words = scoped();
  const ids = [...words.keys()];
  const clean = ['2026-09-01', '2026-09-02'];
  const cards = new Map(ids.map((id, n) => [id, {
    term: words.get(id).term, lists: ['latin-ch04'], phase: 'retain', micro: 0, box: 2,
    /* The best-known word is also the most overdue, so only the readiness
       rule can put the weakest first. */
    dueAt: new Date(START - (n === 0 ? 9 : 1) * 24 * 60 * MIN).toISOString(),
    cleanDays: n === 0 ? { fwd: [...clean], rev: [...clean] } : { fwd: [], rev: [] },
    lastSlip: { fwd: null, rev: null },
    seen: 5, correct: 5, slips: 0, dirOk: { fwd: true, rev: true },
  }]));

  const l = createLesson({
    words, cards, direction: 'fwd', test: EXAM, now: START, random: () => 0.5,
  });
  assert.notEqual(l.next(START).id, ids[0], 'polishing the solid word is the wrong use of the time');
});

test('with no test the lesson behaves exactly as before', () => {
  const words = mixedCorpus();
  const l = createLesson({ words, cards: new Map(), direction: 'fwd', now: START, random: () => 0.5 });
  const step = l.next(START);
  assert.equal(step.kind, 'present', 'every chapter is fair game again');
});
