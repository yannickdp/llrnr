/* parse.js — the word-list parser.

   Pure by design: text in, words out, plus every line it could not read and
   every ambiguity it noticed. It does no fetching, no storage and no DOM, so
   one parser serves both the committed data/*.txt files and the paste-in
   importer, and it is testable without a browser.

   Every string that reaches her — reject reasons, warnings — is Dutch, and carries
   a stable English `code`/`type` beside it so the wording can be reworded without
   breaking anything that tests or branches on it. Thrown errors stay English: those
   are bug guards, and she never sees one.

   Line format (PLAN section 4):

       term | form | translation
       term | translation            <- two fields: no grammar form

   `|` separates fields, `/` separates alternative translations, `#` starts a
   comment and the first `#` line is the chapter title. */

/* ============================================================ hashing ==== */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * FNV-1a, 32-bit, as eight lowercase hex digits.
 *
 * Hashes UTF-16 code units rather than UTF-8 bytes — which is not canonical
 * FNV, but is deterministic, and every string reaching it has been through
 * normalize() and so is effectively ASCII.
 */
export function fnv1a(str) {
  let h = FNV_OFFSET;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME); // imul, or JS floats lose the high bits
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Fold a term to its identity: accents stripped, lowercased, whitespace
 * collapsed. This is what card IDs are derived from, so it is also the reason
 * realigning a column or fixing a capital cannot detach her progress.
 */
export function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** The first word of a grammar form: "libera, liberum" -> "libera". */
function firstWord(form) {
  return normalize(form).match(/[\p{L}\p{N}]+/u)?.[0] ?? '';
}

/**
 * A card ID. Normally content-derived from the term alone, so the same word in
 * two chapters is one card. `qualify` adds the form's first word, which is how
 * homographs (liber the book, liber the free) are told apart.
 */
export function cardId(term, form = '', qualify = false) {
  const key = qualify ? `${normalize(term)}|${firstWord(form)}` : normalize(term);
  return `h${fnv1a(key)}`;
}

/* ========================================================== separators === */

/* Checked in this order against the first data line. Tab comes before `;`
   because a tab is unambiguous spreadsheet output, whereas a stray `;` can
   turn up inside ordinary text. */
const SEPARATORS = [
  { char: '|', label: '|' },
  { char: '\t', label: 'tab' },
  { char: ';', label: ';' },
];

function detectSeparator(firstDataLine) {
  return SEPARATORS.find(s => firstDataLine.includes(s.char)) ?? SEPARATORS[0];
}

/* ============================================================== parse ==== */

/**
 * Parse one word list.
 *
 * @param {string} text  the file or pasted contents
 * @param {object} [opts]
 * @param {Set<string>} [opts.collidingTerms]  normalised terms known to be
 *        homographs elsewhere in the corpus. Terms that collide *within* this
 *        text are detected here and need not be passed.
 * @param {string} [opts.listId]  stamped onto each word, so a card can record
 *        which chapters it belongs to.
 * @returns {{
 *   title: string|null,
 *   separator: string,
 *   words: Array<{id,term,form,translations,answer,line,lists}>,
 *   rejects: Array<{line,text,code,reason}>,
 *   warnings: Array<object>
 * }}
 */
