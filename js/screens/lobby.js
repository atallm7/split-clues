// The room itself: who is here, and the list of things to play.

import { h, locket, setLocket, replaceChildren } from '../dom.js';
import { isHere, otherSeat } from '../room.js';
import { openSheet } from '../ui.js';
import { clock } from '../game/engine.js';
import { PRACTICE, STORIES } from '../game/episodes.js';

// onStart(episodeId) -> Promise<boolean>: true once a run has started.
// extras (optional): { storyFooter(episode, room) -> node, tip() -> node, settings() -> [buttons] }
export function lobbyScreen({ seat, build, onInvite, onCopy, onStart, onLeave, extras = {} }) {
  const other = otherSeat(seat);
  let state = null; // 'waiting' (partner has not joined) | 'apart' (joined, not here) | 'together'
  let partnerName = '';
  let room = null;
  let starting = false;
  let closePractice = null;

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
  const invite = h('button', { class: 'btn btn--primary', type: 'button', onclick: onInvite });
  const shelf = h('div', { class: 'shelf' });

  const el = h('section', { class: 'screen screen--lobby' },
    // Top of the screen is decoration only: FaceTime's video window may sit over a top corner.
    h('p', { class: 'wordmark', 'aria-hidden': 'true' }, 'Split Clues'),
    h('div', { class: 'pair' },
      emblem,
      h('div', { class: 'pair__names' }, who.a.el, who.b.el),
    ),
    h('div', { class: 'status' }, headline, sub),
    shelf,
    h('div', { class: 'actions' },
      invite,
      h('div', { class: 'actions__row' },
        h('button', { class: 'btn btn--text', type: 'button', onclick: onCopy }, 'Copy invite link'),
        extras.settings ? extras.settings() : null,
        h('button', { class: 'btn btn--text', type: 'button', onclick: onLeave }, 'Leave room'),
      ),
    ),
    h('footer', { class: 'foot' }, h('p', { class: 'foot__build' }, build)),
  );

  async function start(episode, button) {
    if (starting || state !== 'together') return;
    starting = true;
    const label = button.textContent;
    button.textContent = 'Starting…';
    button.disabled = true;
    const started = await onStart(episode.id);
    starting = false;
    if (!started) { // if it did start, the screen changes
      button.textContent = label;
      button.disabled = false;
    }
  }

  function dismissPractice() {
    if (closePractice) closePractice();
    closePractice = null;
  }

  function playButton(episode, label, className) {
    const button = h('button', {
      class: className,
      type: 'button',
      disabled: state !== 'together',
      'data-episode': episode.id,
      onclick: () => start(episode, button),
    }, label);
    return button;
  }

  function bestLine(episode) {
    const best = room.best && room.best[episode.id];
    return best && typeof best.ms === 'number' ? `Best time ${clock(best.ms)}` : null;
  }

  function openPractice() {
    dismissPractice();
    closePractice = openSheet({
      title: 'Practice a puzzle',
      body: h('div', { class: 'picks' }, PRACTICE.map((episode) => h('div', { class: 'pick' },
        h('div', { class: 'pick__text' },
          h('strong', null, episode.title),
          h('span', null, [`${episode.puzzles.length} levels`, bestLine(episode)].filter(Boolean).join(' · ')),
        ),
        playButton(episode, 'Play', 'btn btn--primary btn--small'),
      ))),
      actions: [{ label: 'Close', kind: 'ghost' }],
    });
  }

  // The things to play. Redrawn when who-is-here or a best time changes.
  function drawShelf() {
    if (state === 'waiting') return replaceChildren(shelf);
    replaceChildren(shelf,
      extras.tip ? extras.tip() : null,
      STORIES.map((episode) => h('article', { class: 'story card' },
        h('p', { class: 'story__kicker' }, episode.kicker),
        h('h2', { class: 'card__title' }, episode.title),
        h('p', { class: 'card__lead' }, episode.blurb),
        h('p', { class: 'story__meta' }, [`${episode.puzzles.length} clues`, episode.length, bestLine(episode)].filter(Boolean).join(' · ')),
        playButton(episode, state === 'together' ? 'Play' : `Waiting for ${partnerName}`, 'btn btn--primary'),
        extras.storyFooter ? extras.storyFooter(episode, room) : null,
      )),
      h('button', { class: STORIES.length ? 'btn btn--ghost' : 'btn btn--primary', type: 'button', disabled: state !== 'together', onclick: openPractice },
        'Practice a puzzle'),
    );
  }

  function describe() {
    if (state === 'waiting') {
      headline.textContent = 'Waiting for your other half';
      sub.textContent = 'Send the link. It opens this same room today and every time after.';
      invite.textContent = 'Send the invite link';
    } else if (state === 'apart') {
      headline.textContent = `${partnerName} stepped away`;
      sub.textContent = `The room keeps your place. It picks up again the moment ${partnerName} is back.`;
      invite.textContent = 'Send the link again';
    } else {
      headline.textContent = 'You are both here';
      sub.textContent = 'Pick something to play.';
    }
    invite.hidden = state === 'together';
    invite.classList.toggle('btn--primary', state === 'waiting');
    invite.classList.toggle('btn--ghost', state !== 'waiting');
    el.dataset.state = state;
  }

  let drawnFor = '';

  // Called with the latest room every time anything in it changes.
  function update(latest) {
    room = latest;
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
      describe();
    }

    // Redraw the list only when something it shows has changed, so a tap is never lost mid-press.
    const shows = JSON.stringify([state, partnerName, room.best || null, extras.shelfKey ? extras.shelfKey(room) : null]);
    if (shows !== drawnFor) {
      drawnFor = shows;
      drawShelf();
    }
  }

  return { el, update, destroy: dismissPractice, redraw() { drawnFor = ''; if (room) update(room); } };
}
