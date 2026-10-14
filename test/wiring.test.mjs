/* Tests for the wiring between index.html and the code that drives it. The
   screens themselves are DOM and untested, but the names they share with the
   markup are plain strings — and each mismatch fails in its own quiet way: a
   $('typo') is null until someone taps that one button, an unknown screen only
   throws when it is opened, an unknown setting is saved and never read, and an
   unknown icon draws nothing at all. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS } from '../js/store.js';
import { ICONS } from '../js/roma/icons.js';

const ROOT = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, ROOT), 'utf8');
const html = read('index.html');
const app = read('js/app.js');
const ui = read('js/ui.js');

const attrs = (src, name) => [...src.matchAll(new RegExp(`${name}="([^"]+)"`, 'g'))].map(m => m[1]);
const missing = (wanted, have) => [...new Set(wanted)].filter(x => !have.has(x));

/** A `const NAME = ['a', 'b'];` array from app.js, read as text. */
const arrayIn = (src, name) =>
  [...src.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`))[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

const htmlIds = new Set(attrs(html, 'id'));
const screens = new Set(attrs(html, 'data-screen'));

test('every element the code looks up by id exists', () => {
  /* Ids the screens create for themselves (the lesson's input, its timer
     ring) count as existing: they are assigned right where they are made. */
  const created = new Set([
    ...[...ui.matchAll(/\.id = '([^']+)'/g)].map(m => m[1]),
    ...[...ui.matchAll(/\bid: '([^']+)'/g)].map(m => m[1]),
  ]);
  const looked = [...`${app}\n${ui}`.matchAll(/\$\('([^']+)'\)|note\('([^']+)'/g)].map(m => m[1] ?? m[2]);
  assert.ok(looked.length > 20, 'the lookup pattern no longer matches anything');
  assert.deepEqual(missing(looked, new Set([...htmlIds, ...created])), []);
});

test('no id is used twice in index.html', () => {
  const ids = attrs(html, 'id');
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
});

test('every screen the app navigates to exists', () => {
  const wanted = [
    ...attrs(html, 'data-goto'),
    ...[...app.matchAll(/\bshow\('([^']+)'\)/g)].map(m => m[1]),
    ...arrayIn(app, 'TABS'),
    ...arrayIn(app, 'MODAL'),
  ];
  assert.deepEqual(missing(wanted, screens), []);
});

test('every tab is a screen in the tab list, and every screen is a tab or modal', () => {
  /* A screen in neither list would open as a tab but never highlight one, or
     open as a modal without its sheet. */
  const tabs = arrayIn(app, 'TABS');
  const modal = arrayIn(app, 'MODAL');
  assert.deepEqual([...screens].filter(s => !tabs.includes(s) && !modal.includes(s)), []);
  assert.deepEqual(tabs.filter(t => modal.includes(t)), []);
});

test('every settings control names a real setting, with values of the right type', () => {
  /* Mirrors readSetting() in app.js: data-type picks the conversion. */
  const convert = (type, raw) => ({ number: Number(raw), boolean: raw === 'true' }[type] ?? raw);
  const groups = [...html.matchAll(/<div[^>]*data-setting="([^"]+)"([^>]*)>([\s\S]*?)<\/div>/g)];
  assert.ok(groups.length > 0, 'no settings controls found');

  for (const [, key, rest, body] of groups) {
    assert.ok(key in DEFAULT_SETTINGS, `"${key}" is not a setting store.js knows`);
    const type = rest.match(/data-type="([^"]+)"/)?.[1];
    const values = attrs(body, 'data-value').map(raw => convert(type, raw));
    const expected = DEFAULT_SETTINGS[key];

    for (const v of values) {
      assert.equal(typeof v, typeof expected, `${key}: "${v}" would be saved as a ${typeof v}`);
      if (typeof v === 'number') assert.ok(Number.isFinite(v), `${key}: a value is not a number`);
    }
    /* Otherwise a first run shows the group with no option lit. */
    assert.ok(values.includes(expected), `${key}: the default ${expected} has no button`);
  }
});

test('every icon the results screen asks for is drawn', () => {
  /* paintIcon() returns quietly for an unknown id, leaving a blank square. */
  const wanted = [
    ...[...ui.matchAll(/iconCard\('([^']+)'/g)].map(m => m[1]),
    ...[...ui.matchAll(/lines\.push\(\['([^']+)'/g)].map(m => m[1]),
  ];
  assert.ok(wanted.length > 5, 'the icon pattern no longer matches anything');
  assert.deepEqual(missing(wanted, new Set(Object.keys(ICONS))), []);
});
