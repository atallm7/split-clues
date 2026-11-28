// Plays all four Map Directions levels on two pretend iPhones, the way two
// people would: planning a route on the map phone and tapping it out on the
// compass phone. Run with tests/run.sh.

const { begin, sees, shot, fits, readRoom, startPractice, byHalf, livesLeft } = require('./helpers');

const SIDES = ['up', 'right', 'down', 'left'];
const COMPASS = ['north', 'east', 'south', 'west'];
const SHIFT = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const key = (cell) => `${cell.x},${cell.y}`;

// Everything the MAP phone shows, in the positions it shows them.
async function readMap(page) {
  const cells = await page.locator('.map--full .map__cell').evaluateAll((all) => all.map((cell) => ({ x: Number(cell.dataset.x), y: Number(cell.dataset.y), kind: cell.dataset.kind || '' })));
  const size = Math.sqrt(cells.length);
  const pin = (await page.locator('.map--full .map__pin').count())
    ? await page.locator('.map--full .map__pin').evaluate((el) => ({ x: Number(el.dataset.x), y: Number(el.dataset.y) })) : null;
  return {
    size,
    cells,
    pin,
    north: await page.locator('.rose').getAttribute('data-north'),
    treasure: cells.find((cell) => cell.kind === 'treasure'),
    start: cells.find((cell) => cell.kind === 'start'),
    bogs: cells.filter((cell) => cell.kind === 'bog'),
  };
}

// The shortest way across the map as drawn, never entering a bog.
function route(map, from, isGoal) {
  const blocked = new Set(map.bogs.map(key));
  const cameFrom = new Map([[key(from), null]]);
  const queue = [from];
  while (queue.length) {
    const at = queue.shift();
    if (isGoal(at)) {
      const steps = [];
      for (let k = key(at); cameFrom.get(k); k = cameFrom.get(k).from) steps.unshift(cameFrom.get(k).side);
      return { steps, end: at };
    }
    for (const side of SIDES) {
      const next = { x: at.x + SHIFT[side][0], y: at.y + SHIFT[side][1] };
      if (next.x < 0 || next.y < 0 || next.x >= map.size || next.y >= map.size || blocked.has(key(next)) || cameFrom.has(key(next))) continue;
      cameFrom.set(key(next), { from: key(at), side });
      queue.push(next);
    }
  }
  throw new Error('no route on the map');
}

// "Go right on my map" said as a compass direction, given which side of the map is north.
const say = (side, north) => COMPASS[(SIDES.indexOf(side) - SIDES.indexOf(north) + 4) % 4];

async function walk(compass, steps, north) {
  for (const side of steps) {
    await compass.getByRole('button', { name: `Move ${say(side, north)}` }).click();
    await compass.waitForTimeout(60);
  }
}

const pinOn = (page, selector) => page.locator(`${selector} .map__pin`).evaluate((el) => `${el.dataset.x},${el.dataset.y}`);

async function waitForPin(page, selector, cell) {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    if ((await pinOn(page, selector)) === key(cell)) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`the pin is at ${await pinOn(page, selector)}, wanted ${key(cell)}`);
}

