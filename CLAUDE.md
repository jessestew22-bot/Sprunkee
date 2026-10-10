# Sprunkee — notes for agents

- Plain static site: no build step. `index.html` loads `audio.js` → `sounds.js` → `art.js` → `game.js` (globals, in that order).
- All art is canvas-drawn (`art.js`), all audio is synthesized (`audio.js`). Keep it that way: original art and music only, no samples or licensed characters.
  - One exception, by Jesse/Ian's request (2026-10-10): `music/intro.mp3` is the opening theme. It loops on the start stage and fades out when the first sound is added; Clear brings it back.
- Sounds are written in scale degrees / chord tones (`e.deg`, `e.chordNote`) so they fit both Day (C major) and Night (A minor). Don't hardcode MIDI notes for melodic parts.
- Kid audience: nothing scary, big touch targets, no text needed to play.
- Test hook: `window.__sprunkee` (slots, assign(i, id), engine, party). Levels can be checked offline: `new Engine(new OfflineAudioContext(...))` then `playStep()`.
- Bump `CACHE` in `sw.js` when shipping changes.
