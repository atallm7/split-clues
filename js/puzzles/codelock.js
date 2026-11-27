// Code Lock.
//   LOCK: sees four symbols on a padlock and has the keypad.
//   KEY:  sees a card that turns symbols into numbers (and sometimes a rule).
// Neither half is enough alone. The lock holder describes, the key holder
// translates, and together they enter a four-digit code.

import { h } from '../dom.js';
import { seeded, sample, shuffled, pick } from '../game/random.js';
import { PLAIN_SHAPES, POINTING_SHAPES, COLORS, symbolId, symbolTile } from './glyphs.js';

const CODE_LENGTH = 4;

// Extra rules the key card can carry. Each turns the plain digits into the real code.
export const RULES = {
  asRead: { text: 'enter the numbers as they are', apply: (digits) => digits },
  reverse: { text: 'enter them right to left', apply: (digits) => digits.slice().reverse() },
  plusOne: { text: 'add 1 to each number (9 becomes 0)', apply: (digits) => digits.map((d) => (d + 1) % 10) },
  swapEnds: {
    text: 'swap the first and last numbers',
    apply: (digits) => [digits[digits.length - 1], ...digits.slice(1, -1), digits[0]],
  },
};
const TWISTS = ['reverse', 'plusOne', 'swapEnds'];

// ---------- Making a puzzle ----------

// Which symbols can appear, by level.
function symbolPool(level, rand) {
  if (level === 1) {
    // Six clearly different shapes, all one colour.
    return sample(rand, [...PLAIN_SHAPES, 'moon', 'key', 'fish'], 6).map((shape) => ({ shape, color: 'cream', flipped: false }));
  }
  if (level === 3) {
    // Mirror images: the same shape pointing left or right.
    return sample(rand, POINTING_SHAPES, 4).flatMap((shape) => [
      { shape, color: 'cream', flipped: false },
      { shape, color: 'cream', flipped: true },
    ]);
  }
  // Levels 2, 4 and 5: three shapes in three colours, so colour matters.
  const all = sample(rand, PLAIN_SHAPES, 3).flatMap((shape) => COLORS.map((color) => ({ shape, color, flipped: false })));
  return level === 4 ? sample(rand, all, 8) : all;
}

// Builds the whole puzzle (both halves and the answer) from a level and a seed.
// Both phones call this with the same numbers and get the same puzzle.
export function deal(level, seed) {
  const rand = seeded(seed);
  const pool = shuffled(rand, symbolPool(level, rand));
  const digits = sample(rand, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], pool.length);
  const legend = pool.map((symbol, i) => ({ symbol, digit: digits[i] }));
  const code = sample(rand, legend, CODE_LENGTH);

  let rule = 'asRead';
  let lamp = null;
  let lampRules = null;
  if (level === 4) rule = pick(rand, TWISTS);
  if (level === 5) {
    // The lock has a lamp. The key card says what to do for each lamp colour.
    const choices = sample(rand, Object.keys(RULES), COLORS.length);
    lampRules = COLORS.map((color, i) => ({ color, rule: choices[i] }));
    lamp = pick(rand, COLORS);
    rule = lampRules.find((entry) => entry.color === lamp).rule;
  }

  const answer = RULES[rule].apply(code.map((entry) => entry.digit)).join('');
  return { level, symbols: code.map((entry) => entry.symbol), legend, rule, lamp, lampRules, answer };
}

export function initialState() {
  return { entry: '' };
}

// Nudges, mildest first. Both players see them.
export function hints(puzzle) {
  const first = {
    1: 'Lock holder: name each symbol from left to right. Key holder: find it on your card and say its number.',
    2: 'Several symbols share a shape. Say the colour as well as the shape.',
    3: 'Some symbols are mirror images. Say which way each one points.',
    4: 'Key holder: there is a note at the bottom of your card. Read it out loud.',
    5: 'Lock holder: there is a lamp above your lock. Tell your partner what colour it is.',
  }[puzzle.level];
  return [first, `The first number of the code is ${puzzle.answer[0]}.`];
}

// ---------- Drawing it ----------

function slots(className) {
  const boxes = Array.from({ length: CODE_LENGTH }, () => h('span', { class: 'slot' }));
  const el = h('div', { class: `slots ${className || ''}` }, boxes);
  return {
    el,
    show(entry) {
      boxes.forEach((box, i) => {
        box.textContent = entry[i] || '';
        box.classList.toggle('slot--next', i === entry.length);
      });
    },
  };
}

const SHACKLE = `
  <svg class="lock__shackle" viewBox="0 0 120 52" aria-hidden="true">
    <path d="M30 56V34a30 30 0 0 1 60 0V56" fill="none" stroke-width="13" stroke-linecap="round"/>
  </svg>`;

