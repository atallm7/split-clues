// Plays whichever puzzle is on the table, the way two people would: using only
// what each phone shows. Used by the tests that run through whole episodes.

const { roleOf } = require('./helpers');

async function halves(mark, joy) {
  return { [await roleOf(mark)]: mark, [await roleOf(joy)]: joy };
}

// ---------- Code Lock ----------

const TWISTS = {
  asRead: (d) => d,
  reverse: (d) => [d[3], d[2], d[1], d[0]],
  plusOne: (d) => d.map((n) => (n === 9 ? 0 : n + 1)),
  swapEnds: (d) => [d[3], d[1], d[2], d[0]],
};

async function codelock(mark, joy) {
  const { lock, key } = await halves(mark, joy);
  const symbols = await lock.locator('.lock .tiles .tile').evaluateAll((tiles) => tiles.map((tile) => tile.dataset.symbol));
  const lamp = (await lock.locator('.lamp').count()) ? await lock.locator('.lamp').getAttribute('data-lamp') : null;
  const legend = Object.fromEntries(await key.locator('.legend__item').evaluateAll((items) => items.map((item) => [item.dataset.symbol, Number(item.dataset.digit)])));
  let rule = 'asRead';
  if (await key.locator('.note[data-note="rule"]').count()) rule = await key.locator('.note').getAttribute('data-rule');
  if (await key.locator('.note[data-note="lamp"]').count()) rule = await key.locator(`.note__row[data-lamp="${lamp}"]`).getAttribute('data-rule');
  const code = TWISTS[rule](symbols.map((id) => legend[id])).join('');
  for (const digit of code) await lock.getByRole('button', { name: digit, exact: true }).click();
  await lock.getByRole('button', { name: 'Try the code' }).click();
}

// ---------- Color Wires ----------

function wireToCut(panel, rules) {
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
  const rule = rules.find(isTrue);
  if (rule.action === 'nth') return rule.n;
  if (rule.action === 'firstOf') return colors.indexOf(rule.actionColor);
  if (rule.action === 'lastOf') return colors.lastIndexOf(rule.actionColor);
  return panel.wires.findIndex((wire) => wire.striped);
}

async function wires(mark, joy) {
  const table = await halves(mark, joy);
  for (let panelNumber = 0; panelNumber < 3; panelNumber++) {
    const panel = {
      wires: await table.wires.locator('.panel .wire').evaluateAll((rows) => rows.map((row) => ({ color: row.dataset.color, striped: row.dataset.striped === 'true' }))),
      lamp: (await table.wires.locator('.bulb').count()) ? (await table.wires.locator('.bulb').getAttribute('data-lamp')) === 'true' : null,
      plate: (await table.wires.locator('.plate').count()) ? Number(await table.wires.locator('.plate').getAttribute('data-plate')) : null,
    };
    const rules = await table.rulebook.locator('.rule').evaluateAll((lines) => lines.map((line) => ({
      kind: line.dataset.kind,
      color: line.dataset.color || null,
      value: line.dataset.value === undefined ? null : line.dataset.value === 'true',
      action: line.dataset.action,
      n: line.dataset.actionN === undefined ? null : Number(line.dataset.actionN),
      actionColor: line.dataset.actionColor || null,
    })));
    const before = await table.wires.locator('.panel').getAttribute('data-stage');
    const cut = wireToCut(panel, rules);
    await table.wires.getByRole('button', { name: `Wire ${cut + 1}`, exact: true }).click();
    await table.wires.getByRole('button', { name: `Cut wire ${cut + 1}` }).click();
    // Either that was the last panel (the curtain rises) or the next panel appears on both phones.
    const started = Date.now();
    while (Date.now() - started < 6000) {
      if (await table.wires.locator('.curtain:not([hidden])').count()) return;
      const now = await table.wires.locator('.panel').getAttribute('data-stage').catch(() => before);
      const rulesNow = await table.rulebook.locator('.rulebook__label').innerText().catch(() => '');
      if (now !== before && rulesNow.toLowerCase().includes(`panel ${Number(now) + 1}`)) break;
      await table.wires.waitForTimeout(100);
    }
  }
}

