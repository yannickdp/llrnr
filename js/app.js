/* Boot + routing between screens.

   Every screen is a hidden <section data-screen>; exactly one is visible.
   Tab screens live in #screens, the lesson flow in the #modal layer above them.

   Deliberately no History API: the lesson must not be escapable with a back
   swipe, so there are no history entries to swipe through. Leaving a lesson
   goes through the X, which asks first. */

import { loadCorpus } from './lists.js';
import { createLesson } from './lesson.js';
import { openStore } from './store.js';
import { isDue, isOneWay, missingDirection } from './schedule.js';
import { activeTest, makeTest, readiness } from './cram.js';
import { $, DIRECTION_LABEL, el, paintHome, paintResults, readinessPanel, runLesson } from './ui.js';

const TABS = ['home', 'words', 'tests', 'settings'];
const DIRECTIONS = ['fwd', 'rev', 'both'];
const MODAL = ['start', 'lesson', 'results'];

const screens = new Map(
  [...document.querySelectorAll('[data-screen]')].map(el => [el.dataset.screen, el])
);
const modal = $('modal');
const modalTitle = $('modal-title');
const tabs = [...document.querySelectorAll('.tab')];

let current = null;
let lastTab = TABS[0];
let exitGuard = null;

/** Show one screen, hiding whichever was up. Modal screens raise the sheet. */
export function show(name) {
  const next = screens.get(name);
  if (!next) throw new Error(`unknown screen: ${name}`);

  if (current) current.hidden = true;
  next.hidden = false;
  current = next;

  const inModal = MODAL.includes(name);
  modal.hidden = !inModal;
  if (inModal) modalTitle.textContent = next.dataset.title ?? '';
  else lastTab = name;

  for (const tab of tabs) {
    if (tab.dataset.goto === lastTab) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }

  /* Lets CSS and later modules react to where we are without re-querying. */
  document.documentElement.dataset.screen = name;
  next.dispatchEvent(new CustomEvent('screen:show', { bubbles: true }));
}

export function currentScreen() {
  return current?.dataset.screen ?? null;
}

/** Dismiss the lesson sheet and return to the tab it was opened from. */
export function closeModal() {
  show(lastTab);
}

/**
 * Install a veto on the modal X. `fn` runs on every close attempt and returns
 * false to keep the sheet up — which is how a running lesson asks "really
 * quit?" without app.js knowing anything about lessons. Pass null to clear it.
 */
export function setExitGuard(fn) {
  exitGuard = fn;
}

/* One delegated listener covers every [data-goto] and [data-action] in the
   app, including markup that later phases render. */
document.addEventListener('click', e => {
  const goto = e.target.closest('[data-goto]');
  if (goto) {
    show(goto.dataset.goto);
    return;
  }

  /* "Practise the side you are missing" — the fix attached to the marker. */
  const practise = e.target.closest('[data-practise]');
  if (practise) {
    /* The Words screen button names specific words to repair; the readiness
       panel's button just names a direction. */
    const focus = practise.dataset.focus?.split(' ').filter(Boolean) ?? null;
    startLesson(practise.dataset.practise, focus?.length ? focus : null);
    return;
  }

  const removeId = e.target.closest('[data-remove-test]')?.dataset.removeTest;
  if (removeId) {
    removeTest(removeId);
    return;
  }

  const action = e.target.closest('[data-action]');
  if (action?.dataset.action === 'close-modal') {
    if (exitGuard && exitGuard() === false) return;
    closeModal();
    return;
  }

  /* .choices behaves as a radio group: one pressed option per group. The
     lesson's own multiple-choice buttons are excluded — those are answers, not
     a setting, and grade themselves on the first tap. */
  const choice = e.target.closest('.choice');
  if (choice && !choice.classList.contains('choice-option')) {
    for (const sibling of choice.parentElement.querySelectorAll('.choice')) {
      sibling.setAttribute('aria-pressed', String(sibling === choice));
    }
  }
});

/* Nothing outside the lesson submits anywhere; stop stray forms reloading. */
document.addEventListener('submit', e => e.preventDefault());

/* ---------------------------------------------------------- chapters --- */

/* A first, deliberately plain listing of what loaded: enough to prove the
   whole path — index.json, cache-busted .txt, parser, corpus merge — works in
   a real browser. Phase 3.4 adds pool toggles and Phase 4.3 the new -> learned
   track; both replace this rendering, not the loading behind it.

   Built with textContent throughout: chapter titles and terms are file
   content, and innerHTML would make an editable word list an injection path. */

