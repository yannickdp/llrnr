---
description: "Transcribe a textbook vocab page (image) into a data/<id>.txt word list"
agent: "agent"
argument-hint: "chapter/section id (e.g. 1.7) and the item range, e.g. \"1.8, 86-100\""
---
Transcribe the attached Latin textbook vocab image directly into `data/<id>.txt`,
where `<id>` is the chapter/section id given in the request (e.g. `1.7` →
`data/1.7.txt`). No staging copy — the app reads `data/*.txt` via `data/index.json`,
so that's the only file this writes. If the file already has content, append the new
items rather than overwriting.

The image may be rotated 90 degrees (either direction) — read it in its actual
orientation rather than assuming it's already upright; mentally rotate it before
transcribing so lines and columns are read in the right order.

## Update index.json

Add or update the file's entry in `data/index.json`'s `lists` array: `id` (e.g.
`latin-<id>`, following the existing `latin-ch01` style), `file` (`<id>.txt`), and
`rev`. Use `rev: 1` for a brand-new entry; bump the existing `rev` by 1 if the file
already had an entry — `lists.js` cache-busts on `rev`, so an unbumped rev means a
previously-cached copy keeps being served. Never leave `data/<id>.txt` present without
a matching `index.json` entry, and never add an `index.json` entry that doesn't
resolve to a real file in `data/`.

## Format (per PLAN.md section 4 / js/parse.js)

One entry per line: `term | form | translation`

- `|` separates the three fields; align columns with spaces like the existing
  `data/*.txt` files for readability (not required by the parser, which trims each
  field).
- Field 2 (form) is blank, or a short grammar note, when there is no inflected form
  (adverbs, prepositions) — mirror whatever the book prints there (e.g. `(bijwoord)`,
  `+ abl.`), including the hyphenated stem style like `mulier-is, v.`.
- `/` between alternative translations that are true synonyms. Keep a printed `;`
  as-is (it marks related-but-distinct senses in this book, not alternatives) —
  do not convert it to `/`.
- First line of a new file: a `#` comment naming the chapter/range, e.g.
  `# 1.7 — items 64-85`.

## Rules

- **Macrons and other diacritics are mandatory** — reproduce every long vowel mark
  exactly as printed (ā, ē, ī, ō, ū) on both the term and the form. Never drop them
  to plain ASCII.
- Transcribe only the printed dictionary content: term, form, Dutch translation.
  Skip handwritten annotations, correction arrows, and the small side-column
  cross-references to other languages (Fr./Ndl./Eng. notes, example sentences) —
  those aren't part of the word list.
- Keep punctuation that is part of the headword itself (e.g. a trailing `?` on an
  interrogative adverb like `cūr?` if the book prints it that way).
- Preserve the book's item order and numbers only as a mental check — item numbers
  themselves are not written into the file.
- After writing, do a quick pass reading the file back and cross-checking each line
  against the image for macron placement and gender/declension abbreviations
  (`m.`, `f.`, `n.`) before finishing.
