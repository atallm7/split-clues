// The first screen: start a room.

import { h, locket } from '../dom.js';
import { cleanName, nameField, nudge } from '../ui.js';

// onCreate(name) -> Promise<boolean>: true once the room exists.
export function titleScreen({ name, build, onCreate }) {
  const emblem = locket();
  emblem.classList.add('hero__locket', 'locket--drift');

  const field = nameField(name);
  const button = h('button', { class: 'btn btn--primary', type: 'submit' }, 'Create our room');

  const form = h('form', {
    class: 'card',
    novalidate: true,
    onsubmit: async (event) => {
      event.preventDefault();
      const cleaned = cleanName(field.value);
      if (!cleaned) return nudge(field);
      button.disabled = true;
      button.textContent = 'Creating…';
      const created = await onCreate(cleaned);
      if (!created) {
        button.disabled = false;
        button.textContent = 'Create our room';
      }
    },
  },
    h('p', { class: 'card__lead' }, 'One of you starts a room, then texts the other a link.'),
    field,
    button,
  );

  const el = h('section', { class: 'screen screen--title' },
    // Top of the screen is decoration only: FaceTime's video window may sit over a top corner.
    h('header', { class: 'hero' },
      emblem,
      h('h1', { class: 'title' },
        h('span', { class: 'title__a' }, 'Split'),
        h('span', { class: 'title__b' }, 'Clues'),
      ),
      h('p', { class: 'tagline' }, 'A mystery for two'),
    ),
    form,
    h('footer', { class: 'foot' },
      h('p', { class: 'foot__note' }, 'Got a link from your partner? Just open it.'),
      h('p', { class: 'foot__build' }, build),
    ),
  );

  return { el };
}
