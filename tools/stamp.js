// Gives every script and stylesheet a version tag inside index.html, so a phone
// can never end up with a mix of old and new files after an update.
//
//   node tools/stamp.js          rewrite index.html with the current tags
//   node tools/stamp.js --check  exit with an error if index.html is out of date
//
// Run it after changing anything in js/, css/ or vendor/, before publishing.
// (The tests run the check, so a forgotten stamp shows up as a failing test.)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');

function tag(file) {
  return crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, file))).digest('hex').slice(0, 8);
}

function scripts(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return scripts(file);
    return entry.name.endsWith('.js') ? [file] : [];
  });
}

function stamped(html) {
  const modules = [...scripts('js'), ...scripts('vendor')].sort();
  const imports = Object.fromEntries(modules.map((file) => [`./${file}`, `./${file}?v=${tag(file)}`]));
  const map = `<script type="importmap">\n${JSON.stringify({ imports }, null, 2)}\n  </script>`;

  const out = html
    .replace(/(<!-- stamp:modules -->)[\s\S]*?(<!-- \/stamp:modules -->)/, `$1\n  ${map}\n  $2`)
    .replace(/href="css\/app\.css(\?v=\w+)?"/, `href="css/app.css?v=${tag('css/app.css')}"`)
    .replace(/src="js\/main\.js(\?v=\w+)?"/, `src="js/main.js?v=${tag('js/main.js')}"`);

  for (const needed of ['<script type="importmap">', 'href="css/app.css?v=', 'src="js/main.js?v=']) {
    if (!out.includes(needed)) throw new Error(`index.html is missing the place for ${needed}`);
  }
  return out;
}

const before = fs.readFileSync(INDEX, 'utf8');
const after = stamped(before);

if (process.argv.includes('--check')) {
  if (before !== after) {
    console.error('index.html has out-of-date version tags. Run: node tools/stamp.js');
    process.exit(1);
  }
  console.log('version tags are up to date');
} else if (before !== after) {
  fs.writeFileSync(INDEX, after);
  console.log('index.html stamped');
} else {
  console.log('index.html already up to date');
}
