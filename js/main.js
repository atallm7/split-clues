// Starts the game and decides which screen to show.
//
//   no room in the address  -> title screen (or straight back into the last room)
//   room, phone not known   -> join screen
//   room, phone known       -> the room (lobby), or the puzzle if a run is on

import {
  configState, onConnectionChange, refreshConnection,
  createRoom, watchRoom, claimSeat, announcePresence,
  startGame, changeGame, setPuzzleState, endGame,
} from './sync.js';
import * as store from './store.js';
import { h, locket, replaceChildren } from './dom.js';
import { toast, setPill, openSheet } from './ui.js';
import { withTimeout } from './util.js';
import { titleScreen } from './screens/title.js';
import { joinScreen } from './screens/join.js';
import { lobbyScreen } from './screens/lobby.js';
import { playScreen } from './screens/play.js';
import { newGame, isPlayable } from './game/engine.js';

// Shown at the bottom of the screen so you can tell which version a phone has loaded.
const BUILD = 'Build 4 · color wires';

const ROOM_ID = /^[a-z0-9]{20,40}$/;
const app = document.getElementById('app');

// What is on screen right now: { kind, update?, destroy? }
let screen = { kind: null };
// The room this phone is in: { roomId, seat, room, presence, stop }
let session = null;

scatterStars(document.getElementById('sky'));
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
start();

// ---------- Deciding what to show ----------

function start() {
  if (configState() !== 'ok') {
    return showMessage({ headline: 'Setup is not finished', sub: 'The game does not have its database address yet.' });
  }
  watchConnection();
  watchVisibility();

  const asked = new URLSearchParams(location.search).get('room');
  if (asked === null) {
    const last = store.lastRoom();
    return last ? enterRoom(last) : showTitle();
  }
  if (!ROOM_ID.test(asked)) return showBrokenLink();
  enterRoom(asked);
}

function show(kind, built) {
  if (screen.destroy) screen.destroy();
  screen = { kind, update: built.update, destroy: built.destroy };
  replaceChildren(app, built.el);
  window.scrollTo(0, 0);
}

function showTitle() {
  setRoomInAddress(null);
  show('title', titleScreen({
    name: store.myName(),
    build: BUILD,
    onCreate: async (name) => {
      store.setMyName(name);
      try {
        const roomId = await createRoom(name);
        store.rememberRoom(roomId, 'a');
        enterRoom(roomId);
        return true;
      } catch {
        toast('Could not create the room. Check your connection and try again.');
        return false;
      }
    },
  }));
}

function showMessage({ headline, sub, busy, action }) {
  const emblem = locket();
  emblem.classList.add('hero__locket', 'locket--drift');
  show('message', {
    el: h('section', { class: 'screen screen--message' },
      h('header', { class: 'hero' },
        emblem,
        h('h1', { class: 'headline' }, headline),
        sub ? h('p', { class: 'sub' }, sub) : null,
        busy ? h('div', { class: 'spinner', 'aria-hidden': 'true' }) : null,
      ),
      action ? h('div', { class: 'actions' },
        h('button', { class: 'btn btn--primary', type: 'button', onclick: action.onSelect }, action.label)) : null,
      h('footer', { class: 'foot' }, h('p', { class: 'foot__build' }, BUILD)),
    ),
  });
}

function showBrokenLink() {
  const roomId = session ? session.roomId : null;
  closeSession();
  showMessage({
    headline: 'This room link does not work',
    sub: 'It may have been cut short when it was copied. Ask your partner to send it again, or start fresh.',
    action: {
      label: 'Start a new room',
      onSelect: () => {
        if (roomId) store.forgetRoom(roomId);
        showTitle();
      },
    },
  });
}

// ---------- Being in a room ----------

function enterRoom(roomId) {
  closeSession();
  setRoomInAddress(roomId);
  showMessage({ headline: 'Opening your room…', busy: true });

  const mine = { roomId, seat: store.seatFor(roomId), room: null, presence: null, stop: null };
  session = mine;

  const slow = setTimeout(() => {
    if (session === mine && !mine.room) {
      showMessage({ headline: 'Opening your room…', sub: 'Still trying. Check your connection.', busy: true });
    }
  }, 8000);

  mine.stop = watchRoom(roomId, (room) => {
    if (session !== mine) return;
    clearTimeout(slow);
    mine.room = room;
    renderRoom();
  }, () => {
    clearTimeout(slow);
    if (session === mine) showBrokenLink();
  });
}

function closeSession() {
  if (!session) return;
  if (session.stop) session.stop();
  if (session.presence) session.presence.stop();
  session = null;
}

