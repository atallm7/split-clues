// Plays all three Spot the Difference levels on two pretend iPhones.
// A person finds the differences by describing; this test "describes" by
// reading what each phone has drawn in each square and comparing the two.
// Run with tests/run.sh.

const { begin, sees, shot, fits, readRoom, startPractice, roleOf, livesLeft } = require('./helpers');

const looks = (page) => page.locator('.spot__cell').evaluateAll((cells) => cells.map((cell) => cell.dataset.look));
const tap = (page, index) => page.locator(`.spot__cell[data-index="${index}"]`).click();
const marked = (page, index, how) => page.locator(`.spot__cell[data-index="${index}"].${how}`).count();

async function compare(mark, joy) {
  const a = await looks(mark);
  const b = await looks(joy);
  if (a.length !== b.length) throw new Error(`the shelves hold ${a.length} and ${b.length} things`);
  const differ = a.map((look, i) => (look === b[i] ? -1 : i)).filter((i) => i >= 0);
  const same = a.map((look, i) => (look === b[i] ? i : -1)).filter((i) => i >= 0);
  return { size: a.length, differ, same };
}

(async () => {
  const { check, pairUp, finish } = await begin();
  const { mark, joy, invite } = await pairUp();

  console.log('\nSpot the Difference: level 1');
  await check('starting puts both phones on the first pair of shelves', async () => {
    await startPractice(mark, 'Spot the Difference');
    await sees(mark, '.hud__where', /Spot the Difference · 1 of 3/i);
    await sees(joy, '.hud__where', /Spot the Difference · 1 of 3/i);
  });
  await check('one phone has picture A and the other has picture B', async () => {
    const roles = [await roleOf(mark), await roleOf(joy)].sort().join(',');
    if (roles !== 'first,second') throw new Error(`roles are ${roles}`);
    const a = (await roleOf(mark)) === 'first' ? mark : joy;
    const b = a === mark ? joy : mark;
    await sees(a, '.role__plate', /^You have PICTURE A$/);
    await sees(b, '.role__plate', /^You have PICTURE B$/);
    await sees(a, '.role__partner', /has PICTURE B/);
  });
  let found = await compare(mark, joy);
  await shot(mark, 'spot-01-mark-level1');
  await shot(joy, 'spot-02-joy-level1');
  await check('level 1 has nine things, exactly three of them different, and fits', async () => {
    if (found.size !== 9 || found.differ.length !== 3) throw new Error(`${found.size} things, ${found.differ.length} differ`);
    await fits(mark);
    await fits(joy);
  });
  await check('tapping something that is the same costs a life on both phones', async () => {
    await tap(mark, found.same[0]);
    await sees(mark, '.toast', /No difference there\. 2 lives left\./);
    await sees(joy, '.toast', /No difference there\. 2 lives left\./);
    if ((await livesLeft(joy)) !== 2) throw new Error('lives did not drop to 2');
  });
  await check('a difference tapped by one player waits for the other', async () => {
    await tap(mark, found.differ[0]);
    await sees(mark, '.spot__waiting', /Joy still has to tap one you marked/);
    await sees(joy, '.spot__waiting', /Mark marked one you have not tapped yet/);
    await sees(joy, '.spot__count', /Found together: 0 of 3/i);
    if (!(await marked(mark, found.differ[0], 'is-mine'))) throw new Error('Mark\'s tap is not shown on his shelf');
    if (await joy.locator('.spot__cell.is-mine, .spot__cell.is-both').count()) throw new Error('Joy\'s shelf shows where Mark tapped');
  });
  await check('once both have tapped it, it counts on both phones', async () => {
    await tap(joy, found.differ[0]);
    await sees(mark, '.spot__count', /Found together: 1 of 3/i);
    await sees(joy, '.spot__count', /Found together: 1 of 3/i);
    for (const page of [mark, joy]) if (!(await marked(page, found.differ[0], 'is-both'))) throw new Error('not marked as found by both');
  });
  await check('tapping a found difference again does nothing', async () => {
    await tap(mark, found.differ[0]);
    await mark.waitForTimeout(300);
    if ((await livesLeft(mark)) !== 2) throw new Error('a life was lost');
  });
  await check('reloading keeps what has been found', async () => {
    await tap(joy, found.differ[1]);
    await joy.reload();
    await sees(joy, '.spot__count', /Found together: 1 of 3/i);
    if (!(await marked(joy, found.differ[0], 'is-both')) || !(await marked(joy, found.differ[1], 'is-mine'))) throw new Error('marks were lost');
    const again = await compare(mark, joy);
    if (JSON.stringify(again.differ) !== JSON.stringify(found.differ)) throw new Error('the pictures changed after reloading');
  });
  await shot(joy, 'spot-03-marks');
  await check('finding all three together finishes the puzzle on both phones', async () => {
    await tap(mark, found.differ[1]);
    await tap(mark, found.differ[2]);
    await tap(joy, found.differ[2]);
    await sees(mark, '.curtain__title', /All spotted/);
    await sees(joy, '.curtain__title', /All spotted/);
  });

  for (const [level, size] of [[2, 12], [3, 16]]) {
    console.log(`\nSpot the Difference: level ${level}`);
    await check(`level ${level} has ${size} things, three different, fits, and can be finished`, async () => {
      await joy.getByRole('button', { name: 'Next clue' }).click();
      await sees(mark, '.hud__where', new RegExp(`${level} of 3`, 'i'));
      await sees(joy, '.hud__where', new RegExp(`${level} of 3`, 'i'));
      found = await compare(mark, joy);
      if (found.size !== size || found.differ.length !== 3) throw new Error(`${found.size} things, ${found.differ.length} differ`);
      await shot(mark, `spot-mark-level${level}`);
      await shot(joy, `spot-joy-level${level}`);
      await fits(mark);
      await fits(joy);
      for (const index of found.differ) {
        await tap(joy, index);
        await tap(mark, index);
      }
      await sees(mark, '.curtain__title', /All spotted/);
      await sees(joy, '.curtain__title', /All spotted/);
    });
  }

  await check('Finish ends the run on both phones', async () => {
    await mark.getByRole('button', { name: 'Finish' }).click();
    await sees(mark, '.curtain__title', /All 3 solved/);
    await sees(joy, '.curtain__title', /All 3 solved/);
    await mark.getByRole('button', { name: 'Back to the room' }).click();
    await sees(joy, '.headline', /You are both here/);
    if ((await readRoom(invite)).game) throw new Error('the finished run is still saved in the room');
  });

  await finish();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
