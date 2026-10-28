import {test} from 'node:test';import assert from 'node:assert/strict';
import {MISSIONS,objectiveSafe} from '../shared/campaign.js';
import {createCoop,interactCoop,updateCoop} from '../server/coop.js';
test('four operations contain distinct equipment mechanics with explicit task rules',()=>{
 const kinds=new Set(MISSIONS.flatMap(m=>m.steps.map(s=>s.kind)));
 assert.deepEqual([...kinds].sort(),['defend','download','plant','recover','switch']);
 for(const m of MISSIONS){assert.ok(m.steps.some(s=>s.kind==='defend'));for(const s of m.steps){assert.ok(s.hint.length>20);assert.ok(s.duration>0);}}
});
test('defense starts at equipment but permits fighting and moving inside the hold area',()=>{
 const index=0,c=createCoop(index);c.status='active';c.step=MISSIONS[index].steps.findIndex(s=>s.kind==='defend');const s=MISSIONS[index].steps[c.step], [x,z]=s.position;
 const p={position:{x,z},alive:true,hp:1000,kills:0,deaths:0};const room={coop:c,players:new Map([['a',p],['b',{...p,position:{x:x+20,z}}]]),smokes:[]};c.guards=[{id:0,x:x+5,z,homeX:x+5,homeZ:z,hp:100,phase:0,lastFire:0}];
 assert.ok(interactCoop(room,'a'),'nearby guard does not block defense');p.position={x:x+10,z};updateCoop(room,2,2000,()=>Infinity,()=>{});assert.equal(c.task.remaining,23);assert.equal(p.hp,930,'combat continues during hold');
 p.position={x:x+15,z};updateCoop(room,.1,2100,()=>Infinity,()=>{});assert.equal(c.task,null,'leaving defense radius cancels');assert.equal(c.step,2);
 assert.equal(objectiveSafe(s,{x:x+10,z},0,true),false,'cannot remotely begin hold');
});
test('downloads and collection remain interruptible and require close equipment access',()=>{
 for(const s of MISSIONS.flatMap(m=>m.steps).filter(s=>s.kind!=='defend')){const [x,z]=s.position;assert.ok(objectiveSafe(s,{x,z},0));assert.equal(objectiveSafe(s,{x,z},1),false);assert.equal(objectiveSafe(s,{x:x+3,z},0),false);}
});
test('co-op guards investigate loud weapons while suppressed fire preserves distance stealth',async()=>{
 const {alertCoopGuards}=await import('../server/coop.js');const c=createCoop(0);c.status='active';c.guards=[{id:0,x:30,z:0,homeX:30,homeZ:0,hp:100,phase:0,lastFire:0}];const room={coop:c,players:new Map([['a',{position:{x:0,z:0},hp:1000,alive:true}],['b',{position:{x:0,z:0},hp:1000,alive:true}]]),smokes:[]};
 alertCoopGuards(room,{x:0,z:0},12);assert.equal(c.guards[0].lastKnown,undefined);
 alertCoopGuards(room,{x:0,z:0},48);assert.deepEqual(c.guards[0].lastKnown,{x:0,z:0});updateCoop(room,1,1000,()=>Infinity,()=>{});assert.ok(c.guards[0].x<29,'guard investigates before gaining visual contact');
});