// Runs every time anything in the room changes.
function renderRoom() {
  const mine = session;
  const room = mine.room;
  if (!room || !room.players || !room.players.a) return showBrokenLink();

  // The phone remembers a seat that the room does not have: ask again.
  if (mine.seat && !room.players[mine.seat]) mine.seat = null;

  if (!mine.seat) {
    if (screen.kind !== 'join') {
      show('join', joinScreen({
        name: store.myName(),
        build: BUILD,
        onJoin: (name) => joinAsSecondPlayer(mine, name),
        onIdentify: (seat) => {
          takeSeat(mine, seat);
          store.setMyName(mine.room.players[seat].name);
          renderRoom();
        },
      }));
    }
    return screen.update(room);
  }

  if (!mine.presence) {
    mine.presence = announcePresence(mine.roomId, mine.seat);
    if (document.visibilityState === 'hidden') mine.presence.setInView(false).catch(() => {});
  }

  // A run is on: both phones show the puzzle.
  if (isPlayable(room.game)) {
    if (screen.kind !== 'play') {
      show('play', playScreen({
        seat: mine.seat,
        api: {
          change: (move) => changeGame(mine.roomId, move),
          setState: (key, value) => setPuzzleState(mine.roomId, key, value),
          end: () => endGame(mine.roomId),
        },
      }));
    }
    return screen.update(room);
  }

  if (screen.kind !== 'lobby') {
    show('lobby', lobbyScreen({
      seat: mine.seat,
      build: BUILD,
      onInvite: () => shareInvite(mine),
      onCopy: () => copyInvite(mine),
      onStart: (episodeId) => startRun(mine, episodeId),
      onLeave: () => confirmLeave(mine),
    }));
  }
  screen.update(room);
}

async function startRun(mine, episodeId) {
  try {
    await startGame(mine.roomId, newGame(episodeId), isPlayable);
    return true; // whichever phone got there first, a run is now on
  } catch {
    toast('Could not start. Check your connection and try again.');
    return false;
  }
}

function takeSeat(mine, seat) {
  mine.seat = seat;
  store.rememberRoom(mine.roomId, seat);
}

async function joinAsSecondPlayer(mine, name) {
  store.setMyName(name);
  try {
    const gotIt = await claimSeat(mine.roomId, 'b', name);
    if (session !== mine) return true;
    if (!gotIt) {
      toast('Someone has already joined as the second player.');
      return false;
    }
    takeSeat(mine, 'b');
    renderRoom();
    return true;
  } catch {
    toast('Could not join. Check your connection and try again.');
    return false;
  }
}

function confirmLeave(mine) {
  openSheet({
    title: 'Leave this room?',
    body: 'This phone will forget the room. The room itself stays, and the invite link brings you back.',
    actions: [
      {
        label: 'Leave room',
        kind: 'danger',
        onSelect: () => {
          store.forgetRoom(mine.roomId);
          closeSession();
          showTitle();
        },
      },
      { label: 'Stay', kind: 'ghost' },
    ],
  });
}

// ---------- Inviting ----------

function inviteLink(roomId) {
  return `${location.origin}${location.pathname}?room=${roomId}`;
}

async function shareInvite(mine) {
  const url = inviteLink(mine.roomId);
  if (navigator.share) {
    try {
      const name = mine.room.players[mine.seat].name;
      await navigator.share({
        title: 'Split Clues',
        text: `${name} invited you to Split Clues, a mystery for two.`,
        url,
      });
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') return; // the share sheet was closed
    }
  }
  copyInvite(mine);
}

async function copyInvite(mine) {
  const url = inviteLink(mine.roomId);
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    openSheet({ title: 'Your invite link', body: url, actions: [{ label: 'Done', kind: 'primary' }] });
  }
}

// ---------- Address bar ----------

// Keeps the room id in the page address, so a bookmark or Home Screen icon
// made from this page opens the same room.
function setRoomInAddress(roomId) {
  const url = new URL(location.href);
  if (roomId) url.searchParams.set('room', roomId);
  else url.searchParams.delete('room');
  history.replaceState(null, '', url);
}

// ---------- Staying connected ----------

function watchConnection() {
  let everConnected = false;
  let noticeShown = false;
  let timer = null;

  onConnectionChange((connected) => {
    clearTimeout(timer);
    if (connected) {
      everConnected = true;
      if (noticeShown) {
        noticeShown = false;
        setPill('Back in sync', 'ok');
        timer = setTimeout(() => setPill(null), 1600);
      }
      return;
    }
    // Brief blips are not worth a notice.
    timer = setTimeout(() => {
      noticeShown = true;
      setPill(everConnected ? 'Reconnecting…' : 'Connecting…');
    }, everConnected ? 1500 : 4000);
  });
}

function watchVisibility() {
  const leftView = () => {
    if (session && session.presence) session.presence.setInView(false).catch(() => {});
  };

  const cameBack = async () => {
    if (!session || !session.presence) return;
    try {
      // If the server does not answer promptly, the old link died while the
      // phone was asleep: dial again rather than wait for it to time out.
      await withTimeout(session.presence.setInView(true), 3500);
    } catch {
      refreshConnection();
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') leftView();
    else cameBack();
  });
  window.addEventListener('pagehide', leftView);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      refreshConnection();
      cameBack();
    }
  });
}

// ---------- Backdrop ----------

function scatterStars(sky, count = 34) {
  // Fixed seed so the sky looks the same every time rather than reshuffling on reload.
  let seed = 20261125;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const star = document.createElement('span');
    star.className = 'star';
    star.style.left = `${(rand() * 100).toFixed(2)}%`;
    star.style.top = `${(rand() * 72).toFixed(2)}%`;
    star.style.setProperty('--size', `${(1.2 + rand() * 2).toFixed(1)}px`);
    star.style.setProperty('--base', (0.25 + rand() * 0.55).toFixed(2));
    star.style.setProperty('--dur', `${(3.5 + rand() * 5).toFixed(1)}s`);
    star.style.setProperty('--delay', `${(-rand() * 8).toFixed(1)}s`);
    sky.appendChild(star);
  }
}
