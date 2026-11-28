// Color Wires.
//   WIRES:    sees a panel of coloured wires and holds the cutters.
//   RULEBOOK: sees a list of rules saying which wire to cut.
// The rulebook holder asks about the panel, finds the first rule that is true,
// and tells the wire holder which one to cut. A wrong cut costs a life.

import { h, replaceChildren } from '../dom.js';
import { seeded, shuffled, pick, whole } from '../game/random.js';

export const WIRE_COLORS = ['red', 'blue', 'yellow', 'green', 'white'];

// What each level puts on the table.
const LEVELS = {
  1: { stages: 1, wires: 4, rules: 3, kinds: ['none', 'top', 'bottom'] },
  2: { stages: 1, wires: 5, rules: 4, kinds: ['none', 'top', 'bottom', 'one', 'many'] },
  3: { stages: 1, wires: 6, rules: 4, kinds: ['none', 'top', 'bottom', 'one', 'many', 'striped'], stripes: true },
  4: { stages: 1, wires: 6, rules: 5, kinds: ['none', 'bottom', 'one', 'many', 'striped', 'lamp', 'plate'], stripes: true, extras: true },
  5: { stages: 2, wires: 5, rules: 4, kinds: ['none', 'top', 'one', 'many', 'striped', 'lamp', 'plate'], stripes: true, extras: true },
};

// ---------- Rules ----------

// Is this condition true of the panel?
export function holds(condition, panel) {
  const count = (color) => panel.wires.filter((wire) => wire.color === color).length;
  switch (condition.kind) {
    case 'none': return count(condition.color) === 0;
    case 'one': return count(condition.color) === 1;
    case 'many': return count(condition.color) > 1;
    case 'top': return panel.wires[0].color === condition.color;
    case 'bottom': return panel.wires[panel.wires.length - 1].color === condition.color;
    case 'striped': return panel.wires.some((wire) => wire.striped) === condition.value;
    case 'lamp': return panel.lamp === condition.value;
    case 'plate': return (panel.plate % 2 === 1) === condition.value;
    default: return false;
  }
}

// Which wire (counting from 0 at the top) an action points at, or -1 if none.
export function target(action, panel) {
  const indexes = panel.wires.map((_, i) => i);
  switch (action.kind) {
    case 'nth': return action.n < panel.wires.length ? action.n : -1;
    case 'firstOf': return indexes.find((i) => panel.wires[i].color === action.color) ?? -1;
    case 'lastOf': return indexes.reverse().find((i) => panel.wires[i].color === action.color) ?? -1;
    case 'striped': return indexes.find((i) => panel.wires[i].striped) ?? -1;
    default: return -1;
  }
}

const chip = (color) => h('span', { class: `chip chip--${color}` }, color);

function conditionWords(condition) {
  const c = condition.color ? chip(condition.color) : null;
  switch (condition.kind) {
    case 'none': return ['No ', c, ' wire'];
    case 'one': return ['Exactly one ', c, ' wire'];
    case 'many': return ['More than one ', c, ' wire'];
    case 'top': return ['The top wire is ', c];
    case 'bottom': return ['The bottom wire is ', c];
    case 'striped': return [condition.value ? 'There is a striped wire' : 'No wire is striped'];
    case 'lamp': return [condition.value ? 'The lamp is lit' : 'The lamp is dark'];
    case 'plate': return [`The number on the plate is ${condition.value ? 'odd' : 'even'}`];
    default: return [];
  }
}

function actionWords(action, wireCount) {
  switch (action.kind) {
    case 'nth':
      if (action.n === 0) return ['cut the top wire'];
      if (action.n === wireCount - 1) return ['cut the bottom wire'];
      return [`cut wire ${action.n + 1}`];
    case 'firstOf': return ['cut the first ', chip(action.color), ' wire'];
    case 'lastOf': return ['cut the last ', chip(action.color), ' wire'];
    case 'striped': return ['cut the first striped wire'];
    default: return [];
  }
}

// ---------- Making a puzzle ----------

function everyCondition(spec) {
  const out = [];
  for (const kind of spec.kinds) {
    if (['striped', 'lamp', 'plate'].includes(kind)) out.push({ kind, value: true }, { kind, value: false });
    else for (const color of WIRE_COLORS) out.push({ kind, color });
  }
  return out;
}

function everyAction(panel) {
  const out = panel.wires.map((_, n) => ({ kind: 'nth', n }));
  for (const color of new Set(panel.wires.map((wire) => wire.color))) {
    out.push({ kind: 'firstOf', color }, { kind: 'lastOf', color });
  }
  if (panel.wires.some((wire) => wire.striped)) out.push({ kind: 'striped' });
  return out;
}

