/* Boot + routing between screens.
   Every screen is a hidden <section data-screen>; exactly one is visible.
   Tab screens live in #screens, the lesson flow in the #modal layer above them.
   Deliberately no History API: the lesson must not be escapable with a back
   swipe, so there are no history entries to swipe through. */

const TABS = ['home', 'words', 'tests', 'settings'];
const MODAL = ['start', 'lesson', 'results'];

const screens = new Map(
  [...document.querySelectorAll('[data-screen]')].map(el => [el.dataset.screen, el])
);
const modal = document.getElementById('modal');
const tabs = [...document.querySelectorAll('.tab')];

let current = null;
let lastTab = 'home';

export function show(name) {
  const next = screens.get(name);
  if (!next) throw new Error(`unknown screen: ${name}`);

  if (current) current.hidden = true;
  next.hidden = false;
  current = next;

  const inModal = MODAL.includes(name);
  modal.hidden = !inModal;
  if (!inModal) lastTab = name;

  for (const tab of tabs) {
    if (tab.dataset.goto === lastTab) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }

  document.documentElement.dataset.screen = name;
}

/* One listener for every [data-goto] in the app, present or future. */
document.addEventListener('click', e => {
  const target = e.target.closest('[data-goto]');
  if (target) show(target.dataset.goto);
});

show(TABS[0]);
