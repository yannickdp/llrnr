/* ui.js — rendering helpers, and the lesson screen they build.

   Everything here is built with createElement and textContent: word lists are
   hand-edited files and pasted text, and innerHTML would turn a vocabulary
   list into an injection path.

   The clock is read, never trusted to a timer. iOS freezes timers in a
   backgrounded tab, so the countdown ring and the lesson clock recompute from
   Date.now() on every animation frame instead of counting ticks down. */

import { fanfare, forGrade, unlocked as unlockedChime, stageUp } from './sound.js';
import { studyDay, trackPosition, TRACK_STOPS } from './schedule.js';
import { createScene } from './roma/render.js';
import { SCENE } from './roma/catalogue.js';
import { entryFor } from './roma/roma.js';

export const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export const $ = id => document.getElementById(id);

/** m:ss, for the lesson clock. */
export function formatClock(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/* ======================================================== the home ======= */

/**
 * The three numbers on Home, and the save warning if there is one.
 *
 * They are deliberately real or zero, never illustrative: the streak and XP
 * stay at nought until Phase 4.1 actually awards them, because a made-up 5-day
 * streak on a screen that also shows a real "te herhalen" count teaches her to
 * distrust both.
 */
export function paintHome({ due, fresh, streak, warning, stage, ring, next }) {
  $('home-due').textContent = String(due);
  $('home-new').textContent = String(fresh);
  $('home-streak').textContent = String(streak);

  /* The bar sits under the city and measures the thing the city is about: the
     next building, not the next stage. PLAN section 5 asks for exactly that,
     and it was measuring stage progress only because there were no buildings
     to measure yet.
     A stage is five or six buildings wide, so a bar against the stage moves
     imperceptibly per lesson; against the next building it moves visibly every
     time, which is the whole argument for the construction-site teaser too. */
  $('home-stage').textContent = stage.stage.name;
  $('home-xp').style.inlineSize = `${Math.round((next?.progress ?? 1) * 100)}%`;
  $('home-xp-caption').textContent = next
    ? `nog ${next.remaining} XP tot ${next.entry.latin}`
    : 'Roma Aeterna — de stad is af';

  /* One ring, two jobs: the daily goal normally, and readiness during a test
     run-up, because that week progress toward Friday is the thing she cares
     about. */
  $('daily-ring').style.setProperty('--pct', String(Math.round(ring.fraction * 100)));
  $('daily-ring-text').textContent = ring.text;
  $('daily-goal-label').textContent = ring.label;

  const slot = $('home-warning');
  slot.textContent = warning ?? '';
  slot.hidden = !warning;
}

/* ========================================================= the city ====== */

/* Rome lives at the top of Home, which is the point: the reward should be
   unavoidable rather than somewhere she has to navigate to.

   Two views, because the unlock moment belongs on the Results screen and the
   hero belongs on Home. They are separate canvases with separate pans, which
   is why the drawing engine binds its painter per canvas.

   The hero's loop is suspended whenever it is not being looked at — the tab is
   backgrounded, or Home is not the visible screen. On a phone an animation
   nobody can see is just battery. */

let hero = null;
let unlockView = null;

const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Paint the Home hero.
 *
 * @param {object} city
 * @param {string[]} city.unlocked  ids that exist
 * @param {object|null} city.next   `nextAt(xp)` — the building under construction
 * @param {object} city.built       `cityProgress(xp)`
 */
export function paintCity({ unlocked, next, built }) {
  const canvas = $('city-home');
  if (!canvas) return;

  if (!hero) {
    hero = createScene(canvas, { view: SCENE.window, motion: !REDUCED() });
    /* Only run while she can actually see it. */
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) hero.stop();
      else if (!$('screen-home').hidden) hero.start();
    });
  }

  /* The building going up is shown at its real progress, so the plot changes
     a little after every lesson rather than only at the threshold. */
  const progress = next ? { [next.entry.id]: next.progress } : {};
  const ids = next ? [...unlocked, next.entry.id] : unlocked;
  hero.show(ids, progress);

  /* Follow the work: the window sits on whatever is being built, or on the
     newest thing standing once the city is finished. */
  const focus = next?.entry ?? entryFor(unlocked.at(-1) ?? '') ?? null;
  if (focus) hero.focus(focus);

  /* The count only. The XP bar right underneath already names the next
     building, and saying it twice on one screen makes both lines wallpaper. */
  $('city-caption').textContent = `${built.built} van de ${built.total} gebouwen`;
}

