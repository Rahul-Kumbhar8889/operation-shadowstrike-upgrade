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
