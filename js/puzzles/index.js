// Every puzzle type the game knows, by name.
//
// A puzzle type provides:
//   roles          the two halves, e.g. ['lock', 'key']
//   roleNames      the big label for each half
//   roleJobs       one line on what the holder of each half does
//   deal(level, seed)       the whole puzzle, built the same on both phones
//   initialState()          the shared state at the start of an attempt
//   hints(puzzle)           nudges, mildest first
//   mount(role, puzzle, actions)  draws ONE half and returns { el, update(state), onMiss() }

import { codelock } from './codelock.js';

export const PUZZLES = { codelock };