const sameSubject = (a, b) => a.kind === b.kind && a.color === b.color;

// One panel and its page of rules. Exactly one rule is "the first that is true".
function makeStage(rand, spec) {
  for (;;) {
    const wires = Array.from({ length: spec.wires }, () => ({
      color: pick(rand, WIRE_COLORS),
      striped: !!spec.stripes && rand() < 0.25,
    }));
    if (new Set(wires.map((wire) => wire.color)).size < 3) continue;
    const panel = {
      wires,
      lamp: spec.extras ? rand() < 0.5 : null,
      plate: spec.extras ? 1 + whole(rand, 9) : null,
    };

    const applies = whole(rand, spec.rules); // which line is the first true one
    const pool = shuffled(rand, everyCondition(spec));
    const conditions = [];
    for (let line = 0; line < spec.rules - 1; line++) {
      // Lines above the true one must be false; lines below it can be anything.
      const found = pool.find((candidate) => !conditions.some((used) => sameSubject(used, candidate))
        && (line > applies || holds(candidate, panel) === (line === applies)));
      if (found) conditions.push(found);
    }
    if (conditions.length < spec.rules - 1) continue;

    const actions = shuffled(rand, everyAction(panel));
    const answerAction = actions[0];
    const answer = target(answerAction, panel);
    // Every other line points at a different wire, so misreading the rules never works by luck.
    const decoys = actions.filter((action) => target(action, panel) !== answer);
    if (decoys.length < spec.rules) continue;

    let next = 0;
    const rules = Array.from({ length: spec.rules }, (_, line) => ({
      condition: line < spec.rules - 1 ? conditions[line] : null, // the last line is "otherwise"
      action: line === applies ? answerAction : decoys[next++],
    }));
    return { ...panel, rules, applies, answer };
  }
}

export function deal(level, seed) {
  const rand = seeded(seed);
  const spec = LEVELS[level];
  return { level, stages: Array.from({ length: spec.stages }, () => makeStage(rand, spec)) };
}

// stage: which panel is on the table. pick: the wire the cutters are over (-1 for none).
export function initialState() {
  return { stage: 0, pick: -1 };
}

export function hints(puzzle, state) {
  const stage = puzzle.stages[Math.min(state.stage || 0, puzzle.stages.length - 1)];
  return [
    'Rulebook holder: ask how many wires there are and their colours from top to bottom. Then go down your list and stop at the first line that is true.',
    `On this panel, line ${stage.applies + 1} is the first one that is true.`,
  ];
}

// ---------- Drawing it ----------

const SCISSORS = '<svg class="wire__cutters" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.2 8.2 20 19M8.2 15.8 20 5"/></svg>';

// A gently wavy wire; each one bends a little differently.
function wirePath(i) {
  const bend = [7, -6, 5, -8, 6, -5][i % 6];
  return `M4 20C70 ${20 + bend} 110 ${20 - bend} 160 20S250 ${20 + bend} 316 20`;
}

function wireRow(wire, i, onPick) {
  const row = h('button', {
    class: `wire wire--${wire.color}`,
    type: 'button',
    'data-color': wire.color,
    'data-striped': String(wire.striped),
    'aria-label': `Wire ${i + 1}`,
    onclick: () => onPick(i),
  });
  row.innerHTML = `
    <span class="wire__number">${i + 1}</span>
    <svg class="wire__line" viewBox="0 0 320 40" preserveAspectRatio="none" aria-hidden="true">
      <path class="wire__core" d="${wirePath(i)}"/>
      ${wire.striped ? `<path class="wire__stripes" d="${wirePath(i)}"/>` : ''}
    </svg>
    ${SCISSORS}`;
  return row;
}

function stageLabel(puzzle, stage) {
  return puzzle.stages.length > 1 ? `Panel ${stage + 1} of ${puzzle.stages.length}` : '';
}

