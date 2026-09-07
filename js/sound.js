/* sound.js — three short tones, synthesised rather than fetched.

   No audio files: a handful of oscillator notes cost nothing to cache, cannot
   404, and keep the app a folder of text. They are deliberately quiet and
   short — this runs at a kitchen table, and a trainer that chirps loudly at
   every answer gets muted for good within a day.

   iOS will not start an AudioContext until the user has tapped something, so
   the context is created lazily on the first sound *after* a tap (starting a
   lesson always is one) and resumed if the browser suspended it. */

let context = null;
let enabled = true;

/** Called from Settings; also read before every note. */
export function setSoundEnabled(on) {
  enabled = Boolean(on);
}

function audio() {
  if (!enabled) return null;
  try {
    context ??= new (globalThis.AudioContext ?? globalThis.webkitAudioContext)();
    /* Safari suspends the context when the app is backgrounded. */
    if (context.state === 'suspended') context.resume();
    return context;
  } catch {
    /* No Web Audio (or blocked): silence is a perfectly good fallback. */
    return null;
  }
}

/**
 * One note.
 * @param {number} freq   hertz
 * @param {number} start  seconds from now
 * @param {number} length seconds
 * @param {number} peak   0..1
 */
function note(freq, start = 0, length = 0.12, peak = 0.06) {
  const ctx = audio();
  if (!ctx) return;

  const at = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, at);

  /* A tiny fade in and out: a square-edged gate clicks. */
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);

  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

/* A major third up: brief, unremarkable, easy to hear forty times a lesson. */
export const correct = () => { note(660, 0, 0.09); note(880, 0.06, 0.10); };

/* Lower and softer than the right answer, deliberately: a wrong answer costs
   her nothing lasting, so it should not sound like an alarm. */
export const wrong = () => note(200, 0, 0.16, 0.05);

/* Halfway between the two, for a near miss. */
export const almost = () => { note(520, 0, 0.09); note(590, 0.06, 0.10); };

/* The one flourish in the app, saved for a badge. */
export const fanfare = () => {
  [523, 659, 784, 1047].forEach((freq, i) => note(freq, i * 0.09, 0.20, 0.07));
};

/**
 * A building rising. Deliberately not the badge fanfare: a badge is a pat on
 * the back and this is a piece of Rome appearing, so it is lower, slower and
 * only three notes — closer to a bell than to a trumpet. It plays under the
 * ~800 ms reveal, so it has to last about that long and not outstay it.
 */
export const unlocked = () => {
  [392, 523, 784].forEach((freq, i) => note(freq, i * 0.16, 0.34, 0.06));
};

/** A new stage. The one moment that earns both sounds at once. */
export const stageUp = () => {
  unlocked();
  [1047, 1319].forEach((freq, i) => note(freq, 0.5 + i * 0.12, 0.4, 0.05));
};

export const forGrade = grade => ({ correct, wrong, almost }[grade]?.());
