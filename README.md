# 🎵 Sprunkee

A kid-friendly music-mixing game inspired by Sprunki / Incredibox. Drag sounds onto the Sprunkees and build a song.

**Play:** https://jessestew22-bot.github.io/Sprunkee/ (once GitHub Pages is on, see below)

## How to play
1. **Drag** (or just **tap**) a round sound onto a sleepy grey Sprunkee. It wakes up and joins the band.
2. **Tap** a Sprunkee to hush it. Tap again to wake it.
3. Tap the **✕** to send it home.
4. Fill all 7 for a **SUPER JAM!** (confetti, disco lights, and a bonus fanfare).
5. Tap the **moon** for spooky Night mode. The whole band switches to a minor key.
6. The **dice** makes a surprise mix. The **↺** clears the stage.

## What's different from the original
- **20 characters, all original**, drawn in code. They bounce to the beat, sing with open mouths, blink, and watch your finger.
- **All music is synthesized live** (Web Audio): drums, bass, FM bells, marimba, chiptune, and formant-synth *singing voices*. No audio files, no samples.
- **Always in tune.** Every part is written in scale degrees over one chord progression, so any mix sounds good, and Night mode re-harmonizes everything automatically.
- **Kid-simple:** tap-to-add, big buttons, no reading needed, nothing scary (Night mode is cozy-spooky: moon, stars, fireflies).
- Works on phones, tablets and desktop. Add it to your home screen and it runs offline.

## Unlocks, goals and scores
- **20 goals** (🏆 button). Finishing them unlocks **12 secret friends** and **4 new stages** (Beach Party, Candy Land, Outer Space, Snow Day).
- **Points**: every bar your band plays earns points. More friends and more colors earn more, and SUPER JAM doubles it plus +500. A band left alone slowly earns less, so keep changing it up.
- **Top 10 leaderboard**: best single jam, with 3-letter arcade initials.
- **Share jams**: the share button posts your jam (auto-named, like "Funky Pickle Jam") to the 🎵 Jams list, and gives you a link anyone can open.

The leaderboard and Jams list need a free Google Sheet backend. See `apps-script/SETUP.md` (about 5 minutes). Without it, share links still work.

## Run locally
Any static server works:
```
npx http-server -p 8080 .
```

## Turn on GitHub Pages (one time)
Repo **Settings → Pages → Source: GitHub Actions**. The workflow in `.github/workflows/pages.yml` deploys on every push.

## Files
| File | What |
|---|---|
| `audio.js` | Synth engine, sequencer, mixer (reverb, delay, compressor) |
| `sounds.js` | The 20 sounds and their patterns, plus the Super Jam fanfare |
| `art.js` | Character, accessory and particle drawing |
| `game.js` | Layout, drag/tap input, stage, background, render loop |
