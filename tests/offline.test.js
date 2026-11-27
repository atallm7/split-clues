// Checks how updates and lost signal are handled: after a new version is
// published the very next load shows it, and the game still opens when the
// network is gone. Needs no database.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
};

(async () => {
  let online = true;
  let marker = 'first';
  const server = http.createServer((req, res) => {
    if (!online) return req.socket.destroy();
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return res.writeHead(404).end('not found');
    }
    // Like GitHub Pages: files may be reused for ten minutes without asking again.
    const headers = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' };
    // A "new version": the stylesheet changes, and so does its version tag in the page.
    if (pathname === '/' || pathname === '/index.html') {
      return res.writeHead(200, headers).end(fs.readFileSync(file, 'utf8').replace(/css\/app\.css\?v=\w+/, `css/app.css?v=${marker}`));
    }
    if (pathname === '/css/app.css') {
      return res.writeHead(200, headers).end(`${fs.readFileSync(file, 'utf8')}\nbody::after { content: '${marker}'; }`);
    }
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;

  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 14'] });
  const page = await context.newPage();
  const marked = () => page.evaluate(() => getComputedStyle(document.body, '::after').content);
  const failures = [];
  const expect = (label, ok, detail = '') => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : `  (${detail})`}`);
    if (!ok) failures.push(label);
  };

  await page.goto(base);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  expect('the service worker takes over the page', true);
  expect('first version is showing', (await marked()) === '"first"', await marked());

  marker = 'second';
  await page.reload();
  expect('a new version shows on the very next reload', (await marked()) === '"second"', await marked());

  online = false;
  await page.reload();
  const title = await page.locator('.title').innerText({ timeout: 5000 }).catch(() => '(nothing)');
  expect('the game still opens with the network gone', /Split\s+Clues/.test(title), title);
  expect('and shows the last version it had', (await marked()) === '"second"', await marked());

  await browser.close();
  server.close();
  console.log(failures.length ? `\n${failures.length} failed` : '\nall passed');
  process.exit(failures.length ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
