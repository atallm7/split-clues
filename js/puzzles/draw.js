// Describe and Draw.
//   PICTURE: sees a picture and describes it.
//   PENCIL:  draws it from the description alone.
// When the drawing is done, both phones show it next to the original.
// Not scored: no lives, no hints, just for the laugh.

import { h } from '../dom.js';
import { openSheet } from '../ui.js';
import { seeded, pick } from '../game/random.js';
import { pictureFor } from './pictures.js';

const COLORS = { ink: '#2a2033', red: '#e5646e', blue: '#6fa8ea', yellow: '#e9b23b', green: '#4f9d7d' };
const MAX_STROKES = 300;
const MAX_POINTS = 400;
const VERDICTS = ['Museum-worthy.', 'Close enough to frame.', 'An artist is born.', 'Abstract, but we see it.', 'Straight to the fridge door.'];

export function deal(level, seed) {
  const picture = pictureFor(level, seed);
  return { level, picture, verdict: pick(seeded(seed + 7), VERDICTS) };
}

// strokes[id] = { c: colour name, p: "x,y x,y ..." } on a 1000 x 1000 page. Ids sort in drawing order.
export function initialState() {
  return {};
}

export function hints() {
  return [];
}

function ordered(state) {
  return Object.keys(state.strokes || {}).sort().map((id) => ({ id, ...state.strokes[id] }));
}

function strokeMarkup(stroke) {
  const color = COLORS[stroke.c] || COLORS.ink;
  const points = String(stroke.p || '');
  // A single tap is one point: draw it as a dot.
  if (!points.includes(' ')) {
    const [x, y] = points.split(',');
    return `<circle cx="${Number(x) || 0}" cy="${Number(y) || 0}" r="9" fill="${color}"/>`;
  }
  return `<polyline points="${points.replace(/[^0-9, ]/g, '')}" fill="none" stroke="${color}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function drawingSvg(strokes, className) {
  const template = document.createElement('template');
  template.innerHTML = `<svg class="${className}" viewBox="0 0 1000 1000" role="img" aria-label="The drawing">${strokes.map(strokeMarkup).join('')}</svg>`;
  return template.content.firstElementChild;
}

function pictureSvg(picture, className) {
  const template = document.createElement('template');
  template.innerHTML = `<svg class="${className}" viewBox="0 0 200 200" role="img" aria-label="The picture" data-picture="${picture.name}">${picture.svg}</svg>`;
  return template.content.firstElementChild;
}

// The PICTURE half.
function pictureView(puzzle, actions) {
  const partner = actions.names[actions.seat === 'a' ? 'b' : 'a'];
  const progress = h('p', { class: 'mirror__label' });
  const el = h('div', { class: 'sketch' },
    h('div', { class: 'card sketch__page sketch__original' }, pictureSvg(puzzle.picture, 'sketch__art')),
    progress,
    h('p', { class: 'sketch__note' }, `You will see ${partner}'s drawing at the reveal.`),
  );
  return {
    el,
    update(state) {
      const lines = ordered(state).length;
      progress.textContent = lines === 0 ? `${partner} has not started yet` : `${partner} has drawn ${lines} ${lines === 1 ? 'line' : 'lines'}`;
    },
    onMiss() {},
  };
}

