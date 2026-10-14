/* Tests for the committed corpus itself. The loader tests stub `fetch`, so they
   cannot notice a real data/index.json pointing at a file that is not there —
   which surfaces only as a 404 on the phone. These read the actual files. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { parseList, normalize } from '../js/parse.js';
import { loadCorpus } from '../js/lists.js';

const DATA = new URL('../data/', import.meta.url);
const index = JSON.parse(readFileSync(new URL('index.json', DATA), 'utf8'));
const folderOf = file => file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';

test('every list in index.json points at a file that exists', () => {
  const missing = index.lists
    .filter(l => !existsSync(new URL(l.file, DATA)))
    .map(l => `${l.id} → data/${l.file}`);
  assert.deepEqual(missing, []);
});

test('list ids are unique', () => {
  const ids = index.lists.map(l => l.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
});

test('every group a list names is declared', () => {
  const groups = new Set(index.groups.map(g => g.id));
  const unknown = index.lists
    .filter(l => l.group && !groups.has(l.group))
    .map(l => `${l.id} → ${l.group}`);
  assert.deepEqual(unknown, []);
});

test('every committed list parses to words without rejects', () => {
  for (const l of index.lists) {
    const path = new URL(l.file, DATA);
    if (!existsSync(path)) continue; // reported by the existence test
    const r = parseList(readFileSync(path, 'utf8'), { listId: l.id });
    assert.ok(r.words.length > 0, `${l.file} has no words`);
    assert.deepEqual(r.rejects, [], `${l.file} has rejected lines`);
  }
});

test('every .txt under data/ is listed in index.json', () => {
  /* A chapter added to a folder but not to the index never reaches the app. */
  const listed = new Set(index.lists.map(l => l.file));
  const onDisk = readdirSync(DATA, { recursive: true })
    .map(f => String(f).replaceAll('\\', '/'))
    .filter(f => f.endsWith('.txt'));
  assert.deepEqual(onDisk.filter(f => !listed.has(f)), []);
});

test('every rev is a positive integer', () => {
  /* rev is the cache-buster: a missing one fetches "?v=undefined" forever. */
  const bad = index.lists.filter(l => !Number.isInteger(l.rev) || l.rev < 1).map(l => l.id);
  assert.deepEqual(bad, []);
});

test('group ids are unique and every group has a title', () => {
  const ids = index.groups.map(g => g.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
  assert.deepEqual(index.groups.filter(g => !g.title?.trim()).map(g => g.id), []);
});

test('lists in the same folder belong to the same group', () => {
  /* The folder is how chapters are filed; the group is how they are shown.
     A file moved without its "group" lands under the wrong heading. */
  const groupsPerFolder = new Map();
  for (const l of index.lists) {
    const folder = folderOf(l.file);
    if (!groupsPerFolder.has(folder)) groupsPerFolder.set(folder, new Set());
    groupsPerFolder.get(folder).add(l.group ?? null);
  }
  const mixed = [...groupsPerFolder]
    .filter(([folder, groups]) => folder && (groups.size > 1 || groups.has(null)))
    .map(([folder, groups]) => `${folder}: ${[...groups].join(', ')}`);
  assert.deepEqual(mixed, []);
});

test('every committed list has a title line', () => {
  const untitled = index.lists
    .filter(l => existsSync(new URL(l.file, DATA)))
    .filter(l => !parseList(readFileSync(new URL(l.file, DATA), 'utf8')).title)
    .map(l => l.file);
  assert.deepEqual(untitled, []);
});

test('the full corpus loads, and no card id is shared by two different words', async () => {
  /* Serve data/ from disk so this runs the real loader over the real files. */
  const realFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const path = new URL(String(url).split('?')[0], new URL('../', import.meta.url));
    if (!existsSync(path)) return { ok: false, status: 404 };
    const body = readFileSync(path, 'utf8');
    return { ok: true, status: 200, text: async () => body, json: async () => JSON.parse(body) };
  };
  try {
    const { lists, words } = await loadCorpus('data/');
    assert.equal(lists.length, index.lists.length);

    /* The merge folds same-id words into one card, so a hash collision between
       two different words would silently swallow one of them. Re-parse each
       list on its own and check every id still means one term. (Not one form:
       "familiae, f." and "familiae, v." are the same word and rightly merge.) */
    const meaning = new Map();
    const clashes = [];
    for (const list of lists) {
      for (const w of list.words) {
        const key = normalize(w.term);
        const seen = meaning.get(w.id);
        if (seen && seen !== key) clashes.push(`${w.id}: ${seen} vs ${key}`);
        meaning.set(w.id, key);
      }
    }
    assert.deepEqual(clashes, []);
    assert.equal(words.size, meaning.size);
  } finally {
    globalThis.fetch = realFetch;
  }
});
