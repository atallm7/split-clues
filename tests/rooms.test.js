// Rooms: making one, joining from the link, remembering who you are, and
// coming back after a lock or a lost connection.
// Run with tests/run.sh, which starts a local database emulator first.

const { begin, sees, shot, fits, setVisible, readRoom } = require('./helpers');

(async () => {
  const { base, check, newPhone, finish } = await begin();

  console.log('\nStarting a room');
  const markPhone = await newPhone('Mark');
  const mark = await markPhone.open(base);
  let invite = '';

  await check('title screen shows', () => sees(mark, '.title', /Split\s+Clues/));
  await shot(mark, 'rooms-01-title');
  await check('title screen fits small and large iPhones', () => fits(mark));
  await check('an empty name is refused', async () => {
    await mark.getByRole('button', { name: 'Create our room' }).click();
    await mark.waitForSelector('.field.is-nudged', { timeout: 2000 });
    if (new URL(mark.url()).searchParams.get('room')) throw new Error('a room was made anyway');
  });
  await check('creating a room lands in it', async () => {
    await mark.locator('.field').fill('  Mark  ');
    await mark.getByRole('button', { name: 'Create our room' }).click();
    await sees(mark, '.headline', /Waiting for your other half/);
    invite = mark.url();
    if (!/\?room=[a-z0-9]{20}$/.test(invite)) throw new Error(`address is ${invite}`);
  });
  await check('the empty seat is shown as not here yet', async () => {
    await sees(mark, '.who--a', /Mark\s+you/i);
    await sees(mark, '.who--b', /Your partner\s+not here yet/i);
  });
  await shot(mark, 'rooms-02-waiting');
  await check('waiting screen fits small and large iPhones', () => fits(mark));

  console.log('\nThe partner joins from the link');
  const joyPhone = await newPhone('Joy');
  let joy = await joyPhone.open(invite);

  await check('the link shows who invited', () => sees(joy, '.headline', /Mark invited you/));
  await shot(joy, 'rooms-03-invited');
  await check('join screen fits small and large iPhones', () => fits(joy));
  await check('joining puts both phones in the room together', async () => {
    await joy.locator('.field').fill('Joy');
    await joy.getByRole('button', { name: 'Join Mark' }).click();
    await sees(joy, '.headline', /You are both here/);
    await sees(mark, '.headline', /You are both here/);
    await sees(mark, '.who--b', /Joy\s+here/i);
    await sees(joy, '.who--a', /Mark\s+here/i);
    await sees(joy, '.who--b', /Joy\s+you/i);
  });
  await check('the locket closes on both phones', async () => {
    for (const page of [mark, joy]) {
      await page.waitForSelector('.pair__locket[data-joined="true"]', { timeout: 3000 });
    }
  });
  await shot(mark, 'rooms-04-together');
  await check('room screen is never wider than the phone', () => fits(joy, { scroll: true }));

  console.log('\nSmall comforts');
  await check('an iPhone in Safari gets a one-time tip about the Home Screen', async () => {
    await sees(joy, '.tip', /Add to Home Screen/);
    await joy.locator('.tip').getByRole('button', { name: 'Got it' }).click();
    if (await joy.locator('.tip').count()) throw new Error('the tip is still showing');
    await joy.reload();
    await sees(joy, '.headline', /You are both here/);
    if (await joy.locator('.tip').count()) throw new Error('the tip came back after reloading');
  });
  await check('sound is off until someone turns it on, and the choice is remembered', async () => {
    await sees(joy, '.actions__row', /Sound: off/);
    await joy.getByRole('button', { name: 'Sound: off' }).click();
    await sees(joy, '.actions__row', /Sound: on/);
    await sees(mark, '.actions__row', /Sound: off/); // each phone has its own switch
    await joy.reload();
    await sees(joy, '.actions__row', /Sound: on/);
    await joy.getByRole('button', { name: 'Sound: on' }).click();
    await sees(joy, '.actions__row', /Sound: off/);
  });

  console.log('\nLocking a phone and coming back');
  await check('Joy locking her phone shows as stepped away', async () => {
    await setVisible(joy, false);
    await sees(mark, '.headline', /Joy stepped away/);
    await sees(mark, '.who--b', /Joy\s+away/i);
  });
  await shot(mark, 'rooms-05-away');
  await check('stepped-away screen is never wider than the phone', () => fits(mark, { scroll: true }));
  await check('unlocking brings her straight back', async () => {
    await setVisible(joy, true);
    await sees(mark, '.headline', /You are both here/);
  });
  await check('a dropped link reconnects on its own', async () => {
    await joy.evaluate(async () => (await import('./js/sync.js')).refreshConnection());
    await sees(mark, '.headline', /Joy stepped away/, 5000).catch(() => {}); // may be too quick to catch
    await sees(mark, '.headline', /You are both here/);
  });
  await check('closing the game entirely shows as stepped away', async () => {
    await joy.close();
    await sees(mark, '.headline', /Joy stepped away/);
  });
  await check('opening the plain address goes straight back into the room', async () => {
    joy = await joyPhone.open(base);
    await sees(joy, '.headline', /You are both here/);
    await sees(joy, '.who--b', /Joy\s+you/i);
    if (joy.url() !== invite) throw new Error(`address is ${joy.url()}`);
    await sees(mark, '.headline', /You are both here/);
  });

  console.log('\nA Home Screen icon (same room, empty memory)');
  const iconPhone = await newPhone('Joy (icon)');
  const icon = await iconPhone.open(invite);
  await check('it asks who is holding the phone', async () => {
    await sees(icon, '.headline', /Welcome back/);
    await sees(icon, '.card__title', /Who is holding this phone/);
  });
  await shot(icon, 'rooms-06-who');
  await check('who-are-you screen fits small and large iPhones', () => fits(icon));
  await check('choosing a name goes into the room as that player', async () => {
    await icon.getByRole('button', { name: 'Joy' }).click();
    await sees(icon, '.headline', /You are both here/);
    await sees(icon, '.who--b', /Joy\s+you/i);
  });
  await check('closing one of Joy\'s two windows keeps her here', async () => {
    await icon.close();
    await mark.waitForTimeout(1200);
    await sees(mark, '.headline', /You are both here/);
  });

  console.log('\nBad links');
  const stranger = await newPhone('Stranger');
  await check('a mangled link is explained', async () => {
    const page = await stranger.open(`${base}?room=oops`);
    await sees(page, '.headline', /This room link does not work/);
    await shot(page, 'rooms-07-broken');
    await fits(page);
    await page.close();
  });
  await check('a link to a room that does not exist is explained', async () => {
    const page = await stranger.open(`${base}?room=${'z'.repeat(20)}`);
    await sees(page, '.headline', /This room link does not work/);
    await page.getByRole('button', { name: 'Start a new room' }).click();
    await sees(page, '.screen--title .btn--primary', /Create our room/);
    if (new URL(page.url()).searchParams.get('room')) throw new Error('room still in the address');
    await page.close();
  });

  console.log('\nLeaving and coming back');
  await check('leaving forgets the room on that phone only', async () => {
    await mark.getByRole('button', { name: 'Leave room' }).click();
    await shot(mark, 'rooms-08-leave');
    await mark.locator('.sheet').getByRole('button', { name: 'Leave room' }).click();
    await sees(mark, '.screen--title .btn--primary', /Create our room/);
    if (new URL(mark.url()).searchParams.get('room')) throw new Error('room still in the address');
    await sees(joy, '.headline', /Mark stepped away/);
    await mark.reload();
    await sees(mark, '.screen--title .btn--primary', /Create our room/);
    if ((await mark.locator('.field').inputValue()) !== 'Mark') throw new Error('name was not remembered');
  });
  await check('the invite link brings Mark back as himself', async () => {
    await mark.goto(invite);
    await sees(mark, '.card__title', /Who is holding this phone/);
    await mark.getByRole('button', { name: 'Mark' }).click();
    await sees(mark, '.headline', /You are both here/);
    await sees(mark, '.who--a', /Mark\s+you/i);
    await sees(joy, '.headline', /You are both here/);
  });

  console.log('\nWhat was saved');
  await check('the room in the database has the expected shape', async () => {
    let room = await readRoom(invite);
    // Marks from windows that just closed take a moment to clear.
    for (let i = 0; i < 20 && Object.keys(room.presence.b || {}).length > 1; i++) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      room = await readRoom(invite);
    }
    if (room.players.a.name !== 'Mark' || room.players.b.name !== 'Joy') throw new Error(JSON.stringify(room.players));
    if (typeof room.players.b.joinedAt !== 'number' || room.meta.v !== 1) throw new Error(JSON.stringify(room));
    const marks = { a: Object.keys(room.presence.a || {}).length, b: Object.keys(room.presence.b || {}).length };
    if (marks.a !== 1 || marks.b !== 1) throw new Error(`presence marks ${JSON.stringify(marks)}`);
    const keys = Object.keys(room).sort().join(',');
    if (keys !== 'meta,players,presence') throw new Error(`keys: ${keys}`);
  });

  await finish();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
