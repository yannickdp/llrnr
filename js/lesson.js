/* lesson.js — the lesson loop.

   Headless on purpose: this module decides *what to show next* and *what an
   answer did*, and knows nothing about the DOM. ui.js draws whatever it is
   handed. That split is what lets a whole ten-minute lesson run in a test
   against a fake clock.

   The loop is a priority queue on `dueAt`, with one rule on top of "most
   overdue first": a micro-ladder repeat always outranks a retain review. The
   ladder is the thing with real deadlines — a 5-second step served a minute
   late is no longer a 5-second step — whereas a review that has waited three
   days can wait another twenty seconds.

   The two phases interleave, which is the practical reason the design works:
   the 2-minute and 10-minute gaps in one word's ladder are filled with quick
   reviews of other words, and with new words being introduced. */

import { isDue, newCard, overdueBy, present, review } from './schedule.js';
import { check, expectedFor, promptFor, withinOneEdit } from './answer.js';
import { normalize } from './parse.js';

const MINUTE = 60_000;

/**
 * The most day-scale reviews one lesson will serve.
 *
 * After a two-week holiday hundreds of words are overdue, and serving them all
 * is the fastest way to make her quit. PLAN section 2.5: cap the load, and pick
 * the cap by *lowest box first* — rescue the shaky words before polishing the
 * solid ones. The rest are not lost, only later.
 */
export const REVIEW_CAP = 40;

/**
 * @param {object} opts
 * @param {Map<string,object>} opts.words     the corpus: id -> word
 * @param {Map<string,object>} opts.cards     progress: id -> card (mutated in place)
 * @param {'fwd'|'rev'|'both'} [opts.direction]
 * @param {number} [opts.minutes]             the time box
 * @param {number} [opts.newPerLesson]
 * @param {number} [opts.maxInFlight]         ladders running at once
 * @param {number} [opts.now]
 * @param {() => number} [opts.random]        injected so tests are deterministic
 */
