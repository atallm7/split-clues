// Repeatable randomness. Both phones build a puzzle from the same seed number
// and must get exactly the same puzzle, so nothing here uses Math.random().

// Returns a function that gives the next number in [0, 1) for this seed.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A whole number from 0 up to (but not including) `count`.
export function whole(rand, count) {
  return Math.floor(rand() * count);
}

export function pick(rand, list) {
  return list[whole(rand, list.length)];
}

// A shuffled copy of `list`.
export function shuffled(rand, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = whole(rand, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The first `count` items of a shuffled copy.
export function sample(rand, list, count) {
  return shuffled(rand, list).slice(0, count);
}

// A fresh seed for a new puzzle. This one is allowed to be truly random: it is
// made once, saved in the room, and then both phones read the same number.
export function newSeed() {
  return Math.floor(Math.random() * 2147483647) + 1;
}
