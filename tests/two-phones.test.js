// Plays the game on two pretend iPhones at once and checks they stay in step.
// Run with tests/run.sh, which starts a local database emulator first.
//
// Set SHOTS=/some/folder to save a screenshot of each screen.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const ROOT = path.join(__dirname, '..');
const EMULATOR = 'http://127.0.0.1:9000';
const NAMESPACE = 'demo-split-clues-default-rtdb';
const SHOTS = process.env.SHOTS || '';
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
};

let passed = 0;
const problems = [];

function serveFiles() {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function check(label, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok    ${label}`);
  } catch (error) {
    problems.push(label);
    console.log(`  FAIL  ${label}\n        ${String(error.message).split('\n')[0]}`);
  }
}

// Waits until the element's text matches, or fails with what it said instead.
async function sees(page, selector, pattern, timeout = 8000) {
  const target = page.locator(selector).first();
  const started = Date.now();
  let last = '(nothing)';
  while (Date.now() - started < timeout) {
    last = await target.innerText({ timeout: 500 }).catch(() => '(not on screen)');
    if (pattern.test(last)) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`${selector} said "${last}", wanted ${pattern}`);
}

async function shot(page, name) {
  if (!SHOTS) return;
  await page.waitForTimeout(900); // let entrance animations settle
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

function setVisible(page, visible) {
  return page.evaluate((state) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
  }, visible ? 'visible' : 'hidden');
}

// The page area Safari leaves on an iPhone 14, an iPhone SE (2nd/3rd gen), and the
// narrowest iPhone still around. Nothing should need scrolling on any of them.
const SIZES = [[390, 664], [375, 553], [320, 568]];

async function fits(page) {
  const before = page.viewportSize();
  const tooBig = [];
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(120);
    const over = await page.evaluate(() => ({
      tall: document.documentElement.scrollHeight - window.innerHeight,
      wide: document.documentElement.scrollWidth - window.innerWidth,
    }));
    if (over.tall > 0 || over.wide > 0) tooBig.push(`${width}x${height} overflows by ${over.tall} down, ${over.wide} across`);
  }
  await page.setViewportSize(before);
  if (tooBig.length) throw new Error(tooBig.join('; '));
}

(async () => {
  const server = await serveFiles();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const complaints = [];

  // A phone: its own storage, pointed at the emulator instead of the real database.
  async function newPhone(name, device = 'iPhone 14') {
    const context = await browser.newContext({
      ...devices[device],
      deviceScaleFactor: Number(process.env.SHOT_SCALE) || devices[device].deviceScaleFactor,
      serviceWorkers: 'block',
    });
    await context.route(/\/js\/config\.js(\?.*)?$/, (route) => route.fulfill({
      contentType: 'text/javascript',
      body: `export const DATABASE_URL = '${EMULATOR}/?ns=${NAMESPACE}';`,
    }));
    const open = async (url) => {
      const page = await context.newPage();
      page.on('pageerror', (error) => complaints.push(`${name}: ${error.message}`));
      page.on('console', (message) => {
        // The Firebase library listens for "unload", which Chromium grumbles about. Harmless.
        if (message.type() === 'error' && !/unload is not allowed/.test(message.text())) complaints.push(`${name}: ${message.text()}`);
      });
      await page.goto(url);
      return page;
    };
    return { context, open };
  }

  console.log('\nStarting a room');
  const markPhone = await newPhone('Mark');
  let mark = await markPhone.open(base);
  let invite = '';

  await check('title screen shows', () => sees(mark, '.title', /Split\s+Clues/));
  await shot(mark, '01-title');
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
  await shot(mark, '02-waiting');
  await check('waiting screen fits small and large iPhones', () => fits(mark));

  console.log('\nThe partner joins from the link');
  const joyPhone = await newPhone('Joy');
  let joy = await joyPhone.open(invite);

  await check('the link shows who invited', () => sees(joy, '.headline', /Mark invited you/));
  await shot(joy, '03-invited');
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
  await shot(mark, '04-together-mark');
  await check('room screen fits small and large iPhones', () => fits(joy));

  console.log('\nLive sync');
  await check('a wave from Mark shows on Joy\'s phone', async () => {
    await mark.getByRole('button', { name: 'Wave at Joy' }).click();
    await sees(joy, '.toast', /Mark waved/);
    await sees(mark, '.toast', /You waved at Joy/);
  });
  await shot(joy, '05-wave-joy');
  await check('a wave from Joy shows on Mark\'s phone', async () => {
    await joy.getByRole('button', { name: 'Wave at Mark' }).click();
    await sees(mark, '.toast', /Joy waved/);
  });

  console.log('\nLocking a phone and coming back');
  await check('Joy locking her phone shows as stepped away', async () => {
    await setVisible(joy, false);
    await sees(mark, '.headline', /Joy stepped away/);
    await sees(mark, '.who--b', /Joy\s+away/i);
  });
  await shot(mark, '06-away-mark');
  await check('stepped-away screen fits small and large iPhones', () => fits(mark));
  await check('unlocking brings her straight back', async () => {
    await setVisible(joy, true);
    await sees(mark, '.headline', /You are both here/);
  });
  await check('a dropped link reconnects on its own', async () => {
    await joy.evaluate(async () => (await import('./js/sync.js')).refreshConnection());
    await sees(mark, '.headline', /Joy stepped away/, 5000).catch(() => {}); // may be too quick to catch
    await sees(mark, '.headline', /You are both here/);
    await mark.waitForTimeout(1300); // the wave button rests briefly after each wave
    await mark.getByRole('button', { name: 'Wave at Joy' }).click();
    await sees(joy, '.toast', /Mark waved/);
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
  await check('an old wave is not replayed on reopening', async () => {
    await joy.waitForTimeout(600);
    if (await joy.locator('.toast').count()) throw new Error('a toast appeared');
  });

  console.log('\nA Home Screen icon (same room, empty memory)');
  const iconPhone = await newPhone('Joy (icon)');
  const icon = await iconPhone.open(invite);
  await check('it asks who is holding the phone', async () => {
    await sees(icon, '.headline', /Welcome back/);
    await sees(icon, '.card__title', /Who is holding this phone/);
  });
  await shot(icon, '07-who');
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
    await shot(page, '08-broken');
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
    await shot(mark, '09-leave-sheet');
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

  if (SHOTS) {
    const small = await newPhone('Joy (small phone)', 'iPhone SE');
    const page = await small.open(invite);
    await page.getByRole('button', { name: 'Joy' }).click();
    await sees(page, '.headline', /You are both here/);
    await shot(page, '10-together-se');
    await page.close();
  }

  console.log('\nWhat was saved');
  await check('the room in the database has the expected shape', async () => {
    const roomId = new URL(invite).searchParams.get('room');
    const read = async () => (await fetch(`${EMULATOR}/rooms/${roomId}.json?ns=${NAMESPACE}`)).json();
    let room = await read();
    // Marks from windows that just closed take a moment to clear.
    for (let i = 0; i < 20 && Object.keys(room.presence.b || {}).length > 1; i++) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      room = await read();
    }
    if (room.players.a.name !== 'Mark' || room.players.b.name !== 'Joy') throw new Error(JSON.stringify(room.players));
    if (typeof room.players.b.joinedAt !== 'number' || room.meta.v !== 1) throw new Error(JSON.stringify(room));
    const marks = { a: Object.keys(room.presence.a || {}).length, b: Object.keys(room.presence.b || {}).length };
    if (marks.a !== 1 || marks.b !== 1) throw new Error(`presence marks ${JSON.stringify(marks)}`);
    const keys = Object.keys(room).sort().join(',');
    if (keys !== 'meta,players,presence,wave') throw new Error(`keys: ${keys}`);
  });
  await check('no errors were logged by any phone', async () => {
    if (complaints.length) throw new Error(complaints.join(' | '));
  });

  await browser.close();
  server.close();

  console.log(`\n${passed} passed, ${problems.length} failed`);
  if (problems.length) {
    console.log(problems.map((label) => `  - ${label}`).join('\n'));
    process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
