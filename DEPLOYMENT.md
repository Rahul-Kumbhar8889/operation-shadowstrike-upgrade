# Tactical missions release

This branch adds an original three-operation single-player campaign to the existing two-player multiplayer game. It is inspired by tactical infiltration and arena combat; it does not include Project IGI or Counter-Strike files.

## Recommended Render deployment: one Web Service

Create a **new Web Service** from this repository, branch `feat/tactical-mission`. Keep the existing main services and graphics preview unchanged.

- Root directory: blank
- Build: `npm ci --include=dev --no-audit --no-fund && npm run build`
- Start: `npm start`
- Health check: `/health`
- Node: `22.22.0` (or compatible Node 22+)
- Do not set `VITE_SOCKET_SERVER_URL` for this single-service deployment.
- `render.yaml` contains the equivalent Blueprint configuration.

The service serves the built frontend and Socket.IO from the same HTTPS origin. Share the new service URL with both players. No second service or CORS setting is required. A free Render instance may sleep; the lobby allows up to 90 seconds to connect. Rooms are in memory and disappear on a server restart. Use one instance; horizontal scaling requires a shared room store and adapter.

For **separate static hosting**, build with `VITE_SOCKET_SERVER_URL=https://your-backend.onrender.com`, publish `dist`, and set backend `CORS_ORIGINS` to the exact frontend HTTPS origin. The existing main backend remains compatible with this branch's PvP mode; story mode runs locally.

## Local launch

```sh
npm ci
npm run build
npm start
```

Open `http://localhost:3001`. For development, start `npm run server` and `npm run dev` in separate terminals.

## Play

- **Story health:** 1000 HP. Each guard bullet deals 70 damage: fourteen hits leave 20 HP, and the fifteenth kills. On death the camera shows the fallen soldier and a Restart Mission / Back to Main Menu dialog. Restart restores 1000 HP and the current operation. PvP health remains 100.
- **Story Operations:** three sequential missions: Silent Entry, Black Frequency, Last Light. Enter the building through the open south doorway, eliminate all guards, use **E** at the green terminal, then **E** at the cyan extraction ring. The partition has a passage on its east side. The tactical map marks guards, the terminal and extraction.
- **Create / Join Room:** two-player PvP using a six-character code. Server controls weapon cooldowns, ammunition, damage, kills and three-second respawns. First to five kills wins. Damage stops at the result; both players click READY FOR REMATCH to reset the round. This is not a bomb-defusal mode.
- **Solo Training:** existing five-target practice arena.
- WASD move, Shift sprint, mouse aim, left click fire, R reload, 1/2/3 weapons, right click cycle weapon, Z sniper scope, V camera, E mission interaction, M menu, Esc release cursor.
- Story defaults to first-person. Release the cursor to use retry/next/menu buttons. Story pauses when the cursor is released. Training and PvP can also use V to switch perspective.

## Verification and limits

Automated tests cover objective ordering, failure state, a navigable path through every mission interior, two network clients using polling/WebSocket, shooting, reload, respawn, room capacity, disconnection, CORS, health checks and rejection of source-file requests. Build emits a non-fatal JavaScript bundle size warning.

Story is single-player, not synchronized co-op. Guards use line-of-sight and obstacle-aware local steering, not a navigation mesh; they do not plan routes around whole buildings. Soldiers use original rounded procedural geometry and animation, not photorealistic scanned/rigged assets. Desktop keyboard and mouse are required. Campaign progress resets when the page reloads. No matchmaking, persistent accounts, mobile controls or commercial anti-cheat is claimed.

Before final submission, play all three missions on the deployed service and run a full two-device PvP session over separate networks. Check movement, walls, health, kills, reload, death/respawn, leaving/rejoining and wrong/full room errors. A local automated pass is not a substitute for this deployed acceptance test.

## Repeat browser checks

```sh
npm run build
npx playwright install chromium
node scripts/browser-smoke.mjs
```

The smoke check launches the production server, verifies story start/retry/menu and training, then joins a room from two isolated browser contexts. It saves a screenshot under `artifacts/`. This checks browser sessions on one machine, not two physical devices.

For the extended health/death/restart/menu browser check, run `node scripts/browser-smoke.mjs --death`. This waits for real guard fire in the first mission.

## Expanded tactical upgrade

Six selectable weapons (keys 1–6): AR-4, SR-8, P-12, suppressed Spectre SMG, Breacher eight-pellet shotgun, Sentinel LMG. Hold left mouse for automatic weapons. Weapons share one catalogue on server/client; the server resolves shotgun pellets and consumes one shell.

Each original operation now spans a 210m movement area, five enterable installations, five ordered terminal objectives and extraction, with 12–14 guards. Follow the numbered objective; clear guards within 12m before interacting. It is not necessary to kill every guard on the map. The operator is an original 1.9m articulated model with tapered torso, bent elbows/knees, camouflage, curved armor, face detail and merged mesh batches. It is procedural, not a photorealistic scanned character.

## Field equipment and four-operation update

Tactical branch only; the original `main` and its Render services remain untouched.

- Nine firearm slots (`1`–`9`): AR-4, SR-8, P-12, Spectre SMG, Breacher shotgun, Sentinel LMG, Vanguard carbine, Raven heavy assault and Falcon DMR. Firearms, magazines, pellets and damage share one server/browser catalogue.
- `G`: three frag grenades per life/operation; 1.8s fuse, 9m falloff, walls block blast. Frag damages enemy guards/opponents; friendly/self damage is disabled.
- `B`: two smoke grenades; 1s fuse and 16s concealment. Story guards lose sight; PvP receives replicated smoke and concealment. Bullets and grenades still penetrate smoke.
- `H`: three field injections; story heals up to 350 HP, PvP up to 35, capped at each mode's health maximum. No revival and no consumption at full health. Server validates PvP inventory, cooldowns, throw origin and health.
- Four solo story operations, selectable from the lobby: the first three have six installations, Iron Horizon has seven. World movement bounds are ±155m. Each operation has 16–20 guards and a route over 400m; guards investigate nearby gunfire. Objectives use interruptible 3–10s terminal actions followed by extraction. These are original abstract terminal tasks, not a vehicle/escort or fully simulated sabotage system.
- Camera-mounted first-person weapons; `V` returns to the improved articulated procedural operator. Original camouflage, cloth folds, gear and elbow/knee motion; not photorealistic asset scans.
- Textured compounds, perimeter hills/trees, radar landmark, fuel stores, towers and a runway in operation four. Interior collision remains aligned with rendered walls.
- Procedural Web Audio gun/noise profiles, reload, footsteps, pin, explosion, smoke, objective and healing cues. Browser interaction unlocks audio. The Sound button mutes effects.
- Room mode remains authoritative 1v1, first to five kills; missions are solo, not network co-op. Campaign retains 1000 HP and the existing failure/restart flow. No IGI or Counter-Strike assets were copied.

Verification: `npm test`, `npm run build`, `node scripts/browser-smoke.mjs`, `node scripts/campaign-integration.mjs`. Set `BROWSER_EXECUTABLE` if Playwright's default browser is unavailable. Integration tests exercise all four objective chains with simulated movement/combat, not a complete manual playthrough. Smoke tests cover all lobby mission selections, weapon keys, inventory, mute, and two browser contexts joining/leaving a room.
