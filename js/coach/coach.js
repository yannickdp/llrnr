/* coach.js — the pixel Roman who reacts after an answer.

   Where it goes, and the three rules that put it there (PLAN-ROMA section 9):

   1. **Never in the anticipation gap.** That silence is the exercise. A Latin
      motto on screen during a Latin retrieval task can also leak the answer
      outright, which is why `pickMessage` below has a guard rather than a
      comment.
   2. **Concurrent, not additional.** It renders in the reveal beat she is
      already dwelling in, and it never gates the Verder button. Sixty answers
      times five seconds of the demo's default would have been five minutes of
      a ten-minute lesson, and that failure is invisible in a demo where you
      press the buttons yourself.
   3. **Not on every answer.** Twelve appearances a lesson is a reward; sixty is
      wallpaper. Scarcity is the whole mechanism — see `mayShow`.

   And the one rule about its rank: it does not have an XP ladder of its own.
   The spec's 120/350/750/1600/3200 would have made her Imperator inside two
   weeks and then never changed again for the remaining thirty-odd weeks of the
   school year. The rank *is* the city's stage, derived below from the same
   numbers the skyline uses, so retuning the XP table retunes the coach for
   free and the two can never drift. */

import { CATALOGUE, STAGE_XP } from '../roma/catalogue.js';
import { painter } from '../roma/engine.js';
import { normalize } from '../parse.js';
import { RANKS, MSG, UNLOCK } from './messages.js';
import { BUST, TYPES, drawBust, fitBust, burst, stepBurst, drawBurst } from './characters.js';

/**
 * The rank ladder, derived rather than declared.
 *
 * Servus is where she stands before the first building exists; Gladiator
 * arrives with it; the four above are the city's four stage crossings. Six
 * ranks, six states, one set of numbers — and Imperator lands with the
 * Colosseum, so the rank and the skyline say the same thing.
 *
 * `CATALOGUE[0].xp` rather than `STAGE_XP[0]`: stage 0 begins at zero XP, which
 * is a stage with nothing standing in it yet. What she can see is the first hut.
 */
export const RANK_XP = Object.freeze([
  0,
  CATALOGUE[0].xp,
  STAGE_XP[1],
  STAGE_XP[2],
  STAGE_XP[3],
  STAGE_XP[4],
]);

/** How long the coach animates before going quiet. A cap, never a wait. */
export const WAIT_MS = 1200;

/** Roughly one answer in four gets a coach it did not have to earn. */
export const SHOW_ODDS = 0.25;

/* ------------------------------------------------------------- ranks ----- */

/** Which rank `xp` has reached, as an index into `RANKS`. */
export function rankAt(xp) {
  let index = 0;
  for (let i = 0; i < RANK_XP.length; i++) if (xp >= RANK_XP[i]) index = i;
  return index;
}

/**
 * The rank crossed by a lesson, or null.
 *
 * Computed from the XP either side rather than from a stored `lastTier`, which
 * is the same trick `unlockedBy` uses for buildings and for the same reason: a
 * derived answer cannot be corrupted by a botched write, and a threshold
 * therefore fires exactly once without anything being persisted to make it so.
 */
export function rankUpBetween(before, after) {
  const from = rankAt(before);
  const to = rankAt(after);
  if (to <= from) return null;
  return { from, to, rank: RANKS[to], line: UNLOCK[RANKS[to].id] ?? null };
}

/* -------------------------------------------------------------- mood ----- */

/**
 * Which face the answer earns.
 *
 * `almost` and `wrong` both map to `improve` on purpose: the specific
 * diagnosis — *bijna! het is mater* — belongs to the reveal, which is already
 * saying it two centimetres away. The coach's only job on a miss is to make
 * the miss survivable.
 *
 * The multiple-choice question is this app's version of the spec's "with a
 * hint": the answer was one of four on the screen in front of her, so it earns
 * credit without the fanfare. So does a word she has already been asked this
 * lesson — the micro-ladder repeats a new word within minutes, and treating the
 * fourth sighting as a clean recall would cheapen the ones that are.
 *
 * @param {object} opts
 * @param {'correct'|'almost'|'wrong'} opts.grade
 * @param {'typed'|'choice'} [opts.mode]
 * @param {boolean} [opts.repeat]  already asked this lesson
 */
export function moodFor({ grade, mode = 'typed', repeat = false }) {
  if (grade !== 'correct') return 'improve';
  if (mode === 'choice' || repeat) return 'good';
  return 'perfect';
}

/**
 * Should the coach appear at all?
 *
 * Always for a clean recall, always for a word that has just dropped back a
 * box — the two moments worth marking — and otherwise a quarter of the time.
 *
 * A rank-up would be the third always, and is deliberately absent: a rank-up
 * cannot happen mid-lesson, because XP is only awarded once the lesson's tally
 * is final. It is celebrated on the Results screen instead, alongside the stage
 * crossing and the building, which by construction land at the same moment.
 */
