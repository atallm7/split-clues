// The sets of puzzles you can play. Each entry in `puzzles` names a puzzle
// type and a difficulty level; the actual content is dealt fresh every time.

export const EPISODES = {
  locks: {
    id: 'locks',
    title: 'Five Locks',
    blurb: 'Five code locks, each trickier than the last. You swap who holds the lock and who holds the key every round.',
    puzzles: [
      { type: 'codelock', level: 1 },
      { type: 'codelock', level: 2 },
      { type: 'codelock', level: 3 },
      { type: 'codelock', level: 4 },
      { type: 'codelock', level: 5 },
    ],
  },
};

export const FIRST_EPISODE = 'locks';
