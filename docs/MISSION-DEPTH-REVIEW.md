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

## Additional release polish

- Existing self-hosted Poly Haven maps are now applied to mission terrain, concrete, roads and metal; procedural materials remain the loading fallback.
- Nine original firearm models have distinct barrels, magazines, stocks and sight assemblies, batched into at most four material meshes per visible weapon.
- Periodic multiplayer snapshots preserve fallen bodies and reset their articulated pose after revival/respawn.
- Cooperative revival: press E within 3m of a downed teammate, stay within range without taking damage for 4 seconds, consume one injection and restore 350HP. Leaving range, damage or missing supplies cancels the action. All-down still fails the mission.
- Unlocked co-op view renders at 1Hz to avoid queuing expensive scenery frames while players use menus. Camera-locked gameplay retains the normal render loop.

## Validation

Current unit checks: 51 passed. Production build passed; larger-than-500KB bundle warning remains. Two isolated browser sessions passed co-op joining/start/shared objective/pause, and a dedicated two-browser fixture passed downed-state replication, timed revival, 350HP recovery and exactly one injection consumed. The fixture seeds a downed state in memory; it adds no shipped endpoint or debug listener. Software-rendered checks initially stalled under concurrent rendering; reducing unlocked co-op rendering to 1Hz allowed the revive check to complete. Final mouse/touch laptop firing, mobile touch controls and all-four-operation traversal passed after the final code changes. This is not deployment approval.

Run `npm test`, `npm run build`, and the campaign, co-op, mobile and hybrid browser scripts with BROWSER_EXECUTABLE set to an installed Chromium.

## Review limits

The rigged operator uses source-model bounds measured before cloning; a whole-character regression test checks body and weapon size at distant coordinates. The original procedural operator remains the loading fallback. The maps still use the existing compound layout and basic AI steering, not a navigation mesh. No driveable vehicles, hostage escort, persistent save, destructible buildings or physically simulated ragdolls are included. Automated campaign traversal verifies progression but does not replace a full human playthrough or physical phone testing. Render deployment is intentionally pending approval.

## Current changes

Four distinct interior layouts now share collision with the server, guards are moved out of blocked spawn locations, and soldier locomotion, firing, reload and death use the corrected rigged model. Low, Balanced and High graphics choices control shadows, resolution and guard detail. Automated checks pass; real-device testing remains required.
