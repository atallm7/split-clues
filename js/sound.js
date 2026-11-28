// Small, soft sound effects. Off unless a player turns them on, so nothing
// fights with a video call. The sounds are made on the spot from simple tones;
// there are no sound files.

import * as store from './store.js';

let audio = null;

export function soundOn() {
  return store.setting('sound', false) === true;
}

function context() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return null;
  if (!audio) audio = new Audio();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  return audio;
}

// One soft note: pitch in hertz, when to start (seconds from now), how long.
function note(ctx, pitch, start, length, shape = 'sine', loudness = 0.05) {
  const voice = ctx.createOscillator();
  const volume = ctx.createGain();
  const from = ctx.currentTime + start;
  voice.type = shape;
  voice.frequency.value = pitch;
  volume.gain.setValueAtTime(0, from);
  volume.gain.linearRampToValueAtTime(loudness, from + 0.015);
  volume.gain.exponentialRampToValueAtTime(0.0001, from + length);
  voice.connect(volume).connect(ctx.destination);
  voice.start(from);
  voice.stop(from + length + 0.02);
}

const TUNES = {
  // A lock giving way: three rising notes.
  unlock: (ctx) => [523, 659, 784].forEach((pitch, i) => note(ctx, pitch, i * 0.09, 0.35)),
  // A wrong try: two low notes stepping down.
  miss: (ctx) => [220, 165].forEach((pitch, i) => note(ctx, pitch, i * 0.12, 0.22, 'triangle', 0.06)),
  // The end of a run: a little four-note flourish.
  finish: (ctx) => [523, 659, 784, 1047].forEach((pitch, i) => note(ctx, pitch, i * 0.12, 0.5)),
  // Confirmation when sound is switched on.
  hello: (ctx) => [659, 784].forEach((pitch, i) => note(ctx, pitch, i * 0.08, 0.25)),
};

export function play(name) {
  if (!soundOn() || !TUNES[name]) return;
  const ctx = context();
  if (ctx) TUNES[name](ctx);
}

// Flips the switch. Turning it on plays a short hello, which also lets the
// phone know that sound was asked for by a tap (phones insist on that).
export function toggleSound() {
  const on = !soundOn();
  store.setSetting('sound', on);
  if (on) play('hello');
  return on;
}

// If sound was left on from last time, wake the audio on the first tap of this visit.
export function primeSound() {
  if (!soundOn()) return;
  window.addEventListener('pointerdown', () => { if (soundOn()) context(); }, { once: true });
}
