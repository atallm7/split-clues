# Split Clues

A cozy co-op puzzle game for two phones. Every puzzle is split in half: each
player sees only their half and the two solve it by talking.

Play it at https://atallm7.github.io/split-clues/

## How it is put together

- Plain HTML, CSS and JavaScript. There is no build step: the files in this
  folder are the website, served by GitHub Pages from the `main` branch.
- `index.html` is the page, `css/app.css` the look, `js/` the game code.
- `js/sync.js` is the only file that talks to the Firebase Realtime Database.
  `js/config.js` holds the database address.
- `js/game/` holds the rules every puzzle shares (who has which half, lives,
  hints, moving on) and the list of episodes. `js/puzzles/` has one file per
  puzzle type; each draws only the half a phone holds.
- `js/surprise.js` is the note and photo each player can leave for the other.
  It is stored beside the room, and a phone only fetches its partner's
  surprise on the last screen of a finished episode.
- `js/sound.js` makes the optional sound effects (off by default).
- `js/store.js` is what a phone remembers between visits (name, room, which
  player it is, and small switches like the timer and sound). The room id also
  lives in the page address, so a Home Screen icon made from inside a room
  opens that room.
- `sw.js` lets the game open without signal and keeps the page itself fresh.
- `database.rules.json` is a copy of the rules pasted into the Firebase console.
- `vendor/firebase.js` is the Firebase database library bundled into one file,
  and `fonts/` holds the Fraunces typeface (SIL Open Font License).

## Publishing a change

After changing anything in `js/`, `css/` or `vendor/`, refresh the version tags
in `index.html`, then commit and push to `main`:

```bash
node tools/stamp.js
```

The tags make sure a phone never runs a mix of old and new files.

## Tests

The tests play the game on two pretend iPhones at once, against a local copy of
the database (the Firebase emulator), and never touch the real one. They need
Node with Playwright, Java, and the Firebase CLI.

```bash
FIREBASE_BIN=/path/to/firebase tests/run.sh
```

Add names to run only some of the two-phone tests, for example
`tests/run.sh rooms story`. The `*.unit.test.js` files deal thousands of
puzzles of each type and check every one can be solved from its two halves.

## Recording a demo video

`tools/demo-video.js` plays Episode 1 on two phones side by side, with
captions, against the local emulator, and saves an MP4 (needs ffmpeg):

```bash
firebase emulators:exec --config tests/firebase.json --only database --project demo-split-clues "node tools/demo-video.js demo.mp4"
```

## Adding an episode

Episodes are listed in `js/game/episodes.js`. A story is a list of puzzles,
each naming a puzzle type, a level, a chapter name and a line shown once it is
solved.

## Trying it on a computer

Serve the folder with any static web server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. To act as the second player, open the
invite link in a private window, which has its own separate memory like a
second phone would.
