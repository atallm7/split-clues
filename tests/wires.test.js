// Plays all five Color Wires levels on two pretend iPhones, the way two people
// would: reading the panel off one screen and the rulebook off the other.
// Run with tests/run.sh, which starts a local database emulator first.

const { begin, sees, shot, fits, readRoom, startPractice, byHalf, livesLeft } = require('./helpers');

// What the WIRES phone shows.
async function readPanel(page) {
  const wires = await page.locator('.panel .wire').evaluateAll((rows) => rows.map((row) => ({ color: row.dataset.color, striped: row.dataset.striped === 'true' })));
  const lamp = (await page.locator('.bulb').count()) ? (await page.locator('.bulb').getAttribute('data-lamp')) === 'true' : null;
  const plate = (await page.locator('.plate').count()) ? Number(await page.locator('.plate').getAttribute('data-plate')) : null;
  return { wires, lamp, plate };
}

// What the RULEBOOK phone shows.
function readRules(page) {
  return page.locator('.rule').evaluateAll((lines) => lines.map((line) => ({
    kind: line.dataset.kind,
    color: line.dataset.color || null,
    value: line.dataset.value === undefined ? null : line.dataset.value === 'true',
    action: line.dataset.action,
    n: line.dataset.actionN === undefined ? null : Number(line.dataset.actionN),
    actionColor: line.dataset.actionColor || null,
  })));
}

// Worked out by hand from the two halves, without the game's own code.
function isTrue(rule, panel) {
  const colors = panel.wires.map((wire) => wire.color);
  const count = colors.filter((color) => color === rule.color).length;
  if (rule.kind === 'otherwise') return true;
  if (rule.kind === 'none') return count === 0;
  if (rule.kind === 'one') return count === 1;
  if (rule.kind === 'many') return count >= 2;
  if (rule.kind === 'top') return colors[0] === rule.color;
  if (rule.kind === 'bottom') return colors[colors.length - 1] === rule.color;
  if (rule.kind === 'striped') return panel.wires.some((wire) => wire.striped) === rule.value;
  if (rule.kind === 'lamp') return panel.lamp === rule.value;
  if (rule.kind === 'plate') return (panel.plate % 2 === 1) === rule.value;
  throw new Error(`unknown rule kind ${rule.kind}`);
}

function wireFor(rule, panel) {
  const colors = panel.wires.map((wire) => wire.color);
  if (rule.action === 'nth') return rule.n;
  if (rule.action === 'firstOf') return colors.indexOf(rule.actionColor);
  if (rule.action === 'lastOf') return colors.lastIndexOf(rule.actionColor);
  if (rule.action === 'striped') return panel.wires.findIndex((wire) => wire.striped);
  throw new Error(`unknown action ${rule.action}`);
}

async function workOut(table) {
  const panel = await readPanel(table.wires);
  const rules = await readRules(table.rulebook);
  const line = rules.findIndex((rule) => isTrue(rule, panel));
  const cut = wireFor(rules[line], panel);
  if (cut < 0 || cut >= panel.wires.length) throw new Error(`the rules point at wire ${cut + 1}, which is not there`);
  return { panel, rules, line, cut };
}

async function cutWire(page, index) {
  await page.getByRole('button', { name: `Wire ${index + 1}`, exact: true }).click();
  await page.getByRole('button', { name: `Cut wire ${index + 1}` }).click();
}