export function parseList(text, { collidingTerms = new Set(), listId = null } = {}) {
  const lines = String(text)
    .replace(/^﻿/, '') // a BOM would otherwise ride along on the first term
    .split(/\r?\n/);

  let title = null;
  let separator = null;
  const rows = [];
  const rejects = [];

  for (let i = 0; i < lines.length; i++) {
    const line = i + 1;
    const raw = lines[i].trim();

    if (!raw) continue;

    if (raw.startsWith('#')) {
      /* The first comment names the chapter, so no metadata lives elsewhere.
         Later comments are just comments. */
      if (title === null) {
        const stripped = raw.replace(/^#+\s*/, '').trim();
        if (stripped) title = stripped;
      }
      continue;
    }

    separator ??= detectSeparator(raw);

    const fields = raw.split(separator.char).map(f => f.trim());

    /* Tolerate a trailing separator — "pater | patris, m. | vader |" — but
       only past the third field. Trimming any further would read
       "pater | patris, m. |" as a two-field line, quietly making the grammar
       form the answer. A missing translation must be reported, not guessed. */
    while (fields.length > 3 && fields.at(-1) === '') fields.pop();

    if (fields.length === 1) {
      rejects.push({
        line, text: raw, code: 'no-separator',
        reason: `geen ${separator.label} gevonden — verwacht "woord ${separator.label} vorm ${separator.label} vertaling"`,
      });
      continue;
    }
    if (fields.length > 3) {
      rejects.push({
        line, text: raw, code: 'too-many-fields',
        reason: `${fields.length} velden, verwacht er 2 of 3 — staat er een ${separator.label} te veel?`,
      });
      continue;
    }

    /* Two fields mean a word and its meaning; three mean a word, its form and
       its meaning. */
    const [term, form, translation] =
      fields.length === 2 ? [fields[0], '', fields[1]] : fields;

    if (!term) {
      rejects.push({ line, text: raw, code: 'no-term', reason: 'geen woord op deze regel' });
      continue;
    }

    const translations = translation.split('/').map(t => t.trim()).filter(Boolean);
    if (!translations.length) {
      rejects.push({
        line, text: raw, code: 'no-translation',
        reason: raw.endsWith(separator.char)
          ? `geen vertaling voor "${term}" — de regel eindigt op ${separator.label}: vul het laatste veld in of laat de ${separator.label} weg`
          : `geen vertaling voor "${term}"`,
      });
      continue;
    }

    rows.push({
      line,
      term,
      form,
      translations,
      /* The full field as written, shown on reveal as the canonical answer. */
      answer: translation,
    });
  }

  /* --- homographs -------------------------------------------------------
     A term appearing twice in the corpus cannot be keyed on the term alone,
     so those cards — and only those — fold the form into the hash. Doing it
     only where needed keeps typo-resilience for every ordinary word. */

  const localCounts = new Map();
  for (const row of rows) {
    const key = normalize(row.term);
    localCounts.set(key, (localCounts.get(key) ?? 0) + 1);
  }

  const colliding = new Set(collidingTerms);
  for (const [key, count] of localCounts) if (count > 1) colliding.add(key);

  const words = [];
  const warnings = [];
  const seenIds = new Map();

  for (const row of rows) {
    const key = normalize(row.term);
    const id = cardId(row.term, row.form, colliding.has(key));

    /* Same term, same form (or no form at all): a genuine duplicate line
       rather than a homograph. Keeping both would give two cards one ID. */
    if (seenIds.has(id)) {
      rejects.push({
        line: row.line, text: row.term, code: 'duplicate',
        reason: `zelfde woord als op regel ${seenIds.get(id)}`,
      });
      continue;
    }
    seenIds.set(id, row.line);

    words.push({
      id,
      term: row.term,
      form: row.form,
      translations: row.translations,
      answer: row.answer,
      line: row.line,
      lists: listId ? [listId] : [],
    });
  }

  for (const [key, count] of localCounts) {
    if (count < 2) continue;
    warnings.push({
      type: 'homograph',
      term: key,
      message: `"${key}" staat er ${count} keer in — uit elkaar gehouden via de vorm, kijk dit even na`,
      entries: words.filter(w => normalize(w.term) === key)
        .map(w => ({ line: w.line, form: w.form, id: w.id })),
    });
  }

  /* --- translations shared by several terms ------------------------------
     Reverse mode has to accept any of them, so the collisions are at least
     known about. */
  const byTranslation = new Map();
  for (const word of words) {
    for (const t of word.translations) {
      const key = normalize(t);
      if (!byTranslation.has(key)) byTranslation.set(key, []);
      byTranslation.get(key).push(word);
    }
  }
  for (const [key, group] of byTranslation) {
    if (group.length < 2) continue;
    warnings.push({
      type: 'shared-translation',
      translation: key,
      message: `"${key}" hoort bij ${group.length} verschillende woorden — in Nederlands → Latijn is elk daarvan juist`,
      entries: group.map(w => ({ line: w.line, term: w.term, id: w.id })),
    });
  }

  return {
    title,
    separator: (separator ?? SEPARATORS[0]).label,
    words,
    rejects,
    warnings,
  };
}
