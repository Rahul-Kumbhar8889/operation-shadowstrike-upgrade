export const CAMPAIGN_MAX_HP = 1000;
export const GUARD_BULLET_DAMAGE = 70; // 14 hits leave 20 HP; hit 15 is fatal.

// Original campaign definitions. Coordinates use the existing compound world.
export const MISSIONS = [
  {
    name: "01 / SILENT ENTRY",
    brief:
      "Infiltrate the west intelligence office. Secure the guards, recover the dossier, then reach extraction.",
    building: [-27, -20],
    objective: [-27, -22],
    extract: [-27, 12],
    action: "RECOVER DOSSIER",
    guards: [
      [-27, -20],
      [-23, -15],
      [-31, -12],
    ],
    damage: GUARD_BULLET_DAMAGE,
  },
  {
    name: "02 / BLACK FREQUENCY",
    brief:
      "Enter the east communications bunker. Neutralize its security detail and disable the transmitter.",
    building: [27, -20],
    objective: [27, -22],
    extract: [27, 12],
    action: "DISABLE TRANSMITTER",
    guards: [
      [27, -20],
      [23, -15],
      [31, -12],
      [27, -9],
    ],
    damage: GUARD_BULLET_DAMAGE,
  },
  {
    name: "03 / LAST LIGHT",
    brief:
      "Raid the southern command post. Retrieve the command archive and evacuate alive.",
    building: [0, 28],
    objective: [0, 26],
    extract: [0, 0],
    action: "RECOVER COMMAND ARCHIVE",
    guards: [
      [0, 28],
      [-4, 33],
      [4, 33],
      [-6, 23],
      [6, 23],
    ],
    damage: GUARD_BULLET_DAMAGE,
  },
];
export function missionWalls([x, z]) {
  // South entrance is two metres wide; every wall has identical collision/render geometry.
  return [
    [x - 5, z, 0.35, 3.5, 8],
    [x + 5, z, 0.35, 3.5, 8],
    [x, z - 4, 10, 3.5, 0.35],
    [x - 3, z + 4, 4, 3.5, 0.35],
    [x + 3, z + 4, 4, 3.5, 0.35],
    [x - 2, z, 5.5, 3.5, 0.25],
  ];
}
export function blocked(x, z, boxes, r = 0.38) {
  return boxes.some(
    ([a, b, w, , d]) =>
      Math.abs(x - a) < w / 2 + r && Math.abs(z - b) < d / 2 + r,
  );
}
export function interactMission(state, position, livingGuards) {
  if (state.status !== "active") return state;
  const m = MISSIONS[state.index];
  const near = (p) => Math.hypot(position.x - p[0], position.z - p[1]) <= 2.4;
  if (!state.intel && near(m.objective) && livingGuards === 0)
    return { ...state, intel: true };
  if (state.intel && near(m.extract)) return { ...state, status: "complete" };
  return state;
}