/** Start or stop the hero's flame, as Home comes and goes. */
export function cityVisible(visible) {
  if (!hero) return;
  if (visible && !document.hidden) hero.start();
  else hero.stop();
}

/**
 * The unlock moment: pan to the plot, take the scaffolding off, and let the
 * building rise. One at a time — PLAN-ROMA section 7 queues them rather than
 * overlapping, because two buildings appearing at once is a mess and neither
 * gets its moment.
 *
 * @param {object[]} buildings   catalogue entries, in unlock order
 * @param {object} options
 * @param {string[]} options.unlocked  everything that exists after the lesson
 * @param {object|null} options.stageCrossed
 * @param {object|null} options.stage  the stage entered, for its Latin name
 */
export async function cityUnlockMoment(buildings, { unlocked, stageCrossed, stage }) {
  const card = $('unlock-card');
  if (!card || buildings.length === 0) {
    if (card) card.hidden = true;
    return;
  }

  card.hidden = false;
  const canvas = $('city-unlock');
  if (!unlockView) {
    unlockView = createScene(canvas, { view: SCENE.window, motion: !REDUCED() });
  }

  /* Start from the city as it was *before* these landed, so there is something
     to reveal. */
  const before = unlocked.filter(id => !buildings.some(b => b.id === id));
  unlockView.show(before);
  unlockView.start();

  for (const entry of buildings) {
    $('unlock-eyebrow').textContent = stageCrossed && entry === buildings.at(-1)
      ? `${stage?.name ?? ''} — nieuw tijdperk`
      : 'Nieuw gebouw';
    $('unlock-latin').textContent = entry.latin;
    $('unlock-dutch').textContent = entry.dutch;
    /* One line of history. One — it is a reward, not a lesson. */
    $('unlock-note').textContent = entry.note;

    if (stageCrossed && entry === buildings.at(-1)) stageUp();
    else unlockedChime();

    await unlockView.reveal(entry);
    /* A beat to read the card before the next building takes the stage. */
    if (entry !== buildings.at(-1)) await new Promise(r => setTimeout(r, 900));
  }

  unlockView.stop();
}

/* ==================================================== the readiness ====== */

const DAYS_LEFT_LABEL = left => {
  if (left === 0) return 'toets is vandaag';
  if (left === 1) return 'toets is morgen';
  return `toets over ${left} dagen`;
};

/**
 * The readiness panel — PLAN section 2.6 calls it the whole point.
 *
 * The middle line is the most useful diagnostic in the app: it names the exact
 * gap that loses marks, because recognition always runs ahead of production.
 * The button under it practises precisely that side.
 */
