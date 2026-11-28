// Plays all three Describe and Draw levels on two pretend iPhones: one phone
// shows the picture, the other draws with a finger, then both see the reveal.
// Run with tests/run.sh.

const { begin, sees, shot, fits, readRoom, startPractice, byHalf } = require('./helpers');

// Draws one line on the canvas, given as fractions of its width and height.
async function line(page, points) {
  const box = await page.locator('.sketch__canvas').boundingBox();
  const at = ([fx, fy]) => [box.x + fx * box.width, box.y + fy * box.height];
  const [startX, startY] = at(points[0]);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (const point of points.slice(1)) {
    const [x, y] = at(point);
    await page.mouse.move(x, y, { steps: 4 });
  }
  await page.mouse.up();
  await page.waitForTimeout(80);
}

const drawn = (page, selector) => page.locator(`${selector} polyline, ${selector} circle`).count();

(async () => {
  const { check, pairUp, finish } = await begin();
  const { mark, joy, invite } = await pairUp();

  console.log('\nDescribe and Draw: level 1');
  await check('starting puts both phones in the first round', async () => {
    await startPractice(joy, 'Describe and Draw');
    await sees(mark, '.hud__where', /Describe and Draw · 1 of 3/i);
    await sees(joy, '.hud__where', /Describe and Draw · 1 of 3/i);
  });
  let table = await byHalf(mark, joy);
  await check('one phone has the picture and the other has the pencil', async () => {
    await sees(table.picture, '.role__plate', /You have the PICTURE/);
    await sees(table.pencil, '.role__plate', /You have the PENCIL/);
  });
  await check('it is not scored: no lives and no hint button', async () => {
    for (const page of [mark, joy]) {
      if (await page.locator('.lives').isVisible()) throw new Error('lives are showing');
      if (await page.getByRole('button', { name: 'Hint' }).isVisible()) throw new Error('the hint button is showing');
    }
  });
  await check('each phone draws only its own half', async () => {
    if (await table.pencil.locator('.sketch__original, [data-picture]').count()) throw new Error('the pencil phone shows the picture');
    if (await table.picture.locator('.sketch__canvas, .swatch').count()) throw new Error('the picture phone shows the canvas');
    if (!(await table.picture.locator('.sketch__original svg[data-picture]').count())) throw new Error('no picture to describe');
  });
  await shot(table.picture, 'draw-01-picture-level1');
  await check('both halves fit small and large iPhones', async () => {
    await fits(table.picture);
    await fits(table.pencil);
  });
  await check('lines drawn on one phone are counted on the other, but not shown', async () => {
    await sees(table.picture, '.sketch .mirror__label', new RegExp(`${table.holder.pencil} has not started yet`, 'i'));
    await line(table.pencil, [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8]]);
    await sees(table.picture, '.sketch .mirror__label', new RegExp(`${table.holder.pencil} has drawn 1 line$`, 'i'));
    await line(table.pencil, [[0.2, 0.8], [0.5, 0.5]]);
    await line(table.pencil, [[0.3, 0.3], [0.6, 0.7]]);
    await sees(table.picture, '.sketch .mirror__label', /has drawn 3 lines/i);
    if ((await drawn(table.pencil, '.sketch__canvas')) !== 3) throw new Error('the canvas does not show three lines');
    if (await table.picture.locator('polyline').count()) throw new Error('the picture phone shows the drawing early');
  });
  await check('Undo removes the last line', async () => {
    await table.pencil.getByRole('button', { name: 'Undo' }).click();
    await sees(table.picture, '.sketch .mirror__label', /has drawn 2 lines/i);
    if ((await drawn(table.pencil, '.sketch__canvas')) !== 2) throw new Error('the canvas does not show two lines');
  });
  await check('a colour can be chosen for the next line', async () => {
    await table.pencil.getByRole('button', { name: 'Draw in red' }).click();
    await line(table.pencil, [[0.5, 0.1], [0.5, 0.9]]);
    const colors = await table.pencil.locator('.sketch__canvas polyline').evaluateAll((lines) => lines.map((l) => l.getAttribute('stroke')));
    if (colors.length !== 3 || colors[2] !== '#e5646e' || colors[0] !== '#2a2033') throw new Error(`line colours are ${colors}`);
  });
  await shot(table.pencil, 'draw-02-pencil-level1');
  await check('reloading the pencil phone keeps the drawing', async () => {
    await table.pencil.reload();
    await sees(table.pencil, '.hud__where', /1 of 3/i);
    await table.pencil.waitForSelector('.sketch__canvas polyline');
    if ((await drawn(table.pencil, '.sketch__canvas')) !== 3) throw new Error('lines were lost');
  });
  await check('Done asks first, then reveals the drawing beside the picture on both phones', async () => {
    await table.pencil.getByRole('button', { name: 'Done' }).click();
    await sees(table.pencil, '.sheet__title', /Finished drawing/);
    await table.pencil.getByRole('button', { name: 'Reveal it' }).click();
    for (const page of [table.picture, table.pencil]) {
      await sees(page, '.curtain__title', /The reveal/);
      await sees(page, '.reveal', new RegExp(`The picture\\s+${table.holder.pencil}'s drawing`, 'i'));
      if (!(await page.locator('.reveal__picture[data-picture]').count())) throw new Error('the reveal is missing the picture');
      if ((await drawn(page, '.reveal__drawing')) !== 3) throw new Error('the reveal is missing the drawing');
    }
  });
  await shot(table.picture, 'draw-03-reveal');
  await check('the reveal fits small and large iPhones', async () => {
    await fits(table.picture);
    await fits(table.pencil);
  });

  console.log('\nDescribe and Draw: levels 2 and 3');
  await check('level 2 swaps who draws, and Clear wipes the page', async () => {
    await table.picture.getByRole('button', { name: 'Next clue' }).click();
    await sees(mark, '.hud__where', /2 of 3/i);
    await sees(joy, '.hud__where', /2 of 3/i);
    const before = table.holder.pencil;
    table = await byHalf(mark, joy);
    if (table.holder.pencil === before) throw new Error('the same player draws again');
    await shot(table.picture, 'draw-picture-level2');
    await line(table.pencil, [[0.1, 0.1], [0.9, 0.9]]);
    await line(table.pencil, [[0.9, 0.1], [0.1, 0.9]]);
    await table.pencil.getByRole('button', { name: 'Clear' }).click();
    await sees(table.picture, '.sketch .mirror__label', /has not started yet/i);
    if (await drawn(table.pencil, '.sketch__canvas')) throw new Error('the page was not wiped');
    await line(table.pencil, [[0.5, 0.5]]); // a single tap leaves a dot
    await sees(table.picture, '.sketch .mirror__label', /has drawn 1 line$/i);
    await table.pencil.getByRole('button', { name: 'Done' }).click();
    await table.pencil.getByRole('button', { name: 'Reveal it' }).click();
    await sees(table.picture, '.curtain__title', /The reveal/);
    if ((await drawn(table.picture, '.reveal__drawing')) !== 1) throw new Error('the dot is missing from the reveal');
  });
  await check('level 3 is a made-up picture of five shapes', async () => {
    await table.pencil.getByRole('button', { name: 'Next clue' }).click();
    await sees(mark, '.hud__where', /3 of 3/i);
    await sees(joy, '.hud__where', /3 of 3/i);
    table = await byHalf(mark, joy);
    if ((await table.picture.locator('.sketch__original svg').getAttribute('data-picture')) !== 'shapes') throw new Error('not the made-up picture');
    if ((await table.picture.locator('.sketch__original svg > g').count()) !== 5) throw new Error('not five shapes');
    await shot(table.picture, 'draw-picture-level3');
    await fits(table.picture);
    await fits(table.pencil);
  });
  await check('an empty drawing can still be revealed, and Finish ends the run', async () => {
    await table.pencil.getByRole('button', { name: 'Done' }).click();
    await table.pencil.getByRole('button', { name: 'Reveal it' }).click();
    await sees(table.picture, '.curtain__title', /The reveal/);
    await table.picture.getByRole('button', { name: 'Finish' }).click();
    await sees(mark, '.curtain__title', /All 3 solved/);
    await sees(joy, '.curtain__title', /All 3 solved/);
    await mark.getByRole('button', { name: 'Back to the room' }).click();
    await sees(joy, '.headline', /You are both here/);
    if ((await readRoom(invite)).game) throw new Error('the finished run is still saved in the room');
  });

  await finish();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
