/* ui.js — rendering helpers, and the lesson screen they build.

   Everything here is built with createElement and textContent: word lists are
   hand-edited files and pasted text, and innerHTML would turn a vocabulary
   list into an injection path.

   The clock is read, never trusted to a timer. iOS freezes timers in a
   backgrounded tab, so the countdown ring and the lesson clock recompute from
   Date.now() on every animation frame instead of counting ticks down. */

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
export function paintHome({ due, fresh, streak, xp, warning }) {
  $('home-due').textContent = String(due);
  $('home-new').textContent = String(fresh);
  $('home-streak').textContent = String(streak);
  $('home-xp').style.inlineSize = `${xp > 0 ? 100 : 0}%`;

  const slot = $('home-warning');
  slot.textContent = warning ?? '';
  slot.hidden = !warning;
}

/* ====================================================== the lesson ======= */

const DIRECTION_LABEL = {
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
    const verdict = { correct: 'Juist', wrong: 'Fout', almost: 'Bijna' }[reveal.grade];
    const card = el('div', `card reveal reveal-${reveal.grade}`);
    card.append(el('p', 'eyebrow', verdict));
    card.append(el('p', 'prompt reveal-answer', reveal.answer));

    if (reveal.form) card.append(el('p', 'caption', reveal.form));

    /* Every other translation that would also have counted — so a right answer
       she was unsure about is confirmed, not left ambiguous. */
    const extras = reveal.alternatives.filter(t => t !== reveal.answer);
    if (extras.length) {
      card.append(el('p', 'caption', `ook goed: ${extras.join(', ')}`));
    }
    if (reveal.grade === 'wrong' && reveal.typed?.trim()) {
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

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function paintResults(results) {
  const host = $('results-body');
  const lines = [];

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

  const cards = lines.map(([title, detail]) => {
    const card = el('div', 'card');
    card.append(el('p', 'result-line', title));
    if (detail) card.append(el('p', 'caption', detail));
    return card;
  });

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
