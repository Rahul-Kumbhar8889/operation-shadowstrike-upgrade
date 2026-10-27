# OPERATION SHADOWSTRIKE — Tactical Multiplayer Shooter

An original IGI-inspired Three.js tactical shooter built from the supplied project source. This package **does not include or redistribute Project IGI game assets**.

## Quick start

Requires Node.js 20.19+ (or 22+).

```bash
npm install
npm run server
```

Open a second terminal:

```bash
npm run dev
```

Open the Vite URL (usually http://localhost:5173). The Vite proxy forwards `/socket.io` to the Node multiplayer server on port 3001.

**StackBlitz:** Open the folder as a project, run `npm install`, then run `npm run server` and `npm run dev` in separate terminals. If your environment supports only one long-running process, use two terminals or a compatible hosting setup. For multiplayer, both players must reach the same server instance.

## Controls

- WASD — move
- Shift — sprint
- Mouse — camera / aim; click game to lock pointer
- Left click — fire
- Right click — cycle weapons
- 1, 2, 3 — assault rifle, sniper, pistol
- R — reload
- Z — sniper scope
- Esc — unlock cursor

## Game modes

- **Solo training:** local target practice, no server required.
- **Multiplayer:** create a six-character room code and share it with another player; maximum 2 players per room. A running Socket.IO server is required.

## Changes

- Original main gameplay and multiplayer event protocol retained.
- Original-style animated soldier rig, vector weapon illustrations and tactical HUD.
- Original procedural battlefield details (roads, watchtowers, floodlights, cover, vegetation).
- Integrated synthesized gunshots, reload, hit and elimination cues, muzzle flash and shell ejection.
- Vite proxy and separate server script for local multiplayer setup.

## Notes

The battlefield decorations are visual only; the original client/server collision obstacle boxes are authoritative. Sound starts after browser user interaction. Browser audio restrictions may mute sound until you click the game. The server is a demonstration-grade two-player room server, not a production anti-cheat implementation.

## Public multiplayer and Render deployment

The local Vite `/socket.io` proxy exists only in `npm run dev`. A production
static build cannot forward requests to the Node server. Previously the client
always connected to the page origin, so a separately hosted frontend had no
route to the multiplayer backend. A room code identifies a room in one running
server's memory; it does not locate a server or connect computers by itself.

### Deploy the multiplayer backend

1. Push these changes to GitHub. In Render choose **New → Blueprint**, connect
   `Rahul-Kumbhar8889/operation-shadowstrike-upgrade`, and select the branch
   containing `render.yaml`.
2. When asked for `CORS_ORIGINS`, enter the exact frontend origin, for example
   `https://your-game.onrender.com`. Multiple origins are comma-separated (no
   paths or trailing slashes). For local frontend testing against Render include
   `http://localhost:5173`. This setting is not a credential.
3. Deploy the Blueprint. It creates a Node web service with `npm install
   --omit=dev --no-audit --no-fund`, `node server/index.js`, and `/health` as its health
   check. Render supplies `PORT`; the server binds to `0.0.0.0`. No manual port
   value is necessary. Keep **one backend instance**, since rooms are in memory.
4. Copy the service's public HTTPS URL and request `https://YOUR-SERVICE.onrender.com/health`.
   Expect HTTP 200 and `{"status":"ok"}`. This checks service readiness, not
   multiplayer behavior. Free services can sleep; allow startup time and retry.

### Deploy the frontend

1. In Render choose **New → Static Site**, connect this repository and branch.
   Use build command `npm install --no-audit --no-fund && npm run build` and
   publish directory `dist`.
2. Before building, set `VITE_SOCKET_SERVER_URL` to the backend's public HTTPS
   origin, for example `https://operation-shadowstrike-server.onrender.com`.
   This is a public build-time value, not a secret. Do not use localhost,
   a private IP, a `ws://` URL, or append `/socket.io`.
3. Deploy. Set the backend's `CORS_ORIGINS` to the actual static site's HTTPS
   origin and redeploy the backend if the origin differs from the initial value.
4. Both players must open this same deployed game (or builds configured with
   the same backend URL). Player 1 creates a room; player 2 enters its code.
   A change to `VITE_SOCKET_SERVER_URL` requires a fresh frontend build/deploy.

For local development leave `VITE_SOCKET_SERVER_URL` unset and run the two
Quick start commands. To use a public backend locally, copy `.env.example` to
`.env`, set the real URL, allow the local frontend origin in `CORS_ORIGINS`, and
restart Vite. The server defaults to port 3001 and permits only
`http://localhost:5173` and `http://127.0.0.1:5173` unless `CORS_ORIGINS` is set.
Requests without an Origin header (health probes and command-line clients) are
accepted. Origin checks are browser access policy, not player authentication.

### Connection diagnostics and validation

The lobby shows connection/request progress, gives cold starts up to 90 seconds,
and gives room acknowledgements 10 seconds. Failures clear pending listeners;
retry is explicit. Entering solo training cancels pending connections. Polling
can upgrade to WebSocket; networks that block WebSocket can retain polling.
A disconnected match returns to the lobby because server-side players are
removed on disconnect; there is no automatic room/session restoration.

- If `/health` fails, inspect Render service logs and startup status.
- If the health check works but the browser connection fails, inspect the
  browser Network/Console for the `/socket.io` request URL, HTTPS mixed content,
  CORS origin rejection, or a blocked transport. Never disable TLS verification.
- `Room not found` after connection usually means a different backend or a
  server restart. Rooms disappear on deployment, restart, or free-service sleep.
- `npm test` starts an isolated backend on a dynamic port and exercises separate
  client connections, CORS, transport support, room lifecycle, and combat events.
  `npm run build` validates the production bundle. These are local checks.
- Before claiming public multiplayer works, test the deployed HTTPS game on
  **two different computers/networks**: create/join the same room, verify both
  players appear, movement/shots synchronize, damage/respawn work, and leaving
  updates the other player. Also test a sleeping service and a bad/unreachable
  backend. Public deployment and these real-world checks are not automated here.

### If Render returns “Not found” for `/health`

The server in this branch supports GET and HEAD on `/health` and `/health/`,
including query strings. Unknown paths still return 404. Socket.IO continues
handling `/socket.io` independently.

In the Render backend service's Settings, verify the linked repository is
`Rahul-Kumbhar8889/operation-shadowstrike-upgrade`, the branch contains this fix
(use `main` after merging), Root Directory is blank, Start Command is
`node server/index.js`, and Health Check Path is `/health`. The Blueprint
contains these start/health settings, but an existing manually created service
may still have different dashboard settings. Check the deployed commit in the
Render Events page against the merged GitHub commit, then choose Manual Deploy
→ Deploy latest commit. Wait for the deployment to finish and request the
backend's own public URL with `/health`; expect HTTP 200 and `{"status":"ok"}`.

Exact `/health` already existed in the earlier multiplayer fix. If that exact
URL returns the application's “Not found” response, verify the deployed commit,
service URL and entrypoint rather than assuming the current source lacks the
route. A local passing test cannot establish which code Render is running.