// ---------- Map Directions ----------

const SIDES = ['up', 'right', 'down', 'left'];
const COMPASS = ['north', 'east', 'south', 'west'];
const SHIFT = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const at = (cell) => `${cell.x},${cell.y}`;

async function map(mark, joy) {
  const table = await halves(mark, joy);
  const cells = await table.map.locator('.map--full .map__cell').evaluateAll((all) => all.map((cell) => ({ x: Number(cell.dataset.x), y: Number(cell.dataset.y), kind: cell.dataset.kind || '' })));
  const size = Math.sqrt(cells.length);
  const north = await table.map.locator('.rose').getAttribute('data-north');
  const treasure = cells.find((cell) => cell.kind === 'treasure');
  const blocked = new Set(cells.filter((cell) => cell.kind === 'bog').map(at));

  let from;
  if (await table.map.locator('.map--full .map__pin').count()) {
    from = await table.map.locator('.map--full .map__pin').evaluate((el) => ({ x: Number(el.dataset.x), y: Number(el.dataset.y) }));
  } else {
    // By lantern: work out where the marker is from a landmark the compass phone can see.
    const seen = await table.compass.locator('.map--lantern .map__cell').evaluateAll((all) => all.map((cell) => ({ dx: Number(cell.dataset.x) - 1, dy: Number(cell.dataset.y) - 1, kind: cell.dataset.kind || '' })).filter((cell) => cell.kind));
    const landmark = cells.find((cell) => cell.kind === seen[0].kind);
    from = { x: landmark.x - seen[0].dx, y: landmark.y - seen[0].dy };
  }

  const cameFrom = new Map([[at(from), null]]);
  const queue = [from];
  let steps = null;
  while (queue.length && !steps) {
    const here = queue.shift();
    if (at(here) === at(treasure)) {
      steps = [];
      for (let k = at(here); cameFrom.get(k); k = cameFrom.get(k).from) steps.unshift(cameFrom.get(k).side);
      break;
    }
    for (const side of SIDES) {
      const next = { x: here.x + SHIFT[side][0], y: here.y + SHIFT[side][1] };
      if (next.x < 0 || next.y < 0 || next.x >= size || next.y >= size || blocked.has(at(next)) || cameFrom.has(at(next))) continue;
      cameFrom.set(at(next), { from: at(here), side });
      queue.push(next);
    }
  }
  for (const side of steps) {
    const direction = COMPASS[(SIDES.indexOf(side) - SIDES.indexOf(north) + 4) % 4];
    await table.compass.getByRole('button', { name: `Move ${direction}` }).click();
    await table.compass.waitForTimeout(60);
  }
  await table.compass.getByRole('button', { name: 'Dig here' }).click();
}

// ---------- Spot the Difference ----------

async function spot(mark, joy) {
  const looks = (page) => page.locator('.spot__cell').evaluateAll((all) => all.map((cell) => cell.dataset.look));
  const a = await looks(mark);
  const b = await looks(joy);
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    await mark.locator(`.spot__cell[data-index="${i}"]`).click();
    await joy.locator(`.spot__cell[data-index="${i}"]`).click();
  }
}

// ---------- Describe and Draw ----------

async function draw(mark, joy) {
  const { pencil } = await halves(mark, joy);
  const box = await pencil.locator('.sketch__canvas').boundingBox();
  await pencil.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3);
  await pencil.mouse.down();
  await pencil.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.3, { steps: 4 });
  await pencil.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.75, { steps: 4 });
  await pencil.mouse.up();
  await pencil.waitForTimeout(100);
  await pencil.getByRole('button', { name: 'Done' }).click();
  await pencil.getByRole('button', { name: 'Reveal it' }).click();
}

const SOLVERS = { codelock, wires, map, spot, draw };

// Solves the puzzle on the table and waits for the solved screen on both phones.
async function solveCurrent(mark, joy) {
  const type = await mark.locator('.board').getAttribute('data-type');
  await SOLVERS[type](mark, joy);
  for (const page of [mark, joy]) await page.waitForSelector('.curtain:not([hidden]) .curtain__title', { timeout: 8000 });
  return type;
}

module.exports = { solveCurrent };
