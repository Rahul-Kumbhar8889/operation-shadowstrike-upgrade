import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blocked} from '../shared/campaign.js';
import {findGuardCover,guardStep} from '../shared/guardTactics.js';
import {createCoop,updateCoop} from '../server/coop.js';

test('guards walk toward targets and do not cross thin obstacles',()=>{
 const wall=[[1,0,.2,3,4]],start={x:0,z:0};
 const straight=guardStep(start,{x:5,z:0},[],1);
 assert.equal(straight.x,1);
 const detour=guardStep(start,{x:5,z:0},wall,1);
 assert.ok(detour.x<.52);assert.ok(Math.abs(detour.z)>.5);assert.equal(blocked(detour.x,detour.z,wall),false);
 const large=guardStep(start,{x:5,z:0},wall,4);
 assert.ok(large.x<.52,'path sampling prevents crossing the wall');
});
test('cover is nearby, outside collision and on the opposite side from a threat',()=>{
 const boxes=[[0,0,2,3,2]],guard={x:2.4,z:2.4},threat={x:-5,z:0};
 const cover=findGuardCover(guard,threat,boxes);
 assert.ok(cover);assert.ok(cover.x>1);assert.equal(blocked(cover.x,cover.z,boxes),false);
 assert.equal(findGuardCover({x:30,z:30},threat,boxes),null);
});
test('wounded co-op guard chooses temporary cover using server state',()=>{
 const coop=createCoop(0);coop.status='active';coop.boxes=[[0,0,2,3,2]];
 coop.guards=[{id:0,x:2.4,z:2.4,homeX:2.4,homeZ:2.4,hp:50,rotation:0,phase:0,lastFire:0}];
 const player={position:{x:-5,z:0},alive:true,hp:1000},other={position:{x:40,z:40},alive:true,hp:1000};
 const room={coop,players:new Map([['a',player],['b',other]]),smokes:[]};
 updateCoop(room,.1,0,()=>Infinity,()=>{});
 assert.ok(coop.guards[0].coverTarget);assert.ok(coop.guards[0].coverUntil>coop.tick);
 assert.equal(blocked(coop.guards[0].x,coop.guards[0].z,coop.boxes),false);
});
