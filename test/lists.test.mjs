/* Tests for the loader. `fetch` is stubbed with an in-memory set of files, so
   these cover the things only the corpus can show: cache-busting revs, a word
   shared by two chapters, and a homograph split across chapters. */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadCorpus, loadIndex } from '../js/lists.js';

const realFetch = globalThis.fetch;
let requested = [];

/** Serve `files` (keyed by path without the query) and record every URL asked for. */
function serve(files) {
  requested = [];
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    const path = String(url).split('?')[0];
    const body = files[path];
    if (body === undefined) return { ok: false, status: 404 };
    return {
      ok: true,
      status: 200,
      text: async () => body,
      json: async () => JSON.parse(body),
    };
  };
}

beforeEach(() => { requested = []; });
afterEach(() => { globalThis.fetch = realFetch; });

const index = (...lists) => JSON.stringify({ version: 1, lists });

/* --------------------------------------------------------- the basics --- */

test('a list is fetched with its rev, so an edited chapter is not served stale', async () => {
  serve({
    'data/index.json': index({ id: 'a', file: 'a.txt', rev: 3 }),
    'data/a.txt': '# A\npater | patris, m. | vader',
  });

  const { lists } = await loadCorpus();
  assert.ok(requested.includes('data/a.txt?v=3'), `expected ?v=3, got ${requested}`);
  assert.equal(lists[0].title, 'A');
  assert.equal(lists[0].words.length, 1);
});

test('index.json itself is fetched no-cache, since it carries the revs', async () => {
  serve({ 'data/index.json': index() });
  const seen = [];
  const inner = globalThis.fetch;
  globalThis.fetch = (url, opts) => { seen.push(opts); return inner(url, opts); };

  await loadIndex();
  assert.equal(seen[0]?.cache, 'no-cache');
});

test('a missing or malformed index is an error, not an empty app', async () => {
  serve({});
  await assert.rejects(loadCorpus(), /index\.json/);

  serve({ 'data/index.json': '{"version":1}' });
  await assert.rejects(loadCorpus(), /"lists"-lijst/);
});

test('a missing chapter file names itself in the error', async () => {
  serve({ 'data/index.json': index({ id: 'a', file: 'gone.txt', rev: 1 }) });
  await assert.rejects(loadCorpus(), /gone\.txt/);
});

/* ------------------------------------------------ one word, two chapters --- */

test('the same word in two chapters is one card that remembers both', async () => {
  serve({
    'data/index.json': index(
      { id: 'ch03', file: 'c3.txt', rev: 1 },
      { id: 'ch07', file: 'c7.txt', rev: 1 },
    ),
    'data/c3.txt': 'pater | patris, m. | vader',
    'data/c7.txt': 'pater | patris, m. | vader / papa',
  });

  const { words } = await loadCorpus();
  assert.equal(words.size, 1, 'a revisited word must not reset as a second card');

  const [card] = [...words.values()];
  assert.deepEqual(card.lists, ['ch03', 'ch07']);
  assert.deepEqual(card.translations, ['vader', 'papa'],
    'accepted answers are the union across the chapters it appears in');
});

test('a word revisited in another chapter keeps the id it had alone', async () => {
  serve({
    'data/index.json': index({ id: 'ch03', file: 'c3.txt', rev: 1 }),
    'data/c3.txt': 'pater | patris, m. | vader',
  });
  const alone = [...(await loadCorpus()).words.keys()][0];

  serve({
    'data/index.json': index(
      { id: 'ch03', file: 'c3.txt', rev: 1 },
      { id: 'ch07', file: 'c7.txt', rev: 1 },
    ),
    'data/c3.txt': 'pater | patris, m. | vader',
    'data/c7.txt': 'pater | patris, m. | vader / papa',
  });
  const revisited = [...(await loadCorpus()).words.keys()][0];

  assert.equal(revisited, alone, 'adding a chapter must not detach her progress');
});

/* ------------------------------------------ homographs across chapters --- */

test('a homograph split across two chapters is still told apart', async () => {
  serve({
    'data/index.json': index(
      { id: 'ch01', file: 'c1.txt', rev: 1 },
      { id: 'ch07', file: 'c7.txt', rev: 1 },
    ),
    'data/c1.txt': 'liber | libri, m. | boek',
    'data/c7.txt': 'liber | libera, liberum | vrij',
  });

  const { words } = await loadCorpus();
  assert.equal(words.size, 2, 'book and free are different words and different cards');
  const terms = [...words.values()].map(w => w.translations[0]).sort();
  assert.deepEqual(terms, ['boek', 'vrij']);
});

test('agreeing on the form across chapters is a revisit, disagreeing is a homograph', async () => {
  const two = (c1, c7) => ({
    'data/index.json': index(
      { id: 'ch01', file: 'c1.txt', rev: 1 },
      { id: 'ch07', file: 'c7.txt', rev: 1 },
    ),
    'data/c1.txt': c1,
    'data/c7.txt': c7,
  });

  serve(two('liber | libri, m. | boek', 'liber | libri, m. | boek / boekrol'));
  assert.equal((await loadCorpus()).words.size, 1, 'same form: one card');

  serve(two('liber | libri, m. | boek', 'liber | libera, liberum | vrij'));
  assert.equal((await loadCorpus()).words.size, 2, 'different form: two cards');
});

/* ------------------------------------------------------- the real data --- */

test('the committed data/ loads and parses with nothing rejected', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = async name =>
    readFile(new URL(`../data/${name}`, import.meta.url), 'utf8');

  const indexText = await read('index.json');
  const files = { 'data/index.json': indexText };
  for (const list of JSON.parse(indexText).lists) {
    files[`data/${list.file}`] = await read(list.file);
  }
  serve(files);

  const { lists, words } = await loadCorpus();
  assert.ok(lists.length >= 1);
  for (const list of lists) {
    assert.deepEqual(list.rejects, [], `${list.file} has unreadable lines`);
    assert.ok(list.title, `${list.file} has no # title line`);
  }
  assert.ok(words.size > 20);
});
