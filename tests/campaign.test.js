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
    let progress=initial;
    for(let step=0;step<m.steps.length;step++){
      if(step+1<m.steps.length)assert.equal(interactMission(progress,pos(m.steps[step+1].position),0),progress,'cannot skip objectives');
      if(m.steps[step].kind==='defend')assert.equal(interactMission(progress,pos(m.steps[step].position),1).step,step+1,'defense permits enemy presence');
      else assert.equal(interactMission(progress,pos(m.steps[step].position),1),progress,'nearby guard blocks equipment interaction');
      progress=interactMission(progress,pos(m.steps[step].position),0);
      assert.equal(progress.step,step+1);
    }
    assert.equal(progress.intel,true);
    const complete=interactMission(progress,pos(m.extract),0);assert.equal(complete.status,'complete');
    assert.equal(interactMission(complete,pos(m.objective),0),complete);
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

test('expanded operations have six or more separate installations, long routes and guarded extraction',()=>{
 for(const m of MISSIONS){assert.ok(m.steps.length>=6);assert.ok(m.guards.length>=16);let distance=0;let last=m.building;for(const step of m.steps){distance+=Math.hypot(step.position[0]-last[0],step.position[1]-last[1]);last=step.position;}distance+=Math.hypot(m.extract[0]-last[0],m.extract[1]-last[1]);assert.ok(distance>400);}
});
