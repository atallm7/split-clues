// The little symbols used on locks and key cards. Each is drawn in a 48 x 48
// box in the current text colour. "cut" parts take the colour of the tile
// behind, so they read as holes.

const SHAPES = {
  star: '<path d="M24 6 28.7 18.5 42.1 19.1 31.6 27.5 35.2 40.4 24 33 12.8 40.4 16.4 27.5 5.9 19.1 19.3 18.5Z"/>',
  moon: '<path d="M26.7 7.7A17 17 0 1 0 35.6 34.2 14 14 0 0 1 26.7 7.7Z"/>',
  heart: '<path d="M24 41C10 30 5 22 8 15 11 8 20 7 24 14 28 7 37 8 40 15 43 22 38 30 24 41Z"/>',
  drop: '<path d="M24 5C17 15 10 23 10 30A14 14 0 0 0 38 30C38 23 31 15 24 5Z"/>',
  diamond: '<path d="M24 5 42 24 24 43 6 24Z"/>',
  sun: '<circle cx="24" cy="24" r="9"/><path class="glyph__rays" d="M24 4V9M24 39V44M4 24H9M39 24H44M9.9 9.9 13.4 13.4M34.6 34.6 38.1 38.1M9.9 38.1 13.4 34.6M34.6 13.4 38.1 9.9"/>',
  leaf: '<path d="M9 39C9 20 20 9 40 8 39 28 28 39 9 39Z"/><path class="glyph__cut-line" d="M13 35 31 17"/>',
  key: '<path fill-rule="evenodd" d="M14 14.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm0 5.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"/><path d="M22 22H43V26.5H22ZM33 26H37.5V34H33ZM39.5 26H43V31.5H39.5Z"/>',
  bell: '<path d="M24 6C16 6 13 13 13 21 13 29 10 32 8 35H40C38 32 35 29 35 21 35 13 32 6 24 6Z"/><circle cx="24" cy="40" r="3.5"/>',
  cloud: '<path d="M14 37A8.5 8.5 0 0 1 13.5 20 11 11 0 0 1 34.5 18 9.5 9.5 0 0 1 35 37Z"/>',
  crown: '<path d="M7 37V15L17 25 24 10 31 25 41 15V37Z"/>',
  bolt: '<path d="M28 4 10 27H21L18 44 38 20H27Z"/>',
  flame: '<path d="M24 4C26 14 37 18 37 30A13 13 0 0 1 11 30C11 24 15 21 17 16 19 21 21 22 22 22 21 15 22 9 24 4Z"/>',
  flower: '<circle cx="24" cy="13" r="8"/><circle cx="35" cy="24" r="8"/><circle cx="24" cy="35" r="8"/><circle cx="13" cy="24" r="8"/><circle class="glyph__cut" cx="24" cy="24" r="4.5"/>',
  eye: '<path d="M4 24C12 11 36 11 44 24 36 37 12 37 4 24Z"/><circle class="glyph__cut" cx="24" cy="24" r="6.5"/>',
  arrow: '<path d="M6 19.5H26V11L43 24 26 37V28.5H6Z"/>',
  fish: '<path d="M44 24C38 13 23 12 15 23L5 14V34L15 25C23 36 38 35 44 24Z"/><circle class="glyph__cut" cx="35" cy="21" r="2.4"/>',
};

// Shapes that look the same when mirrored, and ones that clearly point one way.
export const PLAIN_SHAPES = ['star', 'heart', 'drop', 'diamond', 'sun', 'bell', 'cloud', 'crown', 'flame', 'flower', 'eye', 'bolt'];
export const POINTING_SHAPES = ['moon', 'leaf', 'key', 'fish', 'arrow'];
export const COLORS = ['amber', 'rose', 'teal'];

// A symbol is { shape, color, flipped }. Its id is what makes two symbols "the same".
export function symbolId(symbol) {
  return `${symbol.shape}-${symbol.color}-${symbol.flipped ? 'left' : 'right'}`;
}

// A square tile showing one symbol.
export function symbolTile(symbol) {
  const tile = document.createElement('span');
  tile.className = `tile tile--${symbol.color}`;
  tile.dataset.symbol = symbolId(symbol);
  const turn = symbol.flipped ? ' transform="translate(48 0) scale(-1 1)"' : '';
  tile.innerHTML = `<svg viewBox="0 0 48 48" aria-hidden="true"><g${turn}>${SHAPES[symbol.shape]}</g></svg>`;
  return tile;
}