const LAMP = `
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path class="lamp__metal" d="M19 6h10v4H19zM15 38h18v4H15z"/>
    <path class="lamp__glass" d="M17 10h14l4 28H13z"/>
    <path class="lamp__metal" d="M22 2h4v5h-4z"/>
  </svg>`;

// The LOCK half. `actions` is how it reports what the player did.
function lockView(puzzle, actions) {
  const entrySlots = slots();
  let entry = '';
  let busy = false;

  const keys = {};
  const press = (label) => {
    if (busy) return;
    if (label === 'back') return actions.setState('entry', entry.slice(0, -1));
    if (label === 'go') {
      if (entry.length < CODE_LENGTH) return;
      busy = true;
      const attempt = entry === puzzle.answer ? actions.solve() : actions.miss();
      return attempt.finally(() => { busy = false; });
    }
    if (entry.length < CODE_LENGTH) actions.setState('entry', entry + label);
  };

  const keypad = h('div', { class: 'keypad' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'go'].map((label) => {
    const text = { back: '⌫', go: 'Try' }[label] || label;
    const name = { back: 'Delete', go: 'Try the code' }[label] || label;
    keys[label] = h('button', {
      class: `key key--${/\d/.test(label) ? 'digit' : label}`,
      type: 'button',
      'aria-label': name,
      onclick: () => press(label),
    }, text);
    return keys[label];
  }));

  const body = h('div', { class: 'lock__body' },
    h('div', { class: 'tiles' }, puzzle.symbols.map(symbolTile)),
    entrySlots.el,
  );
  const top = h('div', { class: 'lock__top' });
  top.innerHTML = SHACKLE;
  top.append(body);

  if (puzzle.lamp) {
    const lamp = h('div', { class: `lamp lamp--${puzzle.lamp}`, 'data-lamp': puzzle.lamp, role: 'img', 'aria-label': `A lamp glowing ${puzzle.lamp}` });
    lamp.innerHTML = LAMP;
    top.prepend(lamp);
  }

  const el = h('div', { class: 'lock' }, top, keypad);

  return {
    el,
    update(state) {
      entry = state.entry || '';
      entrySlots.show(entry);
      keys.go.disabled = entry.length < CODE_LENGTH;
      keys.back.disabled = entry.length === 0;
    },
    // A wrong code: the lock rattles.
    onMiss() {
      top.classList.remove('is-rattling');
      void top.getBoundingClientRect();
      top.classList.add('is-rattling');
    },
  };
}

// The KEY half.
function keyView(puzzle) {
  const mirror = slots('slots--mirror');

  const legend = h('div', { class: `legend legend--${puzzle.legend.length <= 6 ? 'two' : 'three'}` },
    puzzle.legend.map((entry) => h('div', { class: 'legend__item', 'data-symbol': symbolId(entry.symbol), 'data-digit': entry.digit },
      symbolTile(entry.symbol),
      h('span', { class: 'legend__equals', 'aria-hidden': 'true' }, '='),
      h('span', { class: 'legend__digit' }, entry.digit),
    )),
  );

  let note = null;
  if (puzzle.lampRules) {
    note = h('div', { class: 'note', 'data-note': 'lamp' },
      h('p', { class: 'note__lead' }, 'Ask what colour the lamp is.'),
      puzzle.lampRules.map((entry) => h('p', { class: 'note__row', 'data-lamp': entry.color, 'data-rule': entry.rule },
        h('span', { class: `dot dot--${entry.color}`, 'aria-hidden': 'true' }),
        h('span', null, h('strong', null, `${entry.color[0].toUpperCase()}${entry.color.slice(1)}: `), RULES[entry.rule].text),
      )),
    );
  } else if (puzzle.rule !== 'asRead') {
    note = h('div', { class: 'note', 'data-note': 'rule', 'data-rule': puzzle.rule },
      h('p', null, h('strong', null, 'One more thing: '), `${RULES[puzzle.rule].text}.`),
    );
  }

  const el = h('div', { class: 'keyside' },
    h('div', { class: 'card keycard' }, legend, note),
    h('div', { class: 'mirror' },
      h('p', { class: 'mirror__label' }, 'On the lock so far'),
      mirror.el,
    ),
  );

  return {
    el,
    update(state) { mirror.show(state.entry || ''); },
    onMiss() {},
  };
}

// ---------- What the game engine needs to know ----------

export const codelock = {
  type: 'codelock',
  name: 'Code Lock',
  noun: 'lock',
  roles: ['lock', 'key'],
  roleNames: { lock: 'LOCK', key: 'KEY' },
  roleJobs: {
    lock: 'Describe the symbols, then enter the code.',
    key: 'Turn the symbols into numbers.',
  },
  deal,
  initialState,
  hints,
  // Draws one half only. A phone never draws the half it does not hold.
  mount(role, puzzle, actions) {
    return role === 'lock' ? lockView(puzzle, actions) : keyView(puzzle);
  },
};