(async () => {
  const { check, pairUp, finish } = await begin();
  const { mark, joy, invite } = await pairUp();

  console.log('\nColor Wires: level 1');
  await check('starting puts both phones in the first panel', async () => {
    await startPractice(joy, 'Color Wires');
    await sees(mark, '.hud__where', /Color Wires · 1 of 5/i);
    await sees(joy, '.hud__where', /Color Wires · 1 of 5/i);
  });
  let table = await byHalf(mark, joy);
  await check('one phone has the wires and the other has the rulebook', async () => {
    await sees(table.wires, '.role__plate', /You have the WIRES/);
    await sees(table.rulebook, '.role__plate', /You have the RULEBOOK/);
    await sees(table.rulebook, '.role__partner', new RegExp(`${table.holder.wires} has the WIRES`));
  });
  await check('each phone draws only its own half', async () => {
    if (await table.wires.locator('.rule, .rules, .rulecard').count()) throw new Error('the wires phone shows the rulebook');
    if (await table.rulebook.locator('.panel, .wire, .bulb, .plate').count()) throw new Error('the rulebook phone shows the panel');
  });
  let worked = await workOut(table);
  await shot(table.wires, 'wires-01-panel-level1');
  await shot(table.rulebook, 'wires-02-rules-level1');
  await check('level 1 has four wires and three rules, and fits', async () => {
    if (worked.panel.wires.length !== 4 || worked.rules.length !== 3) throw new Error(`${worked.panel.wires.length} wires, ${worked.rules.length} rules`);
    await fits(table.wires);
    await fits(table.rulebook);
  });
  await check('choosing a wire shows on the rulebook phone, and can be undone', async () => {
    await table.wires.getByRole('button', { name: 'Wire 2', exact: true }).click();
    await sees(table.rulebook, '.rulebook .mirror__label', /Cutters are over wire 2/i);
    await sees(table.wires, '.wires > .btn', /Cut wire 2/);
    await table.wires.getByRole('button', { name: 'Wire 2', exact: true }).click();
    await sees(table.rulebook, '.rulebook .mirror__label', /No wire chosen yet/i);
    await sees(table.wires, '.wires > .btn', /Tap a wire to choose it/);
  });
  await check('cutting the wrong wire costs a life on both phones', async () => {
    await cutWire(table.wires, (worked.cut + 1) % worked.panel.wires.length);
    await sees(table.wires, '.toast', /Wrong wire\. 2 lives left\./);
    await sees(table.rulebook, '.toast', /Wrong wire\. 2 lives left\./);
    if ((await livesLeft(table.wires)) !== 2 || (await livesLeft(table.rulebook)) !== 2) throw new Error('lives did not drop to 2 on both');
    await sees(table.rulebook, '.rulebook .mirror__label', /No wire chosen yet/i);
  });
  await check('the second hint names the line that is true', async () => {
    await table.rulebook.getByRole('button', { name: 'Hint' }).click();
    await table.rulebook.getByRole('button', { name: 'Show a hint' }).click();
    await sees(table.wires, '.hints li', /Rulebook holder: ask how many wires/);
    await table.wires.getByRole('button', { name: 'Show another hint' }).click();
    await sees(table.rulebook, '.hints li:nth-child(2)', new RegExp(`line ${worked.line + 1} is the first one that is true`));
    for (const page of [table.wires, table.rulebook]) {
      await page.waitForFunction(() => !document.querySelector('.overlay.is-leaving'));
      await page.getByRole('button', { name: 'Got it' }).click();
      await page.waitForSelector('.overlay', { state: 'detached' });
    }
  });
  await check('cutting the right wire unlocks on both phones', async () => {
    await cutWire(table.wires, worked.cut);
    await sees(table.wires, '.curtain__title', /Unlocked/);
    await sees(table.rulebook, '.curtain__title', /Unlocked/, 2000);
  });

  console.log('\nColor Wires: levels 2 to 4');
  const expectLevel = {
    2: (w) => { if (w.panel.wires.length !== 5 || w.rules.length !== 4) throw new Error('not five wires and four rules'); },
    3: (w) => { if (w.panel.wires.length !== 6 || w.rules.length !== 4) throw new Error('not six wires and four rules'); },
    4: (w) => {
      if (w.panel.wires.length !== 6 || w.rules.length !== 5) throw new Error('not six wires and five rules');
      if (w.panel.lamp === null || w.panel.plate === null) throw new Error('no lamp or number plate on the panel');
    },
  };
  for (const level of [2, 3, 4]) {
    await check(`level ${level} deals the right panel, fits, and opens`, async () => {
      await table.rulebook.getByRole('button', { name: 'Next clue' }).click();
      await sees(mark, '.hud__where', new RegExp(`${level} of 5`, 'i'));
      await sees(joy, '.hud__where', new RegExp(`${level} of 5`, 'i'));
      const before = table.holder.wires;
      table = await byHalf(mark, joy);
      if (table.holder.wires === before) throw new Error('the halves did not swap');
      worked = await workOut(table);
      expectLevel[level](worked);
      await shot(table.wires, `wires-panel-level${level}`);
      await shot(table.rulebook, `wires-rules-level${level}`);
      await fits(table.wires);
      await fits(table.rulebook);
      await cutWire(table.wires, worked.cut);
      await sees(table.rulebook, '.curtain__title', /Unlocked/);
    });
  }

  console.log('\nColor Wires: level 5 (two panels)');
  await check('level 5 starts on panel 1 of 2', async () => {
    await table.wires.getByRole('button', { name: 'Next clue' }).click();
    await sees(mark, '.hud__where', /5 of 5/i);
    table = await byHalf(mark, joy);
    await sees(table.wires, '.panel__label', /Panel 1 of 2/i);
    await sees(table.rulebook, '.rulebook__label', /Panel 1 of 2/i);
  });
  let firstPanel = null;
  await check('the right wire on panel 1 moves both phones to panel 2', async () => {
    firstPanel = await workOut(table);
    await fits(table.wires);
    await fits(table.rulebook);
    await cutWire(table.wires, firstPanel.cut);
    await sees(table.wires, '.panel__label', /Panel 2 of 2/i);
    await sees(table.rulebook, '.rulebook__label', /Panel 2 of 2/i);
    if (await table.wires.locator('.curtain:not([hidden])').count()) throw new Error('unlocked after only one panel');
  });
  await shot(table.wires, 'wires-panel-level5');
  await shot(table.rulebook, 'wires-rules-level5');
  await check('reloading on panel 2 comes back to panel 2', async () => {
    await table.rulebook.reload();
    await sees(table.rulebook, '.rulebook__label', /Panel 2 of 2/i);
    await table.wires.reload();
    await sees(table.wires, '.panel__label', /Panel 2 of 2/i);
  });
  await check('a wrong wire on panel 2 costs a life but keeps you on panel 2', async () => {
    worked = await workOut(table);
    await cutWire(table.wires, (worked.cut + 1) % worked.panel.wires.length);
    await sees(table.rulebook, '.toast', /Wrong wire\. 2 lives left\./);
    await sees(table.wires, '.panel__label', /Panel 2 of 2/i);
  });
  await check('the right wire on panel 2 unlocks, and Finish ends the run on both phones', async () => {
    await cutWire(table.wires, worked.cut);
    await sees(table.rulebook, '.curtain__title', /Unlocked/);
    await table.rulebook.getByRole('button', { name: 'Finish' }).click();
    await sees(mark, '.curtain__title', /All 5 solved/);
    await sees(joy, '.curtain__title', /All 5 solved/);
    await shot(mark, 'wires-finished');
    await mark.getByRole('button', { name: 'Back to the room' }).click();
    await sees(joy, '.headline', /You are both here/);
    if ((await readRoom(invite)).game) throw new Error('the finished run is still saved in the room');
  });

  await finish();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