/**
 * The words in a chapter she knows one way round only, by which way is missing.
 *
 * PLAN section 2.4 is firm that the both-directions requirement must appear as
 * a suggestion with the fix attached, never as an invisible wall — so this
 * count exists to be shown next to a button that practises exactly that side.
 */
function oneWayIn(list) {
  const missing = { fwd: [], rev: [] };
  for (const word of list.words) {
    const card = store.cards.get(word.id);
    if (card && isOneWay(card)) missing[missingDirection(card)].push(word.id);
  }
  return missing;
}

function chapterCard(list) {
  const card = el('div', 'card');
  const head = el('div', 'chapter-head');
  head.append(el('span', 'chapter-title', list.title ?? list.file));
  head.append(el('span', 'caption', `${list.words.length} woorden`));
  card.append(head);

  const missing = oneWayIn(list);
  const worst = missing.rev.length >= missing.fwd.length ? 'rev' : 'fwd';
  const count = missing[worst].length;
  if (count) {
    card.append(el('p', 'caption one-way',
      `${count} ${count === 1 ? 'woord ken je' : 'woorden ken je'} nog maar één richting`));
    const practise = el('button', 'btn btn-small', `${DIRECTION_LABEL[worst]} oefenen`);
    practise.dataset.practise = worst;
    practise.dataset.focus = missing[worst].join(' ');
    card.append(practise);
  }

  const notes = el('div', 'tags');
  for (const warning of list.warnings) {
    notes.append(el('span', 'tag', warning.message));
  }
  for (const reject of list.rejects) {
    notes.append(el('span', 'tag tag-bad', `regel ${reject.line}: ${reject.reason}`));
  }
  if (notes.children.length) card.append(notes);

  return card;
}

function renderChapters() {
  if (!corpus) return;
  $('chapter-list').replaceChildren(
    ...corpus.lists.map(chapterCard),
    el('p', 'caption', `${corpus.words.size} woorden in totaal`),
  );
}

/* ------------------------------------------------------------- tests --- */

/** The readiness panel, on Home and on the Tests screen. */
function renderReadiness() {
  const home = $('readiness-home');
  const list = $('test-list');
  if (!corpus) return;

  const now = Date.now();
  const active = activeTest(store.progress.tests, now);

  home.replaceChildren(
    ...(active ? [readinessPanel(readiness(store.cards, corpus.words, active, now), { compact: true })] : []),
  );

  const upcoming = [...store.progress.tests]
    .sort((a, b) => a.date.localeCompare(b.date));

  list.replaceChildren(...(upcoming.length
    ? upcoming.map(test => {
      const panel = readinessPanel(readiness(store.cards, corpus.words, test, now));
      const remove = el('button', 'btn btn-small', 'Toets verwijderen');
      remove.dataset.removeTest = test.id;
      panel.append(remove);
      return panel;
    })
    : [el('p', 'placeholder', 'Nog geen toets. Voeg er hieronder een toe.')]));
}

/** The chapter checkboxes on the new-test form. */
function renderScopeChoices() {
  if (!corpus) return;
  $('test-scope').replaceChildren(...corpus.lists.map(list => {
    const label = el('label', 'scope-item');
    const box = el('input');
    box.type = 'checkbox';
    box.value = list.id;
    label.append(box, el('span', null, list.title ?? list.file));
    return label;
  }));
}

function saveTest(event) {
  event.preventDefault();
  const lists = [...$('test-scope').querySelectorAll('input:checked')].map(box => box.value);
  const date = $('test-date').value;
  if (!date || !lists.length) return;

  store.progress.tests.push(makeTest({
    id: `t${Date.now().toString(36)}`,
    title: $('test-title').value.trim() || 'Toets',
    date,
    lists,
  }));
  store.save();

  $('test-form').reset();
  renderReadiness();
  refreshHome();
}

function removeTest(id) {
  store.progress.tests = store.progress.tests.filter(test => test.id !== id);
  store.save();
  renderReadiness();
  refreshHome();
}

/* ----------------------------------------------------------- lessons --- */

/* Progress is persistent from here on. The cards Map writes itself through to
   localStorage on every set, so the lesson engine needs to know nothing about
   any of it. */
const store = openStore();

let corpus = null;
let running = null;

function chosenDirection() {
  return $('direction-picker')
    ?.querySelector('.choice[aria-pressed="true"]')
    ?.dataset.direction ?? 'both';
}

