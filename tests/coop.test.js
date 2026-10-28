import {test} from 'node:test';import assert from 'node:assert/strict';
import {createCoop,coopSnapshot,coopSpawn,interactCoop,updateCoop,hurtGuard,coopBlast} from '../server/coop.js';
import {MISSIONS,blocked} from '../shared/campaign.js';
const noWall=()=>Infinity;
function room(index){const coop=createCoop(index);return {coop,players:new Map([['a',{position:coopSpawn(coop,0),alive:true,hp:1000,kills:0,deaths:0}],['b',{position:coopSpawn(coop,1),alive:true,hp:1000,kills:0,deaths:0}]]),smokes:[]};}
for(let index=0;index<MISSIONS.length;index++)test(`co-op ${index+1}: ordered shared actions, interruption, extraction, restart snapshot`,()=>{
 const r=room(index),c=r.coop,a=r.players.get('a'),b=r.players.get('b'),m=MISSIONS[index];
 assert.equal(interactCoop(r,'a'),false,'waiting room cannot progress');c.status='active';
 for(const guard of c.guards)hurtGuard(r,guard,100,'a',()=>{});assert.equal(a.kills,m.guards.length);
 for(let step=0;step<m.steps.length;step++){
  const [x,z]=m.steps[step].position;a.position={x,z};assert.ok(interactCoop(r,'a'));
  if(step===0){a.position.x+=4;updateCoop(r,.1,Date.now(),noWall,()=>{});assert.equal(c.task,null);a.position.x-=4;assert.ok(interactCoop(r,'a'));}
  updateCoop(r,m.steps[step].duration-.1,Date.now(),noWall,()=>{});assert.equal(c.step,step);updateCoop(r,.11,Date.now(),noWall,()=>{});assert.equal(c.step,step+1);
 }
 assert.ok(c.intel);a.position={x:m.extract[0],z:m.extract[1]};assert.equal(interactCoop(r,'a'),false,'teammate must reach extraction');b.position={...a.position};assert.ok(interactCoop(r,'a'));assert.equal(c.status,'complete');assert.equal(coopSnapshot(r).guards.filter(g=>g.hp>0).length,0);assert.equal(createCoop(index).status,'waiting');
});
test('co-op guards damage players on server; smoke blocks fire; all-down fails; one-player pauses',()=>{
 const r=room(0),c=r.coop;c.status='active';c.guards=[{id:0,x:0,z:0,homeX:0,homeZ:0,hp:100,phase:0,lastFire:0}];r.players.get('a').position={x:0,z:8};r.players.get('b').position={x:40,z:40};const events=[];
 updateCoop(r,.1,2000,noWall,(name,d)=>events.push([name,d]));assert.equal(r.players.get('a').hp,930);
 r.smokes=[{x:0,z:4,expires:Date.now()+16000}];updateCoop(r,.1,4000,noWall,()=>{});assert.equal(r.players.get('a').hp,930);
 r.players.delete('b');r.smokes=[];updateCoop(r,.1,6000,noWall,()=>{});assert.equal(r.players.get('a').hp,930,'requires two players');r.players.set('b',{position:{x:40,z:40},hp:0,alive:false});r.players.get('a').alive=false;updateCoop(r,.1,8000,noWall,()=>{});assert.equal(c.status,'failed');
});
test('all co-op spawns and terminals have valid shared collision; blast hits guards, not teammates',()=>{
 for(let i=0;i<MISSIONS.length;i++){const r=room(i),c=r.coop;for(const p of r.players.values())assert.equal(blocked(p.position.x,p.position.z,c.boxes),false);for(const step of MISSIONS[i].steps)assert.equal(blocked(...step.position,c.boxes),false);c.status='active';const g=c.guards[0];coopBlast(r,{x:g.x,z:g.z},'a',noWall,()=>{});assert.equal(g.hp,0);assert.equal(r.players.get('a').hp,1000);assert.equal(r.players.get('b').hp,1000);}
});
