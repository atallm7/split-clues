import { configState, onConnectionChange, roundTrip, explainFailure } from './sync.js';

// Shown at the bottom of the screen so you can tell which version a phone has loaded.
const BUILD = 'Build 1 · setup check';

document.getElementById('build').textContent = BUILD;
scatterStars(document.getElementById('sky'));
checkBackend();

// ---------- Backdrop ----------

function scatterStars(sky, count = 34) {
  // Fixed seed so the sky looks the same every time rather than reshuffling on reload.
  let seed = 20261125;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const star = document.createElement('span');
    star.className = 'star';
    star.style.left = `${(rand() * 100).toFixed(2)}%`;
    star.style.top = `${(rand() * 72).toFixed(2)}%`;
    star.style.setProperty('--size', `${(1.2 + rand() * 2).toFixed(1)}px`);
    star.style.setProperty('--base', (0.25 + rand() * 0.55).toFixed(2));
    star.style.setProperty('--dur', `${(3.5 + rand() * 5).toFixed(1)}s`);
    star.style.setProperty('--delay', `${(-rand() * 8).toFixed(1)}s`);
    sky.appendChild(star);
  }
}

// ---------- Setup check ----------

function setBackend(state, detail) {
  document.getElementById('check-backend').dataset.state = state;
  document.getElementById('check-backend-detail').textContent = detail;
}

async function checkBackend() {
  const config = configState();
  if (config === 'missing') {
    setBackend('todo', 'Not set up yet. Waiting for the database address.');
    return;
  }
  if (config === 'invalid') {
    setBackend('fail', 'The database address does not look right.');
    return;
  }

  setBackend('working', 'Connecting…');
  let passed = false;

  // After the first success, keep showing whether this phone is still linked.
  onConnectionChange((connected) => {
    if (!passed) return;
    if (connected) setBackend('ok', 'Connected.');
    else setBackend('working', 'Connection lost. Reconnecting…');
  });

  try {
    const ms = await roundTrip();
    passed = true;
    setBackend('ok', `Connected. A test note went there and back in ${ms} ms.`);
  } catch (error) {
    console.error('Setup check failed:', error);
    setBackend('fail', explainFailure(error));
  }
}
