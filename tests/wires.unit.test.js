// Deals thousands of Color Wires puzzles and checks every one is fair:
// exactly one rule is "the first that is true", it points at a real wire, and
// reading the wrong rule never works by luck. Needs no browser and no database.

(async () => {
  const { deal, hints, holds, target } = await import('../js/puzzles/wires.js');

  // Worked out separately from the game's own code, the way a player would.
  function byHand(condition, panel) {
    const colors = panel.wires.map((wire) => wire.color);
    const count = colors.filter((color) => color === condition.color).length;
    if (condition.kind === 'none') return count === 0;
    if (condition.kind === 'one') return count === 1;
    if (condition.kind === 'many') return count >= 2;
    if (condition.kind === 'top') return colors[0] === condition.color;
    if (condition.kind === 'bottom') return colors[colors.length - 1] === condition.color;
    if (condition.kind === 'striped') return (panel.wires.filter((wire) => wire.striped).length > 0) === condition.value;
    if (condition.kind === 'lamp') return panel.lamp === condition.value;
    if (condition.kind === 'plate') return ([1, 3, 5, 7, 9].includes(panel.plate)) === condition.value;
    throw new Error(`unknown condition ${condition.kind}`);
  }

  const failures = [];
  const expect = (ok, message) => { if (!ok && failures.length < 10) failures.push(message); };
  const shape = { 1: [1, 4, 3], 2: [1, 5, 4], 3: [1, 6, 4], 4: [1, 6, 5], 5: [2, 5, 4] };
  const appliesSeen = new Set();

  for (let level = 1; level <= 5; level++) {
    for (let seed = 1; seed <= 2500; seed++) {
      const puzzle = deal(level, seed);
      const where = `level ${level} seed ${seed}`;
      expect(JSON.stringify(deal(level, seed)) === JSON.stringify(puzzle), `${where}: dealt differently the second time`);
      expect(puzzle.stages.length === shape[level][0], `${where}: ${puzzle.stages.length} panels`);

      puzzle.stages.forEach((panel, s) => {
        const at = `${where} panel ${s + 1}`;
        expect(panel.wires.length === shape[level][1], `${at}: ${panel.wires.length} wires`);
        expect(panel.rules.length === shape[level][2], `${at}: ${panel.rules.length} rules`);
        expect(new Set(panel.wires.map((wire) => wire.color)).size >= 3, `${at}: fewer than three colours`);
        expect(panel.rules[panel.rules.length - 1].condition === null, `${at}: the last rule is not "otherwise"`);
        expect(panel.rules.slice(0, -1).every((rule) => rule.condition), `${at}: a rule above the last has no condition`);

        // The first true line, found by hand.
        let first = panel.rules.findIndex((rule) => rule.condition === null || byHand(rule.condition, panel));
        expect(first === panel.applies, `${at}: line ${first + 1} is the first true one but the puzzle says ${panel.applies + 1}`);
        panel.rules.forEach((rule) => {
          if (rule.condition) expect(holds(rule.condition, panel) === byHand(rule.condition, panel), `${at}: the game and the hand check disagree on ${JSON.stringify(rule.condition)}`);
        });

        const cut = target(panel.rules[panel.applies].action, panel);
        expect(cut === panel.answer && cut >= 0 && cut < panel.wires.length, `${at}: answer ${panel.answer}, rule points at ${cut}`);
        panel.rules.forEach((rule, line) => {
          const points = target(rule.action, panel);
          expect(points >= 0 && points < panel.wires.length, `${at}: line ${line + 1} points at no wire`);
          if (line !== panel.applies) expect(points !== panel.answer, `${at}: line ${line + 1} also points at the right wire`);
        });
        if (level < 4) expect(panel.lamp === null && panel.plate === null, `${at}: unexpected lamp or plate`);
        else expect(typeof panel.lamp === 'boolean' && panel.plate >= 1 && panel.plate <= 9, `${at}: lamp or plate missing`);
        if (level < 3) expect(panel.wires.every((wire) => !wire.striped), `${at}: unexpected striped wire`);
        appliesSeen.add(`${level}:${panel.applies}`);

        const nudges = hints(puzzle, { stage: s });
        expect(nudges.length === 2 && nudges[1].includes(`line ${panel.applies + 1} `), `${at}: second hint does not name the true line`);
      });
    }
  }
  for (let level = 1; level <= 5; level++) {
    for (let line = 0; line < shape[level][2]; line++) expect(appliesSeen.has(`${level}:${line}`), `level ${level}: line ${line + 1} is never the true one`);
  }

  if (failures.length) {
    console.log(`  FAIL  color wires deals\n        ${failures.join('\n        ')}`);
    process.exit(1);
  }
  console.log('  ok    12500 color wires deals are all fair and solvable');
})().catch((error) => { console.error(error); process.exit(1); });
