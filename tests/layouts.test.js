import {test} from 'node:test';import assert from 'node:assert/strict';import {MISSIONS,installationLayout,campaignObstacles,guardSpawn,blocked} from '../shared/campaign.js';import {createCoop,coopSpawn} from '../server/coop.js';
test('operations have four distinct interiors and every guard spawns outside shared collision',()=>{
 assert.equal(new Set(MISSIONS.map(m=>JSON.stringify(installationLayout(m).walls.map(([, ,w,h,d])=>[w,h,d])))).size,4);
 for(let i=0;i<MISSIONS.length;i++){const m=MISSIONS[i],boxes=campaignObstacles(m),c=createCoop(i);for(const g of c.guards){assert.equal(blocked(g.x,g.z,boxes),false);assert.deepEqual([g.x,g.z],guardSpawn(m.guards[g.id],boxes));}for(let slot=0;slot<2;slot++){const p=coopSpawn(c,slot);assert.equal(blocked(p.x,p.z,boxes),false);}}
});
