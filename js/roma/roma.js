/* roma.js — what the city has, derived from what she has earned.

   Pure functions over total XP, like schedule.js and cram.js: numbers in, an
   answer out, nothing stored and nothing drawn. This file knows why a building
   exists; it has no idea what one looks like.

   The rule that shapes everything here: **total XP wins.** The stored
   `roma.unlocked` list and `roma.stage` are a cache, not a record. They exist
   so that "what is new since she last looked?" is answerable at all, and if
   they ever disagree with the XP they are recomputed and thrown away. A city
   she has earned must never be lost to a botched write — nothing else in this
   app is allowed to cost her a building. */

import { CATALOGUE, BY_ID, STAGE_XP } from './catalogue.js';

/**
 * Every building total `xp` has paid for, in unlock order.
 * @param {number} xp
 * @returns {string[]} ids
 */
export function unlockedAt(xp) {
  return CATALOGUE.filter(entry => xp >= entry.xp).map(entry => entry.id);
}

/**
 * The growth stage `xp` has reached, as an index into `STAGE_XP`.
 * Same numbers `gamify.js` reads, so the stage name and the skyline can never
 * drift apart.
 */
export function stageAt(xp) {
  let index = 0;
  for (let i = 0; i < STAGE_XP.length; i++) if (xp >= STAGE_XP[i]) index = i;
  return index;
}

/**
 * The building she is working toward, and how far along it is.
 *
 * `progress` is what makes the teaser a construction site rather than a
 * silhouette: it runs from 0 at the moment the previous building landed to 1 at
 * the moment this one does, so the site rises a little after every lesson
 * instead of only changing at the threshold. That is feedback on the same
 * schedule as the effort.
 *
 * @param {number} xp
 * @returns {{entry: object, remaining: number, progress: number, from: number}|null}
 *   null once the whole city is built — there is nothing left to tease.
 */
export function nextAt(xp) {
  const index = CATALOGUE.findIndex(entry => xp < entry.xp);
  if (index === -1) return null;

  const entry = CATALOGUE[index];
  const from = index === 0 ? 0 : CATALOGUE[index - 1].xp;
  const span = entry.xp - from;

  return {
    entry,
    remaining: entry.xp - xp,
    from,
    progress: span > 0 ? Math.min(1, Math.max(0, (xp - from) / span)) : 0,
  };
}

/**
 * What has appeared since she last looked at the city.
 *
 * This is the only reason the cache is stored at all. `seenXp` is a watermark:
 * everything whose threshold falls between it and her current total is new to
 * her, however many lessons ago it actually unlocked.
 *
 * @param {{seenXp?: number}} roma
 * @param {number} xp
 * @returns {object[]} catalogue entries, in unlock order
 */
export function newSince(roma, xp) {
  const seen = roma?.seenXp ?? 0;
  return CATALOGUE.filter(entry => entry.xp > seen && entry.xp <= xp);
}

/**
 * Buildings unlocked by one lesson — the Results screen's queue.
 *
 * Taken from the XP either side of the lesson rather than from the stored list,
 * because that is the fact that cannot be corrupted. A lesson big enough to
 * land two buildings queues both; PLAN-ROMA section 7 has them play one after
 * another rather than on top of each other.
 *
 * @param {number} before  total XP before the lesson
 * @param {number} after   total XP after it
 * @returns {{buildings: object[], stageCrossed: object|null}}
 */
export function unlockedBy(before, after) {
  const buildings = CATALOGUE.filter(entry => entry.xp > before && entry.xp <= after);
  const wasStage = stageAt(before);
  const nowStage = stageAt(after);

  return {
    buildings,
    /* Crossing into a new stage is a bigger moment than a building, so it is
       reported separately even though a stage crossing is always caused by
       one. */
    stageCrossed: nowStage > wasStage ? { from: wasStage, to: nowStage } : null,
  };
}

/**
 * Bring the cached city into line with the XP, and say whether it had drifted.
 *
 * Called on load and after every award. The returned object is what should be
 * stored; `changed` is true when the cache was wrong, which is worth knowing
 * only because it means something went wrong somewhere else.
 *
 * @param {{unlocked?: string[], stage?: number, seenXp?: number}} roma
 * @param {number} xp
 * @returns {{unlocked: string[], stage: number, seenXp: number, changed: boolean}}
 */
export function reconcile(roma, xp) {
  const unlocked = unlockedAt(xp);
  const stage = stageAt(xp);
  const seenXp = Math.min(roma?.seenXp ?? 0, xp);

  const had = roma?.unlocked ?? [];
  const changed = had.length !== unlocked.length
    || had.some((id, i) => id !== unlocked[i])
    || (roma?.stage ?? 0) !== stage;

  return { unlocked, stage, seenXp, changed };
}

/**
 * Mark the city as looked at. Call this when she has actually seen it — after
 * the unlock moment on the Results screen, not when a lesson starts.
 */
export function markSeen(roma, xp) {
  return { ...roma, seenXp: xp };
}

/**
 * How much of the city exists, for a caption. Decorations count: she unlocked
 * them and they are on the screen.
 */
export function cityProgress(xp) {
  const built = unlockedAt(xp).length;
  return { built, total: CATALOGUE.length, fraction: built / CATALOGUE.length };
}

/** The catalogue entry for an id, or undefined. Re-exported for convenience. */
export const entryFor = id => BY_ID[id];
