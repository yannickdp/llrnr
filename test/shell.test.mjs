/* Tests for the app shell: the files index.html, the manifest and the service
   worker name. There is no build step to complain when one of these drifts —
   a module missing from SHELL only shows up as an app that will not open
   offline, and a misspelt icon only as a blank one on the home screen. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { posix } from 'node:path';

const ROOT = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, ROOT), 'utf8');
const exists = path => existsSync(new URL(path, ROOT));
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** The SHELL array from service-worker.js, read as text so the worker need not run. */
const SHELL = (() => {
  const body = stripComments(read('service-worker.js')).match(/const SHELL = \[([\s\S]*?)\];/)[1];
  return [...body.matchAll(/'([^']+)'/g)].map(m => m[1]);
})();

/** Every module app.js reaches through static imports, as root-relative paths. */
function reachableModules(entry) {
  const seen = new Set();
  const visit = path => {
    if (seen.has(path)) return;
    seen.add(path);
    if (!exists(path)) return; // reported by the test below
    const src = stripComments(read(path));
    for (const [, spec] of src.matchAll(/(?:from|import)\s+'(\.{1,2}\/[^']+)'/g)) {
      visit(posix.normalize(posix.join(posix.dirname(path), spec)));
    }
  };
  visit(entry);
  return [...seen];
}

test('every file in the service worker SHELL exists', () => {
  assert.deepEqual(SHELL.filter(p => p !== './' && !exists(p)), []);
});

test('SHELL names no file twice', () => {
  assert.deepEqual(SHELL.filter((p, i) => SHELL.indexOf(p) !== i), []);
});

test('every module app.js imports exists', () => {
  assert.deepEqual(reachableModules('js/app.js').filter(p => !exists(p)), []);
});

test('every module app.js imports is precached for offline use', () => {
  assert.deepEqual(reachableModules('js/app.js').filter(p => !SHELL.includes(p)), []);
});

test('every file index.html links to exists and is precached', () => {
  const refs = [...read('index.html').matchAll(/(?:src|href)="([^"#:]+)"/g)].map(m => m[1]);
  assert.ok(refs.length > 0, 'no links found in index.html');
  assert.deepEqual(refs.filter(p => !exists(p)), [], 'missing');
  assert.deepEqual(refs.filter(p => !SHELL.includes(p)), [], 'not in SHELL');
});

test('every manifest icon exists and is precached', () => {
  const { icons } = JSON.parse(read('manifest.webmanifest'));
  const srcs = icons.map(i => i.src);
  assert.deepEqual(srcs.filter(p => !exists(p)), [], 'missing');
  assert.deepEqual(srcs.filter(p => !SHELL.includes(p)), [], 'not in SHELL');
});
