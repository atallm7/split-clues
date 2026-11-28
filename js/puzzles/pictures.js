// The pictures used in Describe and Draw. Each is drawn in a 200 x 200 box.
// Level 1 pictures are a single simple thing, level 2 are small scenes, and
// level 3 pictures are made up fresh each time from plain shapes.

import { seeded, shuffled, pick } from '../game/random.js';

const INK = '#2a2033';

const SIMPLE = {
  house: `
    <circle cx="160" cy="40" r="17" fill="#f3cf62"/>
    <rect x="50" y="95" width="100" height="78" fill="#f0c9b0"/>
    <path d="M38 98 100 44 162 98Z" fill="#c9606a"/>
    <rect x="88" y="127" width="24" height="46" fill="#7a4f58"/>
    <rect x="60" y="110" width="20" height="20" fill="#6fa8ea"/>`,
  sailboat: `
    <rect x="97" y="38" width="6" height="94" fill="#8a6a4a"/>
    <path d="M107 44 158 122H107Z" fill="#fffaf0" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M93 62 52 122H93Z" fill="#6fa8ea"/>
    <path d="M38 130H162L142 162H58Z" fill="#c9606a"/>
    <path d="M20 176q15-12 30 0t30 0 30 0 30 0 30 0" fill="none" stroke="#6fa8ea" stroke-width="5" stroke-linecap="round"/>`,
  snowman: `
    <circle cx="100" cy="150" r="38" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <circle cx="100" cy="94" r="28" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <circle cx="100" cy="52" r="20" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <rect x="83" y="16" width="34" height="20" fill="${INK}"/>
    <rect x="73" y="34" width="54" height="6" rx="2" fill="${INK}"/>
    <path d="M100 51 124 56 100 61Z" fill="#f4914a"/>
    <circle cx="100" cy="86" r="3.5" fill="${INK}"/><circle cx="100" cy="102" r="3.5" fill="${INK}"/>`,
  balloon: `
    <ellipse cx="100" cy="72" rx="44" ry="52" fill="#e5646e"/>
    <path d="M93 122h14l-7 12z" fill="#e5646e"/>
    <path d="M100 134q-16 18 0 32t0 28" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="84" cy="52" rx="8" ry="13" fill="#fff" opacity=".5" transform="rotate(-20 84 52)"/>`,
  icecream: `
    <path d="M68 100h64l-32 84z" fill="#e9b872"/>
    <path d="M78 112 122 112M84 128 116 128M90 144 110 144" stroke="#c4904a" stroke-width="3"/>
    <circle cx="100" cy="84" r="34" fill="#ef9a9a"/>
    <circle cx="100" cy="46" r="25" fill="#7fcbb8"/>
    <circle cx="100" cy="18" r="9" fill="#e5646e"/>`,
};

