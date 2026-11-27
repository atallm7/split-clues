// Small helpers for building the page without a framework.

// h('button', { class: 'btn', onclick: fn }, 'Label') -> <button class="btn">Label</button>
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'value' || key === 'disabled' || key === 'hidden') el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

// Swap everything inside `parent` for the given nodes.
export function replaceChildren(parent, ...nodes) {
  parent.replaceChildren(...nodes.flat().filter(Boolean));
}

// ---------- The locket ----------
// The game's emblem: a locket split in two. The amber half belongs to the first
// player (seat "a"), the rose half to the second (seat "b").

const HALF_A = 'M100 30 L108 50 L94 72 L108 96 L93 120 L106 146 L100 170 A70 70 0 0 1 100 30 Z';
const HALF_B = 'M100 30 L108 50 L94 72 L108 96 L93 120 L106 146 L100 170 A70 70 0 0 0 100 30 Z';
let locketCount = 0;

// Returns an <svg>. Its look is driven by attributes set with setLocket().
export function locket(label = 'A locket split into two halves') {
  const id = `locket${++locketCount}`;
  const template = document.createElement('template');
  template.innerHTML = `
    <svg class="locket" viewBox="0 0 200 200" role="img" aria-label="${label}">
      <defs>
        <path id="${id}-a" d="${HALF_A}"/>
        <path id="${id}-b" d="${HALF_B}"/>
        <clipPath id="${id}-clip-a"><use href="#${id}-a"/></clipPath>
        <clipPath id="${id}-clip-b"><use href="#${id}-b"/></clipPath>
        <g id="${id}-engraving">
          <circle cx="100" cy="100" r="57" fill="none" stroke-width="2.5" stroke-dasharray="1 7" stroke-linecap="round"/>
          <circle cx="100" cy="90" r="13" stroke="none"/>
          <path d="M92 96 L108 96 L113 128 L87 128 Z" stroke="none"/>
        </g>
      </defs>
      <circle class="locket__glow" cx="100" cy="100" r="92"/>
      <g class="locket__half locket__half--a">
        <use href="#${id}-a" class="locket__face"/>
        <use href="#${id}-engraving" class="locket__ink" clip-path="url(#${id}-clip-a)"/>
      </g>
      <g class="locket__half locket__half--b">
        <use href="#${id}-b" class="locket__face"/>
        <use href="#${id}-engraving" class="locket__ink" clip-path="url(#${id}-clip-b)"/>
      </g>
    </svg>`;
  return template.content.firstElementChild;
}

// a / b: 'here' | 'away' | 'empty'. The halves close together when both are here.
export function setLocket(svg, { a = 'here', b = 'here' } = {}) {
  svg.dataset.a = a;
  svg.dataset.b = b;
  svg.dataset.joined = String(a === 'here' && b === 'here');
}
