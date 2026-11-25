// The link between the two phones. Everything shared goes through the Firebase
// Realtime Database; this file is the only place that talks to it.

import {
  initializeApp, getDatabase, ref, set, get, remove, onValue, serverTimestamp,
} from '../vendor/firebase.js';
import { DATABASE_URL } from './config.js';
import { randomId, withTimeout } from './util.js';

let db = null;

// 'missing' | 'invalid' | 'ok'
export function configState() {
  const url = (DATABASE_URL || '').trim();
  if (!url) return 'missing';
  const looksRight = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.(firebaseio\.com|firebasedatabase\.app)\/?$/i.test(url);
  return looksRight ? 'ok' : 'invalid';
}

export function database() {
  if (!db) {
    const app = initializeApp({ databaseURL: DATABASE_URL.trim().replace(/\/$/, '') });
    db = getDatabase(app);
  }
  return db;
}

// Calls back with true/false whenever this phone gains or loses its live link.
// Returns a function that stops listening.
export function onConnectionChange(callback) {
  return onValue(ref(database(), '.info/connected'), (snap) => callback(snap.val() === true));
}

// Writes a tiny note, reads it back, and deletes it. Resolves with how long that
// took in milliseconds. Proves the address is right and the rules allow the game to work.
export function roundTrip(timeoutMs = 12000) {
  const path = `rooms/check-${randomId(20)}`;
  const base = ref(database(), path);
  const note = ref(database(), `${path}/ping`);
  const started = performance.now();
  const trip = (async () => {
    await set(note, { at: serverTimestamp() });
    const snap = await get(note);
    if (!snap.exists()) throw new Error('note-missing');
    await remove(base);
    return Math.round(performance.now() - started);
  })();
  return withTimeout(trip, timeoutMs, 'timeout');
}

// Turns a failure from roundTrip() into a sentence a person can act on.
export function explainFailure(error) {
  const text = `${(error && error.code) || ''} ${(error && error.message) || ''}`.toLowerCase();
  if (text.includes('permission')) {
    return 'Reached the database, but its rules blocked the test. The rules still need publishing.';
  }
  if (text.includes('timeout')) {
    return 'No answer from the database. Check the address and your connection.';
  }
  return 'Something went wrong talking to the database.';
}
