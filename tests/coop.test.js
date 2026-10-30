import {test} from 'node:test';import assert from 'node:assert/strict';
import {createCoop,coopSnapshot,coopSpawn,interactCoop,interactCoopResult,updateCoop,hurtGuard,coopBlast} from '../server/coop.js';
import {MISSIONS,blocked,dualNodes} from '../shared/campaign.js';
const noWall=()=>Infinity;
function room(index){const coop=createCoop(index);return {coop,players:new Map([['a',{position:coopSpawn(coop,0),alive:true,hp:1000,kills:0,deaths:0}],['b',{position:coopSpawn(coop,1),alive:true,hp:1000,kills:0,deaths:0}]]),smokes:[]};}
for(let index=0;index<MISSIONS.length;index++)test(`co-op ${index+1}: ordered shared actions, interruption, extraction, restart snapshot`,()=>{
 const r=room(index),c=r.coop,a=r.players.get('a'),b=r.players.get('b'),m=MISSIONS[index];
 assert.equal(interactCoop(r,'a'),false,'waiting room cannot progress');c.status='active';
 for(const guard of c.guards)hurtGuard(r,guard,100,'a',()=>{});assert.equal(a.kills,m.guards.length);
 for(let step=0;step<m.steps.length;step++){
  const [x,z]=m.steps[step].position;a.position={x,z};
  if(m.steps[step].kind==='sweep'){assert.equal(interactCoop(r,'a'),false);updateCoop(r,.1,Date.now(),noWall,()=>{});assert.equal(c.step,step+1);continue;}
  if(m.steps[step].kind==='dual'){for(const [node,[nx,nz]] of dualNodes(m.steps[step]).entries()){a.position={x:nx,z:nz};assert.ok(interactCoop(r,'a'));updateCoop(r,m.steps[step].duration+.1,Date.now(),noWall,()=>{});assert.equal(c.step,step+(node===1?1:0));}continue;}
  if(m.steps[step].kind==='rendezvous'){b.position={x,z};assert.equal(interactCoop(r,'a'),false);updateCoop(r,m.steps[step].duration+.1,Date.now(),noWall,()=>{});assert.equal(c.step,step+1);continue;}
  assert.ok(interactCoop(r,'a'));
  if(step===0){a.position.x+=4;updateCoop(r,.1,Date.now(),noWall,()=>{});assert.equal(c.task,null);a.position.x-=4;assert.ok(interactCoop(r,'a'));}
  updateCoop(r,m.steps[step].duration-.1,Date.now(),noWall,()=>{});assert.equal(c.step,step);updateCoop(r,.11,Date.now(),noWall,()=>{});
  if(m.steps[step].kind==='timedcharge'){assert.equal(c.step,step);assert.equal(coopSnapshot(r).chargeRemaining,10);a.position={x:x+20,z};b.position={x:x+20,z};updateCoop(r,10,Date.now(),noWall,()=>{});}
  assert.equal(c.step,step+1);
 }
 assert.ok(c.intel);a.position={x:m.extract[0],z:m.extract[1]};assert.equal(interactCoop(r,'a'),false,'teammate must reach extraction');b.position={...a.position};assert.ok(interactCoop(r,'a'));assert.equal(c.status,'complete');assert.equal(coopSnapshot(r).guards.filter(g=>g.hp>0).length,0);assert.equal(createCoop(index).status,'waiting');
});
test('co-op guards damage players on server; smoke blocks fire; all-down fails; one-player pauses',()=>{
 const r=room(0),c=r.coop;c.status='active';c.guards=[{id:0,x:0,z:0,homeX:0,homeZ:0,hp:100,phase:0,lastFire:0}];r.players.get('a').position={x:0,z:8};r.players.get('b').position={x:40,z:40};const events=[];
 updateCoop(r,.1,2000,noWall,(name,d)=>events.push([name,d]));assert.equal(r.players.get('a').hp,930);
 r.smokes=[{x:0,z:4,expires:Date.now()+16000}];updateCoop(r,.1,4000,noWall,()=>{});assert.equal(r.players.get('a').hp,930);
 r.players.delete('b');r.smokes=[];updateCoop(r,.1,6000,noWall,()=>{});assert.equal(r.players.get('a').hp,930,'requires two players');r.players.set('b',{position:{x:40,z:40},hp:0,alive:false});r.players.get('a').alive=false;updateCoop(r,.1,8000,noWall,()=>{});assert.equal(c.status,'failed');
});
test('co-op interaction explains the blocking condition without changing mission state',()=>{
 const r=room(0),c=r.coop,a=r.players.get('a'),b=r.players.get('b');
 assert.equal(interactCoopResult(r,'a').reason,'mission_not_active');c.status='active';
 assert.equal(interactCoopResult(r,'a').reason,'objective_too_far');const [x,z]=MISSIONS[0].steps[0].position;a.position={x,z};
 c.guards=[{id:0,x:x+3,z,hp:100}];assert.equal(interactCoopResult(r,'a').reason,'guards_nearby');c.guards=[];
 c.intel=true;c.step=MISSIONS[0].steps.length;const [ex,ez]=MISSIONS[0].extract;a.position={x:ex,z:ez};b.position={x:ex+20,z:ez};
 assert.equal(interactCoopResult(r,'a').reason,'team_not_at_extraction');assert.equal(c.status,'active');
 b.alive=false;b.position={...a.position};a.equipment={injection:0};assert.equal(interactCoopResult(r,'a').reason,'no_injection');
 r.players.delete('b');assert.equal(interactCoopResult(r,'a').reason,'need_teammate');
});
test('checkpoint sweep advances for both clients only when a player enters and nearby guards are cleared',()=>{
 const r=room(0),c=r.coop;c.status='active';c.step=2;c.boxes=[];const [x,z]=MISSIONS[0].steps[2].position;
 const a=r.players.get('a'),b=r.players.get('b');a.position={x:x+20,z};b.position={x:x+20,z};
 c.guards=[{id:0,x:x+10,z,homeX:x+10,homeZ:z,hp:100,rotation:0,phase:0,lastFire:0}];
 updateCoop(r,.01,0,noWall,()=>{});assert.equal(c.step,2);
 a.position={x,z};updateCoop(r,.01,0,noWall,()=>{});assert.equal(c.step,2,'living guard blocks progress');
 c.guards[0].hp=0;updateCoop(r,.01,0,noWall,()=>{});assert.equal(c.step,3);assert.equal(coopSnapshot(r).step,3);assert.equal(c.task,null);
});
test('data racks require two distinct actions, preserve progress, and share it with both players',()=>{
 const r=room(1),c=r.coop;c.status='active';c.step=3;c.guards=[];const step=MISSIONS[1].steps[3],nodes=dualNodes(step),a=r.players.get('a'),b=r.players.get('b');
 a.position={x:nodes[0][0],z:nodes[0][1]};assert.ok(interactCoop(r,'a'));updateCoop(r,step.duration+.1,0,noWall,()=>{});
 assert.deepEqual(coopSnapshot(r).dualDone,[0]);assert.equal(c.step,3);assert.equal(interactCoop(r,'a'),false,'completed rack cannot be used twice');
 b.position={x:nodes[1][0],z:nodes[1][1]};assert.ok(interactCoop(r,'b'));b.position.x+=4;updateCoop(r,.1,0,noWall,()=>{});assert.equal(c.task,null);assert.deepEqual(c.dualDone,[0]);
 b.position={x:nodes[1][0],z:nodes[1][1]};assert.ok(interactCoop(r,'b'));updateCoop(r,step.duration+.1,0,noWall,()=>{});assert.equal(c.step,4);assert.deepEqual(coopSnapshot(r).dualDone,[]);
});
test('detention yard requires all living players and resets its hold when interrupted',()=>{
 const r=room(2),c=r.coop;c.status='active';c.step=2;c.guards=[];const step=MISSIONS[2].steps[2],[x,z]=step.position,a=r.players.get('a'),b=r.players.get('b');
 a.position={x,z};b.position={x:x+30,z};updateCoop(r,2,0,noWall,()=>{});assert.equal(c.holdRemaining,null);
 b.position={x:x+2,z};updateCoop(r,3,0,noWall,()=>{});assert.equal(coopSnapshot(r).holdRemaining,5);
 b.position.x=x+20;updateCoop(r,.1,0,noWall,()=>{});assert.equal(c.holdRemaining,null,'leaving resets timer');
 b.position.x=x+2;c.guards=[{id:0,x:x+5,z,homeX:x+5,homeZ:z,hp:100,phase:0,lastFire:0}];updateCoop(r,1,0,noWall,()=>{});assert.equal(c.holdRemaining,null,'nearby guards prevent the hold');
 c.guards[0].hp=0;updateCoop(r,8,0,noWall,()=>{});assert.equal(c.step,3);assert.equal(coopSnapshot(r).holdRemaining,null);
});
test('fuel charge fuse is shared, pauses without a teammate, and damages only players inside blast radius',()=>{
 const r=room(3),c=r.coop;c.status='active';c.step=4;c.guards=[];const step=MISSIONS[3].steps[4],[x,z]=step.position,a=r.players.get('a'),b=r.players.get('b'),events=[];
 a.position={x,z};b.position={x:x+20,z};assert.ok(interactCoop(r,'a'));updateCoop(r,step.duration,0,noWall,()=>{});assert.equal(c.step,4);assert.equal(coopSnapshot(r).chargeRemaining,10);assert.equal(interactCoop(r,'a'),false);
 updateCoop(r,4,0,noWall,()=>{});assert.equal(c.chargeRemaining,6);r.players.delete('b');updateCoop(r,10,0,noWall,()=>{});assert.equal(c.chargeRemaining,6,'fuse pauses when teammate disconnects');
 r.players.set('b',b);updateCoop(r,6,0,noWall,(...e)=>events.push(e));assert.equal(c.step,5);assert.equal(a.hp,750);assert.equal(b.hp,1000);assert.equal(events.filter(([name])=>name==='player-hit').length,1);
});
test('lethal fuel detonation downs both players and fails the operation',()=>{
 const r=room(3),c=r.coop;c.status='active';c.step=4;c.guards=[];c.chargeRemaining=.1;const [x,z]=MISSIONS[3].steps[4].position,events=[];
 for(const p of r.players.values()){p.position={x,z};p.hp=250;}
 updateCoop(r,.1,0,noWall,(...event)=>events.push(event));assert.equal(c.status,'failed');assert.equal(events.filter(([name])=>name==='coop-player-down').length,2);assert.ok([...r.players.values()].every(p=>!p.alive));
});
test('all co-op spawns and terminals have valid shared collision; blast hits guards, not teammates',()=>{
 for(let i=0;i<MISSIONS.length;i++){const r=room(i),c=r.coop;for(const p of r.players.values())assert.equal(blocked(p.position.x,p.position.z,c.boxes),false);for(const step of MISSIONS[i].steps)assert.equal(blocked(...step.position,c.boxes),false);c.status='active';const g=c.guards[0];coopBlast(r,{x:g.x,z:g.z},'a',noWall,()=>{});assert.equal(g.hp,0);assert.equal(r.players.get('a').hp,1000);assert.equal(r.players.get('b').hp,1000);}
});

test('railway sabotage draws nearby surviving patrols toward the fuel site after detonation',()=>{
 const r=room(0),c=r.coop;c.status='active';c.step=4;c.boxes=[];
 const [x,z]=MISSIONS[0].steps[3].position;
 for(const p of r.players.values())p.position={x:-150,z:150};
 const g={id:0,x:x+30,z,homeX:x+30,homeZ:z,hp:100,rotation:0,lastFire:0,phase:0};c.guards=[g];
 updateCoop(r,.5,0,noWall,()=>{});assert.ok(g.x<x+30,'patrol investigates blast rather than staying on home patrol');
 assert.equal(c.step,4,'investigation does not skip the manifest objective');
 assert.equal(MISSIONS[0].steps[3].kind,'timedcharge');
});
