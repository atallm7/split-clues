// Spot the Difference.
// Both phones show a shelf of things that looks almost the same. Three things
// differ. Nobody can see both shelves, so you describe yours to each other.
// A difference counts once you have BOTH tapped it. A wrong tap costs a life.

import { h } from '../dom.js';
import { seeded, shuffled, pick, sample } from '../game/random.js';

const LEVELS = {
  1: { rows: 3, cols: 3, kinds: ['bold'] },
  2: { rows: 3, cols: 4, kinds: ['bold', 'subtle'] },
  3: { rows: 4, cols: 4, kinds: ['subtle'] },
};
export const DIFFERENCES = 3;

const INK = '#2a2033';
const PAINT = { amber: '#f4b860', rose: '#ef9a9a', teal: '#7fcbb8', blue: '#6fa8ea', plum: '#8272a8', red: '#e5646e' };
const paint = (name) => PAINT[name];

// Every kind of thing that can sit on the shelf. Each has a few features that
// can differ between the two pictures: "bold" ones are easy to notice (a
// colour, a flame), "subtle" ones take a careful description (a count, a side).
export const THINGS = {
  mug: {
    features: { color: { values: ['amber', 'rose', 'teal', 'blue'], kind: 'bold' }, steam: { values: [true, false], kind: 'bold' } },
    draw: ({ color, steam }) => `
      ${steam ? '<path d="M23 20c-3-4 3-6 0-10M32 20c-3-4 3-6 0-10" stroke="#9a8fa8" stroke-width="2.5" fill="none" stroke-linecap="round"/>' : ''}
      <path d="M40 32h5a6 6 0 0 1 0 14h-5" fill="none" stroke="${paint(color)}" stroke-width="4"/>
      <rect x="15" y="26" width="26" height="29" rx="5" fill="${paint(color)}"/>`,
  },
  plant: {
    features: { pot: { values: ['rose', 'amber', 'blue'], kind: 'bold' }, leaves: { values: [2, 3], kind: 'subtle' } },
    draw: ({ pot, leaves }) => `
      <ellipse cx="22" cy="28" rx="6" ry="13" transform="rotate(-25 22 28)" fill="#4f9d7d"/>
      <ellipse cx="38" cy="28" rx="6" ry="13" transform="rotate(25 38 28)" fill="#4f9d7d"/>
      ${leaves === 3 ? '<ellipse cx="30" cy="21" rx="6" ry="14" fill="#62b592"/>' : ''}
      <path d="M19 40h22l-3 16H22z" fill="${paint(pot)}"/>`,
  },
  candle: {
    features: { lit: { values: [true, false], kind: 'bold' }, color: { values: ['rose', 'blue', 'amber'], kind: 'bold' } },
    draw: ({ lit, color }) => `
      ${lit ? '<path d="M30 6c4 5 5 8 5 10a5 5 0 0 1-10 0c0-2 1-5 5-10z" fill="#f4914a"/>' : ''}
      <path d="M30 27v-6" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
      <rect x="23" y="26" width="14" height="28" rx="2" fill="${paint(color)}"/>
      <rect x="18" y="53" width="24" height="4" rx="2" fill="#9a8fa8"/>`,
  },
  clock: {
    features: { time: { values: [3, 6, 9], kind: 'subtle' }, color: { values: ['teal', 'rose', 'amber'], kind: 'bold' } },
    draw: ({ time, color }) => `
      <circle cx="30" cy="33" r="21" fill="${paint(color)}"/>
      <circle cx="30" cy="33" r="16" fill="#fffaf0"/>
      <path d="M30 33V21" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M30 33${{ 3: 'h9', 6: 'v9', 9: 'h-9' }[time]}" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
  },
  books: {
    features: { top: { values: ['rose', 'teal', 'amber', 'plum'], kind: 'bold' }, count: { values: [2, 3], kind: 'subtle' } },
    draw: ({ top, count }) => `
      <rect x="11" y="46" width="38" height="10" rx="2" fill="#6fa8ea"/>
      <rect x="15" y="36" width="32" height="10" rx="2" fill="${count === 2 ? paint(top) : '#c9bfd6'}"/>
      ${count === 3 ? `<rect x="13" y="26" width="30" height="10" rx="2" fill="${paint(top)}"/>` : ''}`,
  },
  cat: {
    features: { color: { values: ['amber', 'plum', 'blue'], kind: 'bold' }, facing: { values: ['left', 'right'], kind: 'subtle' } },
    draw: ({ color, facing }) => `
      <g${facing === 'right' ? ' transform="translate(60 0) scale(-1 1)"' : ''}>
        <path d="M42 51c9 0 10-9 6-15" stroke="${paint(color)}" stroke-width="5" fill="none" stroke-linecap="round"/>
        <ellipse cx="30" cy="43" rx="13" ry="13" fill="${paint(color)}"/>
        <circle cx="26" cy="23" r="10" fill="${paint(color)}"/>
        <path d="M17 18l1-10 7 6zM35 18l-1-10-7 6z" fill="${paint(color)}"/>
        <circle cx="22" cy="22" r="1.6" fill="${INK}"/><circle cx="29" cy="22" r="1.6" fill="${INK}"/>
      </g>`,
  },
  frame: {
    features: { picture: { values: ['sun', 'moon', 'heart'], kind: 'bold' }, color: { values: ['amber', 'teal', 'rose'], kind: 'bold' } },
    draw: ({ picture, color }) => `
      <rect x="12" y="9" width="36" height="44" rx="3" fill="${paint(color)}"/>
      <rect x="17" y="14" width="26" height="34" fill="#fffaf0"/>
      ${{
    sun: '<circle cx="30" cy="31" r="7.5" fill="#f3cf62"/>',
    moon: '<path d="M33 22a9.5 9.5 0 1 0 5 14 7.5 7.5 0 0 1-5-14z" fill="#6fa8ea"/>',
    heart: '<path d="M30 40c-8-6-10-10-8-14 2-3 6-3 8 0 2-3 6-3 8 0 2 4 0 8-8 14z" fill="#e5646e"/>',
  }[picture]}`,
  },
  lamp: {
    features: { on: { values: [true, false], kind: 'bold' }, shade: { values: ['rose', 'teal', 'amber'], kind: 'bold' } },
    draw: ({ on, shade }) => `
      ${on ? '<path d="M17 31h26l6 16H11z" fill="#ffe08a" opacity=".8"/>' : ''}
      <rect x="27" y="30" width="6" height="23" fill="#8a6a4a"/>
      <rect x="20" y="52" width="20" height="4" rx="2" fill="#8a6a4a"/>
      <path d="M18 31l5-19h14l5 19z" fill="${paint(shade)}"/>`,
  },
  jar: {
    features: { honey: { values: ['full', 'half', 'empty'], kind: 'subtle' }, lid: { values: ['rose', 'teal', 'amber'], kind: 'bold' } },
    draw: ({ honey, lid }) => `
      <rect x="17" y="18" width="26" height="38" rx="6" fill="#e4edf5" stroke="#9a8fa8" stroke-width="2"/>
      ${{ full: '<rect x="20" y="24" width="20" height="29" rx="4" fill="#e9a23b"/>', half: '<rect x="20" y="39" width="20" height="14" rx="4" fill="#e9a23b"/>', empty: '' }[honey]}
      <rect x="19" y="10" width="22" height="9" rx="2" fill="${paint(lid)}"/>`,
  },
  teapot: {
    features: { color: { values: ['blue', 'rose', 'teal'], kind: 'bold' }, spout: { values: ['left', 'right'], kind: 'subtle' } },
    draw: ({ color, spout }) => `
      <g${spout === 'left' ? ' transform="translate(60 0) scale(-1 1)"' : ''}>
        <path d="M43 39l11-9v7l-8 9z" fill="${paint(color)}"/>
        <path d="M15 33a8 8 0 0 0 0 13" stroke="${paint(color)}" stroke-width="4" fill="none" stroke-linecap="round"/>
        <ellipse cx="30" cy="41" rx="16" ry="14" fill="${paint(color)}"/>
        <rect x="22" y="23" width="16" height="6" rx="2" fill="${paint(color)}"/>
        <circle cx="30" cy="20" r="3.5" fill="${paint(color)}"/>
      </g>`,
  },
  cactus: {
    features: { arms: { values: [1, 2], kind: 'subtle' }, flower: { values: [true, false], kind: 'bold' } },
    draw: ({ arms, flower }) => `
      <path d="M25 36h-7v-9" stroke="#4f9d7d" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      ${arms === 2 ? '<path d="M35 31h7v-9" stroke="#4f9d7d" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' : ''}
      <rect x="24" y="13" width="12" height="33" rx="6" fill="#4f9d7d"/>
      ${flower ? '<circle cx="30" cy="11" r="5" fill="#ef9a9a"/><circle cx="30" cy="11" r="2" fill="#f3cf62"/>' : ''}
      <path d="M20 44h20l-3 12H23z" fill="#c9606a"/>`,
  },
  vase: {
    features: { flowers: { values: [1, 2, 3], kind: 'subtle' }, color: { values: ['blue', 'rose', 'amber'], kind: 'bold' } },
    draw: ({ flowers, color }) => `
      <path d="M30 36V16" stroke="#4f9d7d" stroke-width="2.5"/><circle cx="30" cy="13" r="5.5" fill="#e5646e"/>
      ${flowers >= 2 ? '<path d="M28 36 20 21" stroke="#4f9d7d" stroke-width="2.5"/><circle cx="19" cy="18" r="5.5" fill="#f3cf62"/>' : ''}
      ${flowers >= 3 ? '<path d="M32 36 40 21" stroke="#4f9d7d" stroke-width="2.5"/><circle cx="41" cy="18" r="5.5" fill="#b28be0"/>' : ''}
      <path d="M23 34h14l3 22H20z" fill="${paint(color)}"/>`,
  },
};

// ---------- Making a puzzle ----------

function randomLook(rand, kind) {
  const look = {};
  for (const [name, feature] of Object.entries(THINGS[kind].features)) look[name] = pick(rand, feature.values);
  return look;
}

export function deal(level, seed) {
  const rand = seeded(seed);
  const spec = LEVELS[level];
  const count = spec.rows * spec.cols;
  const names = Object.keys(THINGS);

  // As many different kinds of thing as possible before any kind repeats.
  const kinds = [];
  while (kinds.length < count) kinds.push(...shuffled(rand, names));
  const cells = kinds.slice(0, count).map((kind) => {
    const look = randomLook(rand, kind);
    return { kind, first: look, second: { ...look } };
  });

  // Pick three things that have a feature of the right kind, and change it in one picture.
  const canDiffer = (cell) => Object.values(THINGS[cell.kind].features).some((feature) => spec.kinds.includes(feature.kind));
  const chosen = sample(rand, cells.map((cell, i) => i).filter((i) => canDiffer(cells[i])), DIFFERENCES).sort((a, b) => a - b);
  for (const i of chosen) {
    const cell = cells[i];
    const [name, feature] = pick(rand, Object.entries(THINGS[cell.kind].features).filter(([, f]) => spec.kinds.includes(f.kind)));
    const other = pick(rand, feature.values.filter((value) => value !== cell.first[name]));
    // Either picture may be the one that changed.
    const side = rand() < 0.5 ? 'first' : 'second';
    cell[side] = { ...cell[side], [name]: other };
  }
  return { level, rows: spec.rows, cols: spec.cols, cells, differences: chosen };
}

// found[seat][index] is true once that player has tapped that difference.
export function initialState() {
  return {};
}

const SHELF_NAMES = { 3: ['top', 'middle', 'bottom'], 4: ['top', 'second', 'third', 'bottom'] };

export function hints(puzzle) {
  const row = Math.floor(puzzle.differences[0] / puzzle.cols);
  return [
    'Take one shelf at a time. One of you describes each thing from left to right; the other says "same" or "different".',
    `One of the differences is on the ${SHELF_NAMES[puzzle.rows][row]} shelf.`,
  ];
}

// ---------- Drawing it ----------

function pictureView(role, puzzle, actions) {
  const me = actions.seat;
  const partner = me === 'a' ? 'b' : 'a';
  let mine = {};
  let busy = false;
  let done = false;

  const cells = puzzle.cells.map((cell, i) => {
    const look = cell[role];
    const button = h('button', {
      class: 'spot__cell',
      type: 'button',
      'data-index': i,
      'data-look': `${cell.kind} ${JSON.stringify(look)}`,
      'aria-label': `Shelf ${Math.floor(i / puzzle.cols) + 1}, item ${(i % puzzle.cols) + 1}`,
      onclick: () => tap(i, button),
    });
    button.innerHTML = `<svg viewBox="0 0 60 60" aria-hidden="true">${THINGS[cell.kind].draw(look)}</svg>`;
    return button;
  });

  function tap(i, button) {
    if (busy || done || mine[i]) return;
    if (puzzle.differences.includes(i)) return actions.setState(`found/${me}/${i}`, true);
    busy = true;
    button.classList.remove('is-wrong');
    void button.getBoundingClientRect();
    button.classList.add('is-wrong');
    actions.miss({ keep: true, note: 'No difference there' }).finally(() => { busy = false; });
  }

  const rows = [];
  for (let r = 0; r < puzzle.rows; r++) rows.push(h('div', { class: 'spot__row' }, cells.slice(r * puzzle.cols, (r + 1) * puzzle.cols)));
  const count = h('p', { class: 'mirror__label spot__count' });
  const waiting = h('p', { class: 'spot__waiting' });

  const el = h('div', { class: 'spot' },
    h('div', { class: 'card spot__shelf', style: `--cols:${puzzle.cols}; --rows:${puzzle.rows}` }, rows),
    count,
    waiting,
  );

  return {
    el,
    update(state) {
      const found = state.found || {};
      mine = found[me] || {};
      const theirs = found[partner] || {};
      let together = 0;
      let onlyMine = 0;
      let onlyTheirs = 0;
      for (const i of puzzle.differences) {
        const both = !!mine[i] && !!theirs[i];
        cells[i].classList.toggle('is-mine', !!mine[i] && !both);
        cells[i].classList.toggle('is-both', both);
        if (both) together += 1;
        else if (mine[i]) onlyMine += 1;
        else if (theirs[i]) onlyTheirs += 1;
      }
      count.textContent = `Found together: ${together} of ${DIFFERENCES}`;
      const partnerName = actions.names[partner];
      waiting.textContent = onlyMine
        ? `${partnerName} still has to tap ${onlyMine === 1 ? 'one' : onlyMine} you marked.`
        : onlyTheirs ? `${partnerName} marked ${onlyTheirs === 1 ? 'one' : onlyTheirs} you have not tapped yet.` : '';
      if (together === DIFFERENCES && !done) {
        done = true;
        actions.solve().then((sent) => { if (sent === false) done = false; });
      }
    },
    onMiss() {},
  };
}

// ---------- What the game engine needs to know ----------

export const spot = {
  type: 'spot',
  name: 'Spot the Difference',
  roles: ['first', 'second'],
  roleNames: { first: 'PICTURE A', second: 'PICTURE B' },
  roleArticles: { first: '', second: '' },
  roleJobs: {
    first: 'Three things differ. Describe, then both tap.',
    second: 'Three things differ. Describe, then both tap.',
  },
  solvedTitle: 'All spotted',
  deal,
  initialState,
  hints,
  // Draws one picture only. A phone never draws the other one.
  mount(role, puzzle, actions) {
    return pictureView(role, puzzle, actions);
  },
};