export function readinessPanel(summary, { compact = false } = {}) {
  const { test, ready, total, solidFwdOnly, solidRevOnly, shaky, notStarted } = summary;

  const panel = el('div', 'card readiness');
  const head = el('div', 'chapter-head');
  head.append(el('span', 'chapter-title', test.title || 'Toets'));
  head.append(el('span', 'caption', DAYS_LEFT_LABEL(summary.daysLeft)));
  panel.append(head);

  panel.append(el('p', 'readiness-headline',
    `${ready} van de ${total} woorden klaar in beide richtingen`));

  const bar = el('div', 'meter');
  const fill = el('div', 'meter-fill');
  fill.style.inlineSize = `${total ? Math.round((ready / total) * 100) : 0}%`;
  bar.append(fill);
  panel.append(bar);

  /* The gap that loses marks, named in full rather than averaged away. */
  if (solidFwdOnly) {
    panel.append(el('p', 'readiness-gap',
      `${solidFwdOnly} ${solidFwdOnly === 1 ? 'woord zit' : 'woorden zitten'} goed van Latijn naar Nederlands, nog niet omgekeerd`));
  }
  if (solidRevOnly) {
    panel.append(el('p', 'readiness-gap',
      `${solidRevOnly} ${solidRevOnly === 1 ? 'woord zit' : 'woorden zitten'} goed van Nederlands naar Latijn, nog niet omgekeerd`));
  }

  if (!compact) {
    panel.append(el('p', 'caption',
      `${shaky} nog wankel · ${notStarted} nog niet begonnen`));

    panel.append(el('p', 'readiness-estimate', summary.minutesPerDay
      ? `≈ ${summary.minutesPerDay} minuten per dag om op tijd klaar te zijn`
      : 'Je bent klaar voor deze toets.'));
  }

  /* Said out loud rather than quietly reordering behind her back: she is
     entitled to know the app has changed what it is aiming for. */
  if (!summary.feasible && summary.remaining.total > 0) {
    const note = el('div', 'triage');
    note.append(el('p', 'triage-head', 'Te weinig tijd voor alles'));
    note.append(el('p', 'caption',
      'We zorgen eerst dat je élk woord één keer goed hebt, in beide richtingen, '
      + 'voor we er woorden helemaal instampen. Op een toets levert dat meer punten op.'));
    panel.append(note);
  }

  if (summary.weakest) {
    const practise = el('button', 'btn btn-primary',
      `${DIRECTION_LABEL[summary.weakest]} oefenen`);
    practise.dataset.practise = summary.weakest;
    panel.append(practise);
  }

  return panel;
}

/* ====================================================== the lesson ======= */

export const DIRECTION_LABEL = {
  fwd: 'Latijn → Nederlands',
  rev: 'Nederlands → Latijn',
};

/**
 * Bind a lesson to the DOM and run it until it is over.
 *
 * @param {object} lesson    from createLesson()
 * @param {object} opts
 * @param {number} [opts.anticipationSeconds]  the silence before she may type
 * @param {() => void} opts.onFinish
 */
