// Deals thousands of Spot the Difference puzzles and checks every one is fair:
// exactly three things differ, each in one feature of the right kind, and each
// difference really changes what is drawn. Needs no browser and no database.

(async () => {
  const { deal, hints, THINGS, DIFFERENCES } = await import('../js/puzzles/spot.js');

  const failures = [];
  const expect = (ok, message) => { if (!ok && failures.length < 10) failures.push(message); };
  const shape = { 1: [3, 3, ['bold']], 2: [3, 4, ['bold', 'subtle']], 3: [4, 4, ['subtle']] };
  const featuresSeen = new Set();
  const sidesSeen = new Set();

  for (let level = 1; level <= 3; level++) {
    const [rows, cols, kinds] = shape[level];
    for (let seed = 1; seed <= 2500; seed++) {
      const puzzle = deal(level, seed);
      const where = `level ${level} seed ${seed}`;
      expect(JSON.stringify(deal(level, seed)) === JSON.stringify(puzzle), `${where}: dealt differently the second time`);
      expect(puzzle.rows === rows && puzzle.cols === cols && puzzle.cells.length === rows * cols, `${where}: wrong shelf size`);
      expect(new Set(puzzle.cells.slice(0, Math.min(12, rows * cols)).map((cell) => cell.kind)).size === Math.min(12, rows * cols), `${where}: a kind repeats before every kind has been used`);

      const differing = [];
      puzzle.cells.forEach((cell, i) => {
        const thing = THINGS[cell.kind];
        expect(!!thing, `${where}: unknown thing ${cell.kind}`);
        const names = Object.keys(thing.features);
        for (const side of ['first', 'second']) {
          expect(names.every((name) => thing.features[name].values.includes(cell[side][name])), `${where}: square ${i} has a value that is not allowed`);
        }
        const changed = names.filter((name) => cell.first[name] !== cell.second[name]);
        const drawnSame = thing.draw(cell.first) === thing.draw(cell.second);
        expect((changed.length === 0) === drawnSame, `${where}: square ${i} is drawn ${drawnSame ? 'the same' : 'differently'} but ${changed.length} features differ`);
        if (changed.length) {
          differing.push(i);
          expect(changed.length === 1, `${where}: square ${i} differs in ${changed.length} features`);
          expect(kinds.includes(thing.features[changed[0]].kind), `${where}: square ${i} differs in a ${thing.features[changed[0]].kind} feature`);
          featuresSeen.add(`${cell.kind}.${changed[0]}`);
        }
      });
      expect(differing.length === DIFFERENCES, `${where}: ${differing.length} squares differ`);
      expect(JSON.stringify(differing) === JSON.stringify(puzzle.differences), `${where}: the listed differences are ${puzzle.differences} but ${differing} differ`);

      const nudges = hints(puzzle);
      const shelf = ['top', rows === 3 ? 'middle' : 'second', rows === 3 ? 'bottom' : 'third', 'bottom'][Math.floor(puzzle.differences[0] / cols)];
      expect(nudges.length === 2 && nudges[1].includes(`the ${shelf} shelf`), `${where}: second hint names the wrong shelf`);
      sidesSeen.add(seed % 2);
    }
  }

  // Every feature of every thing should turn up as a difference sooner or later.
  for (const [kind, thing] of Object.entries(THINGS)) {
    for (const name of Object.keys(thing.features)) expect(featuresSeen.has(`${kind}.${name}`), `${kind}.${name} is never the difference`);
  }

  if (failures.length) {
    console.log(`  FAIL  spot the difference deals\n        ${failures.join('\n        ')}`);
    process.exit(1);
  }
  console.log('  ok    7500 spot the difference deals are all fair and solvable');
})().catch((error) => { console.error(error); process.exit(1); });
