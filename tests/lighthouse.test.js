// Plays the second story episode straight through on two pretend iPhones, to
// check every one of its (harder) chapters can be solved and it ends properly.
// Run with tests/run.sh.

const { begin, sees, shot, fits, readRoom } = require('./helpers');
const { solveCurrent } = require('./solvers');

const CHAPTERS = ['The Keeper\'s Desk', 'The Sea Chest', 'Low Tide', 'Signal Flags', 'Fog on the Rocks', 'The Great Lamp'];

(async () => {
  const { check, pairUp, finish } = await begin();
  const { mark, joy, invite } = await pairUp();

  console.log('\nThe Lighthouse');
  await check('the room lists both episodes', async () => {
    await sees(mark, '.shelf', /Episode 1\s+Find Your Way Back[\s\S]+Episode 2\s+The Lighthouse/i);
    await sees(mark, '.story:nth-of-type(2) .story__meta', /6 clues · about 30 minutes/);
  });
  await shot(mark, 'lighthouse-01-room');
  await check('Play and Begin start the first chapter on both phones', async () => {
    await mark.locator('.story', { hasText: 'The Lighthouse' }).getByRole('button', { name: 'Play' }).click();
    await sees(joy, '.curtain__title', /The Lighthouse/);
    await sees(joy, '.curtain__story', /The keeper left in a hurry/);
    await fits(joy, { scroll: true });
    await joy.getByRole('button', { name: 'Begin' }).click();
    await sees(mark, '.hud__where', /The Keeper's Desk · 1 of 6/i);
  });

  const types = [];
  for (let n = 0; n < CHAPTERS.length; n++) {
    await check(`chapter ${n + 1}, ${CHAPTERS[n]}, fits and can be solved`, async () => {
      await sees(mark, '.hud__where', new RegExp(`${CHAPTERS[n]} · ${n + 1} of 6`, 'i'));
      await sees(joy, '.hud__where', new RegExp(`${CHAPTERS[n]} · ${n + 1} of 6`, 'i'));
      await fits(mark);
      await fits(joy);
      types.push(await solveCurrent(mark, joy));
      await (n % 2 ? joy : mark).getByRole('button', { name: n === CHAPTERS.length - 1 ? 'Finish' : 'Next clue' }).click();
    });
  }
  await check('the chapters are the ones the episode lists', async () => {
    if (types.join(',') !== 'spot,codelock,map,draw,map,wires') throw new Error(types.join(','));
  });
  await check('it ends on both phones and keeps its own best time', async () => {
    await sees(mark, '.curtain__title', /The light is back/);
    await sees(joy, '.curtain__title', /The light is back/);
    await sees(joy, '.finale__best', /A new best time/);
    await shot(joy, 'lighthouse-02-ending');
    await joy.getByRole('button', { name: 'Back to the room' }).click();
    await sees(mark, '.story:nth-of-type(2) .story__meta', /Best time \d+:\d\d/);
    const room = await readRoom(invite);
    if (!(room.best.lighthouse.ms > 0) || room.best.together) throw new Error(JSON.stringify(room.best));
  });

  await finish();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
