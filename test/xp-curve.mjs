/* xp-curve.mjs — how fast does XP actually accumulate?
 *
 *     node test/xp-curve.mjs [words] [lessons]
 *
 * Not a test: a measuring instrument, and the one the city's XP thresholds are
 * tuned against. It drives the real lesson loop — the real acquire ladder, the
 * real boxes, the real award rules — one ten-minute lesson a day with every
 * answer correct, and reports the XP after each along with where the city has
 * got to.
 *
 * It exists because estimating this went wrong twice. The first table assumed a
 * flat 400-600 XP a lesson; measured, it is 20 for the first lesson, ~520 by
 * the fifth, and near 1000 once reviews are flowing. The second attempt spread
 * the late thresholds evenly in XP, which produced real waits of twenty and
 * twenty-seven lessons once the word pool ran dry. Equal XP steps are not equal
 * waits, and the only way to know the difference is to run the thing.
 *
 * So when PLAN-ROMA step 8 says to retune against real data: change the numbers
 * here to match what her lessons actually produce, run this, and read the new
 * thresholds off the curve at each building's intended `lesson`.
 *
 * Two honest limits. Perfect play is an upper bound — every answer correct, so
 * no drop-backs and no repeated ladders — and one lesson every single day is
 * more than four a week. Both make this optimistic, which is why the thresholds
 * are read off the pessimistic end of her word supply.
 */

import { createLesson } from '../js/lesson.js';
import { awardLesson } from '../js/gamify.js';
import { parseList } from '../js/parse.js';
import { unlockedAt, stageAt } from '../js/roma/roma.js';
import { CATALOGUE } from '../js/roma/catalogue.js';
import { STAGES } from '../js/gamify.js';

const DAY = 86_400_000;

/** A synthetic pool of `count` words, through the real parser. */
function pool(count) {
  const lines = ['# xp-curve'];
  for (let i = 0; i < count; i++) lines.push(`term${i} | | vert${i}`);
  return new Map(parseList(lines.join('\n'), { listId: 'curve' }).words.map(w => [w.id, w]));
}

/** Play one lesson to the end, answering everything correctly. */
function playLesson(words, cards, now) {
  const lesson = createLesson({
    words, cards, now, minutes: 10, newPerLesson: 8, random: () => 0.5,
  });

  let t = now;
  /* The guard is a stop, not a schedule: a bug that stopped advancing the clock
     would otherwise spin here forever instead of failing. */
  for (let guard = 0; guard < 9000; guard++) {
    const step = lesson.next(t);
    if (step.kind === 'done') break;
    if (step.kind === 'wait') {
      t = Math.max(step.untilMs, t + 500);
      continue;
    }
    if (step.kind === 'present') {
      lesson.acknowledge(t);
      t += 4000;                       // she reads the presentation card
      continue;
    }
    lesson.answer(step.direction === 'rev' ? step.word.term : step.word.answer, t);
    t += 6000;                         // and takes six seconds over an answer
  }

  return lesson;
}

/**
 * @param {number} words    how many words exist to be learned
 * @param {number} lessons  how many daily lessons to play
 * @returns {object[]} one row per lesson
 */
export function measure(words, lessons) {
  const corpus = pool(words);
  const progress = {
    xp: 0,
    streak: { current: 0, best: 0, lastDay: null, freezes: 1, freezeWeek: null },
  };

  let cards = new Map();
  const day0 = new Date('2026-09-07T16:00:00').getTime();
  const rows = [];

  for (let day = 0; day < lessons; day++) {
    const start = day0 + day * DAY;
    const lesson = playLesson(corpus, cards, start);
    cards = lesson.cards;

    const results = lesson.results();
    const award = awardLesson(progress, results, start);
    progress.xp = award.xp;
    progress.streak = award.streak;

    rows.push({
      lesson: day + 1,
      gained: award.gained,
      xp: award.xp,
      graduated: results.graduated,
      promoted: results.promoted,
      learned: results.learned,
      built: unlockedAt(award.xp).length,
      stage: stageAt(award.xp),
    });
  }

  return rows;
}

/* ============================================================== report === */

const words = Number(process.argv[2] ?? 500);
const lessons = Number(process.argv[3] ?? 150);
const rows = measure(words, lessons);

console.log(`\n${words} words, ${lessons} daily lessons, every answer correct\n`);

/* Where each building and each stage actually arrived. */
const seen = new Set();
let stage = 0;
let previous = 0;
let worst = { gap: 0, latin: '' };

console.log('lesson      xp   what arrived');
for (const row of rows) {
  for (const entry of CATALOGUE) {
    if (row.xp < entry.xp || seen.has(entry.id)) continue;
    seen.add(entry.id);
    const gap = row.lesson - previous;
    if (gap > worst.gap) worst = { gap, latin: entry.latin };
    previous = row.lesson;
    console.log(
      String(row.lesson).padStart(6),
      String(row.xp).padStart(7),
      `  ${entry.latin}`,
      `(wanted lesson ${entry.lesson}, gap ${gap})`,
    );
  }
  if (row.stage > stage) {
    stage = row.stage;
    console.log(String(row.lesson).padStart(6), String(row.xp).padStart(7),
      `  ** ${STAGES[stage].name} **`);
  }
}

const missing = CATALOGUE.filter(e => !seen.has(e.id));
const last = rows.findIndex(r => r.built === CATALOGUE.length) + 1;

console.log('\nXP per lesson:',
  [1, 5, 10, 20, 40, 80, 120, lessons]
    .filter(d => rows[d - 1])
    .map(d => `L${d}=${rows[d - 1].gained}`)
    .join('  '));
console.log(`Longest drought: ${worst.gap} lessons, before ${worst.latin}`);
console.log(missing.length
  ? `UNREACHABLE with ${words} words: ${missing.map(e => e.latin).join(', ')}`
  : `City complete on lesson ${last}.`);