export function mayShow({ mood, outcome, random = Math.random }) {
  if (mood === 'perfect') return true;
  if (outcome === 'dropped') return true;
  return random() < SHOW_ODDS;
}

/* ---------------------------------------------------------- messages ----- */

/** Every distinct word in a string, normalised and stripped of punctuation. */
function wordsOf(text) {
  return normalize(text ?? '').match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Every word the card puts on the screen: the term, its form, every answer. */
function cardWords(card) {
  if (!card) return new Set();
  const parts = [card.term, card.form, card.answer, ...(card.alternatives ?? [])];
  return new Set(parts.flatMap(wordsOf));
}

/**
 * Does this message share a word with the card being asked?
 *
 * The answer-leak guard, and it is cheap insurance rather than paranoia: with
 * sixty mottos in rotation, *Repetitio **mater** studiorum* on the card for
 * `mater` is not hypothetical, it is a matter of time. The Dutch is checked
 * too, because in the reverse direction the Dutch is the prompt and the Latin
 * is the answer, so either half can give the game away.
 */
export function leaks(message, card) {
  const forbidden = cardWords(card);
  if (forbidden.size === 0) return false;
  const said = [message.nl, message.la, message.tr].flatMap(wordsOf);
  return said.some(word => forbidden.has(word));
}

/**
 * One message for this mood that does not give the card away.
 *
 * If every candidate collides — possible for a very common word — the motto is
 * dropped rather than the coach, because the encouragement is the part she
 * needs and the Latin is the part that leaks.
 *
 * @param {string} mood
 * @param {object|null} card
 * @param {object} [opts]
 * @param {() => number} [opts.random]
 * @param {object|null} [opts.avoid]  the last message shown, not repeated back to back
 */
export function pickMessage(mood, card, { random = Math.random, avoid = null } = {}) {
  const all = MSG[mood] ?? MSG.good;
  const clean = all.filter(m => !leaks(m, card));

  if (clean.length === 0) {
    /* Nothing survives with its motto attached, so strip them: a bare Dutch
       line cannot leak a Latin answer. */
    const bare = all.map(m => ({ nl: m.nl })).filter(m => !leaks(m, card));
    return bare[Math.floor(random() * bare.length)] ?? { nl: all[0].nl };
  }

  const fresh = clean.length > 1 ? clean.filter(m => m !== avoid) : clean;
  return fresh[Math.floor(random() * fresh.length)];
}

/* --------------------------------------------------------- the cast ------ */

/**
 * Which of the busts she has earned turns up this lesson.
 *
 * The pool grows: every rank up to her current one stays eligible, so the
 * servus never disappears, and higher ranks are favoured so advancement is
 * visible. Rolled once per lesson and not once per answer — a mascot that
 * shape-shifts between two consecutive questions is unsettling and reads as a
 * bug rather than as variety.
 */
export function castFor(rankIndex, random = Math.random) {
  if (rankIndex <= 0) return TYPES[0];

  /* Triangular weights: rank i is worth i+1 tickets. */
  const total = ((rankIndex + 1) * (rankIndex + 2)) / 2;
  let ticket = random() * total;
  for (let i = 0; i <= rankIndex; i++) {
    ticket -= i + 1;
    if (ticket < 0) return TYPES[i];
  }
  return TYPES[rankIndex];
}

/* ----------------------------------------------------------- the DOM ----- */

/* Its own three lines rather than ui.js's, because ui.js imports this module
   and importing it back would be a cycle for the sake of a createElement. */
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/**
 * Build the bubble. Split out from `present` so the Results screen's rank-up
 * can render the same thing from a different message.
 */
function bubble(rank, message) {
  const box = el('div', 'coach-bubble');
  const who = el('p', 'coach-who');
  who.append(el('span', 'coach-rank', rank.latin));
  who.append(el('span', 'coach-gloss', rank.dutch));
  box.append(who);
  box.append(el('p', 'coach-line', message.nl));

  if (message.la) {
    const motto = el('p', 'coach-motto');
    motto.append(el('span', 'coach-la', `« ${message.la} »`));
    motto.append(el('span', 'coach-tr', message.tr ?? ''));
    box.append(motto);
  }
  return box;
}

/**
 * One coach, for one lesson.
 *
 * @param {object} opts
 * @param {number} [opts.xp]        her total XP at lesson start
 * @param {boolean} [opts.motion]   false under prefers-reduced-motion
 * @param {() => number} [opts.random]
 * @param {number} [opts.scale]     logical pixels to CSS pixels for the bust
 */
export function createCoach({
  xp = 0, motion = true, random = Math.random, scale = 2,
} = {}) {
  let rankIndex = rankAt(xp);
  let character = castFor(rankIndex, random);
  let waitMs = WAIT_MS;
  let last = null;              // the message shown, so it is not repeated
  let live = null;              // { cancel } for whatever is animating now

  /**
   * Animate one bust on one canvas until `until`, then go quiet.
   *
   * Under reduced motion this paints exactly once and starts no loop at all.
   * The demo re-rendered every 200 ms even then, which is a loop nobody is
   * looking at — PLAN-ROMA section 8 calls that what it is, battery.
   */
  function animate(canvas, { type, mood, flourish, until, onComplete }) {
    const ctx = fitBust(canvas, { scale });
    const g = painter(ctx, scale);
    const clear = () => ctx.clearRect(
      BUST.x * scale, BUST.y * scale, BUST.w * scale, BUST.h * scale,
    );

    if (!motion) {
      clear();
      drawBust(g, type, { mood, motion: false, flourish });
      onComplete?.();
      return { cancel() {} };
    }

    let parts = flourish ? burst(random) : [];
    let frame = null;
    let previous = performance.now();
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      if (frame) cancelAnimationFrame(frame);
      frame = null;
      /* Settle into the rest pose rather than freezing mid-bob. */
      clear();
      drawBust(g, type, { mood, motion: false, flourish: false });
      onComplete?.();
    };

    const step = now => {
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;

      clear();
      const t = now / 1000;
      drawBust(g, type, { mood, t, talk: now < until, flourish, motion: true });
      parts = stepBurst(parts, dt);
      drawBurst(g, parts);

      if (now >= until) return finish();
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return { cancel: finish };
  }

  return {
    get rank() { return RANKS[rankIndex]; },
    get rankIndex() { return rankIndex; },
    get character() { return character; },

    /**
     * Set the rank, silently, and draw this lesson's character.
     *
     * Silently is the point: the spec detected the threshold inside `present`
     * and fired a rank-up mid-lesson, which collides with the stage crossing
     * the Results screen already schedules for the very same event. Call this
     * once at lesson start and never pass XP to `present` again.
     */
    setXp(next) {
      rankIndex = rankAt(next);
      character = castFor(rankIndex, random);
    },

    setWait(ms) { waitMs = ms; },

    /** Stop whatever is animating. Safe to call when nothing is. */
    stop() {
      live?.cancel();
      live = null;
    },

    /**
     * The coach, as an element ready to drop beside the reveal.
     *
     * Returns null when this answer is not one of the ones that gets a coach,
     * so the caller's whole integration is `const node = coach.present(...)`
     * followed by `if (node)`.
     *
     * @param {object} opts
     * @param {'good'|'improve'|'perfect'} opts.mood
     * @param {object|null} [opts.card]  { term, form, answer, alternatives } —
     *   what is on screen, for the answer-leak guard
     * @param {() => void} [opts.onComplete]  called when it goes quiet, early
     *   if she taps it. Never the only way forward: the reveal's own button is
     *   live the whole time.
     */
    present({ mood = 'good', card = null, onComplete = null } = {}) {
      this.stop();

      const message = pickMessage(mood, card, { random, avoid: last });
      last = message;

      const node = el('div', `coach coach-${mood}`);
      const canvas = el('canvas', 'coach-bust');
      canvas.setAttribute('aria-hidden', 'true');
      node.append(canvas, bubble(RANKS[rankIndex], message));

      /* Deferred: the canvas has to be in the document before it can be sized
         against the device pixel ratio, and the caller has not appended it
         yet. A microtask is enough — it runs after the synchronous append. */
      queueMicrotask(() => {
        if (!node.isConnected) return;
        live = animate(canvas, {
          type: character,
          mood,
          flourish: mood === 'perfect',
          until: performance.now() + waitMs,
          onComplete,
        });
      });

      /* Any tap settles it immediately. Not a way forward — the reveal's
         Verder button is that, and it never stops being that — just a way to
         make the coach stop moving for someone who is done looking. */
      node.addEventListener('click', () => this.stop());

      return node;
    },

    /**
     * The rank-up card's contents, for the Results screen. Returns null when
     * the lesson crossed no threshold.
     *
     * Takes the XP either side of the lesson rather than a stored watermark,
     * so it fires exactly once per threshold with nothing persisted.
     */
    rankUp(before, after) {
      const crossed = rankUpBetween(before, after);
      if (!crossed) return null;
      return {
        ...crossed,
        /* The rank she has just reached is who turns up to announce it — not a
           draw from the pool. This one is not about variety. */
        character: TYPES[crossed.to],
        message: crossed.line ?? { nl: `Je bent nu ${crossed.rank.latin}.` },
      };
    },

    /** Paint one bust into a canvas, for the rank-up card. */
    show(canvas, type, { mood = 'perfect', flourish = true, onComplete = null } = {}) {
      this.stop();
      live = animate(canvas, {
        type,
        mood,
        flourish,
        /* A rank-up is once a month at most, so it gets twice the beat. */
        until: performance.now() + waitMs * 2,
        onComplete,
      });
      return live;
    },
  };
}
