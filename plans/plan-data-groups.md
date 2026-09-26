# Plan — grouping data files into chapter folders ("Caput")

## Problem

`data/` is flat: `1.2.txt` … `1.10.txt` all sit next to `index.json` with no
indication they belong together. As more chapters are added (`2.x`, `3.x`, …)
this only gets more confusing, and the Woorden screen already lists every
`.txt` file as one long undifferentiated stack of cards.

## Scope

- Move the existing `1.2.txt` … `1.10.txt` files into `data/caput-1/`.
- `data/latin-chapter-01.txt` is **left where it is, ungrouped**. It doesn't
  match the `1.x.txt` naming the request calls out, and TODO §1.2 already
  marks it a temporary stand-in waiting to be swapped for the real chapter 1
  list — grouping it now would just be more to rename later. It keeps
  rendering exactly as it does today (a plain card, no group header).
- `data/index.json` gains a `groups` array (`{id, title}`) and each list entry
  that belongs to one gets a `group` field naming it. `file` paths become
  `caput-1/1.2.txt` etc.
- The Woorden screen (`renderChapters()` in `js/app.js`) renders a group
  header above the chapter cards that share a `group`, in the order the group
  first appears in `index.json`. Ungrouped lists render exactly as before —
  no header, just the card — so this is additive, not a breaking change for
  future single-file chapters.

## Non-goals

- Not touching the Toetsen screen's chapter-scope checklist (`#test-scope`) —
  it wasn't mentioned and grouping it is a separate, smaller change if wanted
  later.
- Not renaming `list.id` values (`latin-1.2` etc.) — those are stored in
  `store.js` (`excludedLists`, test `lists[]`) and renaming them would orphan
  existing progress. Only `file` (the fetch path) and the new `group` field
  change.
- No card data changes: card IDs are content hashes of the term, not of the
  file path, so moving files cannot touch anyone's progress.

## Changes

1. **`data/caput-1/`** — new folder; `1.2.txt` … `1.10.txt` moved into it
   (`git mv` so history follows).
2. **`data/index.json`** —
   ```json
   {
     "version": 1,
     "groups": [{ "id": "caput-1", "title": "Caput 1" }],
     "lists": [
       { "id": "latin-ch01", "file": "latin-chapter-01.txt", "rev": 1 },
       { "id": "latin-1.2", "file": "caput-1/1.2.txt", "rev": 1, "group": "caput-1" },
       ...
     ]
   }
   ```
3. **`js/lists.js`** — `loadCorpus()` return value gains `groups` (straight
   from `index.groups ?? []`), so `js/app.js` can resolve a group id to its
   title without re-fetching `index.json`. `file` paths with a `/` in them
   need no special handling: `fetch(`${base}${list.file}?v=${list.rev}`)`
   already works for `caput-1/1.2.txt` as-is.
4. **`js/app.js`** — `renderChapters()` walks `corpus.lists` once, and
   whenever a list's `group` differs from the previous list's, appends a
   `<h2 class="section-head">` naming the group (falling back to the raw id
   if `corpus.groups` has no matching entry) before that list's card.
   Ungrouped lists get no header, same as today.
5. **`service-worker.js`** — no change needed; it already builds
   `data/${list.file}?v=${list.rev}` from whatever `index.json` says.

## Testing

- `test/lists.test.mjs`'s "the committed data/ loads and parses with nothing
  rejected" test reads `list.file` straight from the real `index.json` and
  `readFile`s that path, so it exercises the real move without changes.
- Add a small `js/app.js`-level check is out of scope (no existing DOM test
  harness renders `#chapter-list` against a live `corpus`); manually verified
  in the browser instead.
- Run the full suite (`node --test test/`) after the move.
