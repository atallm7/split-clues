# Split Clues

A cozy co-op puzzle game for two phones. Every puzzle is split in half: each
player sees only their half and the two solve it by talking.

## How it is put together

- Plain HTML, CSS and JavaScript. There is no build step: the files in this
  folder are the website.
- `index.html` is the page, `css/app.css` the look, `js/` the game code.
- `js/sync.js` is the only file that talks to the Firebase Realtime Database.
  `js/config.js` holds the database address.
- `database.rules.json` is a copy of the rules pasted into the Firebase console.
- `vendor/firebase.js` is the Firebase database library bundled into one file,
  and `fonts/` holds the Fraunces typeface (SIL Open Font License).

## Trying it on a computer

Serve the folder with any static web server and open it in two browser tabs:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
