/* answer.js — is what she typed right?

   Forgiving about what she is not marked on (case, accents, stray spaces) and
   strict about what she is (the letters). A near miss is graded 'almost',
   which costs her nothing in the boxes but does not count as a clean recall
   either — see schedule.js, where the evidence is recorded. */

import { normalize } from './parse.js';

/**
 * Below this length, a single edit is a different word rather than a typo:
 * Latin is full of two- and three-letter words where one letter is the whole
 * distinction — ad/ab, et/ex, sed/sub. Calling those "almost" would tell her
 * she nearly had it when she had in fact written something else.
 */
export const MIN_ALMOST_LENGTH = 4;

/** What she has to produce for a word, in one direction. */
export function expectedFor(word, direction) {
  return direction === 'fwd' ? word.translations : [word.term];
}

/** What she is shown. Reverse mode prompts with the first translation only. */
export function promptFor(word, direction) {
  return direction === 'fwd' ? word.term : word.translations[0];
}

/**
 * Is `a` reachable from `b` by exactly one insertion, deletion or substitution?
 *
 * A bounded check rather than a full Levenshtein matrix: we only ever care
 * whether the distance is 0 or 1, and this answers that in one pass.
 */
export function withinOneEdit(a, b) {
  if (a === b) return true;

  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.length - short.length > 1) return false;

  let i = 0, j = 0, edits = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    /* Same length means a substitution; otherwise skip the extra letter. */
    if (short.length === long.length) i++;
    j++;
  }
  return true;
}

/**
 * Grade one typed answer.
 *
 * @param {object} opts
 * @param {string} opts.typed
 * @param {object} opts.word      the word being asked
 * @param {'fwd'|'rev'} opts.direction
 * @param {Map<string,object>} [opts.pool]  every word in play, for the reverse
 *        collision rule below
 * @returns {'correct'|'almost'|'wrong'}
 */
export function check({ typed, word, direction, pool = null }) {
  const answer = normalize(typed ?? '');
  if (!answer) return 'wrong';

  const accepted = expectedFor(word, direction).map(normalize);

  /* The whole field as written counts too, so typing "moeder / mama" for a word
     with both is right rather than nearly right. */
  if (direction === 'fwd' && word.answer) accepted.push(normalize(word.answer));

  /* Several Latin words can share a Dutch translation: prompt "zeggen" and
     both dicere and narrare are right. Marking one of them wrong is the
     fastest way to make her stop trusting the app, so any pool word that the
     prompt also means counts — and the card that was asked gets the credit. */
  if (direction === 'rev' && pool) {
    const prompt = normalize(promptFor(word, direction));
    for (const other of pool.values()) {
      if (other.translations.some(t => normalize(t) === prompt)) {
        accepted.push(normalize(other.term));
      }
    }
  }

  if (accepted.includes(answer)) return 'correct';

  /* One letter out on a word long enough for that to be a slip of the thumb. */
  if (accepted.some(a => a.length >= MIN_ALMOST_LENGTH && withinOneEdit(answer, a))) {
    return 'almost';
  }

  return 'wrong';
}
