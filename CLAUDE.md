# Sprunkee — notes for agents

- Plain static site: no build step. `index.html` loads `audio.js` → `sounds.js` → `art.js` → `game.js` (globals, in that order).
- All art is canvas-drawn (`art.js`), all audio is synthesized (`audio.js`). Keep it that way: original art and music only, no samples or licensed characters.
  - One exception, by Jesse/Ian's request (2026-10-10): `music/intro.mp3` is the opening theme. It loops on the start stage and fades out when the first sound is added; Clear brings it back.
- Sounds are written in scale degrees / chord tones (`e.deg`, `e.chordNote`) so they fit both Day (C major) and Night (A minor). Don't hardcode MIDI notes for melodic parts.
- Kid audience: nothing scary, big touch targets, no text needed to play.
- Script order: `config.js` → `audio.js` → `sounds.js` → `art.js` → `progress.js` → `cloud.js` → `scene.js` → `game.js`.
- `SOUNDS` and `THEMES` (stages) are **append-only**: their index is baked into share codes (`cloud.js` `Jam.encode`). Unlockable sounds carry `unlock: true`; their goal lives in `progress.js` `GOALS`.
- Online (leaderboard + shared jams) is OFF by Jesse's call (2026-10-10): `config.js` URL stays empty, and the Top 10 / Jams tabs hide themselves. Code is kept dormant: `apps-script/Code.gs` + `SETUP.md`. As a claude.ai artifact it falls back to the artifact `db`; with neither, share links (`#jam-<code>-<INI>`) still work.
- `link` is a special friend (Ian's son, Link): always unlocked, gold, cape + crown, ×2 points while on stage. Keep him special.
- Shop = pretend purchases with in-game coins only (`SHOP` in `progress.js`). Never show real prices or real-money wording.
- Kid-safe by design: players only pick 3-letter initials and auto-generated jam names. Keep it that way (no free text).
- Test hook: `window.__sprunkee` (slots, assign(i, id), loadJam(code, ini), setStage(id), engine, party, stage). Levels can be checked offline: `new Engine(new OfflineAudioContext(...))` then `playStep()`.
- Bump `CACHE` in `sw.js` when shipping changes.
