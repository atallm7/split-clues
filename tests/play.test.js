// Plays all five code locks on two pretend iPhones, the way two people would:
// reading the symbols off one screen and the key card off the other.
// Run with tests/run.sh, which starts a local database emulator first.

const { begin, sees, shot, fits, setVisible, readRoom } = require('./helpers');

const TWISTS = {
  asRead: (d) => d,
  reverse: (d) => [d[3], d[2], d[1], d[0]],
  plusOne: (d) => d.map((n) => (n === 9 ? 0 : n + 1)),
  swapEnds: (d) => [d[3], d[1], d[2], d[0]],
};

const roleOf = (page) => page.locator('.board').getAttribute('data-role');

// Which of the two phones holds which half right now.
async function halves(mark, joy) {
  const markRole = await roleOf(mark);
  return markRole === 'lock' ? { lock: mark, key: joy, lockName: 'Mark' } : { lock: joy, key: mark, lockName: 'Joy' };
}

// Works out the code from what each phone shows, and nothing else.
async function workOutCode(lock, key) {
  const symbols = await lock.locator('.lock .tiles .tile').evaluateAll((tiles) => tiles.map((tile) => tile.dataset.symbol));
  const lamp = (await lock.locator('.lamp').count()) ? await lock.locator('.lamp').getAttribute('data-lamp') : null;
  const legend = Object.fromEntries(await key.locator('.legend__item').evaluateAll((items) => items.map((item) => [item.dataset.symbol, Number(item.dataset.digit)])));
  let rule = 'asRead';
  if (await key.locator('.note[data-note="rule"]').count()) rule = await key.locator('.note').getAttribute('data-rule');
  if (await key.locator('.note[data-note="lamp"]').count()) rule = await key.locator(`.note__row[data-lamp="${lamp}"]`).getAttribute('data-rule');
  const plain = symbols.map((id) => legend[id]);
  if (plain.some((digit) => digit === undefined)) throw new Error(`a lock symbol is missing from the key card: ${symbols}`);
  return { code: TWISTS[rule](plain).join(''), rule, lamp, legendSize: Object.keys(legend).length };
}

async function type(lock, digits) {
  for (const digit of digits) await lock.getByRole('button', { name: digit, exact: true }).click();
}

const tryIt = (lock) => lock.getByRole('button', { name: 'Try the code' }).click();
const livesLeft = (page) => page.locator('.life:not(.life--lost)').count();
const wrongCode = (code) => String((Number(code) + 1111) % 10000).padStart(4, '0');

