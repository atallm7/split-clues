// The puzzle screen. It draws the frame every puzzle shares (which half you
// hold, lives, hint, the "unlocked" moment) and lets the puzzle type draw its
// own half in the middle.

import { h, replaceChildren } from '../dom.js';
import { toast, openSheet } from '../ui.js';
import { isHere, otherSeat } from '../room.js';
import {
  ENGINE_VERSION, LIVES, current, roleOf, isFinished, dealId, clock,
  afterSolve, afterMiss, afterHint, afterNext, afterRetry,
} from '../game/engine.js';

const HEART = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 41C10 30 5 22 8 15 11 8 20 7 24 14 28 7 37 8 40 15 43 22 38 30 24 41Z"/></svg>';

const PADLOCK = `
  <svg class="padlock" viewBox="0 0 120 150" aria-hidden="true">
    <g class="padlock__shackle"><path d="M34 72V46a26 26 0 0 1 52 0V72" fill="none" stroke-width="13" stroke-linecap="round"/></g>
    <rect class="padlock__body" x="16" y="66" width="88" height="74" rx="18"/>
    <circle class="padlock__hole" cx="60" cy="96" r="9"/>
    <path class="padlock__hole" d="M55 100h10l3 20H52z"/>
  </svg>`;

const BROKEN_HEART = `
  <svg class="broken" viewBox="0 0 48 48" aria-hidden="true">
    <path class="broken__half broken__half--left" d="M24 41C10 30 5 22 8 15 11 8 20 7 24 14L20 21 27 27 22 33Z"/>
    <path class="broken__half broken__half--right" d="M24 14C28 7 37 8 40 15 43 22 38 30 24 41L22 33 27 27 20 21Z"/>
  </svg>`;

// "the LOCK" for most halves; some (PICTURE A) read better without "the".
function halfName(type, role) {
  const article = type.roleArticles ? type.roleArticles[role] : 'the ';
  return { article, name: type.roleNames[role] };
}

