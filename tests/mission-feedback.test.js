import {test} from 'node:test';import assert from 'node:assert/strict';
import {reviveMessage,teammateMessage,interactionMessage} from '../src/missionFeedback.js';
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
