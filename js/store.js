/* store.js — her progress, in one localStorage key.

   One blob, written on every change (PLAN section 4). A few hundred cards is a
   few KB, so there is nothing to gain from splitting it up and a great deal to
   lose: a half-written multi-key update is a corrupted profile.

   Two things this module refuses to do quietly:

   - It never destroys unreadable data. A blob it cannot parse, or one written
     by a newer version of the app, is copied to a `.broken` key before a fresh
     profile is started. Losing a month of practice to a bad write is the worst
     thing this app could do to her.
   - It never lets a failed write pass unnoticed. Safari in private mode throws
     on setItem, and a trainer that silently forgets everything is worse than
     one that says it cannot save.

   `version` is stamped from day one so the schema can change later. */

export const KEY = 'llrnr.progress.v1';
export const BROKEN_KEY = `${KEY}.broken`;
export const VERSION = 1;

/**
 * Chapters pasted into the app rather than committed to data/.
 *
 * Kept under their own key, and holding the raw text rather than parsed words:
 * the text is what she pasted and what she would edit, and parsing it with the
 * same parse.js as the committed files means there is no second code path to
 * keep in sync.
 */
export const LISTS_KEY = 'llrnr.lists.v1';
export const LISTS_BROKEN_KEY = `${LISTS_KEY}.broken`;

export const DEFAULT_SETTINGS = {
  lessonMinutes: 10,
  newPerLesson: 8,
  anticipationSeconds: 4,
  sound: true,
  lastDirection: 'both',
  /* Chapters switched off on the Words screen. Their cards are kept — dropping
     a chapter from the pool must never lose her progress on it. */
  excludedLists: [],
};

/** A profile for someone who has never opened the app. */
export function emptyProgress() {
  return {
    version: VERSION,
    xp: 0,
    stage: 0,
    streak: { current: 0, best: 0, lastDay: null, freezes: 1 },
    badges: [],
    roma: { unlocked: [], seenXp: 0 },
    settings: { ...DEFAULT_SETTINGS },
    tests: [],
    cards: {},
  };
}

/* =========================================================== migration === */

/* Keyed by the version being migrated *from*. Empty while there is only one
   schema — but the hook exists now, because the first time it is needed will
   be the first time her real progress is at stake. */
const MIGRATIONS = {
  // 1: progress => ({ ...progress, version: 2, ... }),
};

/**
 * Bring a stored blob up to the current version.
 * @returns {{progress: object|null, reason: string|null}} a null progress means
 *   the data could not be used and should be set aside rather than trusted.
 */
export function migrate(stored) {
  if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) {
    return { progress: null, reason: 'not an object' };
  }

  let progress = stored;
  let version = Number.isInteger(progress.version) ? progress.version : 0;

  if (version > VERSION) {
    /* Written by a newer build. Downgrading by guesswork would lose whatever
       the newer schema added, so leave it alone and say so. */
    return { progress: null, reason: `written by a newer version (${version})` };
  }

  while (version < VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { progress: null, reason: `no migration from version ${version}` };
    progress = step(progress);
    version = progress.version;
  }

  return { progress: fill(progress), reason: null };
}

/** Fill in anything a older blob (or a hand-edited one) is missing. */
function fill(progress) {
  const base = emptyProgress();
  return {
    ...base,
    ...progress,
    version: VERSION,
    streak: { ...base.streak, ...progress.streak },
    roma: { ...base.roma, ...progress.roma },
    /* Settings merge rather than replace, so adding one later cannot leave an
       existing profile with an undefined lesson length. */
    settings: {
      ...base.settings,
      ...progress.settings,
      excludedLists: Array.isArray(progress.settings?.excludedLists)
        ? progress.settings.excludedLists : [],
    },
    badges: Array.isArray(progress.badges) ? progress.badges : [],
    tests: Array.isArray(progress.tests) ? progress.tests : [],
    cards: progress.cards && typeof progress.cards === 'object' ? progress.cards : {},
  };
}

/* ============================================================== cards ==== */

/**
 * The cards Map the lesson works with, which writes itself through to storage.
 *
 * lesson.js knows nothing about persistence — it just does `cards.set(id, card)`
 * — so making the Map itself save is what keeps "written on every change" true
 * without threading a store through the whole engine.
 */
