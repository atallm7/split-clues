// Every puzzle type the game knows, by name.
//
// A puzzle type provides:
//   roles          the two halves, e.g. ['lock', 'key']
//   roleNames      the big label for each half
//   roleJobs       one line on what the holder of each half does
//   deal(level, seed)       the whole puzzle, built the same on both phones
//   initialState(puzzle)    the shared state at the start of an attempt
//   hints(puzzle, state)    nudges, mildest first (none for an unscored puzzle)
//   mount(role, puzzle, actions)  draws ONE half and returns { el, update(state), onMiss() }
// and optionally:
//   scored: false           no lives for this one
//   roleArticles            the word before each half's name, when it is not "the "
//   solvedView(puzzle, state, who)  its own ending in place of the padlock

import { codelock } from './codelock.js';
import { wires } from './wires.js';

export const PUZZLES = { codelock, wires };