export function runLesson(lesson, { anticipationSeconds = 4, onFinish } = {}) {
  const body = $('lesson-body');
  const progress = $('lesson-progress');
  const clock = $('lesson-clock');

  let frame = null;
  /* When the current question's anticipation gap ends. Absolute, not a count. */
  let revealInputAt = 0;

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = null;
  }

  /* ---------------------------------------------------------- painting --- */

  function paintPresentation(step) {
    const { word } = step;
    const card = el('div', 'card presentation');
    card.append(el('p', 'eyebrow', 'Nieuw woord'));
    card.append(el('p', 'prompt', word.term));
    if (word.form) card.append(el('p', 'caption', word.form));
    card.append(el('p', 'lede reveal-answer', word.answer));

    const go = el('button', 'btn btn-primary btn-lg', 'Verder');
    go.addEventListener('click', () => {
      lesson.acknowledge(Date.now());
      tick();
    }, { once: true });

    body.replaceChildren(card, go);
  }

  function paintQuestion(step) {
    revealInputAt = Date.now() + anticipationSeconds * 1000;

    const area = el('div', 'prompt-area');
    area.append(el('p', 'direction-marker', DIRECTION_LABEL[step.direction]));
    area.append(el('p', 'prompt', step.prompt));

    /* The gap is the exercise, not dead time: the answer is nowhere on screen
       and there is nothing to do but recall. Tapping the ring skips it, for
       when she already knows.

       It is deliberately absent from the multiple-choice first contact: the
       answer is one of the four options in front of her, so there is nothing
       to anticipate and a countdown would only be a delay. */
    if (step.mode === 'typed') {
      const ring = el('button', 'ring', String(anticipationSeconds));
      ring.id = 'ring';
      ring.setAttribute('aria-label', 'Denktijd overslaan');
      ring.addEventListener('click', () => { revealInputAt = 0; });
      area.append(ring);
    }

    const form = el('form', 'answer-form');
    form.autocomplete = 'off';

    const input = el('input', 'answer-input');
    Object.assign(input, {
      type: 'text', id: 'answer-input',
      autocapitalize: 'off', autocorrect: 'off', spellcheck: false,
      placeholder: step.direction === 'fwd' ? 'Typ de vertaling' : 'Typ het Latijnse woord',
      disabled: true,
    });
    input.setAttribute('aria-label', 'Jouw antwoord');

    const submit = el('button', 'btn btn-primary', 'Nakijken');
    submit.type = 'submit';
    submit.disabled = true;

    if (step.mode === 'choice') {
      /* Her one gentle first contact with this word. */
      const choices = el('div', 'choices');
      for (const option of step.options) {
        const button = el('button', 'choice choice-option');
        button.type = 'button';
        button.append(el('span', 'choice-title', option));
        button.addEventListener('click', () => grade(option), { once: true });
        choices.append(button);
      }
      choices.id = 'mc-options';
      body.replaceChildren(area, choices);
    } else {
      form.append(input, submit);
      form.addEventListener('submit', e => {
        e.preventDefault();
        grade(input.value);
      });
      body.replaceChildren(area, form);
    }
  }

  function grade(typed) {
    const reveal = lesson.answer(typed, Date.now());
    paintReveal(reveal);
  }

  function paintReveal(reveal) {
    forGrade(reveal.grade);
    const verdict = { correct: 'Juist', wrong: 'Fout', almost: 'Bijna!' }[reveal.grade];
    const card = el('div', `card reveal reveal-${reveal.grade}`);
    card.append(el('p', 'eyebrow', verdict));
    card.append(el('p', 'prompt reveal-answer', reveal.answer));

    /* For an "almost" the headline word is already the spelling she nearly
       had, so repeating it in a sentence says nothing. What she cannot see is
       what she actually typed — and the spelling is the whole point. */
    if (reveal.grade === 'almost' && reveal.nearest && reveal.nearest !== reveal.answer) {
      card.append(el('p', 'lede reveal-answer', reveal.nearest));
    }

    if (reveal.form) card.append(el('p', 'caption', reveal.form));

    /* Every other translation that would also have counted — so a right answer
       she was unsure about is confirmed, not left ambiguous. */
    const extras = reveal.alternatives.filter(t => t !== reveal.answer);
    if (extras.length) {
      card.append(el('p', 'caption', `ook goed: ${extras.join(', ')}`));
    }
    if (reveal.grade !== 'correct' && reveal.typed?.trim()) {
      card.append(el('p', 'caption typed-back', `jij typte: ${reveal.typed}`));
    }

    const go = el('button', 'btn btn-primary btn-lg', 'Verder');
    go.addEventListener('click', tick, { once: true });

    body.replaceChildren(card, go);
    go.focus();
  }

  function paintWait(step) {
    const card = el('div', 'card waiting');
    card.append(el('p', 'lede', 'Even wachten…'));
    card.append(el('p', 'caption', 'Het volgende woord komt zo terug.'));
    body.replaceChildren(card);
    /* No button: the frame loop calls tick() again once something is due. */
    void step;
  }

  /* ------------------------------------------------------------ loop ----- */

  function tick() {
    const now = Date.now();
    const step = lesson.next(now);

    if (step.kind === 'done') { stop(); onFinish?.(); return; }
    if (step.kind === 'present') return paintPresentation(step);
    if (step.kind === 'ask') return paintQuestion(step);
    return paintWait(step);
  }

  /** Runs every frame: the clock, the ring, and waking up from a wait. */
  function frameLoop() {
    frame = requestAnimationFrame(frameLoop);
    const now = Date.now();

    clock.textContent = `nog ${formatClock(lesson.timeLeftMs(now))}`;
    progress.style.inlineSize = `${(1 - lesson.elapsedFraction(now)) * 100}%`;

    const current = lesson.current;

    if (current?.kind === 'wait' && now >= current.untilMs) tick();

    if (current?.kind === 'ask' && current.mode === 'typed') {
      const ring = $('ring');
      const input = $('answer-input');
      if (!ring || !input) return;

      const left = revealInputAt - now;
      if (left > 0) {
        ring.textContent = String(Math.ceil(left / 1000));
      } else if (input.disabled) {
        /* The gap is over: let her type, and put the caret there for her. */
        ring.hidden = true;
        input.disabled = false;
        input.parentElement.querySelector('button[type="submit"]').disabled = false;
        input.focus();
      }
    }

    if (lesson.isFinished) { stop(); onFinish?.(); }
  }

  tick();
  frameLoop();

  return { stop };
}

