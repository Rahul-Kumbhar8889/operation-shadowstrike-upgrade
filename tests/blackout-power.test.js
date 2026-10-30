import test from 'node:test';
import assert from 'node:assert/strict';
import {MISSIONS,checkpointGate,campaignObstacles,blocked,guardSightRange} from '../shared/campaign.js';
import {createCoop,interactCoopResult,updateCoop} from '../server/coop.js';

test('keycard recovery opens authoritative generator collision and restart locks it',()=>{
 const m=MISSIONS[1],gate=checkpointGate(m),c=createCoop(1);
 assert.ok(blocked(gate[0],gate[1],campaignObstacles(m)));
 assert.equal(blocked(gate[0],gate[1],campaignObstacles(m,1)),false);
 const [x,z]=m.steps[0].position;
 const player=()=>({alive:true,hp:1000,position:{x,z},equipment:{injection:3}});
 const room={coop:c,players:new Map([['a',player()],['b',player()]]),smokes:[]};
 c.status='active';c.guards.forEach(g=>g.hp=0);
 assert.equal(interactCoopResult(room,'a').ok,true);
 updateCoop(room,1.1,2000,()=>Infinity,()=>{});
 assert.equal(c.step,1);assert.equal(c.gateClosed,false);
 assert.equal(blocked(gate[0],gate[1],c.boxes),false);
 assert.equal(createCoop(1).gateClosed,true);
});

test('generator power reduces guard firing distance after completion',()=>{
 for(const step of [1,2]){
  const c=createCoop(1);c.status='active';c.step=step;c.boxes=[];
  c.guards=[{id:0,x:0,z:0,homeX:0,homeZ:0,hp:100,phase:0,lastFire:0}];
  const player=()=>({alive:true,hp:1000,position:{x:20,z:0},deaths:0});
  const room={coop:c,players:new Map([['a',player()],['b',player()]]),smokes:[]};
  const events=[];updateCoop(room,.1,2000,()=>Infinity,(name)=>events.push(name));
  assert.equal(events.includes('coop-guard-fired'),step===1);
 }
 assert.equal(guardSightRange(1,1),23);assert.equal(guardSightRange(1,2),18);
 assert.equal(guardSightRange(2,2),23);
});
