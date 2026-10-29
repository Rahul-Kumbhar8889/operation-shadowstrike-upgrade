import {test} from 'node:test';import assert from 'node:assert/strict';import {MISSIONS,installationLayout,campaignObstacles,guardSpawn,blocked,dualNodes} from '../shared/campaign.js';import {createCoop,coopSpawn} from '../server/coop.js';
test('operations have four distinct interiors and every guard spawns outside shared collision',()=>{
 assert.equal(new Set(MISSIONS.map(m=>JSON.stringify(installationLayout(m).walls.map(([, ,w,h,d])=>[w,h,d])))).size,4);
 for(let i=0;i<MISSIONS.length;i++){const m=MISSIONS[i],boxes=campaignObstacles(m),c=createCoop(i);for(const g of c.guards){assert.equal(blocked(g.x,g.z,boxes),false);assert.deepEqual([g.x,g.z],guardSpawn(m.guards[g.id],boxes));}for(let slot=0;slot<2;slot++){const p=coopSpawn(c,slot);assert.equal(blocked(p.x,p.z,boxes),false);}}
});
test('expanded freight checkpoint has an open route from entrance to objective',()=>{
 const m=MISSIONS[0],layout=installationLayout(m,2),[x,z]=m.sites[2],goal=m.steps[2].position;
 assert.equal(layout.w,16);assert.equal(layout.d,12);assert.equal(blocked(...goal,layout.walls),false);
 const queue=[[x,z+layout.d/2+1]],seen=new Set();let reached=false;
 for(let i=0;i<queue.length;i++){const [a,b]=queue[i],key=`${Math.round(a*2)},${Math.round(b*2)}`;if(seen.has(key))continue;seen.add(key);if(Math.hypot(a-goal[0],b-goal[1])<.75){reached=true;break;}
  for(const [dx,dz] of [[.5,0],[-.5,0],[0,.5],[0,-.5]]){const px=a+dx,pz=b+dz;if(Math.abs(px-x)<=layout.w/2+2&&Math.abs(pz-z)<=layout.d/2+2&&!blocked(px,pz,layout.walls))queue.push([px,pz]);}}
 assert.ok(reached,'checkpoint center remains reachable');
});
test('communications bunker has reachable, separated data racks',()=>{
 const m=MISSIONS[1],site=3,layout=installationLayout(m,site),[x,z]=m.sites[site],nodes=dualNodes(m.steps[site]);
 assert.equal(layout.w,16);assert.equal(layout.d,12);assert.ok(Math.hypot(nodes[0][0]-nodes[1][0],nodes[0][1]-nodes[1][1])>4.8);
 for(const node of nodes){assert.equal(blocked(...node,campaignObstacles(m)),false);const queue=[[x,z+layout.d/2+1]],seen=new Set();let reached=false;
  for(let i=0;i<queue.length;i++){const [a,b]=queue[i],key=`${Math.round((a-x)*2)},${Math.round((b-z)*2)}`;if(seen.has(key))continue;seen.add(key);if(Math.hypot(a-node[0],b-node[1])<1){reached=true;break;}
   for(const [dx,dz] of [[.5,0],[-.5,0],[0,.5],[0,-.5]]){const px=a+dx,pz=b+dz;if(Math.abs(px-x)<=layout.w/2+2&&Math.abs(pz-z)<=layout.d/2+2&&!blocked(px,pz,layout.walls))queue.push([px,pz]);}}
  assert.ok(reached,'each data rack is reachable through the bunker');}
});
