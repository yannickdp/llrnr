/* Boot + routing between screens.

   Every screen is a hidden <section data-screen>; exactly one is visible.
   Tab screens live in #screens, the lesson flow in the #modal layer above them.

   Deliberately no History API: the lesson must not be escapable with a back
   swipe, so there are no history entries to swipe through. Leaving a lesson
   goes through the X, which asks first. */

import { loadCorpus } from './lists.js';
import { parseList } from './parse.js';
import { createLesson } from './lesson.js';
import { exportBackup, inspectBackup, openStore } from './store.js';
import { isDue, isOneWay, missingDirection } from './schedule.js';
import { activeTest, makeTest, readiness } from './cram.js';
import { awardLesson, goalMetToday, newBadges, stageFor, STAGES } from './gamify.js';
import { cityProgress, markSeen, nextAt, reconcile, unlockedBy } from './roma/roma.js';
import { setSoundEnabled } from './sound.js';
import {
  $, DIRECTION_LABEL, cityUnlockMoment, cityVisible, closeCityView, el, importPreview,
  openCityView, paintCity, paintHome, paintResults, plural, progressTrack,
  readinessPanel, runLesson,
} from './ui.js';

const TABS = ['home', 'words', 'tests', 'settings'];
const DIRECTIONS = ['fwd', 'rev', 'both'];
const MODAL = ['start', 'lesson', 'results', 'import'];

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

  /* The city's flame only burns while she can see it. On a phone a render loop
     nobody is looking at is just battery. */
  cityVisible(name === 'home');

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

  const segment = e.target.closest('[data-setting] button');
  if (segment) {
    changeSetting(segment.closest('[data-setting]'), segment);
    return;
  }

  const resetId = e.target.closest('[data-reset-list]')?.dataset.resetList;
  if (resetId) {
    resetChapter(resetId);
    return;
  }

  const listId = e.target.closest('[data-remove-list]')?.dataset.removeList;
  if (listId) {
    /* The pasted text goes; her cards for those words deliberately stay, in
       case the same chapter comes back. */
    store.removeList(listId);
    reloadCorpus();
    return;
  }

  /* The hero is one big button and this is all it does: open the city close
     up. Nothing smaller on it is tappable — at that scale a building is a
     12-26px target (PLAN-ROMA §7). */
  if (e.target.closest('#city-open')) {
    openCityView();
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

/* Escape closes the city view. It is the only overlay that is not a lesson, so
   it is the only one where backing out costs her nothing. */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeCityView();
});

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
  const included = !isExcluded(list.id);
  const card = el('div', `card${included ? '' : ' chapter-off'}`);

  const head = el('label', 'chapter-head scope-item');
  const toggle = el('input');
  toggle.type = 'checkbox';
  toggle.checked = included;
  toggle.addEventListener('change', () => toggleList(list.id, toggle.checked));
  head.append(toggle);
  head.append(el('span', 'chapter-title', list.title ?? list.file));
  head.append(el('span', 'caption', `${list.words.length} woorden`));
  card.append(head);

  if (list.pasted) {
    const remove = el('button', 'btn btn-small', 'Geplakte lijst verwijderen');
    remove.dataset.removeList = list.id;
    card.append(remove);
  }

  card.append(progressTrack(list.words, store.cards));

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

/* ---------------------------------------------------------- importing --- */

/* Parsed live as she types, so the preview is never out of step with the text
   in front of her, and "bewaren" is only enabled once there is something to
   save. */
function refreshPreview() {
  const text = $('import-text').value;
  const host = $('import-preview');
  const save = $('import-save');

  if (!text.trim()) {
    host.replaceChildren();
    save.disabled = true;
    return;
  }

  const parsed = parseList(text);
  host.replaceChildren(...importPreview(parsed));
  save.disabled = parsed.words.length === 0;
}

