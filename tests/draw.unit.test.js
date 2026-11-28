// Checks the pictures used in Describe and Draw: the same seed gives the same
// picture on both phones, every hand-made picture gets used, and the made-up
// ones have five shapes in five different places. Needs no browser.

(async () => {
  const { pictureFor, PICTURE_NAMES } = await import('../js/puzzles/pictures.js');
  const { deal, hints } = await import('../js/puzzles/draw.js');

  const failures = [];
  const expect = (ok, message) => { if (!ok && failures.length < 10) failures.push(message); };
  const used = { 1: new Set(), 2: new Set() };

  for (let level = 1; level <= 3; level++) {
    for (let seed = 1; seed <= 1500; seed++) {
      const picture = pictureFor(level, seed);
      const where = `level ${level} seed ${seed}`;
      expect(JSON.stringify(pictureFor(level, seed)) === JSON.stringify(picture), `${where}: a different picture the second time`);
      expect(typeof picture.svg === 'string' && picture.svg.includes('<'), `${where}: nothing to draw`);
      const opened = (picture.svg.match(/<(?!\/)[a-z]+/g) || []).length;
      const closed = (picture.svg.match(/\/>|<\/[a-z]+>/g) || []).length;
      expect(opened === closed, `${where}: ${opened} tags opened, ${closed} closed`);
      if (level < 3) {
        expect(PICTURE_NAMES[level].includes(picture.name), `${where}: unknown picture ${picture.name}`);
        used[level].add(picture.name);
      } else {
        const places = picture.svg.match(/translate\(\d+ \d+\)/g) || [];
        expect(places.length === 5 && new Set(places).size === 5, `${where}: ${places.length} shapes in ${new Set(places).size} places`);
      }
      const puzzle = deal(level, seed);
      expect(puzzle.picture.name === picture.name && typeof puzzle.verdict === 'string' && puzzle.verdict.length > 3, `${where}: the deal is missing its picture or verdict`);
      expect(hints(puzzle).length === 0, `${where}: an unscored puzzle offers hints`);
    }
  }
  for (const level of [1, 2]) expect(used[level].size === PICTURE_NAMES[level].length, `level ${level} never uses ${PICTURE_NAMES[level].filter((name) => !used[level].has(name))}`);

  if (failures.length) {
    console.log(`  FAIL  describe and draw pictures\n        ${failures.join('\n        ')}`);
    process.exit(1);
  }
  console.log('  ok    4500 describe and draw pictures are well formed and repeatable');
})().catch((error) => { console.error(error); process.exit(1); });