/** Pre-select the direction she chose last time, per PLAN section 2.4. */
function restoreDirection() {
  const picker = $('direction-picker');
  if (!picker) return;
  for (const choice of picker.querySelectorAll('.choice')) {
    choice.setAttribute(
      'aria-pressed', String(choice.dataset.direction === store.settings.lastDirection),
    );
  }
}

/** The honest numbers for the Home screen. */
function refreshHome() {
  if (!corpus) return;
  const now = Date.now();
  let due = 0;
  for (const card of store.cards.values()) if (isDue(card, now)) due++;

  paintHome({
    due,
    fresh: [...corpus.words.keys()].filter(id => !store.cards.has(id)).length,
    streak: store.progress.streak.current,
    xp: store.progress.xp,
    warning: store.status.ok ? null : store.status.message,
  });
}

/**
 * @param {'fwd'|'rev'|'both'} [only]  overrides the picker — this is how the
 *   Words screen's "practise the missing side" button works. Anything else is
 *   ignored rather than trusted: passing this straight to an event listener
 *   hands it a MouseEvent, which is exactly the bug this guard exists for.
 * @param {string[]|null} [focusIds]
 */
function startLesson(only, focusIds = null) {
  /* Guard rather than trust: the button is disabled until the corpus is in,
     so reaching here without one would be a bug. */
  if (!corpus?.words.size) return;

  const direction = DIRECTIONS.includes(only) ? only : chosenDirection();
  store.settings.lastDirection = direction;
  store.save();

  /* Snapshot readiness so the results screen can lead with what changed —
     "+4 klaar voor de toets" is the line she actually wants after a lesson. */
  const test = focusIds ? null : activeTest(store.progress.tests, Date.now());
  const summary = test ? readiness(store.cards, corpus.words, test) : null;
  const readyBefore = summary?.ready ?? null;

  const lesson = createLesson({
    words: corpus.words,
    cards: store.cards,
    direction,
    focusIds,
    /* The nearest deadline still ahead shapes the whole lesson: what is
       introduced, what order it is asked in, and how far ahead it is
       scheduled. Null when there is no test, and everything behaves normally. */
    test,
    /* Too little time left to finish properly: cover everything once each way
       before pushing any single word to three. */
    breadth: summary ? !summary.feasible : false,
    minutes: store.settings.lessonMinutes,
    newPerLesson: store.settings.newPerLesson,
    now: Date.now(),
  });

  show('lesson');

  running = runLesson(lesson, {
    anticipationSeconds: store.settings.anticipationSeconds,
    onFinish: () => {
      running = null;
      setExitGuard(null);
      finishLesson(lesson, test, readyBefore);
    },
  });

  /* Mid-lesson the X asks first. Answering "stop" ends the lesson properly —
     through the results screen — rather than dropping her back on Home with
     the work she just did unaccounted for. */
  setExitGuard(() => {
    if (!running) return true;
    askToQuit(() => {
      running.stop();
      running = null;
      setExitGuard(null);
      lesson.finish();
      finishLesson(lesson, test, readyBefore);
    });
    return false;
  });
}

function finishLesson(lesson, test, readyBefore) {
  const gained = test
    ? readiness(store.cards, corpus.words, test).ready - readyBefore
    : 0;

  paintResults(lesson.results(), { test, gained });
  refreshHome();
  renderChapters();
  renderReadiness();
  show('results');
}

function askToQuit(onQuit) {
  const dialog = $('confirm');
  dialog.hidden = false;

  const close = () => {
    dialog.hidden = true;
    dialog.removeEventListener('click', onClick);
  };

  const onClick = e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'stay') close();
    if (action === 'quit') { close(); onQuit(); }
  };

  dialog.addEventListener('click', onClick);
}

/* -------------------------------------------------------------- boot --- */

async function boot() {
  show(TABS[0]);

  /* Start stays disabled until there are words to teach. A button that looks
     ready and does nothing is worse than one that is visibly not ready yet. */
  const startButton = $('start-lesson');
  startButton.disabled = true;
  startButton.addEventListener('click', () => startLesson());

  restoreDirection();
  $('test-form').addEventListener('submit', saveTest);

  try {
    corpus = await loadCorpus();
    renderChapters();
    renderScopeChoices();
    renderReadiness();
    refreshHome();
    startButton.disabled = corpus.words.size === 0;
    document.documentElement.dataset.corpus = 'ready';
  } catch (err) {
    /* Say what broke and where. A silent empty list would be the worst
       possible failure for a file the parent edits by hand. */
    $('chapter-list').replaceChildren(
      el('p', 'tag tag-bad', `De lijsten konden niet geladen worden — ${err.message}`),
    );
    console.error(err);
  }
}

boot();
