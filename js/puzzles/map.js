// Map Directions.
//   MAP:     sees the whole map, the treasure, and the bogs to avoid.
//   COMPASS: sees a blank map with a marker to move, and does the digging.
// The map holder talks the compass holder to the treasure. Stepping in a bog
// or digging in the wrong place costs a life.
//
// Squares are (x, y) with x growing east and y growing south. On the compass
// holder's screen north is always up; the map holder's map may be turned.

import { h } from '../dom.js';
import { seeded, shuffled, whole } from '../game/random.js';

const LEVELS = {
  1: { size: 5, landmarks: 5, bogs: 0, turned: false, lantern: false },
  2: { size: 6, landmarks: 6, bogs: 5, turned: false, lantern: false },
  3: { size: 6, landmarks: 6, bogs: 5, turned: true, lantern: false },
  4: { size: 6, landmarks: 8, bogs: 4, turned: false, lantern: true },
};

export const LANDMARKS = ['tree', 'rock', 'pond', 'house', 'hill', 'flower', 'well', 'tent', 'signpost', 'campfire', 'mushroom'];

const ICONS = {
  tree: '<path d="M20 4 30 18H25L33 30H7L15 18H10Z" fill="#4f9d7d"/><rect x="18" y="30" width="4" height="6" fill="#8a6a4a"/>',
  rock: '<path d="M5 31 11 17 21 12 31 19 35 31Z" fill="#9a8fa8"/><path d="M11 17 21 12 19 22Z" fill="#b9afc6"/>',
  pond: '<ellipse cx="20" cy="22" rx="15" ry="10" fill="#6fa8ea"/><path d="M11 21q4-3 8 0t8 0" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>',
  house: '<path d="M7 20 20 9 33 20V34H7Z" fill="#f0c9b0"/><path d="M4 21 20 7 36 21" stroke="#b5606a" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="17" y="24" width="6" height="10" fill="#7a4f58"/>',
  hill: '<path d="M3 33 15 11 21 21 26 15 37 33Z" fill="#b9a7d0"/><path d="M15 11 18.5 17 12 17Z" fill="#fff"/>',
  flower: '<path d="M20 22V35" stroke="#4f9d7d" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="9" r="5" fill="#ef9a9a"/><circle cx="27" cy="15" r="5" fill="#ef9a9a"/><circle cx="13" cy="15" r="5" fill="#ef9a9a"/><circle cx="24" cy="22" r="5" fill="#ef9a9a"/><circle cx="16" cy="22" r="5" fill="#ef9a9a"/><circle cx="20" cy="16" r="4" fill="#f3cf62"/>',
  well: '<path d="M12 12V22M28 12V22" stroke="#8a6a4a" stroke-width="2.5"/><path d="M7 13 11 6H29L33 13Z" fill="#b5606a"/><rect x="9" y="21" width="22" height="13" rx="2" fill="#9a8fa8"/><path d="M9 26H31" stroke="#7d728c" stroke-width="1.5"/>',
  tent: '<path d="M4 33 20 8 36 33Z" fill="#f4b860"/><path d="M14 33 20 20 26 33Z" fill="#8a5a1c"/><path d="M20 5V10" stroke="#8a6a4a" stroke-width="2" stroke-linecap="round"/>',
  signpost: '<rect x="18" y="8" width="4" height="27" fill="#8a6a4a"/><path d="M9 10H28L33 15 28 20H9Z" fill="#f3cf62"/>',
  campfire: '<path d="M20 6c2 6 8 8 8 14a8 8 0 0 1-16 0c0-4 3-5 4-8 2 3 3 3 4 3-1-4 0-7 0-9z" fill="#f4914a"/><path d="M9 34 31 27M9 27 31 34" stroke="#8a6a4a" stroke-width="3.5" stroke-linecap="round"/>',
  mushroom: '<rect x="16" y="21" width="8" height="13" rx="3" fill="#f3e9da"/><path d="M6 23a14 13 0 0 1 28 0z" fill="#e5646e"/><circle cx="14" cy="17" r="2.2" fill="#fff"/><circle cx="24" cy="14" r="2.8" fill="#fff"/><circle cx="28" cy="20" r="1.6" fill="#fff"/>',
  bog: '<ellipse cx="20" cy="23" rx="16" ry="10" fill="#5d5342"/><ellipse cx="20" cy="22" rx="11" ry="6" fill="#75694f"/><circle cx="14" cy="21" r="2" fill="#93876a"/><circle cx="25" cy="24" r="1.6" fill="#93876a"/><circle cx="22" cy="19" r="1.2" fill="#93876a"/>',
  treasure: '<path d="M10 10 30 30M30 10 10 30" stroke="#d2424f" stroke-width="6.5" stroke-linecap="round"/>',
  start: '<path d="M12 35V6" stroke="#6a5c72" stroke-width="3" stroke-linecap="round"/><path d="M12 7H29L24 13 29 19H12Z" fill="#7fcbb8"/>',
};

