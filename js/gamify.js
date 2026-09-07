/* gamify.js — rewarding the work, not the grinding.

   The whole design rests on one rule: XP is paid for *lasting progress*, never
   per answer. With micro-ladder repeats a word can be answered correctly four
   times in ten minutes, so paying per answer would make five-second churn the
   optimal way to farm XP — the app would be teaching her to game it.

   Pure functions over the progress blob, like schedule.js and cram.js: the
   clock comes in, a new value comes out. */

import { studyDay } from './schedule.js';
import { daysLeft, isActive, readiness } from './cram.js';
import { STAGE_XP } from './roma/catalogue.js';

/** What lasting progress is worth. Nothing else pays. */
export const XP = {
  graduated: 25,   // cleared the micro-ladder: the word is in the boxes
  promoted: 15,    // climbed a box
  learned: 50,     // known both ways round, for good
  lesson: 10,      // a flat thank-you for finishing
};

/**
 * Growth stages, named in Latin, replacing an abstract level number. A level
 * and a visible city are two abstractions doing one job; the city wins, and
 * these names are themselves vocabulary.
 *
 * The names live here because they are what she reads; the thresholds come from
 * the catalogue, because a stage begins when its first building appears and
 * there should be exactly one place that decides when that is. This file used
 * to carry its own numbers — 0/400/1200/2800/6000 against the catalogue's
 * 0/4000/14000/30000/50000 — and two ladders for one number would have shown up
 * as a stage name changing nowhere near a building.
 *
 * Yes, this makes the XP core import from the reward city. That is the right
 * direction: PLAN-ROMA is explicit that the city is the canonical picture of
 * progress, so the city is what defines a stage.
 *
 * The thresholds are still provisional. PLAN-ROMA step 8 retunes them against a
 * week of real lesson data, and editing the catalogue now moves both.
 */
export const STAGES = [
  { name: 'Roma Quadrata', dutch: 'de eerste muren', xp: STAGE_XP[0] },
  { name: 'Regnum', dutch: 'het koninkrijk', xp: STAGE_XP[1] },
  { name: 'Res Publica', dutch: 'de republiek', xp: STAGE_XP[2] },
  { name: 'Imperium', dutch: 'het keizerrijk', xp: STAGE_XP[3] },
  { name: 'Roma Aeterna', dutch: 'het eeuwige Rome', xp: STAGE_XP[4] },
];

/** Where `xp` sits: the stage reached, and how far into the next one. */
export function stageFor(xp) {
  let index = 0;
  for (let i = 0; i < STAGES.length; i++) if (xp >= STAGES[i].xp) index = i;

  const stage = STAGES[index];
  const next = STAGES[index + 1] ?? null;
  const span = next ? next.xp - stage.xp : 0;

  return {
    index,
    stage,
    next,
    xpIntoStage: xp - stage.xp,
    xpToNext: next ? next.xp - xp : 0,
    fraction: next ? Math.min(1, (xp - stage.xp) / span) : 1,
  };
}

/**
 * XP earned by one lesson's results — from transitions only.
 * A wrong answer costs nothing: PLAN section 3 is explicit that she never
 * loses XP, because a lost box is already re-earnable in the same session.
 */
export function xpForResults(results) {
  return results.graduated * XP.graduated
    + results.promoted * XP.promoted
    + results.learned * XP.learned
    + (results.answered > 0 ? XP.lesson : 0);
}

/* ============================================================= streak ==== */

