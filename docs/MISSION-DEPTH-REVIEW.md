# Mission depth review — not deployed

This work is isolated on `feat/mission-depth-review`. Do not push to the Render-connected tactical branch until Rahul approves deployment.

## Player-facing changes

- Four existing operations now contain five equipment interactions: recover a case (1s), isolate a switch (3s), plant a charge (7s), download data (14s), and defend a relay (25s).
- Begin every interaction within 2.4m using E. For defense, remain within the marked 14m area and continue fighting. Other actions require staying within 2.4m and clearing guards within 12m.
- Nearby guards converge on an active defense. Co-op guards investigate audible weapon fire; suppressed weapons have a smaller hearing radius.
- Cases disappear when collected. Sabotaged controllers show a controlled explosion and remain scorched. This is an equipment interaction, not a free-placement explosive system or destructible building simulation.
- Distinct cases, switch cabinets, server racks, charge controllers and radio relays replace identical green terminals.
- Objective action progress, an expandable operation checklist, route line, compass bearing and distance support navigation.
- Solid freight wagons, a communications mast, parked trucks and a static aircraft distinguish the four compounds. These are scenery/cover, not driveable vehicles.
- Mission lighting/sky and building details improve environmental distinction. Returning to training or PvP restores the original atmosphere.
- Existing 1000HP campaign health, nine firearms, inventory, death poses, room codes and automatic campaign transitions remain.

## Validation

Run `npm test`, `npm run build`, and the campaign, co-op, mobile and hybrid browser scripts with BROWSER_EXECUTABLE set to an installed Chromium.

## Review limits

Character meshes remain original procedural operators, not photorealistic scanned soldiers. The maps still use the existing compound layout and basic AI steering, not a navigation mesh. No driveable vehicles, hostage escort, persistent save, destructible buildings or physically simulated ragdolls are included. Automated campaign traversal verifies progression but does not replace a full human playthrough or physical phone testing. Render deployment is intentionally pending approval.
