import {test} from 'node:test';import assert from 'node:assert/strict';
import {reviveMessage,teammateMessage,interactionMessage,extractionMessage} from '../src/missionFeedback.js';
test('extraction guidance follows proximity, threats and living teammate readiness',()=>{
 const pad=[0,0],player={x:0,z:0},mate={x:8,z:0,alive:true};
 assert.match(extractionMessage({x:3,z:0},pad,[],mate,true),/MOVE INTO/);
 assert.match(extractionMessage(player,pad,[{x:3,z:0,hp:1},{x:2,z:0,hp:1}],mate,true),/CLEAR 2 NEARBY GUARDS/);
 assert.match(extractionMessage(player,pad,[],mate,true),/WAIT FOR YOUR TEAMMATE/);
 assert.match(extractionMessage(player,pad,[],{...mate,alive:false},true),/PRESS E/);
 assert.match(extractionMessage(player,pad,[],null,false),/PRESS E/);
 assert.match(extractionMessage(player,pad,[],null,true),/JOIN/);
});
test('revive progress describes the action from each player perspective',()=>{
 const state={remaining:2.4,targetId:'downed'};
 assert.match(reviveMessage(state,'downed'),/REVIVING YOU • 3s/);
 assert.match(reviveMessage(state,'rescuer'),/REVIVING TEAMMATE • 3s/);
 assert.match(reviveMessage(state,'rescuer'),/one injection/);
});
test('teammate guidance shows location and distinguishes a downed squadmate',()=>{
 const player={x:0,z:0};assert.equal(teammateMessage(player,{x:0,z:-10,alive:true}),'TEAMMATE • 10m N');
 assert.match(teammateMessage(player,{x:5,z:0,alive:false}),/TEAMMATE DOWN • 5m E.*one injection/);
});
test('mission interaction feedback explains the fix and handles unknown reasons',()=>{
 assert.match(interactionMessage('guards_nearby'),/CLEAR GUARDS/);
 assert.match(interactionMessage('team_not_at_extraction'),/BOTH LIVING PLAYERS/);
 assert.match(interactionMessage('revive_interrupted'),/AVOID DAMAGE/);
 assert.match(interactionMessage('unexpected'),/CHECK MISSION OBJECTIVE/);
});
