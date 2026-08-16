# Lumen Stack

Lumen Stack is a portrait-first precision stacking game for desktop and mobile web.
Build a glowing sky garden, chain perfect placements, and charge Firefly Focus for
a wider, slower platform.

## Run locally

```powershell
npm install
npm start
```

Open `http://localhost:8082`. To test on a phone connected to the same Wi-Fi, open
the computer's LAN address with port `8082`.

## Controls

- Tap or click anywhere on the game canvas to place a platform.
- Press Space on desktop to place a platform.
- Use the top-right buttons to toggle sound or pause.

## Features

- Responsive portrait layout with mouse, touch, and keyboard input.
- Perfect-placement combo scoring.
- Firefly Focus power-up after three perfect placements.
- Adaptive floor mission with a completion bonus.
- Local best-score and audio-preference persistence.
- Runtime Canvas graphics and Web Audio sound effects.
- No CDN, analytics, remote API, external font, or backend dependency.
- YouTube Playables SDK integration for readiness, audio, pause/resume, cloud save,
  and score reporting. Outside YouTube, local storage is used as a fallback.

## Create a Playables bundle

```powershell
npm run release
tar.exe -a -c -f release/lumen-stack.zip -C release/lumen-stack index.html src assets LICENSE ATTRIBUTION.md
```

The ZIP root contains `index.html`, `src/`, `assets/`, `LICENSE`, and
`ATTRIBUTION.md`. Upload that ZIP only after your channel is onboarded to the
YouTube Playables Developer Portal.

## Licensing and attribution

See `LICENSE` and `ATTRIBUTION.md`. The original Tower Game MIT copyright notice
is preserved as required by its license.
