// The sets of puzzles you can play. Each entry in `puzzles` names a puzzle
// type and a difficulty level; the actual content is dealt fresh every time.
//
//   kind 'practice'  one puzzle type, every level, easiest first
//   kind 'story'     a themed episode mixing the puzzle types

const levels = (type, count) => Array.from({ length: count }, (_, i) => ({ type, level: i + 1 }));

export const EPISODES = {
  'practice-codelock': {
    id: 'practice-codelock',
    kind: 'practice',
    title: 'Code Lock',
    blurb: 'A lock with four symbols on one phone, the key card on the other.',
    puzzles: levels('codelock', 5),
  },
  'practice-wires': {
    id: 'practice-wires',
    kind: 'practice',
    title: 'Color Wires',
    blurb: 'A panel of wires on one phone, the rulebook on the other. Cut the right one.',
    puzzles: levels('wires', 5),
  },
};

EPISODES['practice-map'] = {
  id: 'practice-map',
  kind: 'practice',
  title: 'Map Directions',
  blurb: 'One phone has the map, the other has a marker to move. Find the treasure.',
  puzzles: levels('map', 4),
};

export const PRACTICE = Object.values(EPISODES).filter((episode) => episode.kind === 'practice');
export const STORIES = Object.values(EPISODES).filter((episode) => episode.kind === 'story');