const SCENES = {
  cat: `
    <path d="M40 30a22 22 0 1 0 14 38 17 17 0 0 1-14-38z" fill="#f3cf62"/>
    <path d="M62 84 70 40 100 70ZM138 84 130 40 100 70Z" fill="#f4b860"/>
    <circle cx="100" cy="112" r="52" fill="#f4b860"/>
    <circle cx="82" cy="102" r="7" fill="${INK}"/><circle cx="118" cy="102" r="7" fill="${INK}"/>
    <path d="M93 120h14l-7 9z" fill="#c9606a"/>
    <path d="M40 116 74 122M40 136 74 130M160 116 126 122M160 136 126 130" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  rocket: `
    <path d="M30 40 34 50 44 50 36 57 39 67 30 61 21 67 24 57 16 50 26 50Z" fill="#f3cf62"/>
    <path d="M165 110 168 117 176 117 170 122 172 130 165 125 158 130 160 122 154 117 162 117Z" fill="#f3cf62"/>
    <circle cx="160" cy="45" r="16" fill="#b28be0"/>
    <path d="M100 20C125 45 128 80 124 130H76C72 80 75 45 100 20Z" fill="#f3e9da" stroke="${INK}" stroke-width="3"/>
    <circle cx="100" cy="75" r="14" fill="#6fa8ea" stroke="${INK}" stroke-width="3"/>
    <path d="M76 105 52 140H76ZM124 105 148 140H124Z" fill="#e5646e"/>
    <path d="M86 132h28l-14 44z" fill="#f4914a"/>`,
  tree: `
    <path d="M132 48a14 14 0 0 1 27-5 13 13 0 0 1 18 14 11 11 0 0 1-3 21h-36a15 15 0 0 1-6-30z" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
    <rect x="72" y="118" width="18" height="56" fill="#8a6a4a"/>
    <circle cx="81" cy="84" r="46" fill="#4f9d7d"/>
    <circle cx="62" cy="72" r="8" fill="#e5646e"/><circle cx="96" cy="64" r="8" fill="#e5646e"/><circle cx="84" cy="102" r="8" fill="#e5646e"/>
    <path d="M14 176H186" stroke="#4f9d7d" stroke-width="6" stroke-linecap="round"/>`,
  fish: `
    <path d="M30 184C24 160 40 150 32 124" fill="none" stroke="#4f9d7d" stroke-width="7" stroke-linecap="round"/>
    <path d="M52 184C60 164 46 156 54 138" fill="none" stroke="#4f9d7d" stroke-width="7" stroke-linecap="round"/>
    <path d="M168 104C150 70 96 66 70 100L40 74V136L70 110C96 144 150 140 168 104Z" fill="#f4914a"/>
    <circle cx="140" cy="96" r="6" fill="${INK}"/>
    <path d="M112 84C104 96 104 114 112 126" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="170" cy="60" r="8" fill="none" stroke="#6fa8ea" stroke-width="3"/>
    <circle cx="152" cy="36" r="5" fill="none" stroke="#6fa8ea" stroke-width="3"/>
    <circle cx="176" cy="24" r="3.5" fill="none" stroke="#6fa8ea" stroke-width="3"/>`,
  cupcake: `
    <path d="M100 16c6 8 8 12 8 16a8 8 0 0 1-16 0c0-4 2-8 8-16z" fill="#f4914a"/>
    <rect x="96" y="38" width="8" height="30" fill="#6fa8ea"/>
    <ellipse cx="100" cy="78" rx="26" ry="14" fill="#ef9a9a"/>
    <ellipse cx="100" cy="98" rx="42" ry="17" fill="#ef9a9a"/>
    <ellipse cx="100" cy="118" rx="54" ry="18" fill="#ef9a9a"/>
    <path d="M50 122h100l-14 60H64z" fill="#7fcbb8"/>
    <path d="M74 126 80 180M100 126V180M126 126 120 180" stroke="#2f8f7a" stroke-width="4"/>`,
};

// Plain shapes for the made-up pictures, each drawn around (0, 0) at a given size.
const SHAPES = {
  circle: (r) => `<circle r="${r}"/>`,
  square: (r) => `<rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}"/>`,
  triangle: (r) => `<path d="M0 ${-r}L${r} ${r * 0.85}H${-r}Z"/>`,
  diamond: (r) => `<path d="M0 ${-r}L${r} 0 0 ${r}L${-r} 0Z"/>`,
  heart: (r) => `<path transform="scale(${r / 20})" d="M0 18C-16 6-22-4-18-12-14-20-4-20 0-11 4-20 14-20 18-12 22-4 16 6 0 18Z"/>`,
  star: (r) => `<path transform="scale(${r / 20})" d="M0-20 5-6 20-6 8 3 12 18 0 9-12 18-8 3-20-6-5-6Z"/>`,
};
const SHAPE_COLORS = { red: '#e5646e', blue: '#6fa8ea', yellow: '#f3cf62', green: '#4f9d7d' };

// Five shapes on a three-by-three grid: nothing to recognise, only to describe exactly.
function madeUp(rand) {
  const spots = shuffled(rand, [0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 5);
  return spots.map((spot) => {
    const x = 36 + (spot % 3) * 64;
    const y = 36 + Math.floor(spot / 3) * 64;
    const size = pick(rand, [15, 27]);
    return `<g transform="translate(${x} ${y})" fill="${pick(rand, Object.values(SHAPE_COLORS))}">${SHAPES[pick(rand, Object.keys(SHAPES))](size)}</g>`;
  }).join('');
}

// The picture for a level and seed: { name, svg } where svg is the inside of a 200 x 200 drawing.
export function pictureFor(level, seed) {
  const rand = seeded(seed);
  if (level === 3) return { name: 'shapes', svg: madeUp(rand) };
  const set = level === 1 ? SIMPLE : SCENES;
  const name = pick(rand, Object.keys(set));
  return { name, svg: set[name] };
}

export const PICTURE_NAMES = { 1: Object.keys(SIMPLE), 2: Object.keys(SCENES) };