// The PENCIL half.
function pencilView(puzzle, actions) {
  let strokes = [];
  let color = 'ink';
  let live = null; // the line being drawn right now: { points: [[x, y], ...], el }
  let serial = 0;
  let closeSheet = null;

  const page = h('div', { class: 'card sketch__page sketch__canvas' });
  let canvas = drawingSvg([], 'sketch__art');
  page.append(canvas);

  const where = (event) => {
    const box = page.getBoundingClientRect();
    const x = Math.round(((event.clientX - box.left) / box.width) * 1000);
    const y = Math.round(((event.clientY - box.top) / box.height) * 1000);
    return [Math.max(0, Math.min(1000, x)), Math.max(0, Math.min(1000, y))];
  };

  page.addEventListener('pointerdown', (event) => {
    if (live || strokes.length >= MAX_STROKES) return;
    event.preventDefault();
    if (page.setPointerCapture) page.setPointerCapture(event.pointerId);
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', COLORS[color]);
    el.setAttribute('stroke-width', '16');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    canvas.append(el);
    live = { points: [where(event)], el };
  });

  page.addEventListener('pointermove', (event) => {
    if (!live || live.points.length >= MAX_POINTS) return;
    const point = where(event);
    const last = live.points[live.points.length - 1];
    if (Math.abs(point[0] - last[0]) + Math.abs(point[1] - last[1]) < 8) return; // skip tiny wiggles
    live.points.push(point);
    live.el.setAttribute('points', live.points.map((p) => p.join(',')).join(' '));
  });

  const finish = () => {
    if (!live) return;
    const points = live.points.map((p) => p.join(',')).join(' ');
    live = null;
    // The time-based id keeps strokes in the order they were drawn, even after a reload.
    const id = `s${Date.now().toString(36).padStart(9, '0')}${String(serial++ % 100).padStart(2, '0')}`;
    actions.setState(`strokes/${id}`, { c: color, p: points });
  };
  page.addEventListener('pointerup', finish);
  page.addEventListener('pointercancel', finish);

  const swatches = Object.keys(COLORS).map((name) => h('button', {
    class: 'swatch',
    type: 'button',
    style: `--swatch:${COLORS[name]}`,
    'data-color': name,
    'aria-label': `Draw in ${name}`,
    onclick: () => {
      color = name;
      swatches.forEach((swatch) => swatch.classList.toggle('is-on', swatch.dataset.color === name));
    },
  }));
  swatches[0].classList.add('is-on');

  const undo = h('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: () => {
    if (strokes.length) actions.setState(`strokes/${strokes[strokes.length - 1].id}`, null);
  } }, 'Undo');
  const clear = h('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: () => actions.setState('strokes', null) }, 'Clear');
  const done = h('button', { class: 'btn btn--primary btn--small', type: 'button', onclick: () => {
    closeSheet = openSheet({
      title: 'Finished drawing?',
      body: 'You both see it next to the original.',
      actions: [
        { label: 'Reveal it', kind: 'primary', onSelect: () => actions.solve() },
        { label: 'Keep drawing', kind: 'ghost' },
      ],
    });
  } }, 'Done');

  const el = h('div', { class: 'sketch' },
    page,
    h('div', { class: 'sketch__tools' }, h('div', { class: 'swatches' }, swatches), undo, clear, done),
  );

  return {
    el,
    update(state) {
      strokes = ordered(state);
      if (live) return; // do not redraw under a line in progress; the next update catches up
      const fresh = drawingSvg(strokes, 'sketch__art');
      canvas.replaceWith(fresh);
      canvas = fresh;
      undo.disabled = strokes.length === 0;
      clear.disabled = strokes.length === 0;
    },
    onMiss() {},
    destroy() { if (closeSheet) closeSheet(); },
  };
}

// What both phones show once the drawing is done.
function solvedView(puzzle, state, who) {
  const artist = Object.keys(who.role).find((seat) => who.role[seat] === 'pencil');
  const frame = (art, caption) => h('figure', { class: 'reveal__frame' }, h('div', { class: 'reveal__art' }, art), h('figcaption', null, caption));
  return [
    h('h2', { class: 'curtain__title' }, 'The reveal'),
    h('div', { class: 'reveal' },
      frame(pictureSvg(puzzle.picture, 'reveal__picture'), 'The picture'),
      frame(drawingSvg(ordered(state), 'reveal__drawing'), `${who.names[artist]}'s drawing`),
    ),
    h('p', { class: 'reveal__verdict' }, puzzle.verdict),
  ];
}

// ---------- What the game engine needs to know ----------

export const draw = {
  type: 'draw',
  name: 'Describe and Draw',
  roles: ['picture', 'pencil'],
  roleNames: { picture: 'PICTURE', pencil: 'PENCIL' },
  roleJobs: {
    picture: 'Describe it. No showing your screen.',
    pencil: 'Draw what you hear, then tap Done.',
  },
  scored: false,
  deal,
  initialState,
  hints,
  solvedView,
  // Draws one half only. A phone never draws the half it does not hold.
  mount(role, puzzle, actions) {
    return role === 'picture' ? pictureView(puzzle, actions) : pencilView(puzzle, actions);
  },
};
