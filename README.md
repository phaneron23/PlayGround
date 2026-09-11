# PlayGround
Playground for browser game experiments

## Warcraft 3D (browser RTS)
A Warcraft-style 3D real-time strategy demo built on Three.js (CDN, no build step).

- `index.html` — shell + HUD + minimap + help overlay
- `css/style.css` — Warcraft-style dark/gold UI
- `js/` — `main.js` (boot/loop), `game.js` (state/combat/economy/waves),
  `controls.js` (camera/selection/orders), `world.js` (terrain/trees/mine),
  `units.js` (procedural low-poly meshes), `config.js`, `audio.js` (WebAudio SFX), `ui.js`

Run: serve the repo root (`python3 -m http.server 8080`) and open
`http://localhost:8080/`. Goal: defend your Town Hall, harvest gold/wood
with Peasants, raise Footmen + Farms, survive Orc waves, destroy the Orc
Stronghold north-east.
