// The link between the two phones. Everything shared goes through the Firebase
// Realtime Database; this file is the only place that talks to it.
//
// Shape of a room in the database:
//   rooms/<roomId>/meta      { v, createdAt }
//   rooms/<roomId>/players   { a: { name, joinedAt }, b: { name, joinedAt } }
//   rooms/<roomId>/presence  { a: { <connection>: time }, b: { ... } }   who is looking at the game right now
//   rooms/<roomId>/wave      { from, id, at }                           the latest hello

import {
  initializeApp, getDatabase, ref, set, remove, onValue, onDisconnect,
  runTransaction, serverTimestamp, goOnline, goOffline,
} from '../vendor/firebase.js';
import { DATABASE_URL } from './config.js';
import { randomId, withTimeout } from './util.js';

const HOSTED = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.(firebaseio\.com|firebasedatabase\.app)\/?$/i;
// A database emulator on this computer, used by the automated tests.
const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost):\d+\/\?ns=[a-z0-9-]+$/i;

const WRITE_TIMEOUT_MS = 12000;

let db = null;

// 'missing' | 'invalid' | 'ok'
export function configState() {
  const url = (DATABASE_URL || '').trim();
  if (!url) return 'missing';
  return HOSTED.test(url) || LOCAL.test(url) ? 'ok' : 'invalid';
}

function database() {
  if (!db) {
    const url = DATABASE_URL.trim();
    const app = initializeApp({ databaseURL: LOCAL.test(url) ? url : url.replace(/\/$/, '') });
    db = getDatabase(app);
  }
  return db;
}

function roomRef(roomId, path = '') {
  return ref(database(), `rooms/${roomId}${path ? `/${path}` : ''}`);
}

// ---------- Connection ----------

// Calls back with true/false whenever this phone gains or loses its live link.
// Returns a function that stops listening.
export function onConnectionChange(callback) {
  return onValue(ref(database(), '.info/connected'), (snap) => callback(snap.val() === true));
}

// Drop the link and dial again. Used when a phone wakes up and its old link
// looks dead; anything not yet sent is kept and goes out on the new link.
export function refreshConnection() {
  const current = database();
  goOffline(current);
  setTimeout(() => goOnline(current), 60);
}

// ---------- Rooms ----------

// Makes a new room with `name` as its first player (seat "a"). Resolves with the room id.
export async function createRoom(name) {
  const roomId = randomId(20);
  const room = {
    meta: { v: 1, createdAt: serverTimestamp() },
    players: { a: { name, joinedAt: serverTimestamp() } },
  };
  await withTimeout(set(roomRef(roomId), room), WRITE_TIMEOUT_MS);
  return roomId;
}

// Calls `onRoom` with the whole room now and again every time anything in it
// changes. `onRoom(null)` means there is no such room. Returns a stop function.
export function watchRoom(roomId, onRoom, onError) {
  return onValue(
    roomRef(roomId),
    (snap) => onRoom(snap.val()),
    (error) => { if (onError) onError(error); },
  );
}

// Takes a seat if nobody has it. Resolves true if this phone got it, false if
// someone was already sitting there.
export async function claimSeat(roomId, seat, name) {
  const result = await withTimeout(
    runTransaction(
      roomRef(roomId, `players/${seat}`),
      (current) => (current === null ? { name, joinedAt: serverTimestamp() } : undefined),
      { applyLocally: false },
    ),
    WRITE_TIMEOUT_MS,
  );
  return result.committed;
}

// ---------- Presence ----------

// Tells the room this phone is looking at the game. The mark is removed by the
// server itself if the phone drops off, so the other player never sees a ghost.
export function announcePresence(roomId, seat) {
  const mine = roomRef(roomId, `presence/${seat}/${randomId(8)}`);
  let inView = true;
  let stopped = false;

  const stopListening = onConnectionChange((connected) => {
    if (!connected || stopped) return;
    onDisconnect(mine).remove()
      .then(() => { if (inView && !stopped) return set(mine, serverTimestamp()); })
      .catch(() => {});
  });

  return {
    // Call with false when the game goes out of view (phone locked, app switched)
    // and true when it comes back. Resolves once the server has the change.
    setInView(on) {
      inView = on;
      if (stopped) return Promise.resolve();
      return on ? set(mine, serverTimestamp()) : remove(mine);
    },
    stop() {
      stopped = true;
      stopListening();
      onDisconnect(mine).cancel().catch(() => {});
      return remove(mine).catch(() => {});
    },
  };
}

// ---------- Waving ----------

export function sendWave(roomId, seat) {
  return set(roomRef(roomId, 'wave'), { from: seat, id: randomId(6), at: serverTimestamp() });
}
