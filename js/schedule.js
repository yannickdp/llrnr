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

/**
 * How many clean days to keep per direction. PLAN caps this at the largest
 * targetRecalls in use, which is 3 by default; a little headroom costs nothing
 * and means raising a test's target does not discard evidence already earned.
 */
export const MAX_CLEAN_DAYS = 5;

const iso = ms => new Date(ms).toISOString();

/**
 * Which study day a moment belongs to, as YYYY-MM-DD.
 *
 * The same 04:00 boundary the intervals use, so a session that runs past
 * midnight counts as one day's practice rather than two — otherwise a late
 * Sunday session would hand her two of her three clean days for free.
 */
export function studyDay(now) {
  const d = new Date(now);
  d.setHours(d.getHours() - DAY_START_HOUR);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
    /* The last day she slipped in each direction, which is what stops a wrong
       answer from being erased by a correct one five seconds later. */
    lastSlip: { fwd: null, rev: null },
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

/**
 * A word she can recognise but not produce — or the other way round.
 *
 * PLAN section 2.4 moves the both-directions requirement to the *top* of the
 * ladder rather than the middle. An earlier draft blocked a word from leaving
 * box 2 until both directions were proven, which becomes a trap once she can
 * pick a direction: a run of Latin -> Dutch lessons would leave every word
 * stuck at box 2 with no visible cause. So boxes climb on whatever direction
 * was actually tested, and only `learned` is gated.
 */
export function isOneWay(card) {
  return card.phase === 'retain'
    && card.box >= BOX_DAYS.length
    && !(card.dirOk.fwd && card.dirOk.rev);
}

/** The direction a parked card still owes, or null if it owes neither. */
export function missingDirection(card) {
  if (card.dirOk.fwd && card.dirOk.rev) return null;
  return card.dirOk.fwd ? 'rev' : 'fwd';
}

/** How overdue a card is, in ms — the lesson queue's sort key. */
export function overdueBy(card, now = Date.now()) {
  return card.dueAt === null ? -Infinity : now - Date.parse(card.dueAt);
}

const clone = card => ({
  ...card,
  lists: [...card.lists],
  cleanDays: { fwd: [...card.cleanDays.fwd], rev: [...card.cleanDays.rev] },
  lastSlip: { ...(card.lastSlip ?? { fwd: null, rev: null }) },
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
 * @param {'fwd'|'rev'} [opts.direction]  which way round she was asked
 * @param {boolean} [opts.hint]           whether she was helped
 * @param {number} [opts.now]
 * @returns {{card: object, outcome: string}} the outcome names the transition,
 *   which is what the results screen counts and what Phase 4.1 pays XP on:
 *   advanced | repeated | reset | graduated | promoted | held | learned | dropped
 */
export function review(card, { grade, direction = 'fwd', hint = false, now = Date.now() } = {}) {
  if (!GRADES.includes(grade)) throw new Error(`unknown grade: ${grade}`);
  if (card.phase === 'new') {
    throw new Error('a new word must be presented before it can be reviewed');
  }

  const next = clone(card);
  next.seen++;
  if (grade === 'correct') next.correct++;
  if (grade === 'almost') next.slips++;

  recordEvidence(next, grade, direction, hint, now);

  return next.phase === 'acquire'
    ? acquire(next, grade, now)
    : retain(next, grade, now);
}

/**
 * Record what this answer proves about the word, per direction.
 *
 * A *clean recall* is correct first time, with no hint and no "almost" — PLAN
 * section 2.6 is emphatic that this number has to mean something, because the
 * whole readiness display is built on it. So a day only counts once she has
 * managed it without slipping in that direction that day, and slipping later
 * the same day takes the day back: a word she got wrong at eight in the
 * evening is not one she reliably knew at nine in the morning.
 */
function recordEvidence(next, grade, direction, hint, now) {
  const day = studyDay(now);
  const days = next.cleanDays[direction];

  if (grade !== 'correct') {
    next.lastSlip[direction] = day;
    const at = days.indexOf(day);
    if (at !== -1) days.splice(at, 1);
    return;
  }

  /* "Has she ever produced this, this way round?" — what gates `learned` and
     drives the one-way marker (Phase 2.3). An almost does not count. */
  next.dirOk[direction] = true;

  if (hint || next.lastSlip[direction] === day) return;
  if (!days.includes(day)) days.push(day);
  if (days.length > MAX_CLEAN_DAYS) days.shift();
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

  /* Cleared box 5 — but knowing a word means knowing it both ways, because
     that is how she is examined. A word proven only one way round parks here
     and keeps coming back occasionally, with a marker saying why. */
  if (!next.dirOk.fwd || !next.dirOk.rev) {
    next.dueAt = iso(dayAfter(now, BOX_DAYS.at(-1)));
    return { card: next, outcome: 'parked' };
  }

  next.phase = 'learned';
  next.dueAt = null;
  return { card: next, outcome: 'learned' };
}
