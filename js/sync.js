// The link between the two phones. Everything shared goes through the Firebase
// Realtime Database; this file is the only place that talks to it.
//
// Shape of a room in the database:
//   rooms/<roomId>/meta      { v, createdAt }
//   rooms/<roomId>/players   { a: { name, joinedAt }, b: { name, joinedAt } }
//   rooms/<roomId>/presence  { a: { <connection>: time }, b: { ... } }   who is looking at the game right now
//   rooms/<roomId>/game      the run being played, if any (see js/game/engine.js)
//   rooms/<roomId>/best      { <episode>: { ms, at } }                  fastest finish for each episode
//
// Surprises are kept beside the room rather than in it, so a phone never even
// downloads its partner's surprise until the episode is finished:
//   rooms/<roomId>-vault/<episode>/<seat>/note   { text, hasPhoto, at }
//   rooms/<roomId>-vault/<episode>/<seat>/photo  a small JPEG as text

import {
  initializeApp, getDatabase, ref, set, get, remove, onValue, onDisconnect,
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

// ---------- The game ----------

// Puts a new run on the table, unless a playable one is already there
// (`isPlayable` decides; leftovers from an older version are replaced).
// Resolves true if this phone's run is the one that started.
export async function startGame(roomId, game, isPlayable) {
  const result = await withTimeout(
    runTransaction(
      roomRef(roomId, 'game'),
      (current) => (isPlayable(current) ? undefined : game),
      { applyLocally: false },
    ),
    WRITE_TIMEOUT_MS,
  );
  return result.committed;
}

// Makes one move. `change(game)` returns the game after the move, or undefined
// if the move no longer applies. If both phones move at once, the server runs
// them one after the other, so nothing is lost or counted twice.
export async function changeGame(roomId, change) {
  const result = await withTimeout(
    runTransaction(roomRef(roomId, 'game'), (current) => (current && current.id ? change(current) : current)),
    WRITE_TIMEOUT_MS,
  );
  return result.committed;
}

// Shares one small piece of the puzzle in progress (for example the digits typed
// so far). An empty key replaces the whole shared state; a null value removes the piece.
export function setPuzzleState(roomId, key, value) {
  return set(roomRef(roomId, key ? `game/puzzle/state/${key}` : 'game/puzzle/state'), value);
}

export function endGame(roomId) {
  return withTimeout(remove(roomRef(roomId, 'game')), WRITE_TIMEOUT_MS);
}

// Records a finish time if it beats the one on record.
export function saveBest(roomId, episodeId, ms) {
  return runTransaction(
    roomRef(roomId, `best/${episodeId}`),
    (current) => (current && current.ms <= ms ? undefined : { ms, at: serverTimestamp() }),
  ).catch(() => {});
}

// ---------- The clock ----------

// The server's idea of "now", so both phones show the same timer whatever their own clocks say.
let clockOffset = 0;
let clockWatched = false;
export function serverNow() {
  if (!clockWatched) {
    clockWatched = true;
    onValue(ref(database(), '.info/serverTimeOffset'), (snap) => { clockOffset = snap.val() || 0; });
  }
  return Date.now() + clockOffset;
}

// ---------- Surprises ----------

function vaultRef(roomId, episodeId, seat, part) {
  return ref(database(), `rooms/${roomId}-vault/${episodeId}/${seat}/${part}`);
}

// Resolves with { text, hasPhoto, at } or null.
export async function loadSurpriseNote(roomId, episodeId, seat) {
  return (await withTimeout(get(vaultRef(roomId, episodeId, seat, 'note')), WRITE_TIMEOUT_MS)).val();
}

// Resolves with the photo (a "data:image/jpeg..." string) or null.
export async function loadSurprisePhoto(roomId, episodeId, seat) {
  return (await withTimeout(get(vaultRef(roomId, episodeId, seat, 'photo')), 30000)).val();
}

// photo: a data URL to store, null to remove it, or undefined to leave it as it is.
export async function saveSurprise(roomId, episodeId, seat, { text, photo, hasPhoto }) {
  if (photo !== undefined) await withTimeout(set(vaultRef(roomId, episodeId, seat, 'photo'), photo), 60000);
  await withTimeout(set(vaultRef(roomId, episodeId, seat, 'note'), { text, hasPhoto, at: serverTimestamp() }), WRITE_TIMEOUT_MS);
}

export function removeSurprise(roomId, episodeId, seat) {
  return withTimeout(remove(ref(database(), `rooms/${roomId}-vault/${episodeId}/${seat}`)), WRITE_TIMEOUT_MS);
}