const icon = (kind) => `<svg viewBox="0 0 40 40" aria-hidden="true">${ICONS[kind]}</svg>`;

const STEPS = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
const same = (a, b) => a.x === b.x && a.y === b.y;

// ---------- Making a puzzle ----------

// Can you walk from `from` to `to` without stepping in a bog?
function reachable(size, bogs, from, to) {
  const blocked = new Set(bogs.map((bog) => `${bog.x},${bog.y}`));
  const seen = new Set([`${from.x},${from.y}`]);
  const queue = [from];
  while (queue.length) {
    const at = queue.shift();
    if (same(at, to)) return true;
    for (const [dx, dy] of Object.values(STEPS)) {
      const next = { x: at.x + dx, y: at.y + dy };
      const key = `${next.x},${next.y}`;
      if (next.x < 0 || next.y < 0 || next.x >= size || next.y >= size || blocked.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return false;
}

export function deal(level, seed) {
  const rand = seeded(seed);
  const spec = LEVELS[level];
  const { size } = spec;
  const all = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) all.push({ x, y });

  for (;;) {
    const cells = shuffled(rand, all);
    const start = cells[0];
    const treasure = cells.find((cell) => Math.abs(cell.x - start.x) + Math.abs(cell.y - start.y) >= size - 1);
    const free = cells.filter((cell) => !same(cell, start) && !same(cell, treasure));
    const bogs = free.slice(0, spec.bogs);
    const kinds = shuffled(rand, LANDMARKS);
    const landmarks = free.slice(spec.bogs, spec.bogs + spec.landmarks).map((cell, i) => ({ ...cell, kind: kinds[i] }));

    if (!reachable(size, bogs, start, treasure)) continue;
    // By lantern light you see only the squares touching yours, so there must be something to see at the start.
    const near = (cell) => Math.abs(cell.x - start.x) <= 1 && Math.abs(cell.y - start.y) <= 1;
    if (spec.lantern && !landmarks.some(near)) continue;

    return {
      level,
      size,
      start,
      treasure,
      bogs,
      landmarks,
      // How many quarter turns clockwise the map holder's map is turned (0 = north is up).
      turn: spec.turned ? 1 + whole(rand, 3) : 0,
      lantern: spec.lantern,
    };
  }
}

// The marker's square.
export function initialState(puzzle) {
  return { x: puzzle.start.x, y: puzzle.start.y };
}

export function hints(puzzle) {
  const first = {
    1: 'Map holder: count the squares from the pin to the red cross, then say it as steps, like "two north, one east".',
    2: 'Map holder: there are bogs your partner cannot see. Plan a route around them before giving any steps.',
    3: 'Map holder: your map is turned. The compass on it shows which way is north on your partner\'s screen.',
    4: 'Compass holder: say what you can see around you and on which side. Map holder: find that spot on your map.',
  }[puzzle.level];
  return [first, `The treasure is ${puzzle.treasure.x + 1} from the west edge and ${puzzle.treasure.y + 1} from the north edge.`];
}

// ---------- Drawing it ----------

// Where a square lands on a map turned `turn` quarter turns clockwise.
export function turned(cell, size, turn) {
  let { x, y } = cell;
  for (let i = 0; i < turn; i++) [x, y] = [size - 1 - y, x];
  return { x, y };
}

const NORTH_SIDE = ['up', 'right', 'down', 'left'];

function grid(size, className) {
  const cells = [];
  const el = h('div', { class: `map ${className}`, style: `--size:${size}` });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = h('span', { class: 'map__cell', 'data-x': x, 'data-y': y });
      cells.push(cell);
      el.append(cell);
    }
  }
  const at = (x, y) => cells[y * size + x];
  return { el, at };
}

function pin(seat) {
  return h('span', { class: `map__pin map__pin--${seat}`, 'aria-hidden': 'true' });
}

function place(marker, x, y, size) {
  marker.style.left = `${((x + 0.5) / size) * 100}%`;
  marker.style.top = `${((y + 0.5) / size) * 100}%`;
  marker.dataset.x = x;
  marker.dataset.y = y;
}