/* ===================================================== the results ======= */

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function paintResults(results, { test = null, gained = 0, award = null, badges = [] } = {}) {
  const host = $('results-body');
  const lines = [];
  const cards = [];

  /* Badges lead, and get the one flourish the app allows itself. */
  if (badges.length) {
    fanfare();
    for (const badge of badges) {
      const card = el('div', 'card badge');
      card.append(el('p', 'eyebrow', 'Nieuwe badge'));
      card.append(el('p', 'badge-name', badge.name));
      card.append(el('p', 'caption', badge.why));
      cards.push(card);
    }
  }

  if (award?.gained) {
    lines.push([`+${award.gained} XP`, award.doubled ? 'eerste les van vandaag — dubbel' : '']);
  }

  /* During a run-up the change in readiness is the top line: progress toward
     Friday is what she cares about that week, not the abstract totals. */
  if (test && gained > 0) {
    lines.push([`+${gained} klaar voor de toets`, test.title || '']);
  }

  if (results.learned) {
    lines.push([plural(results.learned, 'woord helemaal gekend', 'woorden helemaal gekend'),
      results.learnedWords.join(', ')]);
  }
  if (results.graduated) {
    lines.push([plural(results.graduated, 'woord geleerd', 'woorden geleerd'),
      results.graduatedWords.join(', ')]);
  }
  if (results.promoted) {
    lines.push([plural(results.promoted, 'woord een doosje omhoog', 'woorden een doosje omhoog'), '']);
  }
  if (results.presented) {
    lines.push([plural(results.presented, 'nieuw woord gezien', 'nieuwe woorden gezien'), '']);
  }
  lines.push([`${results.correct} van de ${results.answered} juist`, '']);

  cards.push(...lines.map(([title, detail]) => {
    const card = el('div', 'card');
    card.append(el('p', 'result-line', title));
    if (detail) card.append(el('p', 'caption', detail));
    return card;
  }));

  if (results.parked) {
    const card = el('div', 'card');
    card.append(el('p', 'result-line',
      plural(results.parked, 'woord ken je maar één richting', 'woorden ken je maar één richting')));
    card.append(el('p', 'caption',
      'Ze blijven af en toe terugkomen tot je ze ook de andere kant op kent.'));
    cards.push(card);
  }

  /* A count, never a list. After a holiday the honest answer is "hundreds",
     and hundreds of words on a results screen is what makes her stop. */
  if (award?.extended) {
    const card = el('div', 'card');
    card.append(el('p', 'result-line',
      award.streak.current === 1
        ? 'Nieuwe reeks begonnen'
        : `${award.streak.current} dagen op rij`));
    if (award.frozen) {
      card.append(el('p', 'caption', 'Gisteren overgeslagen — dat mag één keer per week.'));
    }
    cards.push(card);
  }

  if (results.heldBack) {
    const card = el('div', 'card');
    card.append(el('p', 'result-line', `Nog ${results.heldBack} woorden te herhalen`));
    card.append(el('p', 'caption', 'Die komen de volgende lessen aan de beurt.'));
    cards.push(card);
  }

  if (results.droppedWords.length) {
    const card = el('div', 'card');
    card.append(el('p', 'result-line', 'Even teruggevallen'));
    card.append(el('p', 'caption', results.droppedWords.join(', ')));
    card.append(el('p', 'caption', 'Die komen vanzelf terug — dat hoort erbij.'));
    cards.push(card);
  }

  host.replaceChildren(...cards);

  $('results-lede').textContent = results.answered
    ? 'Goed gedaan.'
    : 'Tot de volgende keer.';
}

/* ========================================================== importer ===== */

const SEPARATOR_NAME = { '|': 'een |', tab: 'een tab', ';': 'een puntkomma' };

