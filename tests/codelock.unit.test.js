// Deals thousands of Code Lock puzzles and checks every one is fair:
// solvable from the two halves, the same on both phones, and never ambiguous.
// Needs no browser and no database.

(async () => {
  const { deal, hints, RULES } = await import('../js/puzzles/codelock.js');
  const { symbolId } = await import('../js/puzzles/glyphs.js');

  // Worked out separately from the game's own code, the way a player would.
  const byHand = {
    asRead: (d) => d,
    reverse: (d) => [d[3], d[2], d[1], d[0]],
    plusOne: (d) => d.map((n) => (n === 9 ? 0 : n + 1)),
    swapEnds: (d) => [d[3], d[1], d[2], d[0]],
  };

  const failures = [];
  const expect = (ok, message) => { if (!ok && failures.length < 10) failures.push(message); };
  const expectedLegend = { 1: 6, 2: 9, 3: 8, 4: 8, 5: 9 };
  const seenRules = new Set();
  const seenAnswers = new Set();

  for (let level = 1; level <= 5; level++) {
    for (let seed = 1; seed <= 3000; seed++) {
      const puzzle = deal(level, seed);
      const where = `level ${level} seed ${seed}`;

      expect(JSON.stringify(deal(level, seed)) === JSON.stringify(puzzle), `${where}: dealt differently the second time`);
      expect(/^\d{4}$/.test(puzzle.answer), `${where}: answer is "${puzzle.answer}"`);
      expect(puzzle.legend.length === expectedLegend[level], `${where}: legend has ${puzzle.legend.length} symbols`);

      const ids = puzzle.legend.map((entry) => symbolId(entry.symbol));
      expect(new Set(ids).size === ids.length, `${where}: two legend symbols look the same`);
      const digits = puzzle.legend.map((entry) => entry.digit);
      expect(new Set(digits).size === digits.length, `${where}: two legend symbols share a number`);
      expect(digits.every((d) => Number.isInteger(d) && d >= 0 && d <= 9), `${where}: a legend number is not a digit`);

      const lockIds = puzzle.symbols.map(symbolId);
      expect(lockIds.length === 4 && new Set(lockIds).size === 4, `${where}: the lock does not show four different symbols`);
      expect(lockIds.every((id) => ids.includes(id)), `${where}: the lock shows a symbol that is not on the key card`);

      // Solve it from the two halves alone.
      const plain = lockIds.map((id) => puzzle.legend[ids.indexOf(id)].digit);
      let rule = 'asRead';
      if (level === 4) {
        rule = puzzle.rule;
        expect(rule !== 'asRead' && !puzzle.lamp, `${where}: level 4 should carry one twist and no lamp`);
        expect(byHand[rule](plain).join('') !== plain.join(''), `${where}: the twist changes nothing`);
      } else if (level === 5) {
        const colors = puzzle.lampRules.map((entry) => entry.color).sort().join(',');
        expect(colors === 'amber,rose,teal', `${where}: lamp rules cover ${colors}`);
        expect(new Set(puzzle.lampRules.map((entry) => entry.rule)).size === 3, `${where}: two lamp colours share a rule`);
        rule = puzzle.lampRules.find((entry) => entry.color === puzzle.lamp).rule;
      } else {
        expect(puzzle.rule === 'asRead' && !puzzle.lamp && !puzzle.lampRules, `${where}: unexpected twist`);
      }
      expect(!!RULES[rule], `${where}: unknown rule ${rule}`);
      expect(byHand[rule](plain).join('') === puzzle.answer, `${where}: answer ${puzzle.answer} but the halves give ${byHand[rule](plain).join('')}`);

      const nudges = hints(puzzle);
      expect(nudges.length === 2 && nudges[1].includes(` ${puzzle.answer[0]}.`), `${where}: second hint does not give the first number`);

      seenRules.add(`${level}:${rule}`);
      seenAnswers.add(puzzle.answer);
    }
  }

  expect(['4:reverse', '4:plusOne', '4:swapEnds'].every((key) => seenRules.has(key)), 'level 4 never used one of its twists');
  expect(['5:asRead', '5:reverse', '5:plusOne', '5:swapEnds'].every((key) => seenRules.has(key)), 'level 5 never used one of its rules');
  expect(seenAnswers.size > 3000, `only ${seenAnswers.size} different answers in 15000 deals`);

  if (failures.length) {
    console.log(`  FAIL  code lock deals\n        ${failures.join('\n        ')}`);
    process.exit(1);
  }
  console.log('  ok    15000 code lock deals are all fair and solvable');
})().catch((error) => { console.error(error); process.exit(1); });
