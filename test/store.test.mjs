/* Tests for the profile store, against a fake Storage.

   The ones that matter most are at the bottom: what happens to a blob the app
   cannot read, and what happens when the browser refuses to write. Both are
   real (a hand-edited file, Safari in private mode) and both are ways to lose
   a month of her practice silently. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  openStore, migrate, emptyProgress, exportBackup, inspectBackup,
  DEFAULT_SETTINGS, KEY, BROKEN_KEY, VERSION,
} from '../js/store.js';
import { newCard } from '../js/schedule.js';

/** A Storage stand-in, optionally one that refuses to write. */
function fakeStorage(initial = {}, { readonly = false } = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      if (readonly) throw new DOMException('QuotaExceededError');
      data.set(key, String(value));
    },
    removeItem: key => data.delete(key),
    get size() { return data.size; },
    peek: key => (data.has(key) ? data.get(key) : null),
  };
}

const card = term => newCard({ term, lists: ['latin-ch01'] }, { now: Date.parse('2026-09-04T15:00:00Z') });

/* ============================================================= basics ==== */

test('a first run starts from an empty profile', () => {
  const store = openStore({ storage: fakeStorage() });
  assert.equal(store.progress.version, VERSION);
  assert.equal(store.progress.xp, 0);
  assert.equal(store.cards.size, 0);
  assert.deepEqual(store.settings, DEFAULT_SETTINGS);
  assert.equal(store.status.ok, true);
});

test('a card set during a lesson is written through at once', () => {
  const storage = fakeStorage();
  const store = openStore({ storage });

  store.cards.set('h123', card('mater'));

  const written = JSON.parse(storage.peek(KEY));
  assert.equal(written.cards.h123.term, 'mater',
    'the Map must persist itself — lesson.js never calls save()');
});

test('progress comes back after a reload', () => {
  const storage = fakeStorage();

  const first = openStore({ storage });
  first.cards.set('h123', card('mater'));
  first.progress.xp = 240;
  first.settings.lastDirection = 'rev';
  first.save();

  const second = openStore({ storage });
  assert.equal(second.progress.xp, 240);
  assert.equal(second.settings.lastDirection, 'rev');
  assert.equal(second.cards.get('h123').term, 'mater');
  assert.equal(second.cards.size, 1);
});

test('the whole card shape survives the round trip', () => {
  const storage = fakeStorage();
  const original = card('mater');
  original.cleanDays.fwd.push('2026-09-04');
  original.dirOk.fwd = true;

  openStore({ storage }).cards.set('h123', original);
  const returned = openStore({ storage }).cards.get('h123');

  assert.deepEqual(returned, original);
});

test('a card keeps every chapter it belongs to', () => {
  const storage = fakeStorage();
  const store = openStore({ storage });
  const c = card('pater');
  c.lists = ['latin-ch01', 'latin-ch07'];
  store.cards.set('h1', c);

  assert.deepEqual(openStore({ storage }).cards.get('h1').lists, ['latin-ch01', 'latin-ch07'],
    'dropping a chapter from the pool must not lose the card');
});

test('deleting and clearing are written through too', () => {
  const storage = fakeStorage();
  const store = openStore({ storage });
  store.cards.set('h1', card('mater'));
  store.cards.delete('h1');
  assert.deepEqual(JSON.parse(storage.peek(KEY)).cards, {});

  store.cards.set('h2', card('pater'));
  store.reset();
  const after = JSON.parse(storage.peek(KEY));
  assert.deepEqual(after.cards, {});
  assert.equal(after.xp, 0);
});

/* ========================================================== migration ==== */

test('a blob missing newer fields is filled in rather than rejected', () => {
  const partial = { version: 1, xp: 50, cards: {}, settings: { sound: false } };
  const { progress, reason } = migrate(partial);

  assert.equal(reason, null);
  assert.equal(progress.xp, 50);
  assert.equal(progress.settings.sound, false, 'her setting is kept');
  assert.equal(progress.settings.lessonMinutes, DEFAULT_SETTINGS.lessonMinutes,
    'a setting added later must not come back undefined');
  assert.deepEqual(progress.streak, emptyProgress().streak);
  assert.deepEqual(progress.badges, []);
});

test('a version with no migration path is refused, not guessed at', () => {
  assert.equal(migrate({ version: 0, cards: {} }).progress, null);
  assert.match(migrate({ version: 0, cards: {} }).reason, /version 0/);
});

test('a blob from a newer build is left alone', () => {
  const { progress, reason } = migrate({ version: VERSION + 1, xp: 999 });
  assert.equal(progress, null);
  assert.match(reason, /newer version/);
});

test('rubbish in place of an object is refused', () => {
  assert.equal(migrate(null).progress, null);
  assert.equal(migrate([1, 2, 3]).progress, null);
  assert.equal(migrate('nope').progress, null);
});

/* ======================================================== the failures === */

test('unreadable data is set aside, never overwritten', () => {
  const storage = fakeStorage({ [KEY]: '{ this is not json' });
  const store = openStore({ storage });

  assert.equal(store.status.ok, false);
  assert.match(store.status.message, /kon niet gelezen worden/);
  assert.equal(storage.peek(BROKEN_KEY), '{ this is not json',
    'the original must be recoverable by hand');
  assert.equal(store.progress.xp, 0, 'and the app still opens');
});

test('a profile from a newer build is set aside the same way', () => {
  const future = JSON.stringify({ version: VERSION + 5, xp: 4000 });
  const storage = fakeStorage({ [KEY]: future });
  const store = openStore({ storage });

  assert.equal(store.status.ok, false);
  assert.equal(storage.peek(BROKEN_KEY), future);
});

