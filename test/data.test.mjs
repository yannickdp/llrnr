/* Tests for the committed corpus itself. The loader tests stub `fetch`, so they
   cannot notice a real data/index.json pointing at a file that is not there —
   which surfaces only as a 404 on the phone. These read the actual files. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { parseList } from '../js/parse.js';

const DATA = new URL('../data/', import.meta.url);
const index = JSON.parse(readFileSync(new URL('index.json', DATA), 'utf8'));

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