export function createLesson({
  words,
  cards = new Map(),
  direction = 'both',
  minutes = 10,
  newPerLesson = 8,
  /* Ladders overlap by design — the whole ladder is 12m35s long, so in a
     ten-minute lesson every word introduced is still running when it ends.
     Capping below the new-word budget would therefore cap the budget itself. */
  maxInFlight = newPerLesson,
  /* Cards to drill regardless of when they are next due. This is what makes
     "practise the side you are missing" mean something: a word parked at box 5
     is not due for sixty days, so without this the button would start a lesson
     that never asks any of the words it named. A focused lesson introduces no
     new words either — it is a targeted repair, not a normal session. */
  focusIds = null,
  reviewCap = REVIEW_CAP,
  now = Date.now(),
  random = Math.random,
} = {}) {
  const focus = new Set(focusIds ?? []);
  const startedAt = now;
  const endsAt = now + minutes * MINUTE;

  /* New words are spread across the lesson rather than front-loaded, so the
     ladders overlap instead of all starting at once. */
  const newGapMs = (minutes * MINUTE) / Math.max(1, newPerLesson);

  let introduced = 0;
  let lastNewAt = -Infinity;
  let asked = 0;
  let current = null;
  let finished = false;

  /* Which cards owe their one multiple-choice first contact. Lesson-local and
     never persisted: it is a property of "just met this word", not of the card. */
  const firstContact = new Set();

  const tally = {
    presented: 0, answered: 0, correct: 0,
    graduated: 0, promoted: 0, held: 0, dropped: 0, learned: 0, parked: 0,
    droppedWords: [], graduatedWords: [], learnedWords: [],
  };

  /* ------------------------------------------------------------ queue --- */

  /* A card can outlive its chapter: PLAN section 4 keeps progress when a list
     is dropped from index.json, precisely so removing one loses nothing. Such
     a card has no word to ask, so it is skipped rather than crashing the
     lesson — and it is still there if the chapter comes back. */
  const live = () => [...cards.entries()]
    .filter(([id, c]) => c.phase !== 'learned' && words.has(id));

  /**
   * Which of the day's due reviews this lesson will take on, chosen once at the
   * start. Lowest box first, then most overdue: a box-1 word she nearly lost is
   * worth more than a box-5 word she is merely due to see again.
   *
   * Only day-scale reviews are capped. Micro-ladder repeats are the current
   * session's own work and are always served, or the ladder would break.
   */
  function selectReviews(t) {
    const due = [...cards.entries()]
      .filter(([, c]) => c.phase === 'retain' && isDue(c, t))
      .sort(([, a], [, b]) => (a.box - b.box) || (overdueBy(b, t) - overdueBy(a, t)));

    return { chosen: new Set(due.slice(0, reviewCap).map(([id]) => id)), total: due.length };
  }

  const { chosen: reviewSet, total: dueAtStart } = selectReviews(now);

  function servable(id, card, t) {
    if (focus.has(id)) return true;
    if (!isDue(card, t)) return false;
    return card.phase === 'acquire' || reviewSet.has(id);
  }

  function dueNow(t) {
    return live()
      .filter(([id, c]) => servable(id, c, t))
      .sort(([, a], [, b]) => {
        /* A ladder repeat always wins: its interval is the exercise. */
        if ((a.phase === 'acquire') !== (b.phase === 'acquire')) {
          return a.phase === 'acquire' ? -1 : 1;
        }
        /* Then the shakiest word, and among equals the longest-waiting. */
        return (a.box - b.box) || (overdueBy(b, t) - overdueBy(a, t));
      });
  }

  const inFlight = () => live().filter(([, c]) => c.phase === 'acquire').length;

  const unseen = () => [...words.keys()].filter(id => !cards.has(id));

  function canIntroduce(t) {
    if (focus.size) return false;
    if (introduced >= newPerLesson || !unseen().length) return false;
    if (inFlight() >= maxInFlight) return false;
    /* Wait out the pacing gap, unless there is genuinely nothing else to do. */
    return inFlight() === 0 || t - lastNewAt >= newGapMs;
  }

  function soonestDue(t) {
    const times = live()
      .filter(([id, c]) => focus.has(id) || c.phase === 'acquire' || reviewSet.has(id))
      .map(([, c]) => Date.parse(c.dueAt))
      .filter(ms => ms > t);
    return times.length ? Math.min(...times) : null;
  }

  /** When the next new word may be introduced, or Infinity if none is left. */
  function nextIntroAt() {
    if (focus.size) return Infinity;
    if (introduced >= newPerLesson || !unseen().length) return Infinity;
    if (inFlight() >= maxInFlight) return Infinity;
    return lastNewAt + newGapMs;
  }

  /* -------------------------------------------------------- direction --- */

  /**
   * In Both mode the direction is not random: for each word it is the side
   * with the weaker record, alternating on a tie. That is the whole point of
   * Both — it quietly spends more time on whichever way round she is worse at,
   * which is almost always Dutch -> Latin, and that is where the marks go.
   */
  function pickDirection(card) {
    if (direction !== 'both') return direction;
    if (!card) return asked % 2 === 0 ? 'fwd' : 'rev';

    /* Clean days are the real evidence; dirOk breaks ties between two words
       with none yet, since "has produced it once" still beats "never has". */
    const score = dir => card.cleanDays[dir].length * 2 + (card.dirOk[dir] ? 1 : 0);
    const fwd = score('fwd');
    const rev = score('rev');

    if (fwd !== rev) return fwd < rev ? 'fwd' : 'rev';
    return asked % 2 === 0 ? 'fwd' : 'rev';
  }

  /** Three wrong answers drawn from other words, for the first-contact check. */
  function distractors(word, dir, count = 3) {
    const right = dir === 'fwd' ? word.answer : word.term;
    const others = [...words.values()]
      .map(w => (dir === 'fwd' ? w.answer : w.term))
      .filter(text => text !== right);

    const picked = [];
    while (picked.length < count && others.length) {
      const [text] = others.splice(Math.floor(random() * others.length), 1);
      if (!picked.includes(text)) picked.push(text);
    }
    return picked;
  }

  /* ------------------------------------------------------------ steps --- */

  /** What to show next. Pure: calling it twice in a row returns the same step. */
  function next(t = Date.now()) {
    if (finished) return { kind: 'done' };

    if (t >= endsAt) return finish();

    const due = dueNow(t);
    if (due.length) {
      const [id, card] = due[0];
      const word = words.get(id);
      const dir = pickDirection(card);
      const mode = firstContact.has(id) ? 'choice' : 'typed';

      current = {
        kind: 'ask',
        id, word, card,
        direction: dir,
        mode,
        prompt: promptFor(word, dir),
        options: mode === 'choice'
          ? shuffle([dir === 'fwd' ? word.answer : word.term, ...distractors(word, dir)], random)
          : null,
      };
      return current;
    }

    if (canIntroduce(t)) {
      const id = unseen()[0];
      current = { kind: 'present', id, word: words.get(id) };
      return current;
    }

    /* Waiting has to account for the next introduction as well as the next due
       card, or the pacing gap would be skipped straight over and the lesson
       would introduce only as many words as its first ladder left room for. */
    const wakeAt = Math.min(soonestDue(t) ?? Infinity, nextIntroAt());
    if (!Number.isFinite(wakeAt)) return finish();

    current = { kind: 'wait', untilMs: Math.min(wakeAt, endsAt) };
    return current;
  }

  /* ----------------------------------------------------------- moving --- */

  /** She has read the presentation card and tapped on. */
  function acknowledge(t = Date.now()) {
    if (current?.kind !== 'present') throw new Error('nothing to acknowledge');

    const { id, word } = current;
    const { card } = present(newCard(word, { now: t }), { now: t });
    cards.set(id, card);

    firstContact.add(id);
    introduced++;
    lastNewAt = t;
    tally.presented++;
    current = null;
  }

  /**
   * Grade what she typed (or tapped, for the first-contact check).
   * @returns {object} everything the reveal needs, plus the transition.
   */
  function answer(typed, t = Date.now()) {
    if (current?.kind !== 'ask') throw new Error('nothing to answer');

    const { id, word, direction: dir } = current;
    const grade = check({ typed, word, direction: dir, pool: words });
    /* The direction goes to the scheduler because the *evidence* is
       per-direction even though the scheduling clock is shared. */
    const { card, outcome } = review(cards.get(id), { grade, direction: dir, now: t });
    cards.set(id, card);

    firstContact.delete(id);
    asked++;
    tally.answered++;
    if (grade === 'correct') tally.correct++;
    if (outcome in tally) tally[outcome]++;
    if (outcome === 'dropped') tally.droppedWords.push(word.term);
    if (outcome === 'graduated') tally.graduatedWords.push(word.term);
    if (outcome === 'learned') tally.learnedWords.push(word.term);

    current = null;

    return {
      grade, outcome,
      term: word.term,
      form: word.form,
      /* For an "almost", which accepted spelling she nearly wrote — that is
         the one worth showing back, not necessarily the canonical first one. */
      nearest: grade === 'almost' ? nearestTo(typed, word, dir) : null,
      /* The canonical answer as written in the list, plus every alternative
         that would also have counted. */
      answer: dir === 'fwd' ? word.answer : word.term,
      alternatives: dir === 'fwd' ? word.translations : [word.term],
      typed,
    };
  }

  function finish() {
    finished = true;
    current = { kind: 'done' };
    return current;
  }

  /* ---------------------------------------------------------- reading --- */

  const timeLeftMs = (t = Date.now()) => Math.max(0, endsAt - t);
  const elapsedFraction = (t = Date.now()) =>
    Math.min(1, (t - startedAt) / (endsAt - startedAt));

  return {
    next, acknowledge, answer, finish,
    timeLeftMs, elapsedFraction,
    get current() { return current; },
    get isFinished() { return finished; },
    results: () => ({
      ...tally,
      elapsedMs: Date.now() - startedAt,
      /* What the cap left for another day — never rendered as a list. */
      heldBack: Math.max(0, dueAtStart - reviewSet.size),
    }),
    /* Exposed for the UI and the tests; never written to from outside. */
    cards,
  };
}

/** Which accepted answer she came closest to. */
function nearestTo(typed, word, direction) {
  const accepted = expectedFor(word, direction);
  return accepted.find(a => withinOneEdit(normalize(typed ?? ''), normalize(a))) ?? accepted[0];
}

/** Fisher-Yates, with the randomness injected so tests can pin it. */
function shuffle(items, random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
