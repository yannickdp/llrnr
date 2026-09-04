/* Boot + routing between screens.

   Every screen is a hidden <section data-screen>; exactly one is visible.
   Tab screens live in #screens, the lesson flow in the #modal layer above them.

   Deliberately no History API: the lesson must not be escapable with a back
   swipe, so there are no history entries to swipe through. Leaving a lesson
   goes through the X, which later phases guard with a confirmation. */

const TABS = ['home', 'words', 'tests', 'settings'];
const MODAL = ['start', 'lesson', 'results'];

const screens = new Map(
  [...document.querySelectorAll('[data-screen]')].map(el => [el.dataset.screen, el])
);
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
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
 * false to keep the sheet up — which is how lesson.js will ask "really quit?"
 * without app.js knowing anything about lessons. Pass null to clear it.
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

  /* .choices behaves as a radio group: one pressed option per group. */
  const choice = e.target.closest('.choice');
  if (choice) {
    for (const sibling of choice.parentElement.querySelectorAll('.choice')) {
      sibling.setAttribute('aria-pressed', String(sibling === choice));
    }
  }
});

/* Nothing is submitted anywhere yet; stop the shell from reloading itself. */
document.addEventListener('submit', e => e.preventDefault());

show(TABS[0]);
