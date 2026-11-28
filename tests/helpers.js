// Shared by the tests that play the game on pretend iPhones.
//
// Set SHOTS=/some/folder to save a screenshot of each screen, and SHOT_SCALE
// to choose how sharp they are.

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

// The page area Safari leaves on an iPhone 14, an iPhone SE (2nd/3rd gen), and the
// narrowest iPhone still around. Nothing should need scrolling on any of them.
const SIZES = [[390, 664], [375, 553], [320, 568]];

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
  await page.waitForTimeout(1300); // let entrance animations settle
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

// Pass { scroll: true } for a screen that is allowed to scroll down (the room, the last screen).
async function fits(page, { scroll = false } = {}) {
  const before = page.viewportSize();
  const tooBig = [];
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(120);
    const over = await page.evaluate(() => ({
      tall: document.documentElement.scrollHeight - window.innerHeight,
      wide: document.documentElement.scrollWidth - window.innerWidth,
    }));
    if ((over.tall > 0 && !scroll) || over.wide > 0) tooBig.push(`${width}x${height} overflows by ${over.tall} down, ${over.wide} across`);
  }
  await page.setViewportSize(before);
  if (tooBig.length) throw new Error(tooBig.join('; '));
}

function setVisible(page, visible) {
  return page.evaluate((state) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
  }, visible ? 'visible' : 'hidden');
}

// Opens the practice list in the room and starts one puzzle type.
async function startPractice(page, title) {
  await page.getByRole('button', { name: 'Practice a puzzle' }).click();
  await page.locator('.pick', { hasText: title }).getByRole('button', { name: 'Play' }).click();
}

// Which half of the puzzle a phone holds, and how many lives it shows.
const roleOf = (page) => page.locator('.board').getAttribute('data-role');
const livesLeft = (page) => page.locator('.life:not(.life--lost)').count();

// The two phones by the half each holds: { lock: page, key: page, holder: { lock: 'Mark', key: 'Joy' } }.
async function byHalf(mark, joy) {
  const markRole = await roleOf(mark);
  const joyRole = await roleOf(joy);
  if (!markRole || !joyRole || markRole === joyRole) throw new Error(`halves are ${markRole} and ${joyRole}`);
  return { [markRole]: mark, [joyRole]: joy, holder: { [markRole]: 'Mark', [joyRole]: 'Joy' } };
}

// Stops the run from the menu on one phone.
async function stopRun(page) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Stop this run' }).click();
  await page.getByRole('button', { name: 'Stop the run' }).click();
}

// What is saved for a room in the (local) database.
async function readRoom(invite) {
  const roomId = new URL(invite).searchParams.get('room');
  return (await fetch(`${EMULATOR}/rooms/${roomId}.json?ns=${NAMESPACE}`)).json();
}

// Starts the file server and a browser, and keeps score.
async function begin() {
  const server = await serveFiles();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const complaints = [];
  const problems = [];
  let passed = 0;

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

  // Two phones already in a room together: Mark made it, Joy joined.
  async function pairUp() {
    const markPhone = await newPhone('Mark');
    const mark = await markPhone.open(base);
    await mark.locator('.field').fill('Mark');
    await mark.getByRole('button', { name: 'Create our room' }).click();
    await sees(mark, '.headline', /Waiting for your other half/);
    const invite = mark.url();
    const joyPhone = await newPhone('Joy');
    const joy = await joyPhone.open(invite);
    await joy.locator('.field').fill('Joy');
    await joy.getByRole('button', { name: 'Join Mark' }).click();
    await sees(joy, '.headline', /You are both here/);
    await sees(mark, '.headline', /You are both here/);
    return { mark, joy, markPhone, joyPhone, invite };
  }

  async function finish() {
    await check('no errors were logged by any phone', async () => {
      if (complaints.length) throw new Error(complaints.join(' | '));
    });
    await browser.close();
    server.close();
    console.log(`\n${passed} passed, ${problems.length} failed`);
    if (problems.length) console.log(problems.map((label) => `  - ${label}`).join('\n'));
    process.exit(problems.length ? 1 : 0);
  }

  return { base, check, newPhone, pairUp, finish };
}

module.exports = { begin, sees, shot, fits, setVisible, readRoom, startPractice, roleOf, livesLeft, byHalf, stopRun, SHOTS };