(async () => {
  const { check, pairUp, finish } = await begin();
  const { mark, joy, invite } = await pairUp();

  console.log('\nMap Directions: level 1');
  await check('starting puts both phones on the first map', async () => {
    await startPractice(mark, 'Map Directions');
    await sees(mark, '.hud__where', /Map Directions · 1 of 4/i);
    await sees(joy, '.hud__where', /Map Directions · 1 of 4/i);
  });
  let table = await byHalf(mark, joy);
  await check('one phone has the map and the other has the compass', async () => {
    await sees(table.map, '.role__plate', /You have the MAP/);
    await sees(table.compass, '.role__plate', /You have the COMPASS/);
  });
  await check('each phone draws only its own half', async () => {
    if (await table.compass.locator('[data-kind="treasure"], [data-kind="bog"], .rose, .map--full').count()) throw new Error('the compass phone shows the map');
    if (await table.map.locator('.dpad, .seekpad').count()) throw new Error('the map phone shows the controls');
    const drawn = await table.compass.locator('.map--blank .map__cell svg').count();
    if (drawn !== 1) throw new Error(`the blank map has ${drawn} things drawn on it (only the start flag should be)`);
  });
  let map = await readMap(table.map);
  await shot(table.map, 'map-01-map-level1');
  await shot(table.compass, 'map-02-compass-level1');
  await check('level 1 is a 5 by 5 map with no bogs, north up, and fits', async () => {
    if (map.size !== 5 || map.bogs.length || map.north !== 'up') throw new Error(`size ${map.size}, ${map.bogs.length} bogs, north ${map.north}`);
    if (key(map.pin) !== key(map.start)) throw new Error('the pin does not begin on the start flag');
    await fits(table.map);
    await fits(table.compass);
  });
  await check('walking into the edge of the map goes nowhere', async () => {
    const outward = map.start.y === 0 ? 'north' : map.start.x === 0 ? 'west' : null;
    if (outward) {
      await table.compass.getByRole('button', { name: `Move ${outward}` }).click();
      await table.compass.waitForTimeout(300);
    }
    if ((await pinOn(table.map, '.map--full')) !== key(map.start)) throw new Error('the pin moved');
  });
  await check('digging in the wrong place costs a life and leaves the pin where it is', async () => {
    await table.compass.getByRole('button', { name: 'Dig here' }).click();
    await sees(table.compass, '.toast', /Nothing buried here\. 2 lives left\./);
    await sees(table.map, '.toast', /Nothing buried here\. 2 lives left\./);
    if ((await livesLeft(table.map)) !== 2) throw new Error('lives did not drop to 2');
    if ((await pinOn(table.map, '.map--full')) !== key(map.start)) throw new Error('the pin moved');
  });
  await check('steps tapped on the compass phone move the pin on the map phone', async () => {
    const way = route(map, map.pin, (cell) => key(cell) === key(map.treasure));
    await walk(table.compass, way.steps.slice(0, 2), map.north);
    const afterTwo = way.steps.slice(0, 2).reduce((at, side) => ({ x: at.x + SHIFT[side][0], y: at.y + SHIFT[side][1] }), map.pin);
    await waitForPin(table.map, '.map--full', afterTwo);
    await waitForPin(table.compass, '.map--blank', afterTwo); // north is up on both at this level
  });
  await check('reloading the compass phone keeps the pin where it was', async () => {
    const before = await pinOn(table.map, '.map--full');
    await table.compass.reload();
    await sees(table.compass, '.hud__where', /1 of 4/i);
    await table.compass.waitForTimeout(400);
    if ((await pinOn(table.compass, '.map--blank')) !== before) throw new Error('the pin jumped');
  });
  await check('reaching the cross and digging finds the treasure on both phones', async () => {
    map = await readMap(table.map);
    const way = route(map, map.pin, (cell) => key(cell) === key(map.treasure));
    await walk(table.compass, way.steps, map.north);
    await waitForPin(table.map, '.map--full', map.treasure);
    await table.compass.getByRole('button', { name: 'Dig here' }).click();
    await sees(table.compass, '.curtain__title', /Treasure found/);
    await sees(table.map, '.curtain__title', /Treasure found/, 2000);
  });

  async function nextLevel(n) {
    await table.map.getByRole('button', { name: 'Next clue' }).click();
    await sees(mark, '.hud__where', new RegExp(`${n} of 4`, 'i'));
    await sees(joy, '.hud__where', new RegExp(`${n} of 4`, 'i'));
    const before = table.holder.map;
    table = await byHalf(mark, joy);
    if (table.holder.map === before) throw new Error('the halves did not swap');
    return readMap(table.map);
  }

  console.log('\nMap Directions: level 2 (bogs)');
  await check('level 2 is 6 by 6 with five bogs only the map phone can see, and fits', async () => {
    map = await nextLevel(2);
    if (map.size !== 6 || map.bogs.length !== 5) throw new Error(`size ${map.size}, ${map.bogs.length} bogs`);
    await shot(table.map, 'map-map-level2');
    await shot(table.compass, 'map-compass-level2');
    await fits(table.map);
    await fits(table.compass);
  });
  await check('stepping into a bog costs a life and sends the pin back to the start', async () => {
    const bogs = new Set(map.bogs.map(key));
    const beside = (cell) => SIDES.find((side) => bogs.has(key({ x: cell.x + SHIFT[side][0], y: cell.y + SHIFT[side][1] })));
    const way = route(map, map.pin, (cell) => !!beside(cell));
    await walk(table.compass, [...way.steps, beside(way.end)], map.north);
    await sees(table.map, '.toast', /Into a bog\. Back to the start\. 2 lives left\./);
    await sees(table.compass, '.toast', /Into a bog\. Back to the start\. 2 lives left\./);
    await waitForPin(table.map, '.map--full', map.start);
  });
  await check('a route around the bogs reaches the treasure', async () => {
    const way = route(map, map.start, (cell) => key(cell) === key(map.treasure));
    await walk(table.compass, way.steps, map.north);
    await waitForPin(table.map, '.map--full', map.treasure);
    await table.compass.getByRole('button', { name: 'Dig here' }).click();
    await sees(table.map, '.curtain__title', /Treasure found/);
  });

  console.log('\nMap Directions: level 3 (turned map)');
  await check('level 3 turns the map: north is no longer up on the map phone', async () => {
    map = await nextLevel(3);
    if (map.north === 'up') throw new Error('north is still up');
    await shot(table.map, 'map-map-level3');
    await fits(table.map);
    await fits(table.compass);
  });
  await check('steps said by the compass still lead to the treasure', async () => {
    const way = route(map, map.pin, (cell) => key(cell) === key(map.treasure));
    await walk(table.compass, way.steps, map.north);
    await waitForPin(table.map, '.map--full', map.treasure);
    await table.compass.getByRole('button', { name: 'Dig here' }).click();
    await sees(table.map, '.curtain__title', /Treasure found/);
  });

  console.log('\nMap Directions: level 4 (by lantern)');
  await check('level 4 hides the pin from the map phone and shows the compass phone only nearby squares', async () => {
    map = await nextLevel(4);
    if (map.pin) throw new Error('the map phone shows the pin');
    if ((await table.compass.locator('.map--lantern .map__cell').count()) !== 9) throw new Error('the lantern view is not 3 by 3');
    await shot(table.map, 'map-map-level4');
    await shot(table.compass, 'map-compass-level4');
    await fits(table.map);
    await fits(table.compass);
  });
  await check('describing what is nearby is enough to find the way', async () => {
    // "I can see a tent just to my left": find that landmark on the map, step back from it.
    const seen = await table.compass.locator('.map--lantern .map__cell').evaluateAll((all) => all.map((cell) => ({ dx: Number(cell.dataset.x) - 1, dy: Number(cell.dataset.y) - 1, kind: cell.dataset.kind || '' })).filter((cell) => cell.kind));
    if (!seen.length) throw new Error('nothing to see by lantern at the start');
    const landmark = map.cells.find((cell) => cell.kind === seen[0].kind);
    const here = { x: landmark.x - seen[0].dx, y: landmark.y - seen[0].dy };
    if (key(here) !== key(map.start)) throw new Error(`worked out ${key(here)} but the start flag is at ${key(map.start)}`);
    const way = route(map, here, (cell) => key(cell) === key(map.treasure));
    await walk(table.compass, way.steps, map.north);
    await table.compass.getByRole('button', { name: 'Dig here' }).click();
    await sees(table.map, '.curtain__title', /Treasure found/);
    await sees(table.compass, '.curtain__title', /Treasure found/);
  });
  await check('Finish ends the run on both phones', async () => {
    await table.compass.getByRole('button', { name: 'Finish' }).click();
    await sees(mark, '.curtain__title', /All 4 solved/);
    await sees(joy, '.curtain__title', /All 4 solved/);
    await joy.getByRole('button', { name: 'Back to the room' }).click();
    await sees(mark, '.headline', /You are both here/);
    if ((await readRoom(invite)).game) throw new Error('the finished run is still saved in the room');
  });

  await finish();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
