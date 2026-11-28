// The sets of puzzles you can play. Each entry in `puzzles` names a puzzle
// type and a difficulty level; the actual content is dealt fresh every time.
//
//   kind 'practice'  one puzzle type, every level, easiest first
//   kind 'story'     a themed episode mixing the puzzle types. Each puzzle has a
//                    chapter `name` and an `after` line shown once it is solved.

const levels = (type, count) => Array.from({ length: count }, (_, i) => ({ type, level: i + 1 }));

export const EPISODES = {
  together: {
    id: 'together',
    kind: 'story',
    kicker: 'Episode 1',
    title: 'Find Your Way Back',
    blurb: 'A storm split the path, and the locket you share. Six clues lead back to each other.',
    length: 'about 25 minutes',
    intro: 'The storm came down fast. When it cleared you were on opposite sides of the valley, each holding half of the same locket. Every clue on the way back is split the same way: half with you, half with the one you are looking for. Talk it through.',
    finale: 'You found each other',
    puzzles: [
      { type: 'codelock', level: 2, name: 'The Garden Gate', after: 'The gate clicks open. Beyond it, the path dips into the marsh.' },
      { type: 'map', level: 2, name: 'The Marsh', after: 'Solid ground at last, and something glinting in the mud: the key to the old signal box.' },
      { type: 'wires', level: 3, name: 'The Signal Box', after: 'The lamp on the hill blinks on. Now each of you can see where the other is.' },
      { type: 'spot', level: 2, name: 'Two Windows', after: 'Same shelf, same view, nearly. You are closer than you thought.' },
      { type: 'draw', level: 2, name: 'A Postcard', after: 'Not a perfect likeness. Worth keeping anyway.' },
      { type: 'codelock', level: 5, name: 'The Last Door', after: 'The last lock gives. Someone is waiting on the other side.' },
    ],
  },
  lighthouse: {
    id: 'lighthouse',
    kind: 'story',
    kicker: 'Episode 2',
    title: 'The Lighthouse',
    blurb: 'The lamp has gone dark and the tide is turning. Harder clues this time: relight it together.',
    length: 'about 30 minutes',
    intro: 'The keeper left in a hurry, and the great lamp went out with the last of the daylight. One of you is up in the tower with the notes; the other is down on the rocks with the tools. The boats are still out. Work fast, and keep talking.',
    finale: 'The light is back',
    puzzles: [
      { type: 'spot', level: 3, name: 'The Keeper\'s Desk', after: 'Three things out of place, and one of them is a key. The keeper wanted it found.' },
      { type: 'codelock', level: 4, name: 'The Sea Chest', after: 'Inside the chest: a chart of the rocks, turned the wrong way round.' },
      { type: 'map', level: 3, name: 'Low Tide', after: 'The spare fuses were buried above the waterline, right where the chart said.' },
      { type: 'draw', level: 3, name: 'Signal Flags', after: 'Near enough for the harbour to read. They signal back: hurry.' },
      { type: 'map', level: 4, name: 'Fog on the Rocks', after: 'The fog closes behind you, but you have the last part for the lamp.' },
      { type: 'wires', level: 5, name: 'The Great Lamp', after: 'A hum, a flicker, and then the beam swings out across the water.' },
    ],
  },
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

EPISODES['practice-spot'] = {
  id: 'practice-spot',
  kind: 'practice',
  title: 'Spot the Difference',
  blurb: 'Two shelves that look almost the same. Find the three things that differ.',
  puzzles: levels('spot', 3),
};

EPISODES['practice-draw'] = {
  id: 'practice-draw',
  kind: 'practice',
  title: 'Describe and Draw',
  blurb: 'One of you describes a picture, the other draws it. Then you compare.',
  puzzles: levels('draw', 3),
};

export const PRACTICE = Object.values(EPISODES).filter((episode) => episode.kind === 'practice');
export const STORIES = Object.values(EPISODES).filter((episode) => episode.kind === 'story');
