// Plays the first story episode from start to finish on two pretend iPhones:
// leaving surprises, the introduction, the timer, all six clues, the last
// screen with each player's surprise, and the best time. Run with tests/run.sh.

const { begin, sees, shot, fits, readRoom } = require('./helpers');
const { solveCurrent } = require('./solvers');

const EMULATOR = 'http://127.0.0.1:9000';
const NAMESPACE = 'demo-split-clues-default-rtdb';
const CHAPTERS = ['The Garden Gate', 'The Marsh', 'The Signal Box', 'Two Windows', 'A Postcard', 'The Last Door'];

async function vault(invite, seat) {
  const roomId = new URL(invite).searchParams.get('room');
  return (await fetch(`${EMULATOR}/rooms/${roomId}-vault/together/${seat}.json?ns=${NAMESPACE}`)).json();
}

(async () => {
  const { check, pairUp, finish } = await begin();
  const { mark, joy, invite } = await pairUp();

  console.log('\nThe episode in the room');
  await check('the room shows the episode with its length', async () => {
    await sees(mark, '.story', /Episode 1\s+Find Your Way Back/i);
    await sees(mark, '.story__meta', /6 clues · about 25 minutes/);
    await sees(joy, '.story', /Find Your Way Back/);
  });
  await shot(mark, 'story-01-room');
  await check('the room is never wider than the phone', async () => fits(mark, { scroll: true }));

  console.log('\nLeaving surprises');
  // A big picture, to check photos are shrunk before they are saved.
  const easel = await mark.context().newPage();
  await easel.setViewportSize({ width: 1600, height: 1200 });
  await easel.setContent('<body style="margin:0;height:100vh;display:grid;place-items:center;background:linear-gradient(45deg,#e5646e,#6fa8ea)"><h1 style="font:240px Georgia;color:#fff">us</h1></body>');
  const photo = await easel.screenshot({ type: 'png' });
  await easel.close();

  await check('Mark writes a note and adds a photo', async () => {
    await mark.getByRole('button', { name: 'Leave a surprise for Joy' }).click();
    await sees(mark, '.sheet__title', /A surprise for Joy/);
    await sees(mark, '.surprise', /Joy sees this only on the last screen/);
    await mark.locator('.field--area').fill('Three more weeks.\nI miss you.');
    await mark.locator('.surprise input[type=file]').setInputFiles({ name: 'us.png', mimeType: 'image/png', buffer: photo });
    await mark.waitForSelector('.surprise__preview:not([hidden])', { timeout: 10000 });
    await shot(mark, 'story-02-surprise');
    await mark.getByRole('button', { name: 'Save the surprise' }).click();
    await sees(mark, '.toast', /Tucked away for the finish/);
    await sees(mark, '.story__surprise', /Your surprise for Joy is tucked away/);
  });
  await check('the photo was shrunk to a small JPEG before saving', async () => {
    const saved = await vault(invite, 'a');
    if (saved.note.text !== 'Three more weeks.\nI miss you.' || saved.note.hasPhoto !== true) throw new Error(JSON.stringify(saved.note));
    if (!saved.photo.startsWith('data:image/jpeg;base64,')) throw new Error(`photo starts ${saved.photo.slice(0, 30)}`);
    if (saved.photo.length > 450000) throw new Error(`photo is ${saved.photo.length} characters`);
    const size = await mark.evaluate((address) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
      img.src = address;
    }), saved.photo);
    if (Math.max(...size) > 1200 || Math.min(...size) < 300) throw new Error(`photo is ${size.join(' x ')}`);
  });
  await check('nothing about it reaches Joy\'s phone or the room itself', async () => {
    await sees(joy, '.story__surprise', /^Leave a surprise for Mark$/);
    const room = JSON.stringify(await readRoom(invite));
    if (room.includes('Three more weeks') || room.includes('data:image')) throw new Error('the surprise is stored inside the room');
    if (await joy.evaluate(() => document.documentElement.innerHTML.includes('Three more weeks'))) throw new Error('Joy\'s page contains the note');
  });
  await check('Joy leaves a note without a photo, and can reopen it', async () => {
    await joy.getByRole('button', { name: 'Leave a surprise for Mark' }).click();
    await joy.getByRole('button', { name: 'Save the surprise' }).click();
    await sees(joy, '.toast', /Write a note or add a photo first/);
    await joy.locator('.field--area').fill('Look behind the couch cushion.');
    await joy.getByRole('button', { name: 'Save the surprise' }).click();
    await sees(joy, '.story__surprise', /Your surprise for Mark is tucked away/);
    await joy.getByRole('button', { name: /Your surprise for Mark/ }).click();
    await sees(joy, '.sheet__title', /A surprise for Mark/);
    if ((await joy.locator('.field--area').inputValue()) !== 'Look behind the couch cushion.') throw new Error('the saved note was not shown');
    await joy.getByRole('button', { name: 'Cancel' }).click();
    await joy.waitForSelector('.overlay', { state: 'detached' });
  });
  await check('a surprise is remembered after reloading', async () => {
    await mark.reload();
    await sees(mark, '.story__surprise', /Your surprise for Joy is tucked away/);
  });

  console.log('\nStarting the episode');
  await check('Play opens the introduction on both phones', async () => {
    await joy.locator('.story').getByRole('button', { name: 'Play' }).click();
    for (const page of [mark, joy]) {
      await sees(page, '.curtain__title', /Find Your Way Back/);
      await sees(page, '.curtain__story', /The storm came down fast/);
    }
  });
  await shot(joy, 'story-03-intro');
  await check('the introduction fits, scrolling if it must', async () => fits(mark, { scroll: true }));
  await check('either player taps Begin and both land on the first chapter', async () => {
    await mark.getByRole('button', { name: 'Begin' }).click();
    await sees(mark, '.hud__where', /The Garden Gate · 1 of 6/i);
    await sees(joy, '.hud__where', /The Garden Gate · 1 of 6/i);
  });
  await check('both phones show a running timer', async () => {
    await sees(mark, '.hud__timer', /^\d+:\d\d$/);
    await sees(joy, '.hud__timer', /^\d+:\d\d$/);
  });
  await check('the timer can be hidden on one phone without touching the other', async () => {
    await mark.getByRole('button', { name: 'Menu' }).click();
    await mark.getByRole('button', { name: 'Hide the timer' }).click();
    await mark.waitForFunction(() => document.querySelector('.hud__timer').textContent === '', null, { timeout: 3000 });
    await sees(joy, '.hud__timer', /^\d+:\d\d$/);
    await mark.reload();
    await sees(mark, '.hud__where', /The Garden Gate/i);
    await mark.waitForTimeout(1200);
    if ((await mark.locator('.hud__timer').innerText()) !== '') throw new Error('the choice was not remembered');
    await mark.getByRole('button', { name: 'Menu' }).click();
    await mark.getByRole('button', { name: 'Show the timer' }).click();
    await sees(mark, '.hud__timer', /^\d+:\d\d$/);
  });

  console.log('\nSix chapters');
  const types = [];
  for (let n = 0; n < CHAPTERS.length; n++) {
    await check(`chapter ${n + 1}, ${CHAPTERS[n]}, can be solved`, async () => {
      await sees(mark, '.hud__where', new RegExp(`${CHAPTERS[n]} · ${n + 1} of 6`, 'i'));
      await sees(joy, '.hud__where', new RegExp(`${CHAPTERS[n]} · ${n + 1} of 6`, 'i'));
      types.push(await solveCurrent(mark, joy));
      if (n === 0) {
        await sees(mark, '.curtain__story', /The gate clicks open/);
        await sees(joy, '.curtain__story', /The gate clicks open/);
        await shot(mark, 'story-04-chapter-solved');
      }
      await (n % 2 ? mark : joy).getByRole('button', { name: n === CHAPTERS.length - 1 ? 'Finish' : 'Next clue' }).click();
    });
  }
  await check('the episode mixes all five kinds of puzzle', async () => {
    if (types.join(',') !== 'codelock,map,wires,spot,draw,codelock') throw new Error(types.join(','));
  });

  console.log('\nThe last screen');
  await check('both phones reach the ending, with the locket whole again', async () => {
    for (const page of [mark, joy]) {
      await sees(page, '.curtain__title', /You found each other/);
      await page.waitForSelector('.curtain__locket[data-joined="true"]', { timeout: 4000 });
      await sees(page, '.tally', /\d+:\d\d\s+your time/i);
      await sees(page, '.finale__best', /A new best time/);
    }
  });
  await check('Mark sees what Joy left, and Joy sees Mark\'s note and photo', async () => {
    await sees(mark, '.gift', /Joy left you something\s+Look behind the couch cushion\./i);
    if (await mark.locator('.gift__photo:not([hidden])').count()) throw new Error('Mark sees a photo Joy never added');
    await sees(joy, '.gift', /Mark left you something\s+Three more weeks\.\s+I miss you\./i);
    await joy.waitForSelector('.gift__photo:not([hidden])', { timeout: 8000 });
    if (!(await joy.locator('.gift__photo').getAttribute('src')).startsWith('data:image/jpeg')) throw new Error('the photo did not arrive');
    if (await mark.evaluate(() => document.documentElement.innerHTML.includes('Three more weeks'))) throw new Error('Mark\'s own note is shown to Mark');
  });
  await joy.waitForTimeout(1200);
  await shot(joy, 'story-05-ending');
  await check('the last screen is never wider than the phone', async () => {
    await fits(joy, { scroll: true });
    await fits(mark, { scroll: true });
  });

  console.log('\nBack in the room');
  await check('the best time is kept and shown on the episode', async () => {
    await mark.getByRole('button', { name: 'Back to the room' }).click();
    await sees(mark, '.story__meta', /Best time \d+:\d\d/);
    await sees(joy, '.story__meta', /Best time \d+:\d\d/);
    const room = await readRoom(invite);
    if (room.game) throw new Error('the finished run is still saved in the room');
    if (!(room.best.together.ms > 0)) throw new Error(JSON.stringify(room.best));
  });
  await check('a surprise can be taken back', async () => {
    await mark.getByRole('button', { name: /Your surprise for Joy/ }).click();
    await mark.getByRole('button', { name: 'Take it back' }).click();
    await sees(mark, '.story__surprise', /^Leave a surprise for Joy$/);
    if ((await vault(invite, 'a')) !== null) throw new Error('the surprise is still stored');
    if ((await vault(invite, 'b')).note.text !== 'Look behind the couch cushion.') throw new Error('Joy\'s surprise was touched');
  });

  await finish();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
