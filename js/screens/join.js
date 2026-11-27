// Shown when a phone opens a room link but has not yet said who it is.
// Two cases:
//   "invite": the second seat is free, so this is the partner arriving.
//   "choose": both seats are taken, so this is one of the two on a new phone
//             (or a Home Screen icon, which starts with an empty memory).

import { h, locket, setLocket, replaceChildren } from '../dom.js';
import { cleanName, nameField, nudge } from '../ui.js';

// onJoin(name) -> Promise<boolean>: true if this phone got the second seat.
// onIdentify(seat): this phone belongs to the player already in that seat.
export function joinScreen({ name, build, onJoin, onIdentify }) {
  let mode = null;
  let host = '';

  const emblem = locket();
  emblem.classList.add('hero__locket');
  const headline = h('h1', { class: 'headline' });
  const body = h('div', { class: 'stack' });

  const el = h('section', { class: 'screen screen--join' },
    h('header', { class: 'hero' }, emblem, headline, h('p', { class: 'tagline' }, 'A mystery for two')),
    body,
    h('footer', { class: 'foot' }, h('p', { class: 'foot__build' }, build)),
  );

  function buildInvite() {
    const field = nameField(name);
    const button = h('button', { class: 'btn btn--primary', type: 'submit' }, `Join ${host}`);
    const form = h('form', {
      class: 'card',
      novalidate: true,
      onsubmit: async (event) => {
        event.preventDefault();
        const cleaned = cleanName(field.value);
        if (!cleaned) return nudge(field);
        button.disabled = true;
        button.textContent = 'Joining…';
        const joined = await onJoin(cleaned);
        if (!joined) {
          button.disabled = false;
          button.textContent = `Join ${host}`;
        }
      },
    },
      h('p', { class: 'card__lead' }, 'You each get half of every clue. Solve them by talking it through.'),
      field,
      button,
    );
    const already = h('button', { class: 'btn btn--text', type: 'button', onclick: () => onIdentify('a') },
      `I am ${host} on another phone`);
    replaceChildren(body, form, already);
  }

  function buildChoose(players) {
    replaceChildren(body, h('div', { class: 'card' },
      h('h2', { class: 'card__title' }, 'Who is holding this phone?'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn--seat-a', type: 'button', onclick: () => onIdentify('a') }, players.a.name),
        h('button', { class: 'btn btn--seat-b', type: 'button', onclick: () => onIdentify('b') }, players.b.name),
      ),
    ));
  }

  // Called with the latest room every time it changes. Only rebuilds the form
  // when the case changes, so nothing is wiped while someone is typing.
  function update(room) {
    const players = room.players;
    const next = players.b ? 'choose' : 'invite';
    setLocket(emblem, { a: 'here', b: players.b ? 'here' : 'empty' });
    if (next === mode && players.a.name === host) return;
    mode = next;
    host = players.a.name;
    headline.textContent = mode === 'invite' ? `${host} invited you` : 'Welcome back';
    if (mode === 'invite') buildInvite();
    else buildChoose(players);
  }

  return { el, update };
}