test('a browser that refuses to write says so instead of pretending', () => {
  const storage = fakeStorage({}, { readonly: true });
  const store = openStore({ storage });

  store.cards.set('h1', card('mater'));

  assert.equal(store.status.ok, false);
  assert.match(store.status.message, /Opslaan lukt niet/);
  assert.equal(store.cards.get('h1').term, 'mater',
    'the lesson still works in memory for the rest of the session');
});

test('no storage at all does not stop the app opening', () => {
  const hostile = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  const store = openStore({ storage: hostile });
  assert.equal(store.progress.xp, 0);
  assert.doesNotThrow(() => store.cards.set('h1', card('mater')));
  assert.equal(store.status.ok, false);
});

/* ============================================================ settings === */

test('settings are a live reference, and saving keeps them', () => {
  const storage = fakeStorage();
  const store = openStore({ storage });

  store.settings.lessonMinutes = 15;
  store.settings.anticipationSeconds = 6;
  store.save();

  const reopened = openStore({ storage });
  assert.equal(reopened.settings.lessonMinutes, 15);
  assert.equal(reopened.settings.anticipationSeconds, 6);
});

test('the stored blob has the shape PLAN section 4 describes', () => {
  const storage = fakeStorage();
  openStore({ storage }).save();

  const blob = JSON.parse(storage.peek(KEY));
  assert.deepEqual(Object.keys(blob).sort(), [
    'badges', 'cards', 'roma', 'settings', 'streak', 'tests',
    'typedAnswers', 'version', 'xp',
  ]);

  /* `stage` lives inside `roma` with the city's other caches, and no longer
     beside them at the top level as well. Both were derived from `xp` and
     nothing ever read the outer one. */
  assert.deepEqual(Object.keys(blob.roma).sort(), ['seenXp', 'stage', 'unlocked']);
});

/* ============================================================= backup ==== */

test('a backup carries progress and pasted lists together', () => {
  const storage = fakeStorage();
  const store = openStore({ storage });
  store.cards.set('h1', card('mater'));
  store.progress.xp = 750;
  store.addList({ title: 'Geplakt', text: 'pater | vader' });
  store.save();

  const backup = exportBackup(store);
  assert.equal(backup.app, 'llrnr');
  assert.equal(backup.progress.xp, 750);
  assert.equal(Object.keys(backup.progress.cards).length, 1);
  assert.equal(backup.lists.length, 1,
    'a backup without her pasted chapters would restore progress on words that no longer exist');
});

test('a backup survives the round trip', () => {
  const source = openStore({ storage: fakeStorage() });
  source.cards.set('h1', card('mater'));
  source.progress.xp = 750;
  source.progress.badges.push('first-learned');
  source.addList({ title: 'Geplakt', text: 'pater | vader' });
  source.save();

  const text = JSON.stringify(exportBackup(source));

  const target = openStore({ storage: fakeStorage() });
  const check = inspectBackup(text);
  assert.equal(check.ok, true);
  assert.equal(check.summary.cards, 1);
  assert.equal(check.summary.xp, 750);

  target.restore(check.backup);
  assert.equal(target.progress.xp, 750);
  assert.equal(target.cards.get('h1').term, 'mater');
  assert.equal(target.pastedLists.length, 1);
  assert.deepEqual(target.progress.badges, ['first-learned']);
});

test('a restore is written to storage, not just to memory', () => {
  const source = openStore({ storage: fakeStorage() });
  source.cards.set('h1', card('mater'));
  source.progress.xp = 400;
  source.save();

  const storage = fakeStorage();
  const target = openStore({ storage });
  target.restore(inspectBackup(JSON.stringify(exportBackup(source))).backup);

  assert.equal(openStore({ storage }).progress.xp, 400, 'and survives the next reload');
});

test('the profile being replaced is set aside first', () => {
  const source = openStore({ storage: fakeStorage() });
  source.progress.xp = 10;
  source.save();

  const storage = fakeStorage();
  const target = openStore({ storage });
  target.progress.xp = 9999;
  target.save();
  target.restore(inspectBackup(JSON.stringify(exportBackup(source))).backup);

  assert.equal(JSON.parse(storage.peek(BROKEN_KEY)).xp, 9999,
    'restoring the wrong file must not be the end of a month of practice');
});

test('rubbish is refused before anything is replaced', () => {
  assert.equal(inspectBackup('not json').ok, false);
  assert.match(inspectBackup('not json').reason, /geen geldige back-up/);

  assert.equal(inspectBackup('{"hello":true}').ok, false);
  assert.match(inspectBackup('{"hello":true}').reason, /llrnr/);

  const wrongVersion = JSON.stringify({ app: 'llrnr', progress: { version: 99 } });
  assert.equal(inspectBackup(wrongVersion).ok, false);
});

/* ====================================================== reset a chapter == */

test('resetting a chapter forgets its cards', () => {
  const store = openStore({ storage: fakeStorage() });
  store.cards.set('h1', card('mater'));
  store.cards.set('h2', card('pater'));

  assert.equal(store.resetList('latin-ch01', ['h1', 'h2']), 2);
  assert.equal(store.cards.size, 0);
});

test('a word shared with another chapter is left alone', () => {
  const store = openStore({ storage: fakeStorage() });
  const shared = card('pater');
  shared.lists = ['latin-ch01', 'latin-ch07'];
  store.cards.set('h1', card('mater'));
  store.cards.set('h2', shared);

  const removed = store.resetList('latin-ch01', ['h1', 'h2']);
  assert.equal(removed, 1);
  assert.ok(store.cards.has('h2'),
    'the card is shared — wiping it would quietly reset chapter 7 as well');
});
