// The rules of play, independent of any one puzzle type: who holds which half,
// lives, hints, moving on, and starting over.
//
// The shared state of a run lives in the room as `game`:
//   v          engine version that made it (so an out-of-date phone can say so)
//   id         a random id for this run
//   episode    which set of puzzles
//   flip       0 or 1: decides who gets which half in round one; it alternates after
//   index      which puzzle of the episode is on the table
//   begun      false while a story's introduction is showing
//   startedAt  when the clock started (server time), finishedAt when it stopped
//   hintsUsed  hints taken across the whole run
//   puzzle     the puzzle on the table:
//     n, attempt   its place in the episode, and which try this is
//     seed         the number both phones deal the puzzle from
//     lives, hints lives left and hints shown
//     status       'playing' | 'solved' | 'failed'
//     misses       how many wrong tries so far this attempt
//     note         a few words about the latest wrong try, shown on both phones
//     state        whatever the puzzle type needs to share (for a lock: the digits typed)
//
// Every function named like `after…` takes the current game and returns the next
// one, or undefined to mean "no change" (the move no longer applies).

import { EPISODES } from './episodes.js';
import { PUZZLES } from '../puzzles/index.js';
import { newSeed } from './random.js';
import { randomId } from '../util.js';

export const ENGINE_VERSION = 2;
export const LIVES = 3;

const TIME = { '.sv': 'timestamp' }; // the database swaps this for its own clock

function dealt(episode, n, attempt) {
  const slot = episode.puzzles[n];
  const type = PUZZLES[slot.type];
  const seed = newSeed();
  return {
    n,
    attempt,
    seed,
    lives: LIVES,
    hints: 0,
    misses: 0,
    status: 'playing',
    state: type.initialState(type.deal(slot.level, seed)),
  };
}

export function newGame(episodeId) {
  const episode = EPISODES[episodeId];
  return {
    v: ENGINE_VERSION,
    id: randomId(8),
    episode: episodeId,
    flip: Math.random() < 0.5 ? 0 : 1,
    index: 0,
    hintsUsed: 0,
    begun: !episode.intro, // a story waits on its introduction; the clock starts after it
    startedAt: TIME,
    puzzle: dealt(episode, 0, 1),
  };
}

// ---------- Reading a game ----------

// Everything a screen needs to know about the puzzle on the table.
const dealtCache = new Map();
export function current(game) {
  const episode = EPISODES[game.episode];
  const slot = episode.puzzles[game.puzzle.n];
  const type = PUZZLES[slot.type];
  const key = `${slot.type}:${slot.level}:${game.puzzle.seed}`;
  if (!dealtCache.has(key)) {
    dealtCache.clear(); // only the puzzle on the table is worth keeping
    dealtCache.set(key, type.deal(slot.level, game.puzzle.seed));
  }
  return { episode, slot, type, puzzle: dealtCache.get(key), total: episode.puzzles.length };
}

// Which half a seat holds for the puzzle on the table. Halves swap every round.
export function roleOf(game, seat) {
  const { type } = current(game);
  const turn = (game.puzzle.n + game.flip + (seat === 'b' ? 1 : 0)) % 2;
  return type.roles[turn];
}

export function isFinished(game) {
  return !!game.finishedAt;
}

// True if `game` is a run this screen can show (or one from a newer version,
// which the screen answers by asking for an update).
export function isPlayable(game) {
  return !!game && !!game.id && !!game.puzzle && (game.v > ENGINE_VERSION || !!EPISODES[game.episode]);
}

// A handle on one particular deal, so a move made for an old puzzle is ignored.
export function dealId(game) {
  return `${game.id}:${game.puzzle.n}:${game.puzzle.attempt}`;
}

function stillOn(game, deal, status) {
  return !!game && !game.finishedAt && dealId(game) === deal && game.puzzle.status === status;
}

// ---------- Moves ----------

// Past a story's introduction: the first puzzle appears and the clock starts.
export function afterBegin(game) {
  if (!game || game.begun || game.finishedAt) return undefined;
  return { ...game, begun: true, startedAt: TIME };
}

export function afterSolve(game, deal) {
  if (!stillOn(game, deal, 'playing')) return undefined;
  return { ...game, puzzle: { ...game.puzzle, status: 'solved', solvedAt: TIME } };
}

// A wrong try: lose a life. With none left the puzzle is failed.
// By default the shared state starts over (a lock clears its digits). Pass
// { keep: true } to leave it as it is, or { state } to set it. `note` is a few
// words both phones show, such as "Wrong wire".
export function afterMiss(game, deal, { keep = false, state, note } = {}) {
  if (!stillOn(game, deal, 'playing')) return undefined;
  const lives = Math.max(0, game.puzzle.lives - 1);
  const { type, puzzle } = current(game);
  let next = type.initialState(puzzle);
  if (keep) next = game.puzzle.state || null;
  if (state) next = state;
  return {
    ...game,
    puzzle: {
      ...game.puzzle,
      lives,
      misses: (game.puzzle.misses || 0) + 1,
      note: note || null,
      status: lives === 0 ? 'failed' : 'playing',
      state: next,
    },
  };
}

export function afterHint(game, deal, available) {
  if (!stillOn(game, deal, 'playing')) return undefined;
  if (game.puzzle.hints >= available) return undefined;
  return {
    ...game,
    hintsUsed: (game.hintsUsed || 0) + 1,
    puzzle: { ...game.puzzle, hints: game.puzzle.hints + 1 },
  };
}

// After a solved puzzle: deal the next one, or finish the run.
export function afterNext(game, deal) {
  if (!stillOn(game, deal, 'solved')) return undefined;
  const episode = EPISODES[game.episode];
  const n = game.puzzle.n + 1;
  if (n >= episode.puzzles.length) return { ...game, finishedAt: TIME };
  return { ...game, index: n, puzzle: dealt(episode, n, 1) };
}

// After running out of lives: the same puzzle again, freshly dealt.
export function afterRetry(game, deal) {
  if (!stillOn(game, deal, 'failed')) return undefined;
  return { ...game, puzzle: dealt(EPISODES[game.episode], game.puzzle.n, game.puzzle.attempt + 1) };
}

// ---------- Small helpers for screens ----------

// "4:07" from a number of milliseconds.
export function clock(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
