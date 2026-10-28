import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MISSIONS,
  missionWalls,
  blocked,
  interactMission,
} from "../shared/campaign.js";
for (let index = 0; index < MISSIONS.length; index++) {
  const m = MISSIONS[index];
  test(`${m.name}: cannot skip guards, terminal, or extraction`, () => {
    const initial = { index, status: "active", intel: false };
    const pos = (p) => ({ x: p[0], z: p[1] });
    assert.equal(interactMission(initial, pos(m.extract), 0), initial);
    assert.equal(interactMission(initial, pos(m.objective), 1), initial);
    assert.equal(interactMission(initial, { x: 44, z: 44 }, 0), initial);
    const intel = interactMission(initial, pos(m.objective), 0);
    assert.equal(intel.intel, true);
    const complete = interactMission(intel, pos(m.extract), 0);
    assert.equal(complete.status, "complete");
    assert.equal(interactMission(complete, pos(m.objective), 0), complete);
    const failed = { ...initial, status: "failed" };
    assert.equal(interactMission(failed, pos(m.objective), 0), failed);
  });
  test(`${m.name}: entrance and interior route are physically traversable`, () => {
    const walls = missionWalls(m.building),
      [x, z] = m.building;
    assert.equal(blocked(x, z + 4, walls), false, "door is open");
    assert.equal(blocked(x - 3, z + 4, walls), true, "wall remains solid");
    const start = [x, z + 6],
      goal = m.objective,
      queue = [start],
      seen = new Set([start.join(",")]);
    let reached = false;
    for (let i = 0; i < queue.length; i++) {
      const [a, b] = queue[i];
      if (Math.hypot(a - goal[0], b - goal[1]) < 1) {
        reached = true;
        break;
      }
      for (const [dx, dz] of [
        [0.5, 0],
        [-0.5, 0],
        [0, 0.5],
        [0, -0.5],
      ]) {
        const n = [a + dx, b + dz],
          key = n.join(",");
        if (
          Math.abs(n[0] - x) > 7 ||
          Math.abs(n[1] - z) > 7 ||
          seen.has(key) ||
          blocked(...n, walls)
        )
          continue;
        seen.add(key);
        queue.push(n);
      }
    }
    assert.ok(reached, "player can navigate partition to terminal");
  });
}

// Survival tuning applies to every story operation, not PvP.
test('story health survives fourteen guard bullets and reaches zero on bullet fifteen', async () => {
  const {CAMPAIGN_MAX_HP, GUARD_BULLET_DAMAGE} = await import('../shared/campaign.js');
  assert.equal(CAMPAIGN_MAX_HP,1000);
  for(const mission of MISSIONS) {
    assert.equal(mission.damage,GUARD_BULLET_DAMAGE);
    let hp=CAMPAIGN_MAX_HP;
    for(let hit=1;hit<=14;hit++) {hp=Math.max(0,hp-mission.damage);assert.ok(hp>0);}
    assert.equal(hp,20);
    assert.equal(Math.max(0,hp-mission.damage),0);
  }
});
