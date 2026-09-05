/* answer.js — is what she typed right?

   Phase 1.4 needs only the honest core: case, accents and stray whitespace are
   forgiven (they are not what she is marked on), any of the `/`-separated
   alternatives counts, and reverse mode accepts any word in the pool that the
   prompt genuinely means.

   Phase 2.2 adds the rest — Levenshtein distance 1 as "almost", and the
   clean-recall rule. Until then this returns only 'correct' or 'wrong', and
   the scheduler never sees an 'almost'. */

import { normalize } from './parse.js';

/** What she has to produce for a word, in one direction. */
export function expectedFor(word, direction) {
  return direction === 'fwd' ? word.translations : [word.term];
}

/** What she is shown. Reverse mode prompts with the first translation only. */
export function promptFor(word, direction) {
  return direction === 'fwd' ? word.term : word.translations[0];
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
 * @returns {'correct'|'wrong'}
 */
export function check({ typed, word, direction, pool = null }) {
  const answer = normalize(typed ?? '');
  if (!answer) return 'wrong';

  if (direction === 'fwd') {
    return word.translations.some(t => normalize(t) === answer) ? 'correct' : 'wrong';
  }

  if (normalize(word.term) === answer) return 'correct';

  /* Several Latin words can share a Dutch translation: prompt "zeggen" and
     both dicere and narrare are right. Marking one of them wrong is the
     fastest way to make her stop trusting the app, so any pool word that the
     prompt also means counts — and the card that was asked gets the credit. */
  if (pool) {
    const prompt = normalize(promptFor(word, direction));
    for (const other of pool.values()) {
      if (normalize(other.term) !== answer) continue;
      if (other.translations.some(t => normalize(t) === prompt)) return 'correct';
    }
  }

  return 'wrong';
}