// api: { change(fn) -> Promise<boolean>, setState(key, value) -> Promise, end() -> Promise }
// extras (optional): { finished(game, room) -> node, menu() -> [sheet actions], ticker(el, game) -> stop() }
export function playScreen({ seat, api, extras = {} }) {
  const other = otherSeat(seat);
  let room = null;
  let drawnDeal = null; // which deal of which puzzle is on screen
  let view = null; // the half drawn by the puzzle type
  let seen = null; // what was last shown, to spot changes
  let closeSheet = null;
  let stopTicker = null;

  // Top of the screen is information only, kept to the centre: FaceTime's
  // video window may sit over a top corner.
  const where = h('span');
  const timer = h('span', { class: 'hud__timer' });
  const lives = h('div', { class: 'lives', role: 'img' });
  const hearts = Array.from({ length: LIVES }, () => {
    const heart = h('span', { class: 'life' });
    heart.innerHTML = HEART;
    lives.append(heart);
    return heart;
  });

  const plateLead = document.createTextNode('');
  const plateRole = h('strong');
  const plate = h('p', { class: 'role__plate' }, plateLead, plateRole);
  const job = h('p', { class: 'role__job' });
  const partnerLine = h('p', { class: 'role__partner' });

  const board = h('div', { class: 'board' });
  const curtain = h('div', { class: 'curtain', hidden: true });
  const hintButton = h('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: () => showHints() }, 'Hint');

  // The curtain is a sibling of the puzzle screen rather than a child, so it
  // always covers the whole phone whatever the screen underneath is doing.
  const el = h('div', { class: 'play', 'data-seat': seat },
    h('section', { class: 'screen screen--play' },
      h('div', { class: 'hud' }, h('p', { class: 'hud__where' }, where, timer), lives),
      h('div', { class: 'role' }, plate, job, partnerLine),
      board,
      h('div', { class: 'playbar' },
        hintButton,
        h('button', { class: 'btn btn--text', type: 'button', onclick: openMenu }, 'Menu'),
      ),
    ),
    curtain,
  );

  // Sends a move to the room. Resolves false (and says so) if it could not be sent.
  function send(change) {
    return api.change(change).catch(() => {
      toast('That did not go through. Check your connection.');
      return false;
    });
  }

  function dismissSheet() {
    if (closeSheet) closeSheet();
    closeSheet = null;
  }

  // ---------- Hints ----------

  function showHints() {
    const game = room && room.game;
    if (!game || isFinished(game) || game.puzzle.status !== 'playing') return;
    const deal = dealId(game);
    const { type, puzzle } = current(game);
    const all = type.hints(puzzle, game.puzzle.state || {});
    const shown = all.slice(0, game.puzzle.hints);
    const more = shown.length < all.length;

    dismissSheet();
    closeSheet = openSheet({
      title: shown.length ? 'Hints' : 'Need a hint?',
      body: shown.length
        ? h('ol', { class: 'hints' }, shown.map((text) => h('li', null, text)))
        : 'A hint is a small nudge. You will both see it.',
      actions: [
        more ? {
          label: shown.length ? 'Show another hint' : 'Show a hint',
          kind: 'primary',
          onSelect: () => send((now) => afterHint(now, deal, all.length)),
        } : null,
        { label: shown.length ? 'Got it' : 'Not yet', kind: 'ghost' },
      ],
    });
  }

  // ---------- Menu ----------

  function openMenu() {
    dismissSheet();
    closeSheet = openSheet({
      title: 'Menu',
      actions: [
        ...(extras.menu ? extras.menu() : []),
        { label: 'Stop this run', kind: 'ghost', onSelect: confirmStop },
        { label: 'Keep playing', kind: 'primary' },
      ],
    });
  }

  function confirmStop() {
    dismissSheet();
    closeSheet = openSheet({
      title: 'Stop this run?',
      body: 'Both phones go back to the room. Your progress in this run is not kept.',
      actions: [
        { label: 'Stop the run', kind: 'danger', onSelect: () => api.end().catch(() => toast('That did not go through. Check your connection.')) },
        { label: 'Keep playing', kind: 'ghost' },
      ],
    });
  }

  // ---------- The curtain: unlocked, out of lives, finished ----------

  function raiseCurtain(kind, ...children) {
    dismissSheet();
    curtain.dataset.kind = kind;
    replaceChildren(curtain, children);
    curtain.scrollTop = 0;
    curtain.hidden = false;
    el.classList.add('is-curtained');
  }

  function dropCurtain() {
    curtain.hidden = true;
    replaceChildren(curtain);
    el.classList.remove('is-curtained');
  }

  function actionButton(label, change) {
    const button = h('button', {
      class: 'btn btn--primary',
      type: 'button',
      onclick: async () => {
        button.disabled = true;
        await send(change);
        button.disabled = false;
      },
    }, label);
    return button;
  }

  function showSolved(game) {
    const deal = dealId(game);
    const { type, puzzle, total } = current(game);
    const last = game.puzzle.n + 1 >= total;
    const next = actionButton(last ? 'Finish' : 'Next clue', (now) => afterNext(now, deal));
    const count = `Clue ${game.puzzle.n + 1} of ${total}`;

    // Some puzzles have their own ending (a drawing to reveal) instead of the padlock.
    if (type.solvedView) {
      const names = { [seat]: room.players[seat].name, [other]: room.players[other].name };
      const role = { [seat]: roleOf(game, seat), [other]: roleOf(game, other) };
      return raiseCurtain('reveal', ...type.solvedView(puzzle, game.puzzle.state || {}, { names, role }), h('p', { class: 'curtain__sub' }, count), next);
    }

    const art = h('div', { class: 'unlock' },
      h('span', { class: 'unlock__ring' }),
      Array.from({ length: 10 }, (_, i) => h('span', { class: 'unlock__spark', style: `--turn:${i * 36}deg; --delay:${(i % 3) * 40}ms` })),
    );
    art.insertAdjacentHTML('beforeend', PADLOCK);
    raiseCurtain('unlocked', art, h('h2', { class: 'curtain__title' }, type.solvedTitle || 'Unlocked'), h('p', { class: 'curtain__sub' }, count), next);
    if (extras.sound) extras.sound('unlock');
  }

  function showFailed(game) {
    const deal = dealId(game);
    const art = h('div', { class: 'fail' });
    art.innerHTML = BROKEN_HEART;
    raiseCurtain('failed',
      art,
      h('h2', { class: 'curtain__title' }, 'Out of lives'),
      h('p', { class: 'curtain__sub' }, 'This clue resets with a brand new puzzle.'),
      actionButton('Try again', (now) => afterRetry(now, deal)),
    );
  }

  function showFinished(game) {
    if (drawnDeal === 'finished') return;
    drawnDeal = 'finished';
    if (stopTicker) stopTicker();
    stopTicker = null;
    const { episode, total } = current(game);
    const took = typeof game.finishedAt === 'number' && typeof game.startedAt === 'number'
      ? game.finishedAt - game.startedAt : null;
    const hintsUsed = game.hintsUsed || 0;
    const back = h('button', {
      class: 'btn btn--primary',
      type: 'button',
      onclick: () => {
        back.disabled = true;
        api.end().catch(() => {
          back.disabled = false;
          toast('That did not go through. Check your connection.');
        });
      },
    }, 'Back to the room');
    raiseCurtain('finished',
      h('p', { class: 'tagline' }, episode.title),
      h('h2', { class: 'curtain__title' }, episode.finale || `All ${total} solved`),
      h('div', { class: 'tally' },
        took === null ? null : h('p', null, h('strong', null, clock(took)), h('span', null, 'your time')),
        h('p', null, h('strong', null, hintsUsed), h('span', null, hintsUsed === 1 ? 'hint used' : 'hints used')),
      ),
      extras.finished ? extras.finished(game, room, took) : null,
      back,
    );
    if (extras.sound) extras.sound('finish');
  }

  // ---------- Keeping up with the room ----------

  function draw(game) {
    const info = current(game);
    const deal = dealId(game);
    const role = roleOf(game, seat);
    drawnDeal = deal;
    seen = null;
    dropCurtain();
    dismissSheet();

    view = info.type.mount(role, info.puzzle, {
      // setState('', value) replaces the whole shared state in one go.
      setState: (key, value) => api.setState(key, value).catch(() => {}),
      solve: () => send((now) => afterSolve(now, deal)),
      miss: (options) => send((now) => afterMiss(now, deal, options)),
      seat,
      names: { [seat]: room.players[seat].name, [other]: room.players[other].name },
    });
    replaceChildren(board, view.el);
    board.dataset.role = role;
    board.dataset.type = info.type.type;

    const scored = info.type.scored !== false;
    lives.hidden = !scored;
    hintButton.hidden = info.type.hints(info.puzzle, {}).length === 0;

    where.textContent = `${info.episode.title} · ${game.puzzle.n + 1} of ${info.total}`;
    const half = halfName(info.type, role);
    plateLead.textContent = `You have ${half.article}`;
    plateRole.textContent = half.name;
    job.textContent = info.type.roleJobs[role];

    if (!stopTicker && extras.ticker) stopTicker = extras.ticker(timer, game);
  }

  // Called with the latest room every time anything in it changes.
  function update(latest) {
    room = latest;
    const game = room.game;

    if (game.v > ENGINE_VERSION) {
      if (drawnDeal !== 'stale') {
        drawnDeal = 'stale';
        raiseCurtain('stale',
          h('h2', { class: 'curtain__title' }, 'Time for the new version'),
          h('p', { class: 'curtain__sub' }, 'Your partner has a newer version of the game. Close this page and open it again.'),
        );
      }
      return;
    }
    if (isFinished(game)) return showFinished(game);
    if (dealId(game) !== drawnDeal) draw(game);

    const state = game.puzzle;
    const { type } = current(game);
    const partner = room.players[other];
    const partnerHalf = halfName(type, roleOf(game, other));
    partnerLine.textContent = isHere(room, other)
      ? `${partner.name} has ${partnerHalf.article}${partnerHalf.name}`
      : `${partner.name} stepped away`;
    partnerLine.classList.toggle('is-away', !isHere(room, other));

    view.update(state.state || {}, { status: state.status });
    lives.setAttribute('aria-label', `${state.lives} of ${LIVES} lives left`);
    hearts.forEach((heart, i) => heart.classList.toggle('life--lost', i >= state.lives));

    if (seen) {
      if (state.lives < seen.lives) {
        view.onMiss();
        if (extras.sound) extras.sound('miss');
        if (state.status === 'playing') {
          toast(`${state.note || 'Not it'}. ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left.`);
        }
      }
      // Either of you asking for a hint opens it on both phones.
      if (state.hints > seen.hints) showHints();
    }
    if (state.status === 'solved' && (!seen || seen.status !== 'solved')) showSolved(game);
    if (state.status === 'failed' && (!seen || seen.status !== 'failed')) showFailed(game);
    seen = { lives: state.lives, hints: state.hints, status: state.status };
  }

  return {
    el,
    update,
    destroy() {
      dismissSheet();
      if (stopTicker) stopTicker();
      if (view && view.destroy) view.destroy();
    },
  };
}
