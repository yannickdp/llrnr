/* lists.js — where word lists come from.

   parse.js is pure, so someone has to do the fetching. That is this module:
   read data/index.json, pull each .txt with its cache-busting rev, and hand
   the text to the parser.

   It also owns the one thing a single file cannot see for itself: PLAN
   section 4 makes the homograph rule corpus-wide, so "liber" in chapter 1 and
   "liber" in chapter 7 must both fold their grammar form into the hash. That
   needs every list in hand at once, hence the two passes below. */

import { parseList, normalize } from './parse.js';

const BASE = 'data/';

/**
 * The list catalogue. Note it is fetched with cache: 'no-cache' — index.json
 * is the file that *carries* the revs, so a stale copy of it would pin every
 * chapter to an old version. The lists themselves are immutable per rev and
 * cache normally. (The Phase 4.4 service worker has to honour the same split.)
 */
export async function loadIndex(base = BASE) {
  const res = await fetch(`${base}index.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`cannot read ${base}index.json (${res.status})`);

  const index = await res.json();
  if (!Array.isArray(index?.lists)) throw new Error(`${base}index.json has no "lists" array`);
  return index;
}

async function fetchText(base, list) {
  /* ?v=<rev> is the whole cache-busting story: bump rev in index.json and the
     edited chapter is fetched fresh instead of being served from the cache. */
  const res = await fetch(`${base}${list.file}?v=${list.rev}`);
  if (!res.ok) throw new Error(`cannot read ${list.file} (${res.status})`);
  return res.text();
}

/**
 * Load and parse every committed list.
 *
 * @returns {Promise<{lists: Array<object>, byId: Map<string, object>, words: Map<string, object>}>}
 *   `lists` keeps each chapter's title, words, rejects and warnings for the
 *   import preview; `words` is the merged corpus keyed by card ID, where a word
 *   appearing in several chapters is one entry whose `lists` names them all and
 *   whose accepted translations are the union across them.
 */
export async function loadCorpus(base = BASE) {
  const index = await loadIndex(base);

  const texts = await Promise.all(
    index.lists.map(async list => ({ list, text: await fetchText(base, list) }))
  );

  /* Pass 1: which normalised terms appear in more than one place, counting
     across all chapters as well as within each one. */
  const counts = new Map();
  for (const { list, text } of texts) {
    const { words } = parseList(text, { listId: list.id });
    for (const word of words) {
      const key = normalize(word.term);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const collidingTerms = new Set(
    [...counts].filter(([, n]) => n > 1).map(([term]) => term)
  );

  /* Pass 2: parse for real, now that the homographs are known.

     A term in two chapters is *not* a homograph — it is the same word, and it
     must stay one card. So only terms whose entries disagree about their
     grammar form need qualifying; same term plus same form across chapters is
     a revisit, and the merge below folds those into one card. */
  const formsPerTerm = new Map();
  for (const { list, text } of texts) {
    for (const word of parseList(text, { listId: list.id }).words) {
      const key = normalize(word.term);
      if (!formsPerTerm.has(key)) formsPerTerm.set(key, new Set());
      formsPerTerm.get(key).add(normalize(word.form));
    }
  }
  for (const term of [...collidingTerms]) {
    if ((formsPerTerm.get(term)?.size ?? 0) < 2) collidingTerms.delete(term);
  }

  const lists = [];
  const words = new Map();

  for (const { list, text } of texts) {
    const parsed = parseList(text, { listId: list.id, collidingTerms });
    lists.push({ ...list, ...parsed });

    for (const word of parsed.words) {
      const existing = words.get(word.id);
      if (!existing) {
        words.set(word.id, { ...word, translations: [...word.translations] });
        continue;
      }
      /* The same word met again in a later chapter: one card, remembering
         every chapter it belongs to, accepting every translation offered. */
      existing.lists.push(...word.lists.filter(l => !existing.lists.includes(l)));
      for (const t of word.translations) {
        if (!existing.translations.some(e => normalize(e) === normalize(t))) {
          existing.translations.push(t);
        }
      }
    }
  }

  return { lists, byId: new Map(lists.map(l => [l.id, l])), words };
}
