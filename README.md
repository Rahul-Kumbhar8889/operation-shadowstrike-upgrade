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