// The WIRES half.
function wiresView(puzzle, actions) {
  let stage = -1;
  let picked = -1;
  let rows = [];
  let busy = false;

  const label = h('p', { class: 'panel__label' });
  const extras = h('div', { class: 'panel__extras' });
  const list = h('div', { class: 'panel__wires' });
  const panel = h('div', { class: 'panel' }, h('div', { class: 'panel__top' }, label, extras), list);

  const cut = h('button', {
    class: 'btn btn--primary',
    type: 'button',
    onclick: () => {
      if (busy || picked < 0) return;
      const table = puzzle.stages[stage];
      busy = true;
      let move;
      if (picked !== table.answer) {
        move = actions.miss({ state: { stage, pick: -1 }, note: 'Wrong wire' });
      } else if (stage + 1 < puzzle.stages.length) {
        move = actions.setState('', { stage: stage + 1, pick: -1 });
      } else {
        move = actions.solve();
      }
      move.finally(() => { busy = false; });
    },
  });

  const el = h('div', { class: 'wires' }, panel, cut);

  function drawStage() {
    const table = puzzle.stages[stage];
    label.textContent = stageLabel(puzzle, stage);
    replaceChildren(extras,
      table.plate === null ? null : h('span', { class: 'plate', 'data-plate': table.plate, 'aria-label': `Number plate ${table.plate}` }, table.plate),
      table.lamp === null ? null : h('span', { class: `bulb ${table.lamp ? 'bulb--lit' : ''}`, 'data-lamp': String(table.lamp), role: 'img', 'aria-label': table.lamp ? 'A lamp, lit' : 'A lamp, dark' }),
    );
    rows = table.wires.map((wire, i) => wireRow(wire, i, (index) => {
      if (!busy) actions.setState('pick', index === picked ? -1 : index);
    }));
    replaceChildren(list, rows);
    panel.dataset.stage = stage;
  }

  return {
    el,
    update(state) {
      const now = Math.min(state.stage || 0, puzzle.stages.length - 1);
      if (now !== stage) {
        stage = now;
        drawStage();
      }
      picked = typeof state.pick === 'number' ? state.pick : -1;
      rows.forEach((row, i) => row.classList.toggle('is-picked', i === picked));
      cut.disabled = picked < 0;
      cut.textContent = picked < 0 ? 'Tap a wire to choose it' : `Cut wire ${picked + 1}`;
    },
    onMiss() {
      panel.classList.remove('is-sparking');
      void panel.getBoundingClientRect();
      panel.classList.add('is-sparking');
    },
  };
}

// The RULEBOOK half.
function rulebookView(puzzle) {
  let stage = -1;
  const label = h('p', { class: 'rulebook__label' });
  const list = h('ol', { class: 'rules' });
  const over = h('p', { class: 'mirror__label' });

  const el = h('div', { class: 'rulebook' },
    h('div', { class: 'card rulecard' },
      label,
      h('p', { class: 'rulecard__lead' }, 'Go down the list. Use the first line that is true. Wires are counted from the top.'),
      list,
    ),
    over,
  );

  function drawStage() {
    const table = puzzle.stages[stage];
    label.textContent = stageLabel(puzzle, stage);
    label.hidden = !label.textContent;
    replaceChildren(list, table.rules.map((rule) => {
      const c = rule.condition;
      const a = rule.action;
      return h('li', {
        class: 'rule',
        'data-kind': c ? c.kind : 'otherwise',
        'data-color': c && c.color ? c.color : null,
        'data-value': c && c.value !== undefined ? String(c.value) : null,
        'data-action': a.kind,
        'data-action-n': a.n !== undefined ? a.n : null,
        'data-action-color': a.color || null,
      },
        h('span', { class: 'rule__if' }, c ? conditionWords(c) : 'Otherwise'),
        h('span', { class: 'rule__then' }, actionWords(a, table.wires.length)),
      );
    }));
  }

  return {
    el,
    update(state) {
      const now = Math.min(state.stage || 0, puzzle.stages.length - 1);
      if (now !== stage) {
        stage = now;
        drawStage();
      }
      const picked = typeof state.pick === 'number' ? state.pick : -1;
      over.textContent = picked < 0 ? 'No wire chosen yet' : `Cutters are over wire ${picked + 1}`;
    },
    onMiss() {},
  };
}

// ---------- What the game engine needs to know ----------

export const wires = {
  type: 'wires',
  name: 'Color Wires',
  roles: ['wires', 'rulebook'],
  roleNames: { wires: 'WIRES', rulebook: 'RULEBOOK' },
  roleJobs: {
    wires: 'Describe the panel. Cut when you both agree.',
    rulebook: 'Ask about the panel. Find the first true rule.',
  },
  deal,
  initialState,
  hints,
  // Draws one half only. A phone never draws the half it does not hold.
  mount(role, puzzle, actions) {
    return role === 'wires' ? wiresView(puzzle, actions) : rulebookView(puzzle);
  },
};
