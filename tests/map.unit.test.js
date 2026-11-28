// Deals thousands of Map Directions puzzles and checks every one is fair:
// the treasure can be walked to without touching a bog, nothing overlaps, and
// by lantern light there is something to see at the start.
// Needs no browser and no database.

(async () => {
  const { deal, hints, initialState, turned, LANDMARKS } = await import('../js/puzzles/map.js');

  const failures = [];
  const expect = (ok, message) => { if (!ok && failures.length < 10) failures.push(message); };
  const shape = { 1: [5, 5, 0], 2: [6, 6, 5], 3: [6, 6, 5], 4: [6, 8, 4] };
  const turnsSeen = new Set();

  for (let level = 1; level <= 4; level++) {
    for (let seed = 1; seed <= 2500; seed++) {
      const puzzle = deal(level, seed);
      const where = `level ${level} seed ${seed}`;
      const [size, landmarks, bogs] = shape[level];
      expect(JSON.stringify(deal(level, seed)) === JSON.stringify(puzzle), `${where}: dealt differently the second time`);
      expect(puzzle.size === size && puzzle.landmarks.length === landmarks && puzzle.bogs.length === bogs, `${where}: wrong size or counts`);

      const key = (cell) => `${cell.x},${cell.y}`;
      const everything = [puzzle.start, puzzle.treasure, ...puzzle.bogs, ...puzzle.landmarks];
      expect(everything.every((cell) => cell.x >= 0 && cell.y >= 0 && cell.x < size && cell.y < size), `${where}: something is off the map`);
      expect(new Set(everything.map(key)).size === everything.length, `${where}: two things share a square`);
      expect(new Set(puzzle.landmarks.map((item) => item.kind)).size === landmarks, `${where}: two landmarks look the same`);
      expect(puzzle.landmarks.every((item) => LANDMARKS.includes(item.kind)), `${where}: unknown landmark`);
      expect(Math.abs(puzzle.start.x - puzzle.treasure.x) + Math.abs(puzzle.start.y - puzzle.treasure.y) >= size - 1, `${where}: the treasure is too close to the start`);

      // Walk it by hand: flood out from the start, never entering a bog.
      const blocked = new Set(puzzle.bogs.map(key));
      const reached = new Set([key(puzzle.start)]);
      let frontier = [puzzle.start];
      while (frontier.length) {
        const next = [];
        for (const at of frontier) {
          for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
            const cell = { x: at.x + dx, y: at.y + dy };
            if (cell.x < 0 || cell.y < 0 || cell.x >= size || cell.y >= size || blocked.has(key(cell)) || reached.has(key(cell))) continue;
            reached.add(key(cell));
            next.push(cell);
          }
        }
        frontier = next;
      }
      expect(reached.has(key(puzzle.treasure)), `${where}: the treasure cannot be reached without a bog`);

      expect((level === 3) === (puzzle.turn >= 1 && puzzle.turn <= 3) && (level === 3 || puzzle.turn === 0), `${where}: turn is ${puzzle.turn}`);
      expect((level === 4) === puzzle.lantern, `${where}: lantern is ${puzzle.lantern}`);
      if (level === 4) {
        const near = puzzle.landmarks.filter((item) => Math.abs(item.x - puzzle.start.x) <= 1 && Math.abs(item.y - puzzle.start.y) <= 1);
        expect(near.length >= 1, `${where}: nothing to see by lantern at the start`);
      }
      if (level === 3) turnsSeen.add(puzzle.turn);

      const state = initialState(puzzle);
      expect(state.x === puzzle.start.x && state.y === puzzle.start.y, `${where}: the marker does not begin at the start`);
      const nudges = hints(puzzle);
      expect(nudges.length === 2 && nudges[1].includes(`${puzzle.treasure.x + 1} from the west`) && nudges[1].includes(`${puzzle.treasure.y + 1} from the north`), `${where}: second hint is wrong`);
    }
  }
  expect(turnsSeen.size === 3, `level 3 only ever turns the map ${[...turnsSeen]} quarter turns`);

  // Turning: four quarter turns come back to where they began, and north moves as the compass says.
  const corner = { x: 1, y: 0 };
  expect(JSON.stringify(turned(corner, 6, 1)) === JSON.stringify({ x: 5, y: 1 }), 'a quarter turn does not move the top row to the right-hand side');
  expect(JSON.stringify(turned(turned(turned(turned(corner, 6, 1), 6, 1), 6, 1), 6, 1)) === JSON.stringify(corner), 'four quarter turns do not come back round');
  expect(JSON.stringify(turned(corner, 6, 2)) === JSON.stringify(turned(turned(corner, 6, 1), 6, 1)), 'two quarter turns disagree with a half turn');

  if (failures.length) {
    console.log(`  FAIL  map deals\n        ${failures.join('\n        ')}`);
    process.exit(1);
  }
  console.log('  ok    10000 map deals are all fair and solvable');
})().catch((error) => { console.error(error); process.exit(1); });