(async () => {
  const { check, pairUp, finish } = await begin();
  const { mark, joy, joyPhone, invite } = await pairUp();
  let joyPage = joy;

  console.log('\nStarting a run');
  await check('the room offers the run', async () => {
    await sees(mark, '.screen--lobby .btn--primary', /Start Five Locks/);
    await sees(mark, '.sub', /Five code locks/);
  });
  await shot(mark, 'play-01-room');
  await check('room screen still fits small and large iPhones', () => fits(mark));
  await check('one tap puts both phones in the first puzzle', async () => {
    await mark.getByRole('button', { name: 'Start Five Locks' }).click();
    await sees(mark, '.hud__where', /Five Locks · 1 of 5/i);
    await sees(joyPage, '.hud__where', /Five Locks · 1 of 5/i);
  });
  await check('one phone has the lock and the other has the key', async () => {
    const roles = [await roleOf(mark), await roleOf(joyPage)].sort().join(',');
    if (roles !== 'key,lock') throw new Error(`roles are ${roles}`);
    const { lock, key, lockName } = await halves(mark, joyPage);
    await sees(lock, '.role__plate', /You have the LOCK/);
    await sees(key, '.role__plate', /You have the KEY/);
    await sees(key, '.role__partner', new RegExp(`${lockName} has the LOCK`));
  });
  await check('each phone draws only its own half', async () => {
    const { lock, key } = await halves(mark, joyPage);
    if (await lock.locator('.legend, .legend__digit, .note').count()) throw new Error('the lock phone shows the key card');
    if (await key.locator('.lock, .tiles, .keypad').count()) throw new Error('the key phone shows the lock');
    if ((await lock.locator('.tiles .tile').count()) !== 4) throw new Error('the lock does not show four symbols');
  });
  await check('both start with three lives', async () => {
    if ((await livesLeft(mark)) !== 3 || (await livesLeft(joyPage)) !== 3) throw new Error('not three lives');
  });

  console.log('\nLock 1');
  let first = await halves(mark, joyPage);
  let solved = await workOutCode(first.lock, first.key);
  await shot(first.lock, 'play-02-lock-level1');
  await shot(first.key, 'play-03-key-level1');
  await check('both halves fit small and large iPhones', async () => {
    await fits(first.lock);
    await fits(first.key);
  });
  await check('digits typed on the lock appear on the key phone as they go in', async () => {
    await type(first.lock, '12');
    await sees(first.key, '.mirror .slots', /^1\s*2$/);
    await first.lock.getByRole('button', { name: 'Delete' }).click();
    await sees(first.key, '.mirror .slots', /^1$/);
    await first.lock.getByRole('button', { name: 'Delete' }).click();
  });
  await check('a wrong code costs one life on both phones', async () => {
    await type(first.lock, wrongCode(solved.code));
    await tryIt(first.lock);
    await sees(first.lock, '.toast', /Not it\. 2 lives left\./);
    await sees(first.key, '.toast', /Not it\. 2 lives left\./);
    if ((await livesLeft(first.lock)) !== 2 || (await livesLeft(first.key)) !== 2) throw new Error('lives did not drop to 2 on both');
    await sees(first.key, '.mirror .slots', /^$/);
  });
  await check('a hint asked for on one phone opens on both', async () => {
    await first.key.getByRole('button', { name: 'Hint' }).click();
    await sees(first.key, '.sheet__title', /Need a hint/);
    await first.key.getByRole('button', { name: 'Show a hint' }).click();
    await sees(first.key, '.hints li', /Lock holder: name each symbol/);
    await sees(first.lock, '.hints li', /Lock holder: name each symbol/);
  });
  await shot(first.lock, 'play-04-hint');
  await check('the second hint gives the first number, and then there are no more', async () => {
    await first.key.getByRole('button', { name: 'Got it' }).click();
    await first.lock.getByRole('button', { name: 'Show another hint' }).click(); // the lock phone's sheet is still open
    await sees(first.key, '.hints li:nth-child(2)', new RegExp(`first number of the code is ${solved.code[0]}\\.`));
    await sees(first.lock, '.hints li:nth-child(2)', new RegExp(`first number of the code is ${solved.code[0]}\\.`));
    await first.lock.waitForFunction(() => !document.querySelector('.overlay.is-leaving')); // the old sheet slides away first
    if (await first.lock.getByRole('button', { name: /Show (a|another) hint/ }).count()) throw new Error('a third hint is offered');
    await first.lock.getByRole('button', { name: 'Got it' }).click();
    await first.key.getByRole('button', { name: 'Got it' }).click();
    for (const page of [first.lock, first.key]) await page.waitForSelector('.overlay', { state: 'detached' });
  });
  await check('the right code unlocks on both phones at once', async () => {
    await type(first.lock, solved.code);
    await tryIt(first.lock);
    await sees(first.lock, '.curtain__title', /Unlocked/);
    await sees(first.key, '.curtain__title', /Unlocked/, 2000);
    await sees(first.key, '.curtain__sub', /Lock 1 of 5/);
  });
  await shot(first.key, 'play-05-unlocked');
  await check('the unlocked screen fits small and large iPhones', () => fits(first.key));

  console.log('\nLock 2');
  await check('either player can move both phones on', async () => {
    await first.key.getByRole('button', { name: 'Next lock' }).click();
    await sees(mark, '.hud__where', /2 of 5/i);
    await sees(joyPage, '.hud__where', /2 of 5/i);
    if (await mark.locator('.curtain:not([hidden])').count()) throw new Error('the curtain is still up');
  });
  await check('the halves swap for the next round, with lives back to three', async () => {
    const second = await halves(mark, joyPage);
    if (second.lockName === first.lockName) throw new Error(`${second.lockName} has the lock again`);
    if ((await livesLeft(mark)) !== 3) throw new Error('lives were not reset');
  });
  let now = await halves(mark, joyPage);
  solved = await workOutCode(now.lock, now.key);
  await shot(now.lock, 'play-06-lock-level2');
  await shot(now.key, 'play-07-key-level2');
  await check('level 2 uses three shapes in three colours', async () => {
    if (solved.legendSize !== 9) throw new Error(`key card has ${solved.legendSize} symbols`);
    await fits(now.lock);
    await fits(now.key);
  });
  await check('reloading mid-puzzle picks up exactly where it was', async () => {
    await type(now.lock, solved.code.slice(0, 2));
    const before = await roleOf(joyPage);
    await joyPage.reload();
    await sees(joyPage, '.hud__where', /2 of 5/i);
    if ((await roleOf(joyPage)) !== before) throw new Error('Joy came back holding the other half');
    now = await halves(mark, joyPage);
    const again = await workOutCode(now.lock, now.key);
    if (again.code !== solved.code) throw new Error('the puzzle changed after reloading');
    const shown = before === 'lock' ? '.lock .slots' : '.mirror .slots';
    await sees(joyPage, shown, new RegExp(`^${solved.code[0]}\\s*${solved.code[1]}$`));
  });
  await check('closing the game and opening it again also comes straight back', async () => {
    await joyPage.close();
    await sees(mark, '.role__partner', /Joy stepped away/);
    joyPage = await joyPhone.open(invite);
    await sees(joyPage, '.hud__where', /2 of 5/i);
    await sees(mark, '.role__partner', /Joy has the/);
    now = await halves(mark, joyPage);
    await sees(now.lock, '.lock .slots', new RegExp(`^${solved.code[0]}\\s*${solved.code[1]}$`));
  });
  await check('a partner who looks away shows as stepped away', async () => {
    await setVisible(joyPage, false);
    await sees(mark, '.role__partner', /Joy stepped away/);
    await setVisible(joyPage, true);
    await sees(mark, '.role__partner', /Joy has the/);
  });
  await check('three wrong codes run out of lives on both phones', async () => {
    await now.lock.getByRole('button', { name: 'Delete' }).click();
    await now.lock.getByRole('button', { name: 'Delete' }).click();
    for (let i = 0; i < 3; i++) {
      await type(now.lock, wrongCode(solved.code));
      await tryIt(now.lock);
      await now.lock.waitForTimeout(250);
    }
    await sees(now.lock, '.curtain__title', /Out of lives/);
    await sees(now.key, '.curtain__title', /Out of lives/);
  });
  await shot(now.key, 'play-08-out-of-lives');
  await check('trying again deals a fresh puzzle with three lives', async () => {
    await now.key.getByRole('button', { name: 'Try again' }).click();
    await mark.waitForSelector('.curtain', { state: 'hidden', timeout: 4000 });
    await joyPage.waitForSelector('.curtain', { state: 'hidden', timeout: 4000 });
    if ((await livesLeft(mark)) !== 3 || (await livesLeft(joyPage)) !== 3) throw new Error('lives were not reset');
    const after = await halves(mark, joyPage);
    if (after.lockName !== now.lockName) throw new Error('the halves swapped on a retry');
    await sees(mark, '.hud__where', /2 of 5/i);
  });

  // Solves the puzzle on the table the way two people would, then moves on.
  async function solveAndMoveOn(n, expectations) {
    const table = await halves(mark, joyPage);
    const worked = await workOutCode(table.lock, table.key);
    await shot(table.lock, `play-lock-level${n}`);
    await shot(table.key, `play-key-level${n}`);
    await expectations(worked, table);
    await fits(table.lock);
    await fits(table.key);
    await type(table.lock, worked.code);
    await tryIt(table.lock);
    await sees(table.key, '.curtain__title', /Unlocked/);
    await sees(table.lock, '.curtain__sub', new RegExp(`Lock ${n} of 5`));
    return table;
  }

  await check('lock 2 opens with the worked-out code', () => solveAndMoveOn(2, async () => {}));

  console.log('\nLocks 3 to 5');
  await check('lock 3 uses mirror-image symbols and opens', async () => {
    await mark.getByRole('button', { name: 'Next lock' }).click();
    await sees(joyPage, '.hud__where', /3 of 5/i);
    await solveAndMoveOn(3, async (worked, table) => {
      if (worked.legendSize !== 8) throw new Error(`key card has ${worked.legendSize} symbols`);
      const ids = await table.key.locator('.legend__item').evaluateAll((items) => items.map((item) => item.dataset.symbol));
      if (!ids.some((id) => id.endsWith('-left')) || !ids.some((id) => id.endsWith('-right'))) throw new Error('no mirror images on the card');
    });
  });
  await check('lock 4 has a twist on the key card only, and opens', async () => {
    await joyPage.getByRole('button', { name: 'Next lock' }).click();
    await sees(mark, '.hud__where', /4 of 5/i);
    await solveAndMoveOn(4, async (worked, table) => {
      if (worked.rule === 'asRead') throw new Error('no twist on the key card');
      await sees(table.key, '.note', /One more thing:/);
      if (await table.lock.locator('.note').count()) throw new Error('the lock phone shows the twist');
    });
  });
  let last = null;
  await check('lock 5 has a lamp on the lock and lamp rules on the key card, and opens', async () => {
    await mark.getByRole('button', { name: 'Next lock' }).click();
    await sees(joyPage, '.hud__where', /5 of 5/i);
    last = await solveAndMoveOn(5, async (worked, table) => {
      if (!worked.lamp) throw new Error('no lamp on the lock');
      await sees(table.key, '.note', /Ask what colour the lamp is/);
      if ((await table.key.locator('.note__row').count()) !== 3) throw new Error('not three lamp rules');
      if (await table.key.locator('.lamp').count()) throw new Error('the key phone shows the lamp');
    });
  });

  console.log('\nFinishing');
  await check('the last lock offers Finish, and both phones see the result', async () => {
    await last.key.getByRole('button', { name: 'Finish' }).click();
    await sees(mark, '.curtain__title', /All 5 unlocked/);
    await sees(joyPage, '.curtain__title', /All 5 unlocked/);
    await sees(mark, '.tally', /\d+:\d\d\s+your time\s+2\s+hints used/i);
  });
  await shot(mark, 'play-09-finished');
  await check('the finished screen fits small and large iPhones', () => fits(joyPage));
  await check('going back to the room takes both phones there', async () => {
    await joyPage.getByRole('button', { name: 'Back to the room' }).click();
    await sees(mark, '.headline', /You are both here/);
    await sees(joyPage, '.headline', /You are both here/);
    if ((await readRoom(invite)).game) throw new Error('the finished run is still saved in the room');
  });

  console.log('\nStarting again and stopping');
  await check('both tapping Start at the same moment still makes one run', async () => {
    await Promise.all([
      mark.getByRole('button', { name: 'Start Five Locks' }).click(),
      joyPage.getByRole('button', { name: 'Start Five Locks' }).click(),
    ]);
    await sees(mark, '.hud__where', /1 of 5/i);
    await sees(joyPage, '.hud__where', /1 of 5/i);
    const roles = [await roleOf(mark), await roleOf(joyPage)].sort().join(',');
    if (roles !== 'key,lock') throw new Error(`roles are ${roles}`);
    const table = await halves(mark, joyPage);
    await workOutCode(table.lock, table.key); // throws if the two phones were dealt different puzzles
  });
  await check('stopping the run takes both phones back to the room', async () => {
    await joyPage.getByRole('button', { name: 'Stop' }).click();
    await sees(joyPage, '.sheet__title', /Stop this run/);
    await shot(joyPage, 'play-10-stop');
    await joyPage.getByRole('button', { name: 'Stop the run' }).click();
    await sees(mark, '.headline', /You are both here/);
    await sees(joyPage, '.headline', /You are both here/);
    if ((await readRoom(invite)).game) throw new Error('the stopped run is still saved in the room');
  });

  await finish();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