// The MAP half: everything except (by lantern light) where your partner is.
function mapView(puzzle, actions) {
  const { size, turn } = puzzle;
  const board = grid(size, 'map--full');
  const put = (cell, kind) => {
    const shown = turned(cell, size, turn);
    const el = board.at(shown.x, shown.y);
    el.dataset.kind = kind;
    el.innerHTML = icon(kind);
  };
  puzzle.landmarks.forEach((landmark) => put(landmark, landmark.kind));
  puzzle.bogs.forEach((bog) => put(bog, 'bog'));
  put(puzzle.start, 'start');
  put(puzzle.treasure, 'treasure');

  const marker = puzzle.lantern ? null : pin(actions.seat === 'a' ? 'b' : 'a');
  if (marker) board.el.append(marker);

  const rose = h('div', { class: 'rose', 'data-north': NORTH_SIDE[turn], role: 'img', 'aria-label': `Compass: north is ${NORTH_SIDE[turn]}` },
    h('span', { class: 'rose__needle' }),
    h('span', { class: 'rose__n' }, 'N'),
  );

  const key = h('p', { class: 'map__key' },
    h('span', { class: 'map__key-item map__key-item--treasure' }, 'treasure'),
    puzzle.bogs.length ? h('span', { class: 'map__key-item map__key-item--bog' }, 'bog: costs a life') : null,
    puzzle.lantern ? h('span', null, 'Your partner is out there in the dark.') : null,
  );

  const el = h('div', { class: 'mapside' }, h('div', { class: 'mapframe' }, board.el, rose), key);

  return {
    el,
    update(state) {
      if (!marker) return;
      const shown = turned({ x: state.x ?? puzzle.start.x, y: state.y ?? puzzle.start.y }, size, turn);
      place(marker, shown.x, shown.y, size);
    },
    onMiss() {},
  };
}

// The COMPASS half: a blank map (or, by lantern, just the squares around you).
function compassView(puzzle, actions) {
  const { size } = puzzle;
  let at = { ...puzzle.start };
  let busy = false;

  const board = puzzle.lantern ? grid(3, 'map--lantern') : grid(size, 'map--blank');
  const marker = pin(actions.seat);
  board.el.append(marker);
  if (puzzle.lantern) place(marker, 1, 1, 3);
  else board.at(puzzle.start.x, puzzle.start.y).innerHTML = icon('start');

  function bump() {
    board.el.classList.remove('is-bumped');
    void board.el.getBoundingClientRect();
    board.el.classList.add('is-bumped');
  }

  function step(direction) {
    if (busy) return;
    const [dx, dy] = STEPS[direction];
    const next = { x: at.x + dx, y: at.y + dy };
    if (next.x < 0 || next.y < 0 || next.x >= size || next.y >= size) return bump();
    if (puzzle.bogs.some((bog) => same(bog, next))) {
      busy = true;
      return actions.miss({ state: initialState(puzzle), note: 'Into a bog. Back to the start' }).finally(() => { busy = false; });
    }
    actions.setState('', next);
  }

  const arrow = (direction, letter) => h('button', {
    class: `dpad__key dpad__key--${direction}`,
    type: 'button',
    'aria-label': `Move ${direction}`,
    onclick: () => step(direction),
  }, letter);

  const dig = h('button', {
    class: 'btn btn--primary',
    type: 'button',
    onclick: () => {
      if (busy) return;
      busy = true;
      const move = same(at, puzzle.treasure) ? actions.solve() : actions.miss({ keep: true, note: 'Nothing buried here' });
      move.finally(() => { busy = false; });
    },
  }, 'Dig here');

  const el = h('div', { class: 'compass' },
    h('div', { class: 'mapframe' }, board.el),
    h('div', { class: 'seekpad' },
      h('div', { class: 'dpad' }, arrow('north', 'N'), arrow('west', 'W'), h('span', { class: 'dpad__hub', 'aria-hidden': 'true' }), arrow('east', 'E'), arrow('south', 'S')),
      dig,
    ),
  );

  // By lantern: show the nine squares around the marker, landmarks included.
  function drawLantern() {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cell = board.at(dx + 1, dy + 1);
        const x = at.x + dx;
        const y = at.y + dy;
        const outside = x < 0 || y < 0 || x >= size || y >= size;
        const landmark = puzzle.landmarks.find((item) => item.x === x && item.y === y);
        const isStart = x === puzzle.start.x && y === puzzle.start.y;
        cell.classList.toggle('is-outside', outside);
        cell.dataset.kind = landmark ? landmark.kind : '';
        cell.innerHTML = landmark ? icon(landmark.kind) : isStart && (dx || dy) ? icon('start') : '';
      }
    }
  }

  return {
    el,
    update(state) {
      at = { x: state.x ?? puzzle.start.x, y: state.y ?? puzzle.start.y };
      if (puzzle.lantern) {
        drawLantern();
        marker.dataset.x = at.x;
        marker.dataset.y = at.y;
      } else {
        place(marker, at.x, at.y, size);
      }
    },
    onMiss: bump,
  };
}

// ---------- What the game engine needs to know ----------

export const map = {
  type: 'map',
  name: 'Map Directions',
  roles: ['map', 'compass'],
  roleNames: { map: 'MAP', compass: 'COMPASS' },
  roleJobs: {
    map: 'Guide your partner to the red cross.',
    compass: 'Move where you are told, then dig.',
  },
  solvedTitle: 'Treasure found',
  deal,
  initialState,
  hints,
  // Draws one half only. A phone never draws the half it does not hold.
  mount(role, puzzle, actions) {
    return role === 'map' ? mapView(puzzle, actions) : compassView(puzzle, actions);
  },
};
