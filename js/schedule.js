/* schedule.js — when a word comes back.

   Nothing but interval arithmetic: no storage, no DOM, no timers. Every
   function takes the current time and returns a new card, so the whole
   scheduler can be walked through a year of study in a millisecond against a
   fake clock. This is the part of the app most likely to be tuned, so it is
   kept small enough to read in one go.

   Two ladders (PLAN section 2):

     acquire   5s -> 25s -> 2m -> 10m      inside one session
     retain    1d -> 3d -> 7d -> 21d -> 60d -> learned

   Timers are never used to measure any of it. iOS freezes them in a
   backgrounded tab, so a card carries an absolute `dueAt` and the lesson loop
   compares it against the clock on every pass. */

/** The in-session micro-ladder: the wait *before* each retrieval. */
export const MICRO_STEPS_MS = [5_000, 25_000, 120_000, 600_000];

/** Days to the next review for boxes 1-5. Clearing box 5 means learned. */
export const BOX_DAYS = [1, 3, 7, 21, 60];

/**
 * Day-scale reviews land at 04:00 local rather than exactly N*24h later.
 * "Due tomorrow" has to mean tomorrow the *day*: a word answered at 20:00 must
 * be waiting when she practises after school, not at 20:00 sharp. Four in the
 * morning is the quietest possible boundary to roll over on.
 */
export const DAY_START_HOUR = 4;

const GRADES = ['correct', 'almost', 'wrong'];

const iso = ms => new Date(ms).toISOString();

/** N days after `now`, at the day-start hour, local time. */
function dayAfter(now, days) {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(DAY_START_HOUR, 0, 0, 0);
  return d.getTime();
}

/* ============================================================== cards ==== */

/** A word she has never met. Due immediately: "new" means available, not late. */
export function newCard(word, { now = Date.now() } = {}) {
  return {
    term: word.term,
    lists: [...(word.lists ?? [])],
    phase: 'new',
    micro: 0,
    box: 0,
    dueAt: iso(now),
    cleanDays: { fwd: [], rev: [] },
    seen: 0,
    correct: 0,
    slips: 0,
    dirOk: { fwd: false, rev: false },
  };
}

/** Whether a card is ready to be served. A learned card never is. */
export function isDue(card, now = Date.now()) {
  return card.dueAt !== null && Date.parse(card.dueAt) <= now;
}

/** How overdue a card is, in ms — the lesson queue's sort key. */
export function overdueBy(card, now = Date.now()) {
  return card.dueAt === null ? -Infinity : now - Date.parse(card.dueAt);
}

const clone = card => ({
  ...card,
  lists: [...card.lists],
  cleanDays: { fwd: [...card.cleanDays.fwd], rev: [...card.cleanDays.rev] },
  dirOk: { ...card.dirOk },
});

/* ======================================================== transitions ==== */

/**
 * The presentation card: she meets a brand-new word, reads its grammar form
 * and taps on. New material is introduced, not tested, so this is ungraded —
 * the multiple-choice first contact in the lesson loop deliberately carries no
 * scheduling weight either way. The word then enters the ladder at step 1.
 */
export function present(card, { now = Date.now() } = {}) {
  const next = clone(card);
  next.phase = 'acquire';
  next.micro = 0;
  next.seen++;
  next.dueAt = iso(now + MICRO_STEPS_MS[0]);
  return { card: next, outcome: 'presented' };
}

/**
 * Grade one answer and reschedule.
 *
 * @param {object} card
 * @param {object} opts
 * @param {'correct'|'almost'|'wrong'} opts.grade
 * @param {number} [opts.now]
 * @returns {{card: object, outcome: string}} the outcome names the transition,
 *   which is what the results screen counts and what Phase 4.1 pays XP on:
 *   advanced | repeated | reset | graduated | promoted | held | learned | dropped
 */
export function review(card, { grade, now = Date.now() } = {}) {
  if (!GRADES.includes(grade)) throw new Error(`unknown grade: ${grade}`);
  if (card.phase === 'new') {
    throw new Error('a new word must be presented before it can be reviewed');
  }

  const next = clone(card);
  next.seen++;
  if (grade === 'correct') next.correct++;
  if (grade === 'almost') next.slips++;

  return next.phase === 'acquire'
    ? acquire(next, grade, now)
    : retain(next, grade, now);
}

/* --- acquire: cheap, fast, and carrying no lasting penalty --------------- */

function acquire(next, grade, now) {
  if (grade === 'wrong') {
    next.micro = 0;
    next.dueAt = iso(now + MICRO_STEPS_MS[0]);
    return { card: next, outcome: 'reset' };
  }

  /* An "almost" inside the ladder repeats the same step rather than resetting.
     A near-miss on a word met four minutes ago is not evidence of forgetting,
     and the whole ladder is only ten minutes long.
     (An interpretation: PLAN defines "almost" for the boxes, not the ladder.) */
  if (grade === 'almost') {
    next.dueAt = iso(now + MICRO_STEPS_MS[next.micro]);
    return { card: next, outcome: 'repeated' };
  }

  const last = MICRO_STEPS_MS.length - 1;
  if (next.micro < last) {
    next.micro++;
    next.dueAt = iso(now + MICRO_STEPS_MS[next.micro]);
    return { card: next, outcome: 'advanced' };
  }

  /* Clearing the 10-minute step graduates the word into retain. A word that
     dropped back from box 5 re-enters at box 1: the boxes are evidence of
     retention over days, and that evidence is gone. */
  next.phase = 'retain';
  next.micro = 0;
  next.box = 1;
  next.dueAt = iso(dayAfter(now, BOX_DAYS[0]));
  return { card: next, outcome: 'graduated' };
}

/* --- retain: day-scale boxes -------------------------------------------- */

function retain(next, grade, now) {
  if (grade === 'wrong') {
    /* The point of the two-phase design: a forgotten word is repaired in the
       next few minutes, not merely rescheduled for tomorrow. */
    next.phase = 'acquire';
    next.micro = 0;
    next.dueAt = iso(now + MICRO_STEPS_MS[0]);
    return { card: next, outcome: 'dropped' };
  }

  if (grade === 'almost') {
    next.dueAt = iso(dayAfter(now, 1));
    return { card: next, outcome: 'held' };
  }

  if (next.box < BOX_DAYS.length) {
    next.box++;
    next.dueAt = iso(dayAfter(now, BOX_DAYS[next.box - 1]));
    return { card: next, outcome: 'promoted' };
  }

  /* Cleared box 5.
     Phase 2.3 gates this on a clean recall in *both* directions; until then a
     word that has served its 60 days is simply learned. */
  next.phase = 'learned';
  next.dueAt = null;
  return { card: next, outcome: 'learned' };
}