/**
 * What the parser made of what she pasted, shown before anything is saved.
 *
 * PLAN section 4 is firm that this is not optional. A list arrives every couple
 * of weeks, gets pasted from a phone, and the one unacceptable outcome is
 * silently dropping half of it — so every rejected line is named with its
 * number and its reason, and the separator that was guessed is stated.
 */
export function importPreview(parsed, { max = 12 } = {}) {
  const blocks = [];

  const summary = el('div', 'card');
  summary.append(el('p', 'result-line',
    `${parsed.words.length} ${parsed.words.length === 1 ? 'woord' : 'woorden'} gelezen`));
  summary.append(el('p', 'caption',
    `Velden gescheiden door ${SEPARATOR_NAME[parsed.separator] ?? parsed.separator}`
    + (parsed.title ? ` · titel: ${parsed.title}` : '')));

  if (parsed.words.length) {
    const table = el('div', 'preview-table');
    for (const word of parsed.words.slice(0, max)) {
      const row = el('div', 'preview-row');
      row.append(el('span', null, word.term));
      row.append(el('span', null, word.form || '—'));
      row.append(el('span', null, word.answer));
      table.append(row);
    }
    summary.append(table);
    if (parsed.words.length > max) {
      summary.append(el('p', 'preview-more', `… en nog ${parsed.words.length - max}`));
    }
  }
  blocks.push(summary);

  /* Never silently dropped: every line that could not be read, with why. */
  if (parsed.rejects.length) {
    const bad = el('div', 'card');
    bad.append(el('p', 'result-line',
      `${parsed.rejects.length} ${parsed.rejects.length === 1 ? 'regel' : 'regels'} niet gelezen`));
    const notes = el('div', 'tags');
    for (const reject of parsed.rejects) {
      notes.append(el('span', 'tag tag-bad', `regel ${reject.line}: ${reject.reason}`));
    }
    bad.append(notes);
    blocks.push(bad);
  }

  if (parsed.warnings.length) {
    const flagged = el('div', 'card');
    flagged.append(el('p', 'result-line', 'Even nakijken'));
    const notes = el('div', 'tags');
    for (const warning of parsed.warnings) notes.append(el('span', 'tag', warning.message));
    flagged.append(notes);
    blocks.push(flagged);
  }

  if (!parsed.rejects.length && parsed.words.length) {
    const ok = el('div', 'card');
    ok.append(el('p', 'preview-ok', 'Alles gelezen, niets overgeslagen.'));
    blocks.push(ok);
  }

  return blocks;
}

/* ============================================================= track ===== */

const STOP_LABEL = { new: 'nieuw', acquire: 'leren', learned: 'gekend' };

/**
 * A chapter's words as dots on the new -> acquire -> box 1-5 -> learned track.
 *
 * Position, not percentage, per PLAN section 3: a dot that moved one stop is
 * something she can see happen. Words answered today are ringed, so the answer
 * to "what did I actually do today" is on the screen rather than only in the
 * results she has already dismissed.
 */
export function progressTrack(words, cards, now = Date.now()) {
  const today = studyDay(now);
  const byStop = new Map(TRACK_STOPS.map(stop => [stop, []]));

  for (const word of words) {
    const card = cards.get(word.id);
    byStop.get(trackPosition(card)).push({ word, card });
  }

  const track = el('div', 'track');
  for (const stop of TRACK_STOPS) {
    const entries = byStop.get(stop);
    const column = el('div', `track-stop track-stop-${typeof stop === 'number' ? 'box' : stop}`);

    const dots = el('div', 'track-dots');
    for (const { word, card } of entries) {
      const dot = el('span', 'track-dot');
      if (card?.touchedOn === today) dot.classList.add('track-dot-today');
      /* The word itself on long-press or hover — no room for labels. */
      dot.title = word.term;
      dots.append(dot);
    }
    column.append(dots);
    column.append(el('span', 'track-label', STOP_LABEL[stop] ?? String(stop)));
    column.append(el('span', 'track-count', entries.length ? String(entries.length) : ''));
    track.append(column);
  }

  return track;
}

