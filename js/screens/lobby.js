// The room itself: who is here, and (for now) a way to say hello.

import { h, locket, setLocket, wiggleLocket } from '../dom.js';
import { toast } from '../ui.js';

// True if that player has the game open and in view right now.
function isHere(room, seat) {
  const marks = room.presence && room.presence[seat];
  return !!marks && Object.keys(marks).length > 0;
}

export function lobbyScreen({ seat, build, onInvite, onCopy, onWave, onLeave }) {
  const other = seat === 'a' ? 'b' : 'a';
  let state = null; // 'waiting' (partner has not joined) | 'apart' (joined, not here) | 'together'
  let partnerName = '';
  let lastWaveId = null;
  let firstUpdate = true;

  const emblem = locket('Your two halves of the locket');
  emblem.classList.add('pair__locket');

  const who = {};
  for (const s of ['a', 'b']) {
    const name = h('span', { class: 'who__name' });
    const tag = h('span', { class: 'who__tag' });
    who[s] = { el: h('div', { class: `who who--${s}` }, name, tag), name, tag };
  }

  const headline = h('h1', { class: 'headline' });
  const sub = h('p', { class: 'sub' });

  const primary = h('button', {
    class: 'btn btn--primary',
    type: 'button',
    onclick: () => {
      if (state !== 'together') return onInvite();
      onWave();
      primary.disabled = true; // a short pause so waves cannot be spammed
      setTimeout(() => { primary.disabled = false; }, 1200);
    },
  });

  const el = h('section', { class: 'screen screen--lobby' },
    // Top of the screen is decoration only: FaceTime's video window may sit over a top corner.
    h('p', { class: 'wordmark', 'aria-hidden': 'true' }, 'Split Clues'),
    h('div', { class: 'pair' },
      emblem,
      h('div', { class: 'pair__names' }, who.a.el, who.b.el),
    ),
    h('div', { class: 'status' }, headline, sub),
    h('div', { class: 'actions' },
      primary,
      h('div', { class: 'actions__row' },
        h('button', { class: 'btn btn--text', type: 'button', onclick: onCopy }, 'Copy invite link'),
        h('button', { class: 'btn btn--text', type: 'button', onclick: onLeave }, 'Leave room'),
      ),
    ),
    h('footer', { class: 'foot' }, h('p', { class: 'foot__build' }, build)),
  );

  function describe(next) {
    if (next === 'waiting') {
      headline.textContent = 'Waiting for your other half';
      sub.textContent = 'Send the link. It opens this same room today and every time after.';
      primary.textContent = 'Send the invite link';
    } else if (next === 'apart') {
      headline.textContent = `${partnerName} stepped away`;
      sub.textContent = `The room keeps your place. It picks up again the moment ${partnerName} is back.`;
      primary.textContent = 'Send the link again';
    } else {
      headline.textContent = 'You are both here';
      sub.textContent = 'Puzzles arrive in the next step. For now, say hello.';
      primary.textContent = `Wave at ${partnerName}`;
    }
    primary.classList.toggle('btn--primary', next !== 'apart');
    primary.classList.toggle('btn--ghost', next === 'apart');
    primary.disabled = false;
  }

  // Called with the latest room every time anything in it changes.
  function update(room) {
    const partner = room.players[other] || null;
    const partnerHere = !!partner && isHere(room, other);
    const next = !partner ? 'waiting' : partnerHere ? 'together' : 'apart';
    const partnerLook = !partner ? 'empty' : partnerHere ? 'here' : 'away';

    setLocket(emblem, { [seat]: 'here', [other]: partnerLook });

    who[seat].name.textContent = room.players[seat].name;
    who[seat].tag.textContent = 'you';
    who[seat].el.dataset.state = 'here';
    who[other].name.textContent = partner ? partner.name : 'Your partner';
    who[other].tag.textContent = { empty: 'not here yet', away: 'away', here: 'here' }[partnerLook];
    who[other].el.dataset.state = partnerLook;

    const name = partner ? partner.name : '';
    if (next !== state || name !== partnerName) {
      state = next;
      partnerName = name;
      describe(next);
    }

    // A wave that was already in the room when this screen opened is old news.
    const wave = room.wave || null;
    if (firstUpdate) {
      lastWaveId = wave ? wave.id : null;
      firstUpdate = false;
    } else if (wave && wave.id !== lastWaveId) {
      lastWaveId = wave.id;
      wiggleLocket(emblem, wave.from);
      if (wave.from === seat) toast(`You waved at ${partnerName}`);
      else toast(`${room.players[wave.from].name} waved 👋`);
    }
  }

  return { el, update };
}
