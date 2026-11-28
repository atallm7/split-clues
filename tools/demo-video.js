// Records a captioned demo of Split Clues: two phones side by side playing
// Episode 1 from the first tap to the last screen, against a local copy of the
// database (the Firebase emulator). Writes an MP4 that plays on an iPhone.
//
// Run from the project folder:
//   firebase emulators:exec --config tests/firebase.json --only database \
//     --project demo-split-clues "node tools/demo-video.js /path/to/demo.mp4"
//
// DEMO_SPEED=0.1 runs it ten times faster, and NO_VIDEO=1 skips the recording,
// which is handy for checking the script still works.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(process.argv[2] || 'split-clues-demo.mp4');
const RAW = OUT.replace(/\.mp4$/, '') + '.capture.mp4';
const EMULATOR = 'http://127.0.0.1:9000/?ns=demo-split-clues-default-rtdb';
const SPEED = Number(process.env.DEMO_SPEED || 1);
const VIDEO = !process.env.NO_VIDEO;
const FPS = 30;
const SCALE = 1.5;
const STAGE = { width: 960, height: 1056 };
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
};

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms * SPEED));
const log = (text) => console.log(`[demo] ${text}`);

// ---------- The stage: two phones, labels, and a caption ----------

const STAGE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Split Clues demo</title>
<style>
  @font-face { font-family: Fraunces; src: url(/fonts/fraunces-latin-soft-normal.woff2) format('woff2'); font-weight: 100 900; }
  html, body { margin: 0; height: 100%; overflow: hidden; color: #f3e9da; font-family: -apple-system, system-ui, 'Segoe UI', sans-serif; }
  body { background: radial-gradient(120% 70% at 50% 0%, #3b3159 0%, #1d1930 50%, #15121f 100%); }
  .stage { width: ${STAGE.width}px; height: ${STAGE.height}px; display: flex; flex-direction: column; align-items: center; padding-top: 22px; box-sizing: border-box; }
  header { display: flex; align-items: baseline; gap: 14px; height: 44px; }
  .word { font-family: Fraunces; font-variation-settings: 'SOFT' 100; font-weight: 600; font-size: 31px; }
  .word .a { color: #f4b860; } .word .b { color: #ef9a9a; }
  .tag { color: #b5a8c6; font-size: 13px; font-weight: 700; letter-spacing: .24em; text-transform: uppercase; }
  .phones { display: flex; gap: 56px; margin-top: 10px; }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  figcaption { font-size: 14px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
  .label-a { color: #f4b860; } .label-b { color: #ef9a9a; }
  .phone { padding: 13px; border-radius: 58px; background: #0b0910; box-shadow: 0 0 0 2px #3a3350, 0 30px 60px rgba(0,0,0,.55); }
  .screen { position: relative; width: 390px; height: 760px; border-radius: 46px; overflow: hidden; background: #15121f; }
  iframe { display: block; width: 390px; height: 760px; border: 0; }
  .text { position: absolute; top: 14px; left: 12px; right: 12px; padding: 14px 16px; border-radius: 20px;
    background: rgba(247,236,216,.97); color: #2a2033; box-shadow: 0 14px 30px rgba(0,0,0,.45);
    transform: translateY(-140%); transition: transform .45s cubic-bezier(.2,.9,.3,1.1); }
  .text.is-in { transform: none; }
  .text__from { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #6a5c72; }
  .text__body { margin: 6px 0 8px; font-size: 16px; font-weight: 600; }
  .text__link { margin: 0; display: inline-block; padding: 8px 12px; border-radius: 12px; background: #2a2033; color: #f7ecd8; font-size: 14px; font-weight: 700; cursor: pointer; }
  .caption { width: 860px; margin-top: 22px; min-height: 104px; text-align: center; transition: opacity .35s ease; }
  .caption.is-fading { opacity: 0; }
  .caption h2 { margin: 0; font-family: Fraunces; font-variation-settings: 'SOFT' 100; font-weight: 600; font-size: 28px; }
  .caption p { margin: 8px auto 0; max-width: 780px; color: #c9bfd6; font-size: 18px; line-height: 1.42; }
  .endcard { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
    background: radial-gradient(90% 60% at 50% 40%, #3b3159 0%, #1d1930 55%, #15121f 100%); opacity: 0; transition: opacity .8s ease; pointer-events: none; }
  .endcard.is-in { opacity: 1; }
  .endcard .word { font-size: 72px; }
  .endcard p { margin: 0; color: #c9bfd6; font-size: 20px; }
</style></head>
<body><div class="stage">
  <header><span class="word"><span class="a">Split</span> <span class="b">Clues</span></span><span class="tag">a demo on two phones</span></header>
  <div class="phones">
    <figure><figcaption class="label-a">Mark's phone</figcaption><div class="phone"><div class="screen"><iframe name="mark" allow="clipboard-write"></iframe></div></div></figure>
    <figure><figcaption class="label-b">Joy's phone</figcaption><div class="phone"><div class="screen">
      <iframe name="joy" allow="clipboard-write"></iframe>
      <div class="text" id="text"><p class="text__from">Text message · Mark</p><p class="text__body">Come play Split Clues with me tonight!</p><p class="text__link" id="invite-link">atallm7.github.io/split-clues</p></div>
    </div></div></figure>
  </div>
  <div class="caption" id="caption"><h2></h2><p></p></div>
</div>
<div class="endcard" id="endcard"><span class="word"><span class="a">Split</span> <span class="b">Clues</span></span><p>Made for Mark and Joy</p></div>
<script>
  window.caption = (title, text) => new Promise((resolve) => {
    const box = document.getElementById('caption');
    box.classList.add('is-fading');
    setTimeout(() => {
      box.querySelector('h2').textContent = title;
      box.querySelector('p').textContent = text || '';
      box.classList.remove('is-fading');
      resolve();
    }, 350);
  });
</script>
</body></html>`;

// A soft circle wherever a finger "taps", inside the phones and on the stage.
function showTaps() {
  document.addEventListener('pointerdown', (event) => {
    const dot = document.createElement('div');
    dot.style.cssText = `position:fixed;left:${event.clientX - 22}px;top:${event.clientY - 22}px;width:44px;height:44px;border-radius:50%;`
      + 'background:rgba(255,255,255,.45);box-shadow:0 0 0 2px rgba(255,255,255,.85);pointer-events:none;z-index:2147483647';
    (document.body || document.documentElement).appendChild(dot);
    dot.animate([{ transform: 'scale(.5)', opacity: 1 }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 650, easing: 'ease-out' }).onfinish = () => dot.remove();
  }, true);
}

function serve(port = 0) {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (pathname === '/__stage.html') return res.writeHead(200, { 'Content-Type': 'text/html' }).end(STAGE_HTML);
    const file = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end('not found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

// ---------- Recording ----------

// Takes the frames Chromium paints and feeds them to ffmpeg at a steady 30 a second,
// repeating the last frame whenever the screen has not changed.
async function startRecording(context, page) {
  const encoder = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', RAW], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => encoder.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))));
  const cdp = await context.newCDPSession(page);
  let started = null;
  let last = null;
  let written = 0;
  const fill = (until) => {
    const due = Math.floor((until - started) * FPS);
    while (last && written < due) {
      encoder.stdin.write(last);
      written += 1;
    }
  };
  cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
    const now = performance.now() / 1000;
    if (started === null) started = now;
    fill(now);
    last = Buffer.from(data, 'base64');
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: STAGE.width * SCALE, maxHeight: STAGE.height * SCALE });
  return async () => {
    await cdp.send('Page.stopScreencast').catch(() => {});
    fill(performance.now() / 1000);
    encoder.stdin.end();
    await done;
    log(`captured ${written} frames (${(written / FPS).toFixed(1)} s)`);
  };
}

// ---------- Reading each phone (the same way a person would) ----------

const TWISTS = {
  asRead: (d) => d,
  reverse: (d) => [d[3], d[2], d[1], d[0]],
  plusOne: (d) => d.map((n) => (n === 9 ? 0 : n + 1)),
  swapEnds: (d) => [d[3], d[1], d[2], d[0]],
};

// How a person would say a symbol out loud: "orange cloud", "white moon facing left".
const SAY_COLOR = { amber: 'orange', rose: 'pink', teal: 'green', cream: 'white' };
function sayable(id) {
  const [shape, color, side] = id.split('-');
  return `${SAY_COLOR[color] || color} ${shape}${side === 'left' ? ' facing left' : ''}`;
}

// "Two east, then three south" from a list of steps.
const NUMBER = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
function directions(steps) {
  const runs = [];
  for (const step of steps) {
    if (runs.length && runs[runs.length - 1].step === step) runs[runs.length - 1].count += 1;
    else runs.push({ step, count: 1 });
  }
  const words = runs.slice(0, 2).map((run) => `${NUMBER[run.count] || run.count} ${run.step}`);
  const text = words.join(', then ');
  return text[0].toUpperCase() + text.slice(1) + (runs.length > 2 ? '…' : '');
}

async function lockCode(lock, key) {
  const symbols = await lock.locator('.lock .tiles .tile').evaluateAll((tiles) => tiles.map((tile) => tile.dataset.symbol));
  const lamp = (await lock.locator('.lamp').count()) ? await lock.locator('.lamp').getAttribute('data-lamp') : null;
  const legend = Object.fromEntries(await key.locator('.legend__item').evaluateAll((items) => items.map((item) => [item.dataset.symbol, Number(item.dataset.digit)])));
  let rule = 'asRead';
  if (await key.locator('.note[data-note="rule"]').count()) rule = await key.locator('.note').getAttribute('data-rule');
  if (await key.locator('.note[data-note="lamp"]').count()) rule = await key.locator(`.note__row[data-lamp="${lamp}"]`).getAttribute('data-rule');
  return { code: TWISTS[rule](symbols.map((id) => legend[id])).join(''), lamp, first: sayable(symbols[0]), firstDigit: legend[symbols[0]] };
}

async function wireToCut(wiresPhone, rulebookPhone) {
  const panel = {
    wires: await wiresPhone.locator('.panel .wire').evaluateAll((rows) => rows.map((row) => ({ color: row.dataset.color, striped: row.dataset.striped === 'true' }))),
    lamp: (await wiresPhone.locator('.bulb').count()) ? (await wiresPhone.locator('.bulb').getAttribute('data-lamp')) === 'true' : null,
    plate: (await wiresPhone.locator('.plate').count()) ? Number(await wiresPhone.locator('.plate').getAttribute('data-plate')) : null,
  };
  const rules = await rulebookPhone.locator('.rule').evaluateAll((lines) => lines.map((line) => ({
    kind: line.dataset.kind,
    color: line.dataset.color || null,
    value: line.dataset.value === undefined ? null : line.dataset.value === 'true',
    action: line.dataset.action,
    n: line.dataset.actionN === undefined ? null : Number(line.dataset.actionN),
    actionColor: line.dataset.actionColor || null,
  })));
  const colors = panel.wires.map((wire) => wire.color);
  const count = (color) => colors.filter((c) => c === color).length;
  const isTrue = (rule) => ({
    otherwise: () => true,
    none: () => count(rule.color) === 0,
    one: () => count(rule.color) === 1,
    many: () => count(rule.color) >= 2,
    top: () => colors[0] === rule.color,
    bottom: () => colors[colors.length - 1] === rule.color,
    striped: () => panel.wires.some((wire) => wire.striped) === rule.value,
    lamp: () => panel.lamp === rule.value,
    plate: () => (panel.plate % 2 === 1) === rule.value,
  }[rule.kind]());
  const line = rules.findIndex(isTrue);
  const rule = rules[line];
  let cut = panel.wires.findIndex((wire) => wire.striped);
  if (rule.action === 'nth') cut = rule.n;
  if (rule.action === 'firstOf') cut = colors.indexOf(rule.actionColor);
  if (rule.action === 'lastOf') cut = colors.lastIndexOf(rule.actionColor);
  return { cut, line };
}

const SIDES = ['up', 'right', 'down', 'left'];
const COMPASS = ['north', 'east', 'south', 'west'];
const SHIFT = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const at = (cell) => `${cell.x},${cell.y}`;

async function mapRoute(mapPhone) {
  const cells = await mapPhone.locator('.map--full .map__cell').evaluateAll((all) => all.map((cell) => ({ x: Number(cell.dataset.x), y: Number(cell.dataset.y), kind: cell.dataset.kind || '' })));
  const size = Math.sqrt(cells.length);
  const north = await mapPhone.locator('.rose').getAttribute('data-north');
  const treasure = cells.find((cell) => cell.kind === 'treasure');
  const blocked = new Set(cells.filter((cell) => cell.kind === 'bog').map(at));
  const from = await mapPhone.locator('.map--full .map__pin').evaluate((el) => ({ x: Number(el.dataset.x), y: Number(el.dataset.y) }));
  const cameFrom = new Map([[at(from), null]]);
  const queue = [from];
  while (queue.length) {
    const here = queue.shift();
    if (at(here) === at(treasure)) {
      const steps = [];
      for (let k = at(here); cameFrom.get(k); k = cameFrom.get(k).from) steps.unshift(cameFrom.get(k).side);
      return steps.map((side) => COMPASS[(SIDES.indexOf(side) - SIDES.indexOf(north) + 4) % 4]);
    }
    for (const side of SIDES) {
      const next = { x: here.x + SHIFT[side][0], y: here.y + SHIFT[side][1] };
      if (next.x < 0 || next.y < 0 || next.x >= size || next.y >= size || blocked.has(at(next)) || cameFrom.has(at(next))) continue;
      cameFrom.set(at(next), { from: at(here), side });
      queue.push(next);
    }
  }
  throw new Error('no route');
}

// ---------- Rough sketches for Describe and Draw (fractions of the page) ----------

const ring = (cx, cy, rx, ry, n = 26) => Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.cos((i / n) * Math.PI * 2), cy + ry * Math.sin((i / n) * Math.PI * 2)]);
const dot = (x, y) => [[x, y]];
const SKETCHES = {
  cat: [
    ['yellow', ring(0.2, 0.18, 0.07, 0.07)],
    ['yellow', ring(0.5, 0.58, 0.25, 0.24)],
    ['yellow', [[0.31, 0.44], [0.33, 0.2], [0.46, 0.35]]],
    ['yellow', [[0.54, 0.35], [0.67, 0.2], [0.69, 0.44]]],
    ['ink', dot(0.41, 0.53)], ['ink', dot(0.59, 0.53)],
    ['red', [[0.47, 0.61], [0.53, 0.61], [0.5, 0.65], [0.47, 0.61]]],
    ['ink', [[0.18, 0.6], [0.37, 0.63]]], ['ink', [[0.18, 0.69], [0.37, 0.67]]],
    ['ink', [[0.82, 0.6], [0.63, 0.63]]], ['ink', [[0.82, 0.69], [0.63, 0.67]]],
  ],
  rocket: [
    ['ink', [[0.5, 0.1], [0.6, 0.26], [0.62, 0.62], [0.38, 0.62], [0.4, 0.26], [0.5, 0.1]]],
    ['blue', ring(0.5, 0.37, 0.07, 0.07)],
    ['red', [[0.39, 0.5], [0.26, 0.71], [0.39, 0.68]]],
    ['red', [[0.61, 0.5], [0.74, 0.71], [0.61, 0.68]]],
    ['yellow', [[0.43, 0.65], [0.5, 0.87], [0.57, 0.65]]],
    ['yellow', [[0.15, 0.24], [0.23, 0.24]]], ['yellow', [[0.19, 0.2], [0.19, 0.28]]],
    ['yellow', ring(0.8, 0.22, 0.07, 0.07)],
  ],
  tree: [
    ['ink', [[0.37, 0.88], [0.37, 0.6], [0.46, 0.6], [0.46, 0.88]]],
    ['green', ring(0.42, 0.42, 0.22, 0.22)],
    ['red', dot(0.33, 0.38)], ['red', dot(0.49, 0.33)], ['red', dot(0.43, 0.51)],
    ['green', [[0.06, 0.88], [0.94, 0.88]]],
    ['ink', ring(0.79, 0.2, 0.11, 0.06)],
  ],
  fish: [
    ['red', ring(0.56, 0.52, 0.25, 0.15)],
    ['red', [[0.31, 0.52], [0.16, 0.38], [0.16, 0.66], [0.31, 0.52]]],
    ['ink', dot(0.69, 0.48)],
    ['blue', ring(0.86, 0.3, 0.03, 0.03, 12)], ['blue', ring(0.78, 0.18, 0.022, 0.022, 12)],
    ['green', [[0.15, 0.96], [0.19, 0.86], [0.13, 0.77], [0.17, 0.66]]],
  ],
  cupcake: [
    ['blue', [[0.26, 0.6], [0.74, 0.6], [0.68, 0.9], [0.32, 0.9], [0.26, 0.6]]],
    ['red', ring(0.5, 0.56, 0.26, 0.07)],
    ['red', ring(0.5, 0.47, 0.2, 0.06)],
    ['red', ring(0.5, 0.39, 0.13, 0.05)],
    ['blue', [[0.5, 0.33], [0.5, 0.2]]],
    ['yellow', ring(0.5, 0.14, 0.025, 0.045, 12)],
  ],
};

// ---------- The show ----------

(async () => {
  const servers = [await serve(), await serve()];
  const [portMark, portJoy] = servers.map((server) => server.address().port);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: STAGE, deviceScaleFactor: SCALE, serviceWorkers: 'block' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await context.route(/\/js\/config\.js(\?.*)?$/, (route) => route.fulfill({ contentType: 'text/javascript', body: `export const DATABASE_URL = '${EMULATOR}';` }));
  await context.addInitScript(showTaps);
  const page = await context.newPage();
  page.on('pageerror', (error) => log(`page error: ${error.message}`));
  await page.goto(`http://127.0.0.1:${portMark}/__stage.html`);
  await page.evaluate(() => document.fonts.ready);

  const mark = page.frame({ name: 'mark' });
  const joy = page.frame({ name: 'joy' });
  const NAMES = new Map([[mark, 'Mark'], [joy, 'Joy']]);
  await mark.goto(`http://127.0.0.1:${portMark}/`);
  await joy.goto(`http://127.0.0.1:${portJoy}/`);

  const say = async (title, text, hold = 0) => {
    log(title);
    await page.evaluate(([t, x]) => window.caption(t, x), [title, text]);
    await pause(hold);
  };
  const button = (frame, name) => frame.getByRole('button', { name, exact: true });
  const until = (frame, selector, text, timeout = 15000) => frame.locator(selector, text ? { hasText: text } : {}).first().waitFor({ timeout });
  const tap = async (target, before = 450, after = 500) => {
    await pause(before);
    await target.click();
    await pause(after);
  };
  const both = (fn) => Promise.all([fn(mark), fn(joy)]);
  const other = (frame) => (frame === mark ? joy : mark);
  const holders = async () => {
    const roles = {};
    for (const frame of [mark, joy]) roles[await frame.locator('.board').getAttribute('data-role')] = frame;
    return roles;
  };
  const closeSheets = async (frames) => {
    for (const frame of frames) {
      await frame.locator('.overlay:not(.is-leaving)').first().waitFor({ timeout: 4000 });
      await tap(frame.locator('.overlay:not(.is-leaving) .actions .btn--ghost').last(), 200, 200);
      await frame.locator('.overlay').first().waitFor({ state: 'detached', timeout: 4000 });
    }
  };
  const typeDigits = async (lock, digits) => {
    for (const digit of digits) await tap(button(lock, digit), 330, 0);
  };

  // A photo for Mark's surprise, made on the spot.
  const easel = await context.newPage();
  await easel.setViewportSize({ width: 1200, height: 900 });
  await easel.setContent(`<body style="margin:0;height:100vh;display:grid;place-items:center;background:linear-gradient(160deg,#f4b860,#ef9a9a 55%,#8272a8)">
    <div style="text-align:center;color:#fff;font-family:Georgia,serif">
      <svg width="220" height="200" viewBox="0 0 48 44"><path d="M24 41C10 30 5 22 8 15 11 8 20 7 24 14 28 7 37 8 40 15 43 22 38 30 24 41Z" fill="#fff"/></svg>
      <div style="font-size:150px;line-height:1">M + J</div><div style="font-size:54px;margin-top:20px">see you soon</div></div></body>`);
  const photo = await easel.screenshot({ type: 'png' });
  await easel.close();

  await until(mark, '.screen--title');
  await until(joy, '.screen--title');
  const stopRecording = VIDEO ? await startRecording(context, page) : async () => {};

  try {
    // ----- Opening -----
    await say('Split Clues', 'A co-op mystery for two phones. This is a full run of Episode 1, with Mark on the left and Joy on the right.', 4500);

    // ----- Making a room -----
    await say('Mark starts a room', 'He types his name and taps "Create our room".', 1200);
    await tap(mark.locator('.field'), 200, 200);
    await mark.locator('.field').pressSequentially('Mark', { delay: 150 * SPEED });
    await tap(button(mark, 'Create our room'));
    await until(mark, '.headline', 'Waiting for your other half');
    await pause(1500);
    await say('Then he sends Joy the link', 'One tap opens the share sheet. The same link brings you both back to this room every time, so you only do this once.', 1000);
    await tap(button(mark, 'Send the invite link'), 300, 900);
    if (await mark.locator('.overlay').count()) await closeSheets([mark]);
    await page.evaluate(() => document.getElementById('text').classList.add('is-in'));
    await pause(2600);

    // ----- Joining -----
    await say('Joy taps the link', 'It opens Split Clues straight into Mark\'s room.', 800);
    await tap(page.locator('#invite-link'), 300, 400);
    await page.evaluate(() => document.getElementById('text').classList.remove('is-in'));
    await joy.goto(mark.url().replace(`:${portMark}/`, `:${portJoy}/`));
    await until(joy, '.headline', 'Mark invited you');
    await pause(1600);
    await tap(joy.locator('.field'), 200, 200);
    await joy.locator('.field').pressSequentially('Joy', { delay: 150 * SPEED });
    await tap(button(joy, 'Join Mark'));
    await both((frame) => until(frame, '.headline', 'You are both here'));
    await say('They\'re both in', 'Each phone shows who is here. If one of you locks your phone or loses signal, the other sees it, and the game picks up where you left off.', 5500);

    // ----- Surprises -----
    const card = (frame) => frame.locator('.story', { hasText: 'Find Your Way Back' });
    await say('A surprise for the end', 'Before playing, each of you can hide a note or a photo for the other. It only appears on the last screen of the episode.', 1500);
    await tap(card(mark).getByRole('button', { name: 'Leave a surprise for Joy' }));
    await until(mark, '.sheet__title', 'A surprise for Joy');
    await pause(1200);
    await tap(mark.locator('.field--area'), 200, 200);
    await mark.locator('.field--area').pressSequentially('Three more weeks. I miss you!', { delay: 70 * SPEED });
    await pause(500);
    await tap(button(mark, 'Add a photo'), 300, 300);
    await mark.locator('.surprise input[type=file]').setInputFiles({ name: 'us.png', mimeType: 'image/png', buffer: photo });
    await mark.locator('.surprise__preview:not([hidden])').waitFor({ timeout: 10000 });
    await pause(1600);
    await tap(button(mark, 'Save the surprise'));
    await until(mark, '.toast', 'Tucked away');
    await pause(800);
    await say('Joy leaves one too', 'Neither phone can see the other\'s surprise until the end.', 600);
    await tap(card(joy).getByRole('button', { name: 'Leave a surprise for Mark' }));
    await until(joy, '.sheet__title', 'A surprise for Mark');
    await tap(joy.locator('.field--area'), 400, 200);
    await joy.locator('.field--area').pressSequentially('Check under your pillow tonight.', { delay: 55 * SPEED });
    await tap(button(joy, 'Save the surprise'));
    await until(joy, '.toast', 'Tucked away');
    await pause(1800);

    // ----- The episode -----
    await say('Episode 1: Find Your Way Back', 'Six clues, about 25 minutes. Either of you taps Play and both phones follow.', 1500);
    await tap(card(mark).getByRole('button', { name: 'Play' }));
    await both((frame) => until(frame, '.curtain__title', 'Find Your Way Back'));
    await say('It opens with a little story', 'Then either of you taps Begin. The timer starts now.', 6000);
    await tap(button(joy, 'Begin'));
    await both((frame) => until(frame, '.hud__where', 'The Garden Gate'));
    await pause(800);

    // ----- Clue 1: Code Lock -----
    let roles = await holders();
    await say('Clue 1 · Code Lock', `${NAMES.get(roles.lock)} has the LOCK: four symbols and a keypad. ${NAMES.get(roles.key)} has the KEY, a card that turns symbols into numbers. Neither of you can open it alone.`, 6500);
    let lock = await lockCode(roles.lock, roles.key);
    const wrong = String((Number(lock.code) + 2222) % 10000).padStart(4, '0');
    await say('Describe, translate, type', `"First one is a ${lock.first}." "That's a ${lock.firstDigit}." Every digit shows up on both phones as it is typed.`, 600);
    await typeDigits(roles.lock, wrong.slice(0, 3));
    await pause(900);
    await typeDigits(roles.lock, wrong.slice(3));
    await tap(button(roles.lock, 'Try the code'), 500, 0);
    await both((frame) => until(frame, '.toast', 'Wrong code'));
    await say('A wrong code costs a life', 'On both phones at once. Each clue has three lives.', 3000);
    await say('Stuck? Ask for a hint', 'Either of you can tap Hint. It opens on both phones, so you\'re always looking at the same nudge.', 600);
    await tap(button(roles.key, 'Hint'));
    await tap(button(roles.key, 'Show a hint'), 700, 0);
    await both((frame) => until(frame, '.hints li'));
    await pause(4500);
    await closeSheets([roles.lock, roles.key]);
    await say('Second try', 'This time they read the symbols carefully.', 400);
    await typeDigits(roles.lock, lock.code);
    await tap(button(roles.lock, 'Try the code'), 600, 0);
    await both((frame) => until(frame, '.curtain__title', 'Unlocked'));
    await say('Unlocked!', 'The lock springs open on both phones at the same moment, and the story moves on.', 5000);
    await tap(button(roles.key, 'Next clue'));

    // ----- Clue 2: Map Directions -----
    await both((frame) => until(frame, '.hud__where', 'The Marsh'));
    roles = await holders();
    await say('Clue 2 · Map Directions', `This time ${NAMES.get(roles.map)} has the MAP, with the treasure and the bogs. ${NAMES.get(roles.compass)} has the COMPASS: a blank map and a marker to move. The halves swap every round.`, 6500);
    const steps = await mapRoute(roles.map);
    await say(`"${directions(steps)}"`, 'Stepping into a bog costs a life, so the map holder picks a way around them. Both phones see the marker move.', 800);
    for (const direction of steps) await tap(button(roles.compass, `Move ${direction}`), 520, 0);
    await tap(button(roles.compass, 'Dig here'), 900, 0);
    await both((frame) => until(frame, '.curtain__title', 'Treasure found'));
    await pause(4000);
    await tap(button(roles.map, 'Next clue'));

    // ----- Clue 3: Color Wires -----
    await both((frame) => until(frame, '.hud__where', 'The Signal Box'));
    roles = await holders();
    await say('Clue 3 · Color Wires', `${NAMES.get(roles.wires)} describes the panel. ${NAMES.get(roles.rulebook)} has the RULEBOOK and works down it to the first rule that is true.`, 6500);
    const wire = await wireToCut(roles.wires, roles.rulebook);
    await say(`"Rule ${wire.line + 1} is true. Cut wire ${wire.cut + 1}."`, 'Tapping a wire puts the cutters on it, and the rulebook phone sees which one, so you can double-check before cutting.', 800);
    await tap(roles.wires.getByRole('button', { name: `Wire ${wire.cut + 1}`, exact: true }), 600, 0);
    await pause(2500);
    await tap(button(roles.wires, `Cut wire ${wire.cut + 1}`), 400, 0);
    await both((frame) => until(frame, '.curtain__title', 'Clean cut'));
    await pause(4000);
    await tap(button(roles.rulebook, 'Next clue'));

    // ----- Clue 4: Spot the Difference -----
    await both((frame) => until(frame, '.hud__where', 'Two Windows'));
    await say('Clue 4 · Spot the Difference', 'Both shelves look the same, but three things are different. Each of you only sees your own, so you describe them to each other.', 6500);
    const looks = (frame) => frame.locator('.spot__cell').evaluateAll((cells) => cells.map((cell) => cell.dataset.look));
    const [left, right] = [await looks(mark), await looks(joy)];
    const differences = left.map((look, i) => (look === right[i] ? -1 : i)).filter((i) => i >= 0);
    await say('A difference counts once you\'ve both tapped it', 'Go shelf by shelf: one of you describes each thing, the other says "same" or "different".', 600);
    for (const [n, index] of differences.entries()) {
      const first = n % 2 ? joy : mark;
      await tap(first.locator(`.spot__cell[data-index="${index}"]`), 900, 0);
      await pause(n === 0 ? 2200 : 900);
      await tap(other(first).locator(`.spot__cell[data-index="${index}"]`), 300, 0);
      await pause(1200);
    }
    await both((frame) => until(frame, '.curtain__title', 'All spotted'));
    await pause(3500);
    await tap(button(mark, 'Next clue'));

    // ----- Clue 5: Describe and Draw -----
    await both((frame) => until(frame, '.hud__where', 'A Postcard'));
    roles = await holders();
    await say('Clue 5 · Describe and Draw', `${NAMES.get(roles.picture)} describes a picture. ${NAMES.get(roles.pencil)} draws it from the description alone. No lives on this one: it's just for laughs.`, 6000);
    const subject = await roles.picture.locator('.sketch__original svg').getAttribute('data-picture');
    const box = await roles.pencil.locator('.sketch__canvas').boundingBox();
    const wobble = () => (Math.random() - 0.5) * 0.012;
    let color = 'ink';
    for (const [paint, points] of SKETCHES[subject] || SKETCHES.tree) {
      if (paint !== color) {
        await tap(roles.pencil.getByRole('button', { name: `Draw in ${paint}` }), 200, 150);
        color = paint;
      }
      const [x0, y0] = points[0];
      await page.mouse.move(box.x + (x0 + wobble()) * box.width, box.y + (y0 + wobble()) * box.height);
      await page.mouse.down();
      for (const [x, y] of points.slice(1)) {
        await page.mouse.move(box.x + (x + wobble()) * box.width, box.y + (y + wobble()) * box.height, { steps: 3 });
        await pause(18);
      }
      await page.mouse.up();
      await pause(220);
    }
    await pause(800);
    await tap(button(roles.pencil, 'Done'));
    await tap(button(roles.pencil, 'Reveal it'), 600, 0);
    await both((frame) => until(frame, '.curtain__title', 'The reveal'));
    await say('The reveal', 'Both phones show the drawing next to the real picture.', 6500);
    await tap(button(roles.picture, 'Next clue'));

    // ----- Clue 6: the last lock -----
    await both((frame) => until(frame, '.hud__where', 'The Last Door'));
    roles = await holders();
    lock = await lockCode(roles.lock, roles.key);
    await say('Clue 6 · The Last Door', `A harder lock. There's a lamp that only ${NAMES.get(roles.lock)} can see, and its colour decides which rule on ${NAMES.get(roles.key)}'s card to use.`, 6500);
    await say(`"The lamp is ${lock.lamp}."`, 'Then the same as before: describe, translate, type.', 600);
    await typeDigits(roles.lock, lock.code);
    await tap(button(roles.lock, 'Try the code'), 600, 0);
    await both((frame) => until(frame, '.curtain__title', 'Unlocked'));
    await pause(3000);
    await tap(button(roles.key, 'Finish'));

    // ----- The ending -----
    await both((frame) => until(frame, '.curtain__title', 'You found each other'));
    await say('You found each other', 'The two halves of the locket close, and your time is saved as your best for this episode.', 4500);
    await say('And finally, the surprises', 'Each of you sees what the other left.', 600);
    await both((frame) => frame.locator('.gift:not([hidden])').waitFor({ timeout: 10000 }));
    await joy.locator('.gift__photo:not([hidden])').waitFor({ timeout: 10000 });
    await pause(1500);
    await both((frame) => frame.evaluate(() => document.querySelector('.curtain').scrollTo({ top: 99999, behavior: 'smooth' })));
    await pause(7000);

    // ----- Close -----
    await say('That\'s Split Clues', 'Episode 2, The Lighthouse, and practice rounds for each puzzle are waiting in the room.', 4000);
    await page.evaluate(() => document.getElementById('endcard').classList.add('is-in'));
    await pause(3500);
  } finally {
    await stopRecording();
    await browser.close();
    servers.forEach((server) => server.close());
  }

  if (VIDEO) {
    log('making the final video…');
    await new Promise((resolve, reject) => {
      const final = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', RAW, '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-tune', 'animation',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
      final.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
    });
    fs.unlinkSync(RAW);
    log(`saved ${OUT} (${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB)`);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
