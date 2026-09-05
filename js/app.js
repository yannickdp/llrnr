/* Boot + routing between screens.

   Every screen is a hidden <section data-screen>; exactly one is visible.
   Tab screens live in #screens, the lesson flow in the #modal layer above them.

   Deliberately no History API: the lesson must not be escapable with a back
   swipe, so there are no history entries to swipe through. Leaving a lesson
   goes through the X, which asks first. */

import { loadCorpus } from './lists.js';
import { createLesson } from './lesson.js';
import { $, el, paintResults, runLesson } from './ui.js';

const TABS = ['home', 'words', 'tests', 'settings'];
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

function chapterCard(list) {
  const card = el('div', 'card');
  const head = el('div', 'chapter-head');
  head.append(el('span', 'chapter-title', list.title ?? list.file));
  head.append(el('span', 'caption', `${list.words.length} woorden`));
  card.append(head);

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

function renderChapters(lists, wordCount) {
  $('chapter-list').replaceChildren(
    ...lists.map(chapterCard),
    el('p', 'caption', `${wordCount} woorden in totaal`),
  );
}

/* ----------------------------------------------------------- lessons --- */

/* Progress lives in memory only, so it survives moving between screens but not
   a reload. Phase 2.1 swaps this one Map for store.js and localStorage, and
   nothing else here has to change. */
const progress = new Map();

let corpus = null;
let running = null;

function chosenDirection() {
  return $('direction-picker')
    ?.querySelector('.choice[aria-pressed="true"]')
    ?.dataset.direction ?? 'both';
}

function startLesson() {
  /* Guard rather than trust: the button is disabled until the corpus is in,
     so reaching here without one would be a bug. */
  if (!corpus?.words.size) return;

  const lesson = createLesson({
    words: corpus.words,
    cards: progress,
    direction: chosenDirection(),
    now: Date.now(),
  });

  show('lesson');

  running = runLesson(lesson, {
    onFinish: () => {
      running = null;
      setExitGuard(null);
      paintResults(lesson.results());
      show('results');
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
      paintResults(lesson.results());
      show('results');
    });
    return false;
  });
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
  startButton.addEventListener('click', startLesson);

  try {
    corpus = await loadCorpus();
    renderChapters(corpus.lists, corpus.words.size);
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