/** ISO-ish week key, used only to hand out one streak freeze per week. */
export function weekKey(now) {
  const d = new Date(studyDay(now));
  const day = (d.getDay() + 6) % 7;          // Monday = 0
  d.setDate(d.getDate() - day + 3);          // the Thursday of that week
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(
    ((d - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7,
  );
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

const daysBetween = (from, to) =>
  Math.round((new Date(to) - new Date(from)) / 86400000);

/**
 * Advance the streak for a lesson finished now.
 *
 * One missed day is forgiven if a freeze is available, because a single busy
 * Wednesday wiping a thirty-day streak is exactly the kind of thing that makes
 * someone stop. Freezes refill once a week.
 *
 * @returns {{streak: object, extended: boolean, frozen: boolean, doubled: boolean}}
 *   `doubled` is the first-lesson-of-the-day bonus, which is decided here
 *   because it is the same question as "has she practised today".
 */
export function advanceStreak(streak, now = Date.now()) {
  const today = studyDay(now);
  const next = { ...streak };

  /* A new week hands back the one freeze, whether or not the old one was used. */
  if (next.freezeWeek !== weekKey(now)) {
    next.freezes = 1;
    next.freezeWeek = weekKey(now);
  }

  if (next.lastDay === today) {
    /* Already practised today: the streak is untouched and the double is spent. */
    return { streak: next, extended: false, frozen: false, doubled: false };
  }

  const gap = next.lastDay ? daysBetween(next.lastDay, today) : null;
  let frozen = false;

  if (gap === 1) {
    next.current += 1;
  } else if (gap === 2 && next.freezes > 0) {
    next.freezes -= 1;
    next.current += 1;
    frozen = true;
  } else {
    next.current = 1;
  }

  next.lastDay = today;
  next.best = Math.max(next.best, next.current);

  return { streak: next, extended: true, frozen, doubled: true };
}

/** Has she finished a lesson today? The daily-goal ring, in one line. */
export function goalMetToday(streak, now = Date.now()) {
  return streak.lastDay === studyDay(now);
}

/* ============================================================ applying === */

/**
 * Award a finished lesson: XP, the double, and the streak.
 * Mutates nothing — hands back the numbers for the caller to store.
 */
export function awardLesson(progress, results, now = Date.now()) {
  const base = xpForResults(results);
  const { streak, extended, frozen, doubled } = advanceStreak(progress.streak, now);
  const gained = doubled ? base * 2 : base;

  return {
    xp: progress.xp + gained,
    streak,
    gained,
    doubled: doubled && base > 0,
    extended,
    frozen,
  };
}

/* ============================================================ badges ===== */

/**
 * What each badge is for. Ids are English and never change; names are what she
 * reads. Every one of them rewards something that took real work — there is
 * deliberately no badge for opening the app or for answering a lot.
 */
export const BADGES = [
  {
    id: 'first-learned',
    name: 'Eerste woord gekend',
    why: 'Een woord dat je in beide richtingen kent.',
    earned: c => c.learnedCount >= 1,
  },
  {
    id: 'ten-learned',
    name: 'Tien woorden gekend',
    why: 'Tien woorden die je beide kanten op kent.',
    earned: c => c.learnedCount >= 10,
  },
  {
    id: 'chapter-learned',
    name: 'Hoofdstuk uitgespeeld',
    why: 'Elk woord van een hoofdstuk gekend.',
    earned: c => c.lists.some(list =>
      list.words.length > 0
      && list.words.every(word => c.cards.get(word.id)?.phase === 'learned')),
  },
  {
    id: 'streak-7',
    name: 'Zeven dagen op rij',
    why: 'Een week lang elke dag geoefend.',
    earned: c => c.streak.current >= 7,
  },
  {
    id: 'streak-30',
    name: 'Dertig dagen op rij',
    why: 'Een maand lang elke dag geoefend.',
    earned: c => c.streak.current >= 30,
  },
  {
    id: 'flawless-lesson',
    name: 'Les zonder terugval',
    why: 'Een hele les zonder één woord kwijt te raken.',
    earned: c => c.results.answered >= 8 && c.results.dropped === 0,
  },
  {
    id: 'typed-100',
    name: 'Honderd keer getypt',
    why: 'Honderd antwoorden zelf uitgeschreven.',
    earned: c => c.typedTotal >= 100,
  },
  {
    /* The one that rewards not cramming — PLAN section 3 singles it out. */
    id: 'ready-early',
    name: 'Klaar met een dag over',
    why: 'Alles op tijd geleerd, niet de avond ervoor.',
    earned: c => c.tests.some(test => {
      if (!isActive(test, c.now) || daysLeft(test, c.now) < 1) return false;
      const summary = readiness(c.cards, c.words, test, c.now);
      return summary.total > 0 && summary.ready === summary.total;
    }),
  },
];

/**
 * Which badges she has just earned — those whose condition now holds and that
 * she does not already have.
 *
 * @param {object} context  {cards, words, lists, streak, results, tests, typedTotal, now}
 * @param {string[]} already  badge ids already awarded
 */
export function newBadges(context, already = []) {
  const have = new Set(already);
  return BADGES.filter(badge => !have.has(badge.id) && badge.earned(context));
}