class PersistentCards extends Map {
  constructor(entries, onChange) {
    super(entries);
    this._onChange = onChange;
  }

  set(key, value) {
    const result = super.set(key, value);
    this._onChange?.();
    return result;
  }

  delete(key) {
    const result = super.delete(key);
    if (result) this._onChange?.();
    return result;
  }

  clear() {
    super.clear();
    this._onChange?.();
  }
}

/* ============================================================== store ==== */

/** localStorage can throw merely on being touched; never let that reach a screen. */
function safely(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * Open the profile.
 *
 * @param {object} [opts]
 * @param {Storage} [opts.storage]  injected so tests need no browser
 * @returns {{progress, cards, settings, save, reset, status}}
 */
export function openStore({ storage = globalThis.localStorage } = {}) {
  let status = { ok: true, message: null };

  const raw = safely(() => storage?.getItem(KEY) ?? null);

  let progress = null;
  if (raw !== null) {
    let parsed = null;
    let reason = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      reason = 'unreadable JSON';
    }

    const result = reason ? { progress: null, reason } : migrate(parsed);
    progress = result.progress;

    if (!progress) {
      /* Keep the original where it can be recovered by hand, then carry on. */
      safely(() => storage.setItem(BROKEN_KEY, raw));
      status = {
        ok: false,
        message: `De opgeslagen voortgang kon niet gelezen worden (${result.reason}). `
          + 'Er is opnieuw begonnen; de oude gegevens zijn bewaard.',
      };
    }
  }

  progress ??= emptyProgress();

  /* --- pasted chapters, same never-destroy discipline as the profile ----- */

  let pastedLists = [];
  const rawLists = safely(() => storage?.getItem(LISTS_KEY) ?? null);
  if (rawLists !== null) {
    try {
      const parsed = JSON.parse(rawLists);
      if (Array.isArray(parsed?.lists)) pastedLists = parsed.lists;
      else throw new Error('no lists array');
    } catch {
      safely(() => storage.setItem(LISTS_BROKEN_KEY, rawLists));
      status = {
        ok: false,
        message: 'De geplakte lijsten konden niet gelezen worden. '
          + 'De oude gegevens zijn bewaard.',
      };
    }
  }

  function saveLists() {
    try {
      storage.setItem(LISTS_KEY, JSON.stringify({ version: 1, lists: pastedLists }));
      return true;
    } catch (err) {
      status = { ok: false, message: 'Opslaan lukt niet — de lijst blijft niet bewaard.' };
      console.error('llrnr: could not save lists', err);
      return false;
    }
  }

  const cards = new PersistentCards(Object.entries(progress.cards), () => save());

  function save() {
    progress.cards = Object.fromEntries(cards);
    const serialised = JSON.stringify(progress);

    try {
      storage.setItem(KEY, serialised);
      if (!status.ok && status.message?.startsWith('Opslaan')) status = { ok: true, message: null };
      return true;
    } catch (err) {
      status = {
        ok: false,
        message: 'Opslaan lukt niet — je voortgang van nu blijft niet bewaard.',
      };
      console.error('llrnr: could not save progress', err);
      return false;
    }
  }

  return {
    progress,
    cards,
    get settings() { return progress.settings; },

    /** Persist a change made outside the cards Map (a setting, say). */
    save,

    /** Chapters she pasted in, newest last. */
    get pastedLists() { return pastedLists; },

    /** Add one, returning it. The raw text is kept, not the parsed words. */
    addList({ title, text }) {
      const list = {
        id: `paste-${Date.now().toString(36)}`,
        title: title || 'Geplakte lijst',
        text,
        rev: 1,
        addedAt: new Date().toISOString(),
      };
      pastedLists.push(list);
      saveLists();
      return list;
    },

    /** Remove one. Her cards for those words are deliberately left alone. */
    removeList(id) {
      pastedLists = pastedLists.filter(list => list.id !== id);
      saveLists();
    },

    saveLists,

    /** Wipe the profile. Only ever from an explicit action in Settings. */
    reset() {
      progress = emptyProgress();
      cards.clear();          // clear() saves, which writes the empty profile
      return progress;
    },

    /** Whether the last read or write worked, and what to tell her if not. */
    get status() { return status; },
  };
}