async function saveImport() {
  const text = $('import-text').value;
  if (!text.trim()) return;

  store.addList({ title: $('import-title').value.trim(), text });
  $('import-text').value = '';
  $('import-title').value = '';
  refreshPreview();

  await reloadCorpus();
  closeModal();
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
    ...(active ? [readinessPanel(readiness(store.cards, activeWords(), active, now), { compact: true })] : []),
  );

  const upcoming = [...store.progress.tests]
    .sort((a, b) => a.date.localeCompare(b.date));

  list.replaceChildren(...(upcoming.length
    ? upcoming.map(test => {
      const panel = readinessPanel(readiness(store.cards, activeWords(), test, now));
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

/* -------------------------------------------------------------- pool --- */

/** Chapters she has switched off are out of the pool — their cards are kept. */
function isExcluded(listId) {
  return store.settings.excludedLists.includes(listId);
}

function toggleList(listId, include) {
  const excluded = new Set(store.settings.excludedLists);
  if (include) excluded.delete(listId);
  else excluded.add(listId);
  store.settings.excludedLists = [...excluded];
  store.save();

  renderChapters();
  refreshHome();
}

/** The corpus minus the chapters she has switched off. */
function activeWords() {
  const words = new Map();
  for (const [id, word] of corpus.words) {
    if (word.lists.every(isExcluded)) continue;
    words.set(id, word);
  }
  return words;
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

  const active = activeWords();
  const test = activeTest(store.progress.tests, now);

  /* During a run-up the ring shows readiness rather than the daily goal:
     progress toward Friday outranks an abstract daily tick that week. */
  let ring;
  if (test) {
    const summary = readiness(store.cards, active, test, now);
    ring = {
      fraction: summary.total ? summary.ready / summary.total : 0,
      text: `${summary.ready}/${summary.total}`,
      label: 'klaar voor de toets',
    };
  } else {
    const met = goalMetToday(store.progress.streak, now);
    ring = {
      fraction: met ? 1 : 0,
      text: met ? '✓' : '0/1',
      label: met ? 'dagdoel gehaald' : 'nog geen les vandaag',
    };
  }

  const next = nextAt(store.progress.xp);
  const stage = stageFor(store.progress.xp);

  paintHome({
    due,
    fresh: [...active.keys()].filter(id => !store.cards.has(id)).length,
    streak: store.progress.streak.current,
    stage,
    ring,
    next,
    warning: store.status.ok ? null : store.status.message,
  });

  paintCity({
    unlocked: store.progress.roma.unlocked,
    next,
    built: cityProgress(store.progress.xp),
    stage: store.progress.roma.stage,
    /* For the full-screen view's one context line, since Home is not on
       screen behind it to say which era this is. */
    stageName: stage.stage.name,
    /* The crowd on the street grows with the words she knows — a second,
       free reading of progress that costs one number (PLAN-ROMA §4). */
    learned: [...store.cards.values()].filter(card => card.phase === 'learned').length,
  });

  /* Switching every chapter off leaves nothing to teach, so Start goes dead
     rather than opening a lesson that ends the moment it begins. */
  $('start-lesson').disabled = active.size === 0;
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
  const summary = test ? readiness(store.cards, activeWords(), test) : null;
  const readyBefore = summary?.ready ?? null;

  const lesson = createLesson({
    words: activeWords(),
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
  const results = lesson.results();
  const gained = test
    ? readiness(store.cards, activeWords(), test).ready - readyBefore
    : 0;

  /* XP is paid on transitions, so this is the one place it can be awarded:
     when the lesson is over and its tally is final. */
  const now = Date.now();
  const xpBefore = store.progress.xp;
  const award = awardLesson(store.progress, results, now);
  store.progress.xp = award.xp;
  store.progress.streak = award.streak;
  store.progress.typedAnswers += results.typed;

  /* Badges are checked after the award, so a streak badge can be earned by the
     very lesson that extended the streak. */
  const words = activeWords();
  const earned = newBadges({
    cards: store.cards,
    words,
    lists: corpus.lists,
    streak: award.streak,
    results,
    tests: store.progress.tests,
    typedTotal: store.progress.typedAnswers,
    learnedCount: [...store.cards.values()].filter(card => card.phase === 'learned').length,
    now,
  }, store.progress.badges);

  store.progress.badges.push(...earned.map(badge => badge.id));

  /* What this lesson built, taken from the XP either side of it rather than
     from the stored list — that is the fact that cannot be corrupted. */
  const rose = unlockedBy(xpBefore, award.xp);
  const { changed: _drift, ...city } = reconcile(store.progress.roma, award.xp);
  store.progress.roma = city;
  store.save();

  paintResults(results, { test, gained, award, badges: earned });
  refreshHome();
  renderChapters();
  renderReadiness();
  show('results');

  /* The unlock moment, after the screen is up so she watches it happen rather
     than arriving to find it already over. Never mid-lesson: PLAN-ROMA 7 is
     explicit that it would break the flow the anticipation gap depends on.

     Awaited so that `seenXp` only moves once she has actually seen it — that
     watermark is the whole reason the city keeps a cache at all. */
  cityUnlockMoment(rose.buildings, {
    unlocked: store.progress.roma.unlocked,
    stageCrossed: rose.stageCrossed,
    stage: rose.stageCrossed ? STAGES[rose.stageCrossed.to] : null,
    stageIndex: store.progress.roma.stage,
  }).then(() => {
    store.progress.roma = markSeen(store.progress.roma, store.progress.xp);
    store.save();
  });
}

/**
 * The one confirmation dialog, reused. Nothing that forgets her work happens
 * without passing through here.
 */
function askToConfirm(title, detail, onConfirm, opts = {}) {
  const { confirmLabel = 'Doorgaan', cancelLabel = 'Annuleren' } = opts;
  const dialog = $('confirm');

  $('confirm-title').textContent = title;
  $('confirm-detail').textContent = detail;
  $('confirm-stay').textContent = cancelLabel;
  $('confirm-quit').textContent = confirmLabel;
  dialog.hidden = false;

  const close = () => {
    dialog.hidden = true;
    dialog.removeEventListener('click', onClick);
  };

  const onClick = e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'stay') close();
    if (action === 'quit') { close(); onConfirm(); }
  };

  dialog.addEventListener('click', onClick);
}

const askToQuit = onQuit => askToConfirm(
  'Les stoppen?',
  'Je bent nog bezig. Wat je al deed, telt mee in het resultaat.',
  onQuit,
  { confirmLabel: 'Stoppen', cancelLabel: 'Verdergaan' },
);

/* ---------------------------------------------------------- settings --- */

/* Each control is a `.segmented` group carrying the settings key it edits, so
   adding one is a matter of markup rather than another handler here. */

const readSetting = (group, raw) => ({
  number: Number(raw),
  boolean: raw === 'true',
}[group.dataset.type] ?? raw);

/** Light up whichever button matches what is stored. */
function renderSettings() {
  for (const group of document.querySelectorAll('[data-setting]')) {
    const current = store.settings[group.dataset.setting];
    for (const button of group.querySelectorAll('button')) {
      const value = readSetting(group, button.dataset.value);
      button.setAttribute('aria-pressed', String(value === current));
    }
  }
}

function changeSetting(group, button) {
  const key = group.dataset.setting;
  store.settings[key] = readSetting(group, button.dataset.value);
  store.save();

  renderSettings();

  /* Two settings have an effect outside their own value. */
  if (key === 'sound') setSoundEnabled(store.settings.sound);
  if (key === 'lastDirection') restoreDirection();
}

/* ------------------------------------------------------------ backup --- */

const backupFilename = () => `llrnr-${new Date().toISOString().slice(0, 10)}.json`;

const backupText = () => JSON.stringify(exportBackup(store), null, 2);

function note(id, message) {
  const slot = $(id);
  slot.textContent = message;
  slot.hidden = !message;
}

function downloadBackup() {
  const blob = new Blob([backupText()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = el('a');
  link.href = url;
  link.download = backupFilename();
  link.click();
  URL.revokeObjectURL(url);
  note('export-note', `Bewaard als ${backupFilename()}.`);
}

async function copyBackup() {
  /* Copying matters more than it looks on an installed iOS app, where a saved
     file can be awkward to find again — the clipboard goes straight into a
     note or an email to herself. */
  try {
    await navigator.clipboard.writeText(backupText());
    note('export-note', 'Gekopieerd. Plak het ergens veilig, bijvoorbeeld in een mail aan jezelf.');
  } catch {
    note('export-note', 'Kopieren lukt niet in deze browser — gebruik "Bestand bewaren".');
  }
}

let pendingRestore = null;

function refreshRestorePreview() {
  const text = $('restore-text').value.trim();
  const host = $('restore-preview');
  const apply = $('restore-apply');

  pendingRestore = null;
  apply.disabled = true;

  if (!text) { host.replaceChildren(); return; }

  const result = inspectBackup(text);
  if (!result.ok) {
    host.replaceChildren(el('p', 'tag tag-bad', result.reason));
    return;
  }

  /* Say what is in it *and* what it costs, before anything is replaced. */
  const { summary } = result;
  const card = el('div', 'card');
  card.append(el('p', 'result-line',
    `${plural(summary.cards, 'woord', 'woorden')}, ${summary.xp} XP`));
  card.append(el('p', 'caption', [
    plural(summary.badges, 'badge', 'badges'),
    plural(summary.tests, 'toets', 'toetsen'),
    plural(summary.lists, 'geplakte lijst', 'geplakte lijsten'),
    ...(summary.exportedAt ? [`bewaard op ${summary.exportedAt.slice(0, 10)}`] : []),
  ].join(' · ')));
  card.append(el('p', 'tag tag-bad',
    `Dit vervangt je huidige voortgang (${plural(store.cards.size, 'woord', 'woorden')}, `
    + `${store.progress.xp} XP).`));

  host.replaceChildren(card);
  pendingRestore = result.backup;
  apply.disabled = false;
}

async function applyRestore(event) {
  event.preventDefault();
  if (!pendingRestore) return;

  store.restore(pendingRestore);
  $('restore-text').value = '';
  refreshRestorePreview();
  restoreDirection();
  renderSettings();
  setSoundEnabled(store.settings.sound);
  await reloadCorpus();
  note('export-note', 'Terugzetten gelukt.');
}

/** One button per chapter, each asking before it forgets anything. */
function renderResetList() {
  if (!corpus) return;
  $('reset-list').replaceChildren(...corpus.lists.map(list => {
    const button = el('button', 'btn btn-small', `${list.title ?? list.file} opnieuw`);
    button.dataset.resetList = list.id;
    return button;
  }));
}

function resetChapter(listId) {
  const list = corpus.lists.find(entry => entry.id === listId);
  if (!list) return;

  askToConfirm(
    `${list.title ?? list.file} opnieuw beginnen?`,
    'Je voortgang voor dit hoofdstuk wordt gewist. De woorden blijven staan.',
    () => {
      const removed = store.resetList(listId, list.words.map(word => word.id));
      store.save();
      renderChapters();
      refreshHome();
      renderReadiness();
      note('export-note', `${removed} woorden opnieuw op nul gezet.`);
    },
    { confirmLabel: 'Wissen' },
  );
}

/* -------------------------------------------------------------- boot --- */

/** Re-read every source, committed and pasted, and repaint what depends on it. */
async function reloadCorpus() {
  corpus = await loadCorpus('data/', { pasted: store.pastedLists });
  renderChapters();
  renderScopeChoices();
  renderReadiness();
  renderResetList();
  refreshHome();
}

async function boot() {
  /* Total XP wins. `roma.unlocked` and `roma.stage` are a cache kept only so
     that "what is new since she last looked?" is answerable, so a stored list
     that disagrees with the XP is recomputed rather than believed. A botched
     write must never cost her a building — nothing else in this app is allowed
     to take something away either. */
  const { changed, ...city } = reconcile(store.progress.roma, store.progress.xp);
  store.progress.roma = city;
  if (changed) store.save();

  show(TABS[0]);

  /* Start stays disabled until there are words to teach. A button that looks
     ready and does nothing is worse than one that is visibly not ready yet. */
  const startButton = $('start-lesson');
  startButton.disabled = true;
  startButton.addEventListener('click', () => startLesson());

  restoreDirection();
  renderSettings();
  setSoundEnabled(store.settings.sound);
  $('test-form').addEventListener('submit', saveTest);

  $('import-text').addEventListener('input', refreshPreview);
  $('import-save').addEventListener('click', saveImport);
  $('export-download').addEventListener('click', downloadBackup);
  $('export-copy').addEventListener('click', copyBackup);
  $('restore-text').addEventListener('input', refreshRestorePreview);
  $('import-form').addEventListener('submit', applyRestore);

  /* Offline support, but only where a service worker is allowed to exist. */
  if ('serviceWorker' in navigator
      && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('service-worker.js')
      .catch(err => console.warn('llrnr: service worker not registered', err));
  }

  try {
    await reloadCorpus();
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
